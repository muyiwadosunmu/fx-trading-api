import { Controller, Get, Query } from '@nestjs/common';
import { APIRes } from 'src/core/common/api-response';
import { FxService } from './fx.service';

@Controller('v1/fx')
export class FxController {
  constructor(private readonly fxService: FxService) {}

  @Get('rates')
  async getRates(@Query('base') base: string) {
    const rates = await this.fxService.getRates(base || 'USD');
    return APIRes(rates, 'FX rates fetched successfully');
  }
}
