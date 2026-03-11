import { Module } from '@nestjs/common';
import { QuoteController } from './quote.controller';
import { QuoteService } from './quote.service';
import { QuoteGateway } from './quote.gateway';
import { UploadModule } from '../upload/upload.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [UploadModule, AiModule],
  controllers: [QuoteController],
  providers: [QuoteService, QuoteGateway],
  exports: [QuoteGateway],
})
export class QuoteModule {}
