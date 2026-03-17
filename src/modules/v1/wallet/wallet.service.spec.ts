import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FxService } from '../fx/fx.service';
import { CurrencyCode } from '../fx/enums/currency.enum';
import { WalletService } from './wallet.service';
import { TransactionType } from './entities/transaction.entity';

describe('WalletService', () => {
  let service: WalletService;

  let walletRepository: any;
  let transactionRepository: any;
  let userRepository: any;
  let paginationProvider: any;
  let fxService: any;
  let dataSource: any;
  let queryRunner: any;

  const originalSpread = process.env.FX_SPREAD_BPS;
  const originalFee = process.env.FX_FEE_BPS;

  beforeEach(() => {
    walletRepository = {
      findOne: jest.fn(),
      create: jest.fn((payload) => payload),
      save: jest.fn(async (payload) => payload),
      find: jest.fn(),
    };

    transactionRepository = {
      findOne: jest.fn(),
      create: jest.fn((payload) => payload),
      save: jest.fn(async (payload) => payload),
    };

    userRepository = {
      findOne: jest.fn(),
    };

    paginationProvider = {
      paginateQuery: jest.fn(),
    };

    fxService = {
      getExchangeRate: jest.fn(),
    } as Partial<FxService>;

    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn(),
        create: jest.fn((_: unknown, payload: any) => payload),
        save: jest.fn(async (payload) => payload),
      },
    };

    dataSource = {
      createQueryRunner: jest.fn(() => queryRunner),
    } as Partial<DataSource>;

    service = new WalletService(
      walletRepository,
      transactionRepository,
      userRepository,
      paginationProvider,
      fxService,
      dataSource,
    );
  });

  afterEach(() => {
    process.env.FX_SPREAD_BPS = originalSpread;
    process.env.FX_FEE_BPS = originalFee;
    jest.clearAllMocks();
  });

  describe('buildFxQuote', () => {
    it('computes quote correctly for 2-decimal currencies with spread and fee', () => {
      process.env.FX_SPREAD_BPS = '100';
      process.env.FX_FEE_BPS = '50';

      const quote = (service as any).buildFxQuote(10000, 1500, 'USD', 'NGN');

      expect(quote.grossAmountMinor).toBe(15000000);
      expect(quote.spreadAmountMinor).toBe(150000);
      expect(quote.feeAmountMinor).toBe(75000);
      expect(quote.netAmountMinor).toBe(14775000);
      expect(quote.fromMinorFactor).toBe(100);
      expect(quote.toMinorFactor).toBe(100);
      expect(quote.effectiveRate).toBe(1477.5);
    });

    it('supports 0-decimal source currencies', () => {
      process.env.FX_SPREAD_BPS = '0';
      process.env.FX_FEE_BPS = '0';

      const quote = (service as any).buildFxQuote(1000, 0.0065, 'JPY', 'USD');

      expect(quote.fromMinorFactor).toBe(1);
      expect(quote.toMinorFactor).toBe(100);
      expect(quote.grossAmountMinor).toBe(650);
      expect(quote.netAmountMinor).toBe(650);
    });

    it('supports 3-decimal source currencies', () => {
      process.env.FX_SPREAD_BPS = '0';
      process.env.FX_FEE_BPS = '0';

      const quote = (service as any).buildFxQuote(12345, 3.25, 'KWD', 'USD');

      expect(quote.fromMinorFactor).toBe(1000);
      expect(quote.toMinorFactor).toBe(100);
      expect(quote.grossAmountMinor).toBe(4012);
      expect(quote.netAmountMinor).toBe(4012);
    });
  });

  describe('getConversionQuote', () => {
    it('returns quote and normalizes currency codes', async () => {
      process.env.FX_SPREAD_BPS = '0';
      process.env.FX_FEE_BPS = '0';
      fxService.getExchangeRate.mockResolvedValue(1500);

      const result = await service.getConversionQuote('usd', 'ngn', 10000);

      expect(fxService.getExchangeRate).toHaveBeenCalledWith('USD', 'NGN');
      expect(result.fromCurrency).toBe('USD');
      expect(result.toCurrency).toBe('NGN');
      expect(result.convertedAmount).toBe(15000000);
      expect(result.quote.netAmountMinor).toBe(15000000);
    });
  });

  describe('convertCurrency', () => {
    it('converts successfully and persists source, destination, and transaction', async () => {
      process.env.FX_SPREAD_BPS = '0';
      process.env.FX_FEE_BPS = '0';
      fxService.getExchangeRate.mockResolvedValue(1500);

      const sourceWallet = { balance: 20000, currency: 'USD' };
      const destinationWallet = { balance: 500, currency: 'NGN' };

      queryRunner.manager.findOne.mockImplementation(
        async (entity: unknown, options: any) => {
          if (
            options?.where?.user?.id === 'user-1' &&
            options?.where?.currency === 'USD'
          ) {
            return sourceWallet;
          }

          if (
            options?.where?.user?.id === 'user-1' &&
            options?.where?.currency === 'NGN'
          ) {
            return destinationWallet;
          }

          if (entity && options?.where?.idempotencyKey) {
            return null;
          }

          return null;
        },
      );

      queryRunner.manager.create.mockImplementation(
        (entity: any, payload: any) => {
          if (entity?.name === 'Transaction') {
            return { id: 'tx-1', ...payload };
          }
          return payload;
        },
      );

      const result = await service.convertCurrency(
        'user-1',
        'USD',
        'NGN',
        10000,
        false,
      );

      expect(result.message).toBe('Conversion successful');
      expect(result.amountReceived).toBe(15000000);
      expect(sourceWallet.balance).toBe(10000);
      expect(destinationWallet.balance).toBe(15000500);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.manager.create).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ type: TransactionType.CONVERT }),
      );
    });

    it('rejects when source wallet balance is insufficient', async () => {
      process.env.FX_SPREAD_BPS = '0';
      process.env.FX_FEE_BPS = '0';
      fxService.getExchangeRate.mockResolvedValue(1500);

      queryRunner.manager.findOne.mockImplementation(
        async (_entity: any, options: any) => {
          if (options?.where?.currency === 'USD') {
            return { balance: 5000, currency: 'USD' };
          }
          return null;
        },
      );

      await expect(
        service.convertCurrency('user-1', 'USD', 'NGN', 10000, false),
      ).rejects.toThrow(BadRequestException);

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('transferFunds', () => {
    it('returns existing transaction for duplicate idempotency key', async () => {
      const sender = { id: 'sender-1', email: 'sender@test.dev' };
      const recipient = {
        id: 'recipient-1',
        email: 'recipient@test.dev',
        isSuspended: false,
        isDeleted: false,
        isEmailVerified: true,
      };

      userRepository.findOne
        .mockResolvedValueOnce(sender)
        .mockResolvedValueOnce(recipient);

      const existingTx = { id: 'tx-existing', idempotencyKey: 'idem-1' };
      queryRunner.manager.findOne.mockResolvedValue(existingTx);

      const result = await service.transferFunds(
        'sender-1',
        {
          recipientEmail: 'recipient@test.dev',
          currency: CurrencyCode.USD,
          amountMinor: 1000,
        },
        'idem-1',
      );

      expect(result).toEqual({
        message: 'Transfer already processed',
        transaction: existingTx,
      });
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('completes transfer and updates both wallets', async () => {
      const sender = { id: 'sender-1', email: 'sender@test.dev' };
      const recipient = {
        id: 'recipient-1',
        email: 'recipient@test.dev',
        isSuspended: false,
        isDeleted: false,
        isEmailVerified: true,
      };

      userRepository.findOne
        .mockResolvedValueOnce(sender)
        .mockResolvedValueOnce(recipient);

      const senderWallet = { balance: 5000, currency: 'USD' };
      const recipientWallet = { balance: 200, currency: 'USD' };

      queryRunner.manager.findOne.mockImplementation(
        async (entity: any, options: any) => {
          if (entity?.name === 'Transaction') {
            return null;
          }

          if (
            options?.where?.user?.id === 'sender-1' &&
            options?.where?.currency === 'USD'
          ) {
            return senderWallet;
          }

          if (
            options?.where?.user?.id === 'recipient-1' &&
            options?.where?.currency === 'USD'
          ) {
            return recipientWallet;
          }

          return null;
        },
      );

      queryRunner.manager.create.mockImplementation(
        (entity: any, payload: any) => {
          if (entity?.name === 'Transaction') {
            return {
              id: payload.idempotencyKey ? 'sender-tx' : 'recipient-tx',
              ...payload,
            };
          }
          return payload;
        },
      );

      const result = await service.transferFunds(
        'sender-1',
        {
          recipientEmail: 'recipient@test.dev',
          currency: CurrencyCode.USD,
          amountMinor: 1000,
        },
        'idem-transfer-1',
      );

      expect(result.message).toBe('Transfer successful');
      expect(senderWallet.balance).toBe(4000);
      expect(recipientWallet.balance).toBe(1200);
      expect(result.transfer.transactionId).toBe('sender-tx');
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('rejects transfer to self', async () => {
      const sender = { id: 'sender-1', email: 'sender@test.dev' };

      userRepository.findOne
        .mockResolvedValueOnce(sender)
        .mockResolvedValueOnce({
          id: 'sender-1',
          email: 'sender@test.dev',
          isSuspended: false,
          isDeleted: false,
          isEmailVerified: true,
        });

      await expect(
        service.transferFunds(
          'sender-1',
          {
            recipientEmail: 'sender@test.dev',
            currency: CurrencyCode.USD,
            amountMinor: 1000,
          },
          'idem-self-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
