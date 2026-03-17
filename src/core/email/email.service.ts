import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ZeptoMailService } from './zeptomail.service';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private emailAddress = 'test@FX-Trader.com';

  constructor(private readonly zeptoMail: ZeptoMailService) {}

  async sendOtp(email: string, firstName: string, otp: string): Promise<void> {
    const year = new Date().getFullYear();
    this.zeptoMail.sendEmail(
      { otp, firstName, year },
      {
        email,
        template: 'send_reset_otp',
        subject: `Password Reset 🔒 ${otp}`,
      },
    );
  }
  async sendLoginOTP(
    email: string,
    firstName: string,
    otp: string,
  ): Promise<void> {
    const year = new Date().getFullYear();
    this.zeptoMail.sendEmail(
      { otp, firstName, year },
      {
        email,
        template: 'send_login_otp',
        subject: `Login OTP 🔒 ${otp}`,
      },
    );
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    const year = new Date().getFullYear();
    this.zeptoMail.sendEmail(
      { firstName, year },
      {
        email,
        template: 'welcome_email',
        subject: 'Welcome to FX-Trader! 🚀',
      },
    );
  }

  async sendRegisterOTP(
    email: string,
    firstName: string,
    otp: string,
  ): Promise<void> {
    const year = new Date().getFullYear();
    this.zeptoMail.sendEmail(
      { otp, firstName, year },
      {
        email,
        template: 'send_otp',
        subject: `Verify Your Email 🔒 ${otp}`,
      },
    );
  }
}
