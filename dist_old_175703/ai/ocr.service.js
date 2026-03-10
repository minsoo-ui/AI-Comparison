"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var OcrService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OcrService = void 0;
const common_1 = require("@nestjs/common");
const { PDFParse } = require('pdf-parse');
const ppu_paddle_ocr_1 = require("ppu-paddle-ocr");
let OcrService = OcrService_1 = class OcrService {
    logger = new common_1.Logger(OcrService_1.name);
    paddleOcr;
    constructor() {
        this.initPaddleOcr();
    }
    async initPaddleOcr() {
        try {
            this.paddleOcr = new ppu_paddle_ocr_1.PaddleOcrService();
            await this.paddleOcr.initialize();
            this.logger.log('PaddleOcrService initialized successfully.');
        }
        catch (error) {
            this.logger.warn('Failed to initialize PaddleOCR. Falling back to pdf-parse only.', error);
        }
    }
    async parsePdfText(buffer) {
        const parser = new PDFParse({ data: buffer });
        try {
            return await parser.getText();
        }
        finally {
            await parser.destroy();
        }
    }
    async parsePdfInfo(buffer) {
        const parser = new PDFParse({ data: buffer });
        try {
            return await parser.getInfo();
        }
        finally {
            await parser.destroy();
        }
    }
    async extractText(buffer, fileName = '') {
        const lowerName = fileName.toLowerCase();
        if (lowerName.endsWith('.md') || lowerName.endsWith('.txt')) {
            return buffer.toString('utf-8');
        }
        try {
            const data = await this.parsePdfText(buffer);
            if (data.text && data.text.trim().length > 100) {
                return data.text;
            }
            if (this.paddleOcr) {
                this.logger.log('PDF text is sparse, attempting PaddleOCR...');
                const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
                const result = await this.paddleOcr.recognize(arrayBuffer);
                return result.text;
            }
            return data.text;
        }
        catch (error) {
            this.logger.warn('PDF parsing failed, treating as raw text...');
            return buffer.toString('utf-8');
        }
    }
    async extractTextFromPdf(buffer) {
        return this.extractText(buffer);
    }
    async extractMetadata(buffer) {
        try {
            const data = await this.parsePdfInfo(buffer);
            return data.info ?? data.metadata ?? data;
        }
        catch (error) {
            this.logger.error('Error parsing PDF metadata:', error);
            throw new Error('Failed to extract PDF metadata');
        }
    }
};
exports.OcrService = OcrService;
exports.OcrService = OcrService = OcrService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], OcrService);
//# sourceMappingURL=ocr.service.js.map