import { HttpStatus, Injectable } from '@nestjs/common';
import { OtpPurpose, RoleType, User } from '@prisma/client';
import { PrismaService } from 'libs/modules/prisma/prisma.service';
import { ErrorCode } from 'libs/utils/enum';
import { ApiException } from 'libs/utils/exception';
import { generateHash, validateHash } from 'libs/utils/util';
import { CoreUserLoginDto } from '../dto/login.dto';
import { CoreUserRegisterDto } from '../dto/register.dto';
import { TokenService } from './token.service';
import { RequestOtpDto } from '../dto/request-otp.dto';
import { MailerService } from 'libs/modules/mailer/mailer.service';
import * as bcrypt from 'bcryptjs'
import { VerifyOtpDto } from '../dto/verify-otp.dto';
import { randomBytes, randomInt } from 'crypto';
import { ResetPasswordDto } from '../dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly tokenService: TokenService,
    private readonly prismaService: PrismaService,
    private readonly mailerService: MailerService,
  ) { }

  private readonly OTP_TTL_MS = 5 * 60 * 1000; // 5 phút
  private readonly OTP_COOLDOWN_MS = 30 * 1000;
  private readonly RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
  private readonly MAX_ATTEMPTS = 5;

  private generateNumericOtp(length = 6) {
    let s = '';
    for (let i = 0; i < length; i++) s += randomInt(0, 10);
    return s;
  }


  async getUserByEmail(email: string) {
    return this.prismaService.user.findFirst({ where: { email } });
  }

  async register(
    body: CoreUserRegisterDto,
    optional?: {
      isAdmin?: boolean;
    },
  ) {
    const existingUser = await this.getUserByEmail(body.email);

    if (existingUser) {
      throw new ApiException(
        'User existing',
        HttpStatus.BAD_REQUEST,
        ErrorCode.INVALID_INPUT,
      );
    }

    const hashedPassword = generateHash(body.password);

    const role = await this.prismaService.role.findFirst({
      where: {
        name: body.role as RoleType,
      }
    });
    if (!role) {
      throw new ApiException(`Database doesn't have role ${body.role}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const newUser = await this.prismaService.user.create({
      data: {
        name: body.name,
        email: body.email,
        password: hashedPassword,
        roleId: role.id,
      },
    });

    return this.tokenService.signToken(newUser);
  }

  async login(body: CoreUserLoginDto) {
    const user = await this.getUserByEmail(body.email);

    if (!user) {
      throw new ApiException(
        'User not found',
        HttpStatus.NOT_FOUND,
        ErrorCode.INVALID_INPUT,
      );
    }

    const isMatchPassword = await validateHash(body.password, user.password);

    if (!isMatchPassword) {
      throw new ApiException(
        'Email or password not matching',
        HttpStatus.NOT_FOUND,
        ErrorCode.INVALID_INPUT,
      );
    }

    await this.prismaService.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const token = await this.tokenService.signToken(user);
    return {
      ...token,
      role: (await this.prismaService.role.findUnique({ where: { id: user.roleId } }))?.name,
    }
  }

  async requestOtp(body: RequestOtpDto) {
    const { email } = body;

    const user = await this.getUserByEmail(email);

    if (!user) {
      throw new ApiException(
        `If the account exists, we've sent an email`,
        HttpStatus.NOT_FOUND,
        ErrorCode.INVALID_INPUT,
      );
    }

    // Cooldown: chỉ cho phép gửi lại sau OTP_COOLDOWN_MS
    const lastOtp = await this.prismaService.otp.findFirst({
      where: {
        userId: user.id,
        purpose: OtpPurpose.RESET_PASSWORD,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (lastOtp && Date.now() - lastOtp.createdAt.getTime() < this.OTP_COOLDOWN_MS) {
      return {
        ok: false,
        message: "Không được gửi lại OTP trong thời gian 30s kể từ lần gửi trước đó"
      };
    }

    const otp = this.generateNumericOtp(6);
    const codeHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + this.OTP_TTL_MS);

    try {
      await this.prismaService.$transaction(async (prisma) => {
        await prisma.otp.deleteMany({
          where: {
            userId: user.id,
            purpose: OtpPurpose.RESET_PASSWORD,
          }
        })
        await prisma.otp.create({
          data: {
            userId: user.id,
            code: codeHash,
            expireTime: expiresAt,
            purpose: OtpPurpose.RESET_PASSWORD,
          },
        });
      });

      // Gửi email
      await this.mailerService.sendOtp(email, otp);
      return { ok: true, message: 'OTP sent' };
    } catch (error) {
      throw new ApiException(
        `Error sending otp: ${error.message}`,
      )
    }
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const { email, otp } = dto;
    const user = await this.getUserByEmail(email);
    if (!user) {
      throw new ApiException(
        `User not found`,
        HttpStatus.NOT_FOUND,
        ErrorCode.INVALID_INPUT,
      )
    }
    const record = await this.prismaService.otp.findFirst({
      where: {
        userId: user.id,
        purpose: OtpPurpose.RESET_PASSWORD,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    if (!record) {
      throw new ApiException(
        `Invalid or expired OTP`,
        HttpStatus.UNAUTHORIZED,
        ErrorCode.INVALID_INPUT,
      );
    }

    // Hết hạn
    if (record.expireTime < new Date()) {
      // dọn dẹp trước
      await this.prismaService.otp.delete({
        where:
        {
          id: record.id,
          purpose: OtpPurpose.RESET_PASSWORD,
        }
      }).catch(() => { });
      throw new ApiException(
        `OTP expired`,
        HttpStatus.UNAUTHORIZED,
        ErrorCode.INVALID_INPUT,
      );
    }

    // Vượt ngưỡng
    if (record.attempts >= this.MAX_ATTEMPTS) {
      await this.prismaService.otp.delete({
        where:
        {
          id: record.id,
          purpose: OtpPurpose.RESET_PASSWORD,
        }
      }).catch(() => { });
      throw new ApiException(
        `Too many attempts`,
        HttpStatus.UNAUTHORIZED,
        ErrorCode.INVALID_INPUT,
      );
    }

    const ok = await bcrypt.compare(otp, record.code);
    if (!ok) {
      const updated = await this.prismaService.otp.updateMany({
        where: { id: record.id, attempts: { lt: this.MAX_ATTEMPTS } },
        data: { attempts: { increment: 1 } },
      });

      if (!updated.count) {
        // đã chạm ngưỡng
        await this.prismaService.otp
          .delete({ where: { id: record.id } })
          .catch(() => { });
        throw new ApiException(
          'Too many attempts',
          HttpStatus.UNAUTHORIZED,
          ErrorCode.INVALID_INPUT,
        );
      }
      throw new ApiException('Invalid OTP', HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_INPUT);
    }

    // Thành công → xóa OTP (one-time)
    await this.prismaService.otp.delete({
      where:
      {
        id: record.id,
        purpose: OtpPurpose.RESET_PASSWORD,
      }
    }).catch(() => { });

    // Tạo token reset -> Reset password
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = generateHash(rawToken);
    const expiresAt = new Date(Date.now() + this.RESET_TOKEN_TTL_MS);

    await this.prismaService.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return { ok: true, resetToken: rawToken, expiresInSec: this.RESET_TOKEN_TTL_MS / 1000 };
  }

  async resetPassword(body: ResetPasswordDto) {
    const candidates = await this.prismaService.passwordResetToken.findMany({
      where: { usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 50, // hạn chế scan
    });

    // Tìm token trùng
    let tokenRow = null as null | (typeof candidates)[number];
    for (const row of candidates) {
      const match = await validateHash(body.resetToken, row.tokenHash);
      if (match) {
        tokenRow = row;
        break;
      }
    }
    if (!tokenRow) {
      throw new ApiException(
        `Invalid or expired reset token`,
        HttpStatus.UNAUTHORIZED,
        ErrorCode.INVALID_INPUT,
      )
    }

    const passwordHash = generateHash(body.newPassword);
    await this.prismaService.$transaction(async (prisma) => {
      // đổi mật khẩu
      await prisma.user.update({
        where: { id: tokenRow!.userId },
        data: { password: passwordHash },
      });

      // Đánh dấu token đã dùng
      await prisma.passwordResetToken.update({
        where: { id: tokenRow!.id },
        data: { usedAt: new Date() },
      });

      // vô hiệu hóa các token khác còn hạn của cùng user
      await prisma.passwordResetToken.updateMany({
        where: {
          userId: tokenRow!.userId,
          usedAt: null,
          expiresAt: { gt: new Date() },
          NOT: { id: tokenRow.id },
        },
        data: { usedAt: new Date() },
      });
    });

    // (khuyên) gửi email thông báo đổi mật khẩu thành công
    try {
      const user = await this.prismaService.user.findUnique({ where: { id: tokenRow.userId } });
      if (user?.email) {
        await this.mailerService.sendPasswordChangedNotice(user.email);
      }
    } catch {
      // không fail flow nếu email notice lỗi
    }

    return { ok: true, message: 'Password has been reset successfully' };
  }

  async generateNewToken(user: User, isAccessToken = false) {
    return this.tokenService.signToken(user, isAccessToken);
  }
}
