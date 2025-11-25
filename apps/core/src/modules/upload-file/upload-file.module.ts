import { Module } from "@nestjs/common";
import { UploadFileController } from "./upload-file.controller";
import { UploadFileService } from "./services/upload-file.service";
import { StorageModule } from "libs/modules/storage/storage.module";

@Module({
  imports: [StorageModule],
  controllers: [UploadFileController],
  providers: [UploadFileService],
  exports: [UploadFileService],
})
export class UploadFileModule { }