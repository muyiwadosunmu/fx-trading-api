import { Transform, Type } from 'class-transformer';
import { IsEnum, IsNumber, IsString, Min } from 'class-validator';
import { CurrencyCode } from 'src/modules/v1/fx/enums/currency.enum';

export class FundWalletDto {
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsEnum(CurrencyCode, {
    message: 'currency is not supported by configured FX provider',
  })
  currency: CurrencyCode;

  @Transform(({ value }) => value)
  @Type(() => Number)
  @IsNumber({}, { message: 'amountMinor must be a number in minor units' })
  @Min(500000, {
    message: 'Minimum funding amount is 500000 minor units (kobo/cents/pence)',
  })
  amountMinor: number;
}
