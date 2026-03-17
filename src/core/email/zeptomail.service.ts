import { Injectable, Logger } from '@nestjs/common';
import * as handlebars from 'handlebars';
import { SendMailClient } from 'zeptomail';
import * as fs from 'fs';
import * as path from 'path';

interface EmailOptions {
  email: string;
  template: string;
  name?: string;
  subject: string;
}

@Injectable()
export class ZeptoMailService {
  private readonly logger = new Logger(ZeptoMailService.name);
  private readonly url = 'api.zeptomail.com/';
  client: SendMailClient;

  constructor() {
    const token = process.env.ZEPTOMAIL_TOKEN;
    if (!token) {
      throw new Error(
        'ZEPTOMAIL_TOKEN is not defined in environment variables',
      );
    }
    this.client = new SendMailClient({ url: this.url, token });
  }

  async sendEmail(
    templateData: Record<string, unknown>,
    option: EmailOptions,
  ): Promise<void> {
    try {
      const filePath = this.getTemplatePath(option.template);

      if (!fs.existsSync(filePath)) {
        throw new Error(`Email template not found: ${filePath}`);
      }

      const templateSource = fs.readFileSync(filePath, 'utf8');
      const compiledTemplate = handlebars.compile(templateSource);
      const htmlContent = compiledTemplate(templateData);

      this.logger.log(`Sending email to: ${option.email}`);
      this.logger.debug(`Using template: ${option.template}`);

      const response = await this.client.sendMail({
        from: {
          address: 'test@flospay.com',
          name: 'Test',
        },
        to: [
          {
            email_address: {
              address: option.email,
              name: option.name || '',
            },
          },
        ],
        subject: option.subject,
        htmlbody: htmlContent,
      });

      this.logger.log(`Email sent successfully to ${option.email}`);
      return response;
    } catch (error) {
      console.error('Error sending email:', error);
      this.logger.error('Failed to send email', {
        error: error.message,
        stack: error.stack,
        recipient: option.email,
        template: option.template,
      });
      throw error;
    }
  }

  private getTemplatePath(template: string): string {
    const fileName = `${template}.handlebars`;
    const candidatePaths = [
      path.resolve(__dirname, 'templates', fileName),
      path.resolve(process.cwd(), 'dist/src/core/email/templates', fileName),
      path.resolve(process.cwd(), 'dist/core/email/templates', fileName),
      path.resolve(process.cwd(), 'src/core/email/templates', fileName),
    ];

    const existingPath = candidatePaths.find((candidate) =>
      fs.existsSync(candidate),
    );

    return existingPath || candidatePaths[0];
  }
}
