import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsInt, Min } from 'class-validator';
import { CurrencyCode } from 'src/modules/v1/fx/enums/currency.enum';

export class TransferFundsDto {
  @IsEmail()
  recipientEmail: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsEnum(CurrencyCode, {
    message: 'currency is not supported by configured FX provider',
  })
  currency: CurrencyCode;

  @IsInt()
  @Min(1000, {
    message: 'Minimum transfer amount is 1000 of actual currency e.g `',
  })
  amount: number;
}
