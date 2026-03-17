import { IsOptional, IsString } from 'class-validator';

export class PaginateQuery {
  @IsString()
  @IsOptional()
  search: string;

  @IsString()
  @IsOptional()
  sort: string;
}
