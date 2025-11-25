import { Injectable, InternalServerErrorException } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { S3 } from 'aws-sdk';
import { createReadStream } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';

export interface UploadedFile {
  fieldname: string;
  originalName: string;
  encoding: string;
  mimetype: string;
  destination: string;
  filename: string;
  path: string;
  size: number;
  buffer?: Buffer;
}

interface ThumbSize {
  width: number;
  height: number;
  suffix: string;
}

@Injectable()
export class StorageService {
  private readonly s3: S3;
  private readonly thumbSizes: ThumbSize[] = [
    { width: 150, height: 150, suffix: 'thumb' },
    { width: 300, height: 300, suffix: 'medium' },
  ];

  constructor(private configService: ConfigService) {
    this.s3 = new S3({
      accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      region: this.configService.get<string>('AWS_REGION'),
    });
  }

  async uploadFile(
    files: UploadedFile[],
    folder: string = 'uploads',
    options?: {
      addTimestampPrefix?: boolean;
    },
  ): Promise<
    string[] | { original: string; thumbs?: { [key: string]: string } }[]
  > {
    try {
      const bucket = this.configService.get('AWS_S3_BUCKET');
      // Missing AWS_S3_BUCKET env
      if (!bucket) throw new Error('AWS_S3_BUCKET 環境変数が設定されていません');

      const addTimestamp = options?.addTimestampPrefix !== false;
      const results: {
        original: string;
        thumbs?: { [key: string]: string }
      }[] = [];

      for (const file of files) {
        const baseName = file.filename || file.originalName;
        const finalName = addTimestamp ? `${Date.now()}-${baseName}` : baseName;
        const key = `${folder}/${finalName}`;
        const uploadParams = {
          Bucket: bucket,
          Key: key,
          Body: file.buffer || createReadStream(file.path),
          ContentType: file.mimetype,
        };

        const result = await this.s3.upload(uploadParams).promise();

        if (file.mimetype.startsWith('image/')) {
          const thumbUrls = await this.generateAndUploadThumbnails(
            file,
            key,
            bucket,
          );
          results.push({
            original: result.Location,
            thumbs: thumbUrls,
          });
        } else {
          results.push({
            original: result.Location,
          });
        }
      }

      return results;
    } catch (error) {
      // Failed to upload file
      throw new InternalServerErrorException(
        `ファイルのアップロードに失敗しました: ${error.message}`,
      );
    }
  }

  private async generateAndUploadThumbnails(
    file: UploadedFile,
    originalKey: string,
    bucket: string,
  ): Promise<{ [key: string]: string }> {
    const thumbUrls: { [key: string]: string } = {};
    const keyParts = originalKey.split('.');
    const extension = keyParts.pop();
    const baseKey = keyParts.join('.');

    for (const size of this.thumbSizes) {
      const thumbBuffer = await sharp(file.buffer)
        .resize(size.width, size.height, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .toBuffer();

      const thumbKey = `${baseKey}-${size.suffix}.${extension}`;
      const uploadParams = {
        Bucket: bucket,
        Key: thumbKey,
        Body: thumbBuffer,
        ContentType: file.mimetype,
        // ACL: 'public-read',
      };

      const result = await this.s3.upload(uploadParams).promise();
      thumbUrls[size.suffix] = result.Location;
    }

    return thumbUrls;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      const bucket = this.configService.get<string>('AWS_S3_BUCKET');
      if (!bucket) {
        // AWS S3 bucket not configured
        throw new InternalServerErrorException('AWS S3 バケットが設定されていません');
      }

      const key = this.getObjectKeyFromUrl(fileUrl);
      await this.s3
        .deleteObject({
          Bucket: bucket,
          Key: key,
        })
        .promise();

      // Try to delete thumbnails if they exist
      const keyParts = key.split('.');
      const extension = keyParts.pop();
      const baseKey = keyParts.join('.');

      for (const size of this.thumbSizes) {
        try {
          await this.s3
            .deleteObject({
              Bucket: bucket,
              Key: `${baseKey}-${size.suffix}.${extension}`,
            })
            .promise();
        } catch (error) {
          // Ignore errors when deleting thumbnails
          console.warn(`Failed to delete thumbnail: ${error.message}`);
        }
      }
    } catch (error) {
      throw new InternalServerErrorException(
        // Failed to delete file
        `ファイルの削除に失敗しました: ${error.message}`,
      );
    }
  }

  private getObjectKeyFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return decodeURIComponent(urlObj.pathname.slice(1));
    } catch (error) {
      // Invalid S3 URL
      throw new InternalServerErrorException('無効なS3 URL');
    }
  }

  async uploadBase64(
    base64Data: string,
    folder: string = 'uploads',
  ): Promise<string> {
    try {
      const bucket = this.configService.get('AWS_S3_BUCKET');

      // Extract the MIME type and base64 content
      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

      if (!matches || matches.length !== 3) {
        throw new InternalServerErrorException('Invalid base64 data');
      }

      const mimeType = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');

      // Generate a unique filename
      const extension = mimeType.split('/')[1];
      const filename = `${uuidv4()}.${extension}`;
      const key = `${folder}/${filename}`;

      const uploadParams = {
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ContentEncoding: 'base64',
      };

      const result = await this.s3.upload(uploadParams).promise();
      return result.Location;
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to upload base64 file: ${error.message}`,
      );
    }
  }
}
