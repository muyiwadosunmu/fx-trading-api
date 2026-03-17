import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { TransferFundsDto } from './dto/transfer-funds.dto';

@Injectable()
export class WalletService {
  private readonly RATE_SCALE = 1_000_000;
  private readonly BPS_BASE = 10_000;
  private readonly CURRENCY_DECIMALS: Record<string, number> = {
    JPY: 0,
    KRW: 0,
    VND: 0,
    BHD: 3,
    IQD: 3,
    JOD: 3,
    KWD: 3,
    LYD: 3,
    OMR: 3,
    TND: 3,
  };

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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
      const quote = this.buildFxQuote(amount, rate, fromCurrency, toCurrency);
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

  async transferFunds(
    senderUserId: string,
    body: TransferFundsDto,
    idempotencyKey: string,
  ) {
    if (!idempotencyKey || !idempotencyKey.trim()) {
      throw new BadRequestException(
        'x-idempotency-key header is required for transfer',
      );
    }

    if (!Number.isInteger(body.amountMinor) || body.amountMinor <= 0) {
      throw new BadRequestException(
        'Transfer amount must be a positive integer in minor units',
      );
    }

    const sender = await this.userRepository.findOne({
      where: { id: senderUserId },
      select: ['id', 'email'],
    });

    const recipient = await this.userRepository.findOne({
      where: { email: body.recipientEmail.toLowerCase() },
      select: ['id', 'email', 'isSuspended', 'isDeleted', 'isEmailVerified'],
    });

    if (!sender || !recipient) {
      throw new NotFoundException('Sender or recipient not found');
    }

    if (sender.id === recipient.id) {
      throw new BadRequestException('You cannot transfer funds to yourself');
    }

    if (
      !recipient.isEmailVerified ||
      recipient.isSuspended ||
      recipient.isDeleted
    ) {
      throw new BadRequestException(
        'Recipient account is not eligible to receive transfer',
      );
    }

    const currency = body.currency.toUpperCase();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingTx = await queryRunner.manager.findOne(Transaction, {
        where: { idempotencyKey },
      });

      if (existingTx) {
        await queryRunner.rollbackTransaction();
        return {
          message: 'Transfer already processed',
          transaction: existingTx,
        };
      }

      const senderWallet = await queryRunner.manager.findOne(Wallet, {
        where: { user: { id: sender.id }, currency },
        lock: { mode: 'pessimistic_write' },
      });

      if (!senderWallet || Number(senderWallet.balance) < body.amountMinor) {
        throw new BadRequestException(
          `Insufficient balance in ${currency} wallet`,
        );
      }

      let recipientWallet = await queryRunner.manager.findOne(Wallet, {
        where: { user: { id: recipient.id }, currency },
        lock: { mode: 'pessimistic_write' },
      });

      if (!recipientWallet) {
        recipientWallet = queryRunner.manager.create(Wallet, {
          user: { id: recipient.id } as User,
          currency,
          balance: 0,
        });
      }

      senderWallet.balance = Number(senderWallet.balance) - body.amountMinor;
      recipientWallet.balance =
        Number(recipientWallet.balance) + body.amountMinor;

      await queryRunner.manager.save(senderWallet);
      await queryRunner.manager.save(recipientWallet);

      const senderTx = queryRunner.manager.create(Transaction, {
        user: { id: sender.id } as User,
        type: TransactionType.TRANSFER,
        fromCurrency: currency,
        toCurrency: currency,
        amount: body.amountMinor,
        status: 'SUCCESS',
        idempotencyKey,
      });

      const recipientTx = queryRunner.manager.create(Transaction, {
        user: { id: recipient.id } as User,
        type: TransactionType.TRANSFER,
        fromCurrency: currency,
        toCurrency: currency,
        amount: body.amountMinor,
        status: 'SUCCESS',
      });

      await queryRunner.manager.save(senderTx);
      await queryRunner.manager.save(recipientTx);
      await queryRunner.commitTransaction();

      return {
        message: 'Transfer successful',
        transfer: {
          currency,
          amountMinor: body.amountMinor,
          sender: { id: sender.id, email: sender.email },
          recipient: { id: recipient.id, email: recipient.email },
          transactionId: senderTx.id,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
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
    const quote = this.buildFxQuote(amount, rate, from, to);

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

  private buildFxQuote(
    amountMinor: number,
    marketRate: number,
    fromCurrency: string,
    toCurrency: string,
  ) {
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      throw new BadRequestException(
        'Amount must be a positive integer in minor units',
      );
    }

    const spreadBps = this.parseBps(process.env.FX_SPREAD_BPS, 0);
    const feeBps = this.parseBps(process.env.FX_FEE_BPS, 0);
    const fromFactor = this.getMinorFactor(fromCurrency);
    const toFactor = this.getMinorFactor(toCurrency);

    const sourceAmountMajor = amountMinor / fromFactor;
    const grossAmountMajor = sourceAmountMajor * marketRate;
    const gross = Math.floor(grossAmountMajor * toFactor);
    const scaledRate = Math.floor(marketRate * this.RATE_SCALE);

    if (scaledRate <= 0 || gross <= 0) {
      throw new BadRequestException('Invalid exchange rate received');
    }

    const spreadAmount = Math.floor((gross * spreadBps) / this.BPS_BASE);
    const feeAmount = Math.floor((gross * feeBps) / this.BPS_BASE);
    const net = gross - spreadAmount - feeAmount;
    const roundingRemainderScaled = Math.floor(
      (grossAmountMajor * toFactor - gross) * this.RATE_SCALE,
    );

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
      // Flooring happens on major->minor conversion; remainder is audit data.
      roundingRemainderScaled: this.ensureSafeInteger(roundingRemainderScaled),
      rateScale: this.RATE_SCALE,
      marketRate,
      fromMinorFactor: fromFactor,
      toMinorFactor: toFactor,
      effectiveRate: netAmountMinor / toFactor / (amountMinor / fromFactor),
    };
  }

  private getMinorFactor(currency: string): number {
    const normalized = currency.toUpperCase();
    const decimals = this.CURRENCY_DECIMALS[normalized] ?? 2;
    return 10 ** decimals;
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

  async getTransactionById(userId: string, id: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id, user: { id: userId } },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }
}
