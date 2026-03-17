import { Module } from '@nestjs/common';
import { PaginationModule } from './common/pagination/pagination.module';
import { DatabaseModule } from './database/database.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [DatabaseModule, PaginationModule, EmailModule],
  providers: [],
  exports: [DatabaseModule, PaginationModule, EmailModule],
})
export class CoreModule {}
