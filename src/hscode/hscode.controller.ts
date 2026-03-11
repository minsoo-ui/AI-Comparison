import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { HscodeService } from './hscode.service';

@Controller('hscode')
export class HscodeController {
  constructor(private readonly hscodeService: HscodeService) {}

  @Get('search')
  async search(@Query('q') query: string) {
    if (!query) {
      throw new BadRequestException('Query parameter "q" is required.');
    }
    return await this.hscodeService.searchHSCode(query);
  }

  @Get('calculate')
  async calculate(@Query('value') value: number, @Query('rate') rate: string) {
    if (!value || !rate) {
      throw new BadRequestException(
        'Parameters "value" and "rate" (e.g. 10%) are required.',
      );
    }
    const numericValue = Number(value);
    const tax = await this.hscodeService.calculateTax(numericValue, rate);
    return {
      value: numericValue,
      taxRate: rate,
      taxAmount: tax,
      totalWithTax: numericValue + tax,
    };
  }
}
