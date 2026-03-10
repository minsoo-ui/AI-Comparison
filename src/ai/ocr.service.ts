import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
const { PDFParse } = require('pdf-parse');
import { PaddleOcrService } from 'ppu-paddle-ocr';

@Injectable()
export class OcrService {
    private readonly logger = new Logger(OcrService.name);
    private paddleOcr: PaddleOcrService;

    private readonly usePaddleVl = (process.env.USE_PADDLEOCR_VL || '').toLowerCase() === '1';
    private readonly pythonBin = process.env.PADDLEOCR_PYTHON || 'python';
    private readonly paddleVlScript =
        process.env.PADDLEOCR_VL_SCRIPT || path.join(process.cwd(), 'scripts', 'paddleocr_vl_pipeline.py');

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

    private async parsePdfText(buffer: Buffer) {
        const parser = new PDFParse({ data: buffer });
        try {
            return await parser.getText();
        } finally {
            await parser.destroy();
        }
    }

    private async parsePdfInfo(buffer: Buffer) {
        const parser = new PDFParse({ data: buffer });
        try {
            return await parser.getInfo();
        } finally {
            await parser.destroy();
        }
    }

    private isImageFile(fileName: string) {
        const lowerName = fileName.toLowerCase();
        return (
            lowerName.endsWith('.png') ||
            lowerName.endsWith('.jpg') ||
            lowerName.endsWith('.jpeg') ||
            lowerName.endsWith('.bmp') ||
            lowerName.endsWith('.tif') ||
            lowerName.endsWith('.tiff')
        );
    }

    private isPdfFile(fileName: string) {
        return fileName.toLowerCase().endsWith('.pdf');
    }

    private async runPaddleVl(inputPath: string) {
        const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paddleocr-vl-'));
        const args = [this.paddleVlScript, inputPath, outDir];

        return new Promise<{ text: string; raw: any }>((resolve, reject) => {
            const proc = spawn(this.pythonBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
            let stderr = '';

            proc.stderr.on('data', (chunk) => {
                stderr += chunk.toString();
            });

            proc.on('error', (err) => {
                reject(err);
            });

            proc.on('close', async (code) => {
                if (code !== 0) {
                    reject(new Error(`PaddleOCR-VL failed (code ${code}): ${stderr}`));
                    return;
                }

                try {
                    const jsonPath = path.join(outDir, 'output.json');
                    const raw = await fs.readJson(jsonPath);
                    const text = this.collectTextFromPaddleVl(raw);
                    resolve({ text, raw });
                } catch (err) {
                    reject(err);
                }
            });
        });
    }

    private collectTextFromPaddleVl(payload: any): string {
        if (!payload) return '';
        if (typeof payload.text === 'string' && payload.text.trim().length > 0) return payload.text;
        if (typeof payload.markdown === 'string' && payload.markdown.trim().length > 0) return payload.markdown;
        return JSON.stringify(payload);
    }

    async extractText(buffer: Buffer, fileName: string = ''): Promise<string> {
        const lowerName = fileName.toLowerCase();

        // Check if it's a text-based file for testing
        if (lowerName.endsWith('.md') || lowerName.endsWith('.txt')) {
            return buffer.toString('utf-8');
        }

        // PaddleOCR-VL for images and PDFs (DOC/DOCX will be added later)
        if (this.usePaddleVl && (this.isImageFile(fileName) || this.isPdfFile(fileName))) {
            try {
                const tmpInputPath = path.join(os.tmpdir(), `paddleocr-vl-${Date.now()}-${path.basename(fileName)}`);
                await fs.writeFile(tmpInputPath, buffer);
                const result = await this.runPaddleVl(tmpInputPath);
                await fs.remove(tmpInputPath);
                if (result.text && result.text.trim().length > 0) {
                    return result.text;
                }
            } catch (error) {
                this.logger.warn('PaddleOCR-VL failed, falling back to other extractors.', error);
            }
        }

        // Default to PDF processing
        try {
            const data = await this.parsePdfText(buffer);
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
            const data = await this.parsePdfInfo(buffer);
            return data.info ?? data.metadata ?? data;
        } catch (error) {
            this.logger.error('Error parsing PDF metadata:', error);
            throw new Error('Failed to extract PDF metadata');
        }
    }
}
