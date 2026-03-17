import { Injectable, Logger, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

interface ExchangeRateLatestResponse {
  result: string;
  conversion_rates?: Record<string, number>;
  'error-type'?: string;
}

@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);
  private readonly CACHE_KEY = 'fxRates';
  private readonly CACHE_TTL = 300;
  private readonly exchangeRateBaseUrl =
    process.env.EXCHANGE_RATE_API_BASE_URL ||
    'https://v6.exchangerate-api.com/v6';
  private readonly exchangeRateApiKey =
    process.env.EXCHANGE_RATE_API_KEY || process.env.FIXER_API_KEY;

  constructor(
    private readonly httpService: HttpService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getRates(baseCurrency = 'USD'): Promise<Record<string, number>> {
    if (!this.exchangeRateApiKey) {
      throw new Error('EXCHANGE_RATE_API_KEY is not configured');
    }

    const normalizedBase = baseCurrency.toUpperCase();
    const cacheKey = `${this.CACHE_KEY}:${normalizedBase}`;

    const cachedRates: Record<string, number> | undefined =
      await this.cacheManager.get(cacheKey);
    if (cachedRates) {
      this.logger.log('Retrieved FX rates from Redis cache');
      return cachedRates;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get<ExchangeRateLatestResponse>(
          `${this.exchangeRateBaseUrl}/${this.exchangeRateApiKey}/latest/${normalizedBase}`,
        ),
      );
      if (
        response.data?.result === 'success' &&
        response.data.conversion_rates
      ) {
        const rates = response.data.conversion_rates;
        await this.cacheManager.set(cacheKey, rates, this.CACHE_TTL * 1000);
        this.logger.log('Successfully fetched and cached FX rates in Redis');
        return rates;
      }

      throw new Error(
        response.data?.['error-type'] ||
          'Invalid response structure from ExchangeRate API',
      );
    } catch (error) {
      this.logger.error(
        'Failed to fetch FX rates, falling back to cache if available',
        error,
      );
      const expiredCache: Record<string, number> | undefined =
        await this.cacheManager.get(cacheKey);
      if (expiredCache) {
        return expiredCache;
      }
      throw error;
    }
  }

  async getExchangeRate(
    fromCurrency: string,
    toCurrency: string,
  ): Promise<number> {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    const rates = await this.getRates(from);
    const rate = rates[to];

    if (!rate) {
      throw new Error('Unsupported currency pair');
    }

    return rate;
  }
}
