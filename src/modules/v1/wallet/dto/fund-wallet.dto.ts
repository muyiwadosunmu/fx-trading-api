import { Transform } from 'class-transformer';
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

  @IsNumber()
  @Min(500000, {
    message:
      'Minimum funding amount is 500000 of base values like kobo, pence, cents etc.',
  })
  amount: number;
}
