import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from 'src/core/common/pagination/dto/pagination-query.dto';

export class ListUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  order?: 'ASC' | 'DESC' | 'asc' | 'desc';
}
