import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QuoteController } from './quote.controller';
import { QuoteService } from './quote.service';
import { QuoteProcessor } from './quote.processor';
import { QuoteGateway } from './quote.gateway';
import { UploadModule } from '../upload/upload.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    UploadModule,
    AiModule,
    BullModule.registerQueue({
      name: 'quote-extraction',
    }),
  ],
  controllers: [QuoteController],
  providers: [QuoteService, QuoteProcessor, QuoteGateway],
})
export class QuoteModule {}
