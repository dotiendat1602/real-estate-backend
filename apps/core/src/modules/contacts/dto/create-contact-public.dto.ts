import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateContactPublicDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsNotEmpty()
  @IsString()
  topic: string;

  @IsNotEmpty()
  @IsString()
  subject: string;

  @IsNotEmpty()
  @IsString()
  message: string;
}
