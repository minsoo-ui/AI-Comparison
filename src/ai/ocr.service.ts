import { Injectable, Logger } from '@nestjs/common';
const pdf = require('pdf-parse');
import { PaddleOcrService } from 'ppu-paddle-ocr';

@Injectable()
export class OcrService {
    private readonly logger = new Logger(OcrService.name);
    private paddleOcr: PaddleOcrService;

    constructor() {
        this.initPaddleOcr();
    }

    private async initPaddleOcr() {
        try {
            this.paddleOcr = new PaddleOcrService();
            await this.paddleOcr.initialize();
            this.logger.log('PaddleOcrService initialized successfully.');
        } catch (error) {
            this.logger.warn('Failed to initialize PaddleOCR. Falling back to pdf-parse only.', error);
        }
    }

    async extractText(buffer: Buffer, fileName: string = ''): Promise<string> {
        const lowerName = fileName.toLowerCase();

        // Check if it's a text-based file for testing
        if (lowerName.endsWith('.md') || lowerName.endsWith('.txt')) {
            return buffer.toString('utf-8');
        }

        // Default to PDF processing
        try {
            const data = await pdf(buffer);
            if (data.text && data.text.trim().length > 100) {
                return data.text;
            }

            if (this.paddleOcr) {
                this.logger.log('PDF text is sparse, attempting PaddleOCR...');
                const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
                const result = await this.paddleOcr.recognize(arrayBuffer);
                return result.text;
            }

            return data.text;
        } catch (error) {
            // If pdf-parse fails, try treating it as UTF-8 as second fallback
            this.logger.warn('PDF parsing failed, treating as raw text...');
            return buffer.toString('utf-8');
        }
    }

    // Maintaining backward compatibility for existing calls
    async extractTextFromPdf(buffer: Buffer): Promise<string> {
        return this.extractText(buffer);
    }

    async extractMetadata(buffer: Buffer) {
        try {
            const data = await pdf(buffer);
            return data.metadata;
        } catch (error) {
            this.logger.error('Error parsing PDF metadata:', error);
            throw new Error('Failed to extract PDF metadata');
        }
    }
}
