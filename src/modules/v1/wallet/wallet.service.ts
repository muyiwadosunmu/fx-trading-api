import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Paginated } from 'src/core/common/pagination/interfaces/paginated.interfaces';
import { PaginationProvider } from 'src/core/common/pagination/providers/pagination.provider';
import {
  Between,
  DataSource,
  FindOptionsOrder,
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { Transaction, TransactionType } from './entities/transaction.entity';
import { User } from '../users/entities/user.entity';
import { FxService } from '../fx/fx.service';
import { TransactionHistoryQueryDto } from './dto/transaction-history-query.dto';

@Injectable()
export class WalletService {
  private readonly RATE_SCALE = 1_000_000;
  private readonly BPS_BASE = 10_000;

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly paginationProvider: PaginationProvider,
    private readonly fxService: FxService,
    private readonly dataSource: DataSource,
  ) {}

  async getBalances(userId: string) {
    return this.walletRepository.find({
      where: { user: { id: userId } },
    });
  }

  async fundWallet(
    userId: string,
    currency: string,
    amount: number,
    idempotencyKey: string,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    if (!idempotencyKey || !idempotencyKey.trim()) {
      throw new BadRequestException(
        'x-idempotency-key header is required for funding',
      );
    }

    const existingTx = await this.transactionRepository.findOne({
      where: { idempotencyKey },
    });
    if (existingTx) {
      return {
        message: 'Transaction already processed',
        transaction: existingTx,
      };
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

  async convertCurrency(
    userId: string,
    fromCurrency: string,
    toCurrency: string,
    amount: number,
    isTrade = false,
    idempotencyKey?: string,
  ) {
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
        const existingTx = await queryRunner.manager.findOne(Transaction, {
          where: { idempotencyKey },
        });
        if (existingTx) {
          await queryRunner.rollbackTransaction();
          return {
            message: 'Transaction already processed',
            transaction: existingTx,
          };
        }
      }

      const rate = await this.fxService.getExchangeRate(
        fromCurrency,
        toCurrency,
      );
      const quote = this.buildFxQuote(amount, rate);
      const convertedAmount = quote.netAmountMinor;

      // Lock the source wallet row to prevent concurrent spending
      const sourceWallet = await queryRunner.manager.findOne(Wallet, {
        where: { user: { id: userId }, currency: fromCurrency },
        lock: { mode: 'pessimistic_write' },
      });

      if (!sourceWallet || Number(sourceWallet.balance) < amount) {
        throw new BadRequestException(
          `Insufficient balance in ${fromCurrency} wallet`,
        );
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

      const transactionType = isTrade
        ? TransactionType.TRADE
        : TransactionType.CONVERT;

      const transaction = queryRunner.manager.create(Transaction, {
        user: { id: userId } as User,
        type: transactionType,
        fromCurrency,
        toCurrency,
        amount: convertedAmount,
        rate: quote.effectiveRate,
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
        rate: quote.effectiveRate,
        quote,
        transaction,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async tradeCurrency(
    userId: string,
    fromCurrency: string,
    toCurrency: string,
    amount: number,
    idempotencyKey?: string,
  ) {
    return this.convertCurrency(
      userId,
      fromCurrency,
      toCurrency,
      amount,
      true,
      idempotencyKey,
    );
  }

  async getConversionQuote(
    fromCurrency: string,
    toCurrency: string,
    amount: number,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    if (from === to) {
      throw new BadRequestException('Cannot quote same currency conversion');
    }

    const rate = await this.fxService.getExchangeRate(from, to);
    const quote = this.buildFxQuote(amount, rate);

    return {
      fromCurrency: from,
      toCurrency: to,
      amount,
      rate: quote.effectiveRate,
      convertedAmount: quote.netAmountMinor,
      quote,
      quotedAt: new Date().toISOString(),
    };
  }

  private buildFxQuote(amountMinor: number, marketRate: number) {
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      throw new BadRequestException(
        'Amount must be a positive integer in minor units',
      );
    }

    const spreadBps = this.parseBps(process.env.FX_SPREAD_BPS, 0);
    const feeBps = this.parseBps(process.env.FX_FEE_BPS, 0);
    const scaledRate = Math.floor(marketRate * this.RATE_SCALE);

    if (scaledRate <= 0) {
      throw new BadRequestException('Invalid exchange rate received');
    }

    const sourceAmount = amountMinor;
    const gross = Math.floor((sourceAmount * scaledRate) / this.RATE_SCALE);
    const spreadAmount = Math.floor((gross * spreadBps) / this.BPS_BASE);
    const feeAmount = Math.floor((gross * feeBps) / this.BPS_BASE);
    const net = gross - spreadAmount - feeAmount;
    const roundingRemainder = (sourceAmount * scaledRate) % this.RATE_SCALE;

    if (net <= 0) {
      throw new BadRequestException(
        'Conversion amount is too small after rounding and fees',
      );
    }

    const netAmountMinor = this.ensureSafeInteger(net);

    return {
      sourceAmountMinor: amountMinor,
      grossAmountMinor: this.ensureSafeInteger(gross),
      spreadBps,
      spreadAmountMinor: this.ensureSafeInteger(spreadAmount),
      feeBps,
      feeAmountMinor: this.ensureSafeInteger(feeAmount),
      netAmountMinor,
      // Flooring happens during scaled integer division; remainder is audit data.
      roundingRemainderScaled: this.ensureSafeInteger(roundingRemainder),
      rateScale: this.RATE_SCALE,
      marketRate,
      effectiveRate: netAmountMinor / amountMinor,
    };
  }

  private parseBps(value: string | undefined, fallback: number): number {
    const parsed = Number(value ?? fallback);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 5000) {
      throw new BadRequestException('Invalid FX bps configuration');
    }
    return Math.floor(parsed);
  }

  private ensureSafeInteger(value: number): number {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new BadRequestException('Invalid computed amount');
    }
    if (value > Number.MAX_SAFE_INTEGER) {
      throw new BadRequestException('Amount exceeds safe processing range');
    }
    return value;
  }

  async getTransactionHistory(
    userId: string,
    query: TransactionHistoryQueryDto,
  ): Promise<Paginated<Transaction>> {
    const { type, startDate, endDate, page = 1, limit = 10 } = query;
    const direction =
      (query.order || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const filters: FindOptionsWhere<Transaction> = {
      user: { id: userId },
    };

    if (type) {
      filters.type = type;
    }

    if (startDate && endDate) {
      filters.timestamp = Between(new Date(startDate), new Date(endDate));
    } else if (startDate) {
      filters.timestamp = MoreThanOrEqual(new Date(startDate));
    } else if (endDate) {
      filters.timestamp = LessThanOrEqual(new Date(endDate));
    }

    const order: FindOptionsOrder<Transaction> = { timestamp: direction };

    return this.paginationProvider.paginateQuery(
      { page, limit },
      this.transactionRepository,
      filters,
      order,
    );
  }
}
