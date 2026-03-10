import { Module } from '@nestjs/common';
import { QuoteController } from './quote.controller';
import { QuoteService } from './quote.service';
import { UploadModule } from '../upload/upload.module';
import { AiModule } from '../ai/ai.module';

@Module({
    imports: [UploadModule, AiModule],
    controllers: [QuoteController],
    providers: [QuoteService],
})
export class QuoteModule { }
