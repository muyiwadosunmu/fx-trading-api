import { Injectable, Logger, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class FxService {
    private readonly logger = new Logger(FxService.name);
    private readonly CACHE_KEY = 'fxRates';
    // Redis cache TTL usually expects seconds, caching for 5 minutes
    private readonly CACHE_TTL = 300;

    constructor(
        private readonly httpService: HttpService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) { }

    async getRates(baseCurrency: string = 'USD'): Promise<Record<string, number>> {
        const cachedRates: Record<string, number> | undefined = await this.cacheManager.get(this.CACHE_KEY);
        if (cachedRates) {
            this.logger.log('Retrieved FX rates from Redis cache');
            return cachedRates;
        }

        try {
            const response = await firstValueFrom(
                this.httpService.get(`https://open.er-api.com/v6/latest/${baseCurrency}`)
            );
            if (response.data && response.data.rates) {
                const rates = response.data.rates;
                await this.cacheManager.set(this.CACHE_KEY, rates, this.CACHE_TTL * 1000); // Set using ms or config object depending on version
                this.logger.log('Successfully fetched and cached FX rates in Redis');
                return rates;
            }
            throw new Error('Invalid response structure from FX API');
        } catch (error) {
            this.logger.error('Failed to fetch FX rates, falling back to cache if available', error);
            const expiredCache: Record<string, number> | undefined = await this.cacheManager.get(this.CACHE_KEY);
            if (expiredCache) {
                return expiredCache;
            }
            throw error;
        }
    }

    async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
        const rates = await this.getRates('USD');
        const fromRate = rates[fromCurrency.toUpperCase()];
        const toRate = rates[toCurrency.toUpperCase()];

        if (!fromRate || !toRate) {
            throw new Error('Unsupported currency pair');
        }

        // Convert: (Amount / fromRate) * toRate
        // So the conversion rate is toRate / fromRate
        return toRate / fromRate;
    }
}
