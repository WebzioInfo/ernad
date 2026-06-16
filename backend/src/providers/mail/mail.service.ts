import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD || process.env.SMTP_PASS,
      },
    });
  }

  private getFromAddress(defaultName: string = 'Ernad Factory Intelligence'): string {
    const fromName = process.env.SMTP_FROM_NAME || defaultName;
    const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
    return `"${fromName}" <${fromEmail}>`;
  }

  async sendWelcomeEmail(to: string, name: string, username: string, passOrPin: string) {
    const mailOptions = {
      from: this.getFromAddress(),
      to,
      subject: '📦 Identity Secured: Your Factory Access Credentials',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">Welcome to Ernad Collective</h2>
          <p style="color: #475569; font-size: 16px;">Hello <b>${name}</b>,</p>
          <p style="color: #475569;">Your professional identity has been successfully registered in the factory core systems. You can now access your station and the unified dashboard using the credentials below:</p>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><b>Identity Signature:</b> ${username}</p>
            <p style="margin: 5px 0;"><b>Access Credential:</b> ${passOrPin}</p>
          </div>

          <p style="color: #475569; font-size: 14px; background-color: #fffbeb; padding: 10px; border-radius: 6px; border-left: 4px solid #f59e0b;">
            <b>Security Note:</b> For security reasons, please change your credential after your first login into the Admin Dashboard.
          </p>

          <footer style="margin-top: 30px; font-size: 12px; color: #94a3b8; text-align: center;">
            &copy; 2026 Ernad Factory Intelligence Platform • High-Fidelity Infrastructure
          </footer>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Successfully dispatched welcome email to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${to}`, error);
    }
  }

  async sendAlert(to: string, subject: string, message: string) {
    const mailOptions = {
      from: this.getFromAddress('Factory Guardian'),
      to,
      subject: `🚨 System Alert: ${subject}`,
      text: message,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      this.logger.error(`Failed to send alert to ${to}`, error);
    }
  }

  async sendPasswordResetEmail(to: string, name: string, resetLink: string) {
    const mailOptions = {
      from: this.getFromAddress(),
      to,
      subject: '🔑 Password Reset Request',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">Password Reset Request</h2>
          <p style="color: #475569; font-size: 16px;">Hello <b>${name}</b>,</p>
          <p style="color: #475569;">We received a request to reset the password for your Ernad Collective account. You can reset your password by clicking the secure link below:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #3b82f6; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
          </div>

          <p style="color: #475569; font-size: 14px;">If the button above does not work, you can copy and paste the following link into your browser:</p>
          <p style="color: #3b82f6; font-size: 14px; word-break: break-all;">${resetLink}</p>

          <p style="color: #475569; font-size: 14px; background-color: #fffbeb; padding: 10px; border-radius: 6px; border-left: 4px solid #f59e0b;">
            <b>Security Note:</b> This password reset link will expire in 30 minutes. If you did not request a password reset, you can safely ignore this email.
          </p>

          <footer style="margin-top: 30px; font-size: 12px; color: #94a3b8; text-align: center;">
            &copy; 2026 ${process.env.SMTP_FROM_NAME || 'Ernad Collective'} • Secure Operations
          </footer>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Successfully dispatched password reset email to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${to}`, error);
    }
  }
}
