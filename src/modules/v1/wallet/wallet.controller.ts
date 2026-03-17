import { Body, Controller, Get, Post, Headers } from '@nestjs/common';
import { APIRes } from 'src/core/common/api-response';
import { Protected } from 'src/core/decorators/access.decorator';
import { LoggedInUser } from 'src/core/decorators/logged-in-decorator';
import { User } from '../users/entities/user.entity';
import { WalletService } from './wallet.service';

@Controller('v1/wallet')
export class WalletController {
    constructor(private readonly walletService: WalletService) { }

    @Get()
    @Protected()
    async getBalances(@LoggedInUser() user: User) {
        const balances = await this.walletService.getBalances(user.id);
        return APIRes(balances, 'Balances fetched successfully');
    }

    @Post('/fund')
    @Protected()
    async fundWallet(
        @LoggedInUser() user: User,
        @Body() body: { currency: string; amount: number },
        @Headers('x-idempotency-key') idempotencyKey?: string,
    ) {
        const result = await this.walletService.fundWallet(
            user.id,
            body.currency,
            body.amount,
            idempotencyKey,
        );
        return APIRes(result, result.message);
    }

    @Post('/convert')
    @Protected()
    async convertCurrency(
        @LoggedInUser() user: User,
        @Body() body: { fromCurrency: string; toCurrency: string; amount: number },
        @Headers('x-idempotency-key') idempotencyKey?: string,
    ) {
        const result = await this.walletService.convertCurrency(
            user.id,
            body.fromCurrency,
            body.toCurrency,
            body.amount,
            false,
            idempotencyKey,
        );
        return APIRes(result, result.message);
    }

    @Post('/trade')
    @Protected()
    async tradeCurrency(
        @LoggedInUser() user: User,
        @Body() body: { fromCurrency: string; toCurrency: string; amount: number },
        @Headers('x-idempotency-key') idempotencyKey?: string,
    ) {
        const result = await this.walletService.tradeCurrency(
            user.id,
            body.fromCurrency,
            body.toCurrency,
            body.amount,
            idempotencyKey,
        );
        return APIRes(result, result.message);
    }

    @Get('/transactions')
    @Protected()
    async getTransactionHistory(@LoggedInUser() user: User) {
        const transactions = await this.walletService.getTransactionHistory(user.id);
        return APIRes(transactions, 'Transaction history fetched successfully');
    }
}
