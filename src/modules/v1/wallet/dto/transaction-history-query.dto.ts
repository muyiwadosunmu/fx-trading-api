import { IsEnum, IsIn, IsOptional, IsDateString } from 'class-validator';
import { PaginationQueryDto } from 'src/core/common/pagination/dto/pagination-query.dto';
import { TransactionType } from '../entities/transaction.entity';

export class TransactionHistoryQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  order?: 'ASC' | 'DESC' | 'asc' | 'desc';
}
