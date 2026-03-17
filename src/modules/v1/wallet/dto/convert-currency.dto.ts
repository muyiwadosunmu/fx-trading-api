import { Transform, Type } from 'class-transformer';
import { IsEnum, IsNumber, IsString, Min } from 'class-validator';
import { CurrencyCode } from 'src/modules/v1/fx/enums/currency.enum';

export class ConvertCurrencyDto {
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsEnum(CurrencyCode, {
    message: 'fromCurrency is not supported by configured FX provider',
  })
  fromCurrency: CurrencyCode;

  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsEnum(CurrencyCode, {
    message: 'toCurrency is not supported by configured FX provider',
  })
  toCurrency: CurrencyCode;

  @Transform(({ value }) => value)
  @Type(() => Number)
  @IsNumber({}, { message: 'amountMinor must be a number in minor units' })
  @Min(100)
  amountMinor: number;
}
