import { Module } from '@nestjs/common';
import { PaginationModule } from './common/pagination/pagination.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [DatabaseModule, PaginationModule],
  providers: [],
  exports: [DatabaseModule, PaginationModule],
})
export class CoreModule { }
