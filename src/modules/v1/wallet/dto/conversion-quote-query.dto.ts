import { Transform, Type } from 'class-transformer';
import { IsEnum, IsNumber, IsString, Min } from 'class-validator';
import { CurrencyCode } from 'src/modules/v1/fx/enums/currency.enum';

export class ConversionQuoteQueryDto {
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

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  amount: number;
}
