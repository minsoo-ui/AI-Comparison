import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { OcrService } from './ocr.service';
import { SpecialTermsService } from './special-terms.service';
import { ExtractService } from './extract.service';

@Module({
  providers: [AiService, OcrService, SpecialTermsService, ExtractService],
  exports: [AiService, OcrService, SpecialTermsService, ExtractService],
})
export class AiModule { }
