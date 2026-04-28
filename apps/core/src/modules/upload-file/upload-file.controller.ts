import { Body, FileTypeValidator, MaxFileSizeValidator, ParseFilePipe, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Auth } from "libs/utils";
import { ApiOperation } from "@nestjs/swagger/dist/decorators/api-operation.decorator";
import { ApiOkResponse, ApiResponse } from "@nestjs/swagger/dist/decorators/api-response.decorator";
import { ApiConsumes } from "@nestjs/swagger/dist/decorators/api-consumes.decorator";
import { ApiBody } from "@nestjs/swagger";
import { CoreControllers } from "libs/utils/decorators/controller-customer.decorator";
import { UploadedFile as StorageUploadedFile } from "libs/modules/storage/storage.service";
import { UploadFileService } from "./services/upload-file.service";
import { DeleteFileDto } from "./dto/delete-file.dto";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200MB

@CoreControllers({
  path: 'upload',
  tag: 'Upload File',
})
export class UploadFileController {
  constructor(
    private readonly uploadFileService: UploadFileService,
  ) { }

  private transformToStorageFile = (file: Express.Multer.File): StorageUploadedFile => ({
    fieldname: file.fieldname,
    originalName: file.originalname,
    encoding: file.encoding,
    mimetype: file.mimetype,
    destination: (file as any).destination ?? '',
    filename: file.filename,
    path: (file as any).path ?? '',
    size: file.size,
    buffer: file.buffer,
  });

  // Endpoint: POST /api/core/upload
  @Auth()
  @ApiOperation({ summary: "Upload one file to S3" })
  @ApiResponse({ status: 500, description: "Internal server error" })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiOkResponse({
    description: "Return one file url",
    schema: {
      example: {
        imageFile: {
          "data": {
            "url": "https://salon-step-bucket.s3.ap-southeast-1.amazonaws.com/uploads/1760605276729-amela.jpg",
            "thumbnailUrl": "https://salon-step-bucket.s3.ap-southeast-1.amazonaws.com/uploads/1760605276729-amela-thumb.jpg",
            "thumbnails": {
              "thumb": "https://salon-step-bucket.s3.ap-southeast-1.amazonaws.com/uploads/1760605276729-amela-thumb.jpg",
              "medium": "https://salon-step-bucket.s3.ap-southeast-1.amazonaws.com/uploads/1760605276729-amela-medium.jpg"
            }
          },
          "timestamp": "16/10/2025 16:01:17",
          "path": "/api/core/upload",
          "traceId": "6398a828-bad6-4b25-8f48-3da9639c7a0c"
        },
        nonImageFile: {
          "data": {
            "url": "https://salon-step-bucket.s3.ap-southeast-1.amazonaws.com/uploads/1760605276729-document.pdf"
          },
          "timestamp": "16/10/2025 16:01:17",
          "path": "/api/core/upload",
          "traceId": "6398a828-bad6-4b25-8f48-3da9639c7a0c"
        }
      }
    }
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadOne(
    @UploadedFile(new ParseFilePipe({
      // validators: [
      //   new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }), // 10MB
      // ],
      fileIsRequired: true,
    })) file: Express.Multer.File,
  ) {
    const files: StorageUploadedFile[] = [this.transformToStorageFile(file)];
    return this.uploadFileService.uploadOneFile(files);
  }

  // Endpoint: POST /api/core/upload/delete
  @Auth()
  @ApiOperation({ summary: "Delete one file from S3" })
  @ApiResponse({ status: 500, description: "Internal server error" })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiOkResponse({
    description: "Return one image url",
    schema: {
      example: {
        "data": {
          "success": true,
          "message": "File deleted successfully",
          "deletedUrl": "https://salon-step-bucket.s3.ap-southeast-1.amazonaws.com/1760605276729-amela.jpg",
        },
        "timestamp": "16/10/2025 16:01:17",
        "path": "/api/core/upload/delete",
        "traceId": "6398a828-bad6-4b25-8f48-3da9639c7a0c"
      }
    }
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', example: 'https://salon-step-bucket.s3.ap-southeast-1.amazonaws.com/1760605276729-amela.jpg' },
      },
      required: ['url'],
    },
  })
  @Post('delete')
  async deleteOne(
    @Body() body: DeleteFileDto,
  ) {
    return this.uploadFileService.deleteOneFile(body.url);
  }

  @Auth()
  @ApiOperation({ summary: "Upload one MP4 video (<= 200MB) to S3" })
  @ApiResponse({ status: 500, description: "Internal server error" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiOkResponse({
    description: "Return uploaded video url",
    schema: {
      example: {
        data: {
          url: "https://salon-step-bucket.s3.ap-southeast-1.amazonaws.com/uploads/1761019999999-demo.mp4",
        },
        timestamp: "21/10/2025 10:30:00",
        path: "/api/core/upload/video",
        traceId: "1c1f6b0f-aaaa-bbbb-cccc-1234567890ab",
      },
    },
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        video: { type: 'string', format: 'binary' },
      },
      required: ['video'],
    },
  })
  @Post('video')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('video', {
      limits: { fileSize: MAX_VIDEO_SIZE },
    }),
  )
  async uploadVideo(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_VIDEO_SIZE }), // 200MB
          new FileTypeValidator({ fileType: /(mp4)$/i })
        ],
        fileIsRequired: true,
      }),
    )
    video: Express.Multer.File,
  ) {
    const files: StorageUploadedFile[] = [this.transformToStorageFile(video)];
    return this.uploadFileService.uploadOneFile(files);
  }
}
