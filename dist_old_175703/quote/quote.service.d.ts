import { UploadService } from '../upload/upload.service';
import { OcrService } from '../ai/ocr.service';
import { ExtractService } from '../ai/extract.service';
import { SpecialTermsService } from '../ai/special-terms.service';
import { AiService } from '../ai/ai.service';
export declare class QuoteService {
    private uploadService;
    private ocrService;
    private extractService;
    private specialTermsService;
    private aiService;
    private readonly logger;
    constructor(uploadService: UploadService, ocrService: OcrService, extractService: ExtractService, specialTermsService: SpecialTermsService, aiService: AiService);
    compareQuotes(filePaths: string[]): Promise<any>;
    private buildAnalysisPrompt;
    private calculateInsights;
    chatWithQuotesContext(message: string, history: {
        role: string;
        content: string;
    }[], context: any): Promise<{
        reply: string;
    }>;
}
