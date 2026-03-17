import {
  Body,
  Controller,
  Get,
  Post,
  Headers,
  Param,
  Query,
} from '@nestjs/common';
import { APIRes } from 'src/core/common/api-response';
import { Protected } from 'src/core/decorators/access.decorator';
import { LoggedInUser } from 'src/core/decorators/logged-in-decorator';
import { User } from '../users/entities/user.entity';
import { WalletService } from './wallet.service';
import { ConvertCurrencyDto } from './dto/convert-currency.dto';
import {
  ConversionQuoteBodyDto,
  ConversionQuoteQueryDto,
} from './dto/conversion-quote-query.dto';
import { FundWalletDto } from './dto/fund-wallet.dto';
import { TradeCurrencyDto } from './dto/trade-currency.dto';
import { TransactionHistoryQueryDto } from './dto/transaction-history-query.dto';
import { TransferFundsDto } from './dto/transfer-funds.dto';

@Controller('v1/wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @Protected()
  async getBalances(@LoggedInUser() user: User) {
    const balances = await this.walletService.getBalances(user.id);
    return APIRes(balances, 'Balances fetched successfully');
  }

  @Post('fund')
  @Protected()
  async fundWallet(
    @LoggedInUser() user: User,
    @Body() body: FundWalletDto,
    @Headers('x-idempotency-key') idempotencyKey: string,
  ) {
    const result = await this.walletService.fundWallet(
      user.id,
      body.currency,
      body.amountMinor,
      idempotencyKey,
    );
    return APIRes(result, result.message);
  }

  @Post('convert')
  @Protected()
  async convertCurrency(
    @LoggedInUser() user: User,
    @Body() body: ConvertCurrencyDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    const result = await this.walletService.convertCurrency(
      user.id,
      body.fromCurrency,
      body.toCurrency,
      body.amountMinor,
      false,
      idempotencyKey,
    );
    return APIRes(result, result.message);
  }

  @Post('trade')
  @Protected()
  async tradeCurrency(
    @LoggedInUser() user: User,
    @Body() body: TradeCurrencyDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    const result = await this.walletService.tradeCurrency(
      user.id,
      body.fromCurrency,
      body.toCurrency,
      body.amountMinor,
      idempotencyKey,
    );
    return APIRes(result, result.message);
  }

  @Post('transfer')
  @Protected()
  async transferFunds(
    @LoggedInUser() user: User,
    @Body() body: TransferFundsDto,
    @Headers('x-idempotency-key') idempotencyKey: string,
  ) {
    const result = await this.walletService.transferFunds(
      user.id,
      body,
      idempotencyKey,
    );
    return APIRes(result, result.message);
  }

  @Get('quote')
  @Protected()
  async getQuote(
    @Query() query: ConversionQuoteQueryDto,
    @Body() body: ConversionQuoteBodyDto,
  ) {
    const data = await this.walletService.getConversionQuote(
      query.fromCurrency,
      query.toCurrency,
      body.amountMinor,
    );
    return APIRes(data, 'Quote fetched successfully');
  }

  @Get('transactions')
  @Protected()
  async getTransactionHistory(
    @LoggedInUser() user: User,
    @Query() query: TransactionHistoryQueryDto,
  ) {
    const transactions = await this.walletService.getTransactionHistory(
      user.id,
      query,
    );
    return APIRes(transactions, 'Transaction history fetched successfully');
  }

  @Get('transactions/:id')
  @Protected()
  async getSingleTransaction(
    @LoggedInUser() user: User,
    @Param('id') id: string,
  ) {
    const transaction = await this.walletService.getTransactionById(
      user.id,
      id,
    );
    return APIRes(transaction, 'Transaction fetched successfully');
  }
}
