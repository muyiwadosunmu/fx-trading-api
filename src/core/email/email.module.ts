import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { ZeptoMailService } from './zeptomail.service';

@Module({
  providers: [EmailService, ZeptoMailService],
  exports: [EmailService, ZeptoMailService],
})
export class EmailModule {}
