import { Injectable } from "@nestjs/common";
import { StorageService, UploadedFile as StorageUploadedFile } from "libs/modules/storage/storage.service";

@Injectable()
export class UploadFileService {
  constructor(private readonly storageService: StorageService) { }

  async uploadOneFile(
    files: StorageUploadedFile[],
    opts?: {
      folder?: string;
      addTimestampPrefix?: boolean;
    },
  ) {
    const folder = opts?.folder ?? 'uploads';

    const res = await this.storageService.uploadFile(files, folder, {
      addTimestampPrefix: opts?.addTimestampPrefix,
    });

    const first = (res as any[])[0];

    const originalUrl: string = first?.original;
    const thumbs: Record<string, string> | undefined = first?.thumbs;

    const thumbnailUrl: string | undefined =
      thumbs?.thumb || thumbs?.medium;

    return {
      url: originalUrl,
      thumbnailUrl: thumbnailUrl || undefined,
      thumbnails: thumbs || undefined,
    };
  }

  async deleteOneFile(url: string) {
    await this.storageService.deleteFile(url);
    return {
      success: true,
      message: "File deleted successfully",
      deletedUrl: url,
    };
  }
}