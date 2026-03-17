import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { Transaction, TransactionType } from './entities/transaction.entity';
import { User } from '../users/entities/user.entity';
import { FxService } from '../fx/fx.service';

@Injectable()
export class WalletService {
    constructor(
        @InjectRepository(Wallet)
        private readonly walletRepository: Repository<Wallet>,
        @InjectRepository(Transaction)
        private readonly transactionRepository: Repository<Transaction>,
        private readonly fxService: FxService,
        private readonly dataSource: DataSource,
    ) { }

    async getBalances(userId: string) {
        return this.walletRepository.find({
            where: { user: { id: userId } },
        });
    }

    async fundWallet(userId: string, currency: string, amount: number, idempotencyKey?: string) {
        if (amount <= 0) {
            throw new BadRequestException('Amount must be greater than zero');
        }

        if (idempotencyKey) {
            const existingTx = await this.transactionRepository.findOne({ where: { idempotencyKey } });
            if (existingTx) {
                return { message: 'Transaction already processed', transaction: existingTx };
            }
        }

        currency = currency.toUpperCase();

        let wallet = await this.walletRepository.findOne({
            where: { user: { id: userId }, currency },
        });

        if (!wallet) {
            wallet = this.walletRepository.create({
                user: { id: userId } as User,
                currency,
                balance: 0,
            });
        }

        const currentBalance = Number(wallet.balance) || 0;
        wallet.balance = currentBalance + amount;

        await this.walletRepository.save(wallet);

        const transaction = this.transactionRepository.create({
            user: { id: userId } as User,
            type: TransactionType.FUND,
            toCurrency: currency,
            amount,
            status: 'SUCCESS',
            idempotencyKey,
        });

        await this.transactionRepository.save(transaction);

        return {
            message: 'Wallet funded successfully',
            wallet,
            transaction,
        };
    }

    async convertCurrency(userId: string, fromCurrency: string, toCurrency: string, amount: number, isTrade: boolean = false, idempotencyKey?: string) {
        if (amount <= 0) {
            throw new BadRequestException('Amount must be greater than zero');
        }

        fromCurrency = fromCurrency.toUpperCase();
        toCurrency = toCurrency.toUpperCase();

        if (fromCurrency === toCurrency) {
            throw new BadRequestException('Cannot convert to the same currency');
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            if (idempotencyKey) {
                const existingTx = await queryRunner.manager.findOne(Transaction, { where: { idempotencyKey } });
                if (existingTx) {
                    await queryRunner.rollbackTransaction();
                    return { message: 'Transaction already processed', transaction: existingTx };
                }
            }

            const rate = await this.fxService.getExchangeRate(fromCurrency, toCurrency);
            const convertedAmount = amount * rate;

            // Lock the source wallet row to prevent concurrent spending
            let sourceWallet = await queryRunner.manager.findOne(Wallet, {
                where: { user: { id: userId }, currency: fromCurrency },
                lock: { mode: 'pessimistic_write' },
            });

            if (!sourceWallet || Number(sourceWallet.balance) < amount) {
                throw new BadRequestException(`Insufficient balance in ${fromCurrency} wallet`);
            }

            // Lock or create destination wallet
            let destWallet = await queryRunner.manager.findOne(Wallet, {
                where: { user: { id: userId }, currency: toCurrency },
                lock: { mode: 'pessimistic_write' },
            });

            if (!destWallet) {
                destWallet = queryRunner.manager.create(Wallet, {
                    user: { id: userId } as User,
                    currency: toCurrency,
                    balance: 0,
                });
            }

            sourceWallet.balance = Number(sourceWallet.balance) - amount;
            destWallet.balance = Number(destWallet.balance) + convertedAmount;

            await queryRunner.manager.save(sourceWallet);
            await queryRunner.manager.save(destWallet);

            const transactionType = isTrade ? TransactionType.TRADE : TransactionType.CONVERT;

            const transaction = queryRunner.manager.create(Transaction, {
                user: { id: userId } as User,
                type: transactionType,
                fromCurrency,
                toCurrency,
                amount: convertedAmount, // Storing what they received, could also store source amount
                rate,
                status: 'SUCCESS',
                idempotencyKey,
            });

            await queryRunner.manager.save(transaction);

            await queryRunner.commitTransaction();

            return {
                message: `${isTrade ? 'Trade' : 'Conversion'} successful`,
                fromCurrency,
                toCurrency,
                amountDeducted: amount,
                amountReceived: convertedAmount,
                rate,
                transaction,
            };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async tradeCurrency(userId: string, fromCurrency: string, toCurrency: string, amount: number, idempotencyKey?: string) {
        return this.convertCurrency(userId, fromCurrency, toCurrency, amount, true, idempotencyKey);
    }

    async getTransactionHistory(userId: string) {
        return this.transactionRepository.find({
            where: { user: { id: userId } },
            order: { timestamp: 'DESC' },
        });
    }
}
