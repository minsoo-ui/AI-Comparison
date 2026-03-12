import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { OcrService } from './ocr.service';
import { ExtractService } from './extract.service';
import { SpecialTermsService } from './special-terms.service';
import { TermPreprocessorService } from './term-preprocessor.service';

@Module({
  providers: [
    AiService,
    OcrService,
    ExtractService,
    SpecialTermsService,
    TermPreprocessorService,
  ],
  exports: [
    AiService,
    OcrService,
    ExtractService,
    SpecialTermsService,
    TermPreprocessorService,
  ],
})
export class AiModule {}
