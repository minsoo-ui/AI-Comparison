import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
const { PDFParse } = require('pdf-parse');
import { PaddleOcrService } from 'ppu-paddle-ocr';

export interface OcrBlock {
    text: string;
    bbox: [number, number, number, number]; // [x, y, w, h]
    confidence?: number;
}

export interface OcrPage {
    pageNumber: number;
    text: string;
    blocks: OcrBlock[];
    raw: any;
}

export interface OcrResult {
    text: string;
    pages: OcrPage[];
}

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

    private async runPaddleVl(inputPath: string): Promise<OcrResult> {
        const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paddleocr-vl-'));
        const args = [this.paddleVlScript, inputPath, outDir];

        return new Promise<OcrResult>((resolve, reject) => {
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
                    const data = await fs.readJson(jsonPath);
                    
                    const result: OcrResult = {
                        text: data.text,
                        pages: (data.pages || []).map((p: any) => ({
                            pageNumber: p.page,
                            text: p.markdown || p.text || '',
                            blocks: this.expandBlocks(p.raw),
                            raw: p.raw,
                        })),
                    };
                    resolve(result);
                } catch (err) {
                    reject(err);
                } finally {
                    // Cleanup output directory
                    fs.remove(outDir).catch(e => this.logger.warn(`Failed to cleanup OCR outDir: ${outDir}`, e));
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

    async extractText(buffer: Buffer, fileName: string = ''): Promise<OcrResult> {
        const lowerName = fileName.toLowerCase();

        // Check if it's a text-based file for testing
        if (lowerName.endsWith('.md') || lowerName.endsWith('.txt')) {
            const text = buffer.toString('utf-8');
                return {
                    text,
                    pages: [{ pageNumber: 1, text, blocks: [], raw: null }],
                };
        }

        // PaddleOCR-VL for images and PDFs (DOC/DOCX will be added later)
        if (this.usePaddleVl && (this.isImageFile(fileName) || this.isPdfFile(fileName))) {
            try {
                const tmpInputPath = path.join(os.tmpdir(), `paddleocr-vl-${Date.now()}-${path.basename(fileName)}`);
                await fs.writeFile(tmpInputPath, buffer);
                const result = await this.runPaddleVl(tmpInputPath);
                await fs.remove(tmpInputPath);
                if (result.text && result.text.trim().length > 0) {
                    return result;
                }
            } catch (error) {
                this.logger.warn('PaddleOCR-VL failed, falling back to other extractors.', error);
            }
        }

        // Default to PDF processing
        try {
            const data = await this.parsePdfText(buffer);
            const fallbackResult: OcrResult = {
                text: data.text,
                pages: [{ pageNumber: 1, text: data.text, blocks: [], raw: null }]
            };

            if (data.text && data.text.trim().length > 100) {
                return fallbackResult;
            }

            if (this.paddleOcr) {
                this.logger.log('PDF text is sparse, attempting PaddleOCR...');
                const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
                const result = await (this.paddleOcr as any).recognize(arrayBuffer);
                return {
                    text: result.text,
                    pages: [{ pageNumber: 1, text: result.text, blocks: this.expandBlocks(result), raw: result }]
                };
            }

            return fallbackResult;
        } catch (error) {
            // If pdf-parse fails, try treating it as UTF-8 as second fallback
            this.logger.warn('PDF parsing failed, treating as raw text...');
            const text = buffer.toString('utf-8');
            return {
                text,
                pages: [{ pageNumber: 1, text, blocks: [], raw: null }]
            };
        }
    }

    /**
     * Helper to convert raw PaddleOCR JSON to flat OcrBlock array.
     */
    private expandBlocks(raw: any): OcrBlock[] {
        if (!raw || !Array.isArray(raw)) return [];
        const blocks: OcrBlock[] = [];
        
        // PaddleOCR-VL raw output is often an array of blocks
        for (const item of raw) {
            if (item.res && Array.isArray(item.res)) {
                // Nested format from some PaddleOCR versions
                for (const sub of item.res) {
                    blocks.push(this.mapSingleBlock(sub));
                }
            } else {
                blocks.push(this.mapSingleBlock(item));
            }
        }
        return blocks.filter(b => b.text.trim().length > 0);
    }

    private mapSingleBlock(item: any): OcrBlock {
        // Handle common PaddleOCR formats [ [[x1,y1],[x2,y2],[x3,y3],[x4,y4]], ("text", score) ]
        // OR { text: "...", bbox: [...] }
        if (item.text && item.bbox) {
            return {
                text: item.text,
                bbox: item.bbox,
                confidence: item.confidence || item.score || 0.9,
            };
        }
        
        // Fallback for raw PaddleOCR structure
        const text = item.text || (Array.isArray(item[1]) ? item[1][0] : item[1]) || '';
        const score = item.score || (Array.isArray(item[1]) ? item[1][1] : 0.9);
        let bbox: [number, number, number, number] = [0, 0, 0, 0];

        if (Array.isArray(item[0]) && item[0].length === 4) {
            // [ [x,y], [x,y], [x,y], [x,y] ]
            const pts = item[0];
            const x = Math.min(pts[0][0], pts[3][0]);
            const y = Math.min(pts[0][1], pts[1][1]);
            const w = Math.max(pts[1][0], pts[2][0]) - x;
            const h = Math.max(pts[2][1], pts[3][1]) - y;
            bbox = [x, y, w, h];
        }

        return { text, bbox, confidence: score };
    }

    // Maintaining backward compatibility for existing calls
    async extractTextFromPdf(buffer: Buffer): Promise<OcrResult> {
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
