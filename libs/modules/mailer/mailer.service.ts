import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: String(process.env.SMTP_SECURE ?? 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  async sendOtp(to: string, otp: string) {
    const html = `
      <p>Here is your OTP:</p>
      <h2>${otp}</h2>
      <p>This code will expire in 5 minutes.</p>
    `;
    await this.transporter.sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject: 'Your OTP Code',
      html,
    });
  }

  async sendPasswordChangedNotice(email: string) {
    const html = `
      <p>Your password was changed sucessfully</p>
    `;
    await this.transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: email,
      subject: 'Notification',
      html,
    });
  }
}
