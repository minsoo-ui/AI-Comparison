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

  private readonly usePaddleVl =
    (process.env.USE_PADDLEOCR_VL || '').toLowerCase() === '1';
  private readonly pythonBin = process.env.PADDLEOCR_PYTHON || 'python';
  private readonly paddleVlScript =
    process.env.PADDLEOCR_VL_SCRIPT ||
    path.join(process.cwd(), 'scripts', 'paddleocr_vl_pipeline.py');

  constructor() {
    this.initPaddleOcr();
  }

  private async initPaddleOcr() {
    try {
      this.paddleOcr = new PaddleOcrService();
      await this.paddleOcr.initialize();
      this.logger.log('PaddleOcrService initialized successfully.');
    } catch (error) {
      this.logger.warn(
        'Failed to initialize PaddleOCR. Falling back to pdf-parse only.',
        error,
      );
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
      const proc = spawn(this.pythonBin, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
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
    if (typeof payload.text === 'string' && payload.text.trim().length > 0)
      return payload.text;
    if (
      typeof payload.markdown === 'string' &&
      payload.markdown.trim().length > 0
    )
      return payload.markdown;
    return JSON.stringify(payload);
  }

  private async runCleaner(inputText: string): Promise<string> {
    const cleanerScript = path.join(process.cwd(), 'scripts', 'clean_quote_data.py');
    const tmpInputPath = path.join(os.tmpdir(), `cleaner-input-${Date.now()}.txt`);
    await fs.writeFile(tmpInputPath, inputText, 'utf-8');

    return new Promise<string>((resolve, reject) => {
      const proc = spawn(this.pythonBin, [cleanerScript, tmpInputPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (chunk) => (stdout += chunk.toString()));
      proc.stderr.on('data', (chunk) => (stderr += chunk.toString()));

      proc.on('close', async (code) => {
        await fs.remove(tmpInputPath);
        if (code !== 0) {
          this.logger.warn(`Cleaner failed (code ${code}): ${stderr}`);
          resolve(`--- RAW TEXT ---\n${inputText}\n--- END RAW TEXT ---`);
          return;
        }
        try {
          const cleaned = JSON.parse(stdout);
          if (Array.isArray(cleaned) && cleaned.length > 0) {
            const tablesAsText = cleaned
              .map((table, i) => `[TABLE ${i + 1}]\n${JSON.stringify(table, null, 2)}`)
              .join('\n\n');
            resolve(`--- CLEANED DATA ---\n${tablesAsText}\n--- END CLEANED DATA ---\n\n--- RAW TEXT ---\n${inputText}\n--- END RAW TEXT ---`);
          } else {
            resolve(`--- RAW TEXT ---\n${inputText}\n--- END RAW TEXT ---`);
          }
        } catch {
          resolve(`--- RAW TEXT ---\n${inputText}\n--- END RAW TEXT ---`);
        }
      });
    });
  }

  async extractText(buffer: Buffer, fileName: string = ''): Promise<string> {
    const lowerName = fileName.toLowerCase();

    // Check if it's a text-based file for testing
    if (lowerName.endsWith('.md') || lowerName.endsWith('.txt')) {
      const text = buffer.toString('utf-8');
      return await this.runCleaner(text);
    }

    // PaddleOCR-VL for images and PDFs
    let rawText = '';
    if (
      this.usePaddleVl &&
      (this.isImageFile(fileName) || this.isPdfFile(fileName))
    ) {
      try {
        const tmpInputPath = path.join(
          os.tmpdir(),
          `paddleocr-vl-${Date.now()}-${path.basename(fileName)}`,
        );
        await fs.writeFile(tmpInputPath, buffer);
        const result = await this.runPaddleVl(tmpInputPath);
        await fs.remove(tmpInputPath);
        rawText = result.text || '';
      } catch (error) {
        this.logger.warn(
          'PaddleOCR-VL failed, falling back to other extractors.',
          error,
        );
      }
    }

    // Default to PDF processing if paddle-vl didn't provide enough text
    if (!rawText || rawText.length < 50) {
      try {
        const data = await this.parsePdfText(buffer);
        rawText = data.text || '';

        if ((!rawText || rawText.trim().length < 100) && this.paddleOcr) {
          this.logger.log('PDF text is sparse, attempting PaddleOCR...');
          const arrayBuffer = buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.byteLength,
          ) as ArrayBuffer;
          const result = await this.paddleOcr.recognize(arrayBuffer);
          rawText = result.text;
        }
      } catch (error) {
        this.logger.warn('PDF parsing failed, treating as raw text...');
        rawText = buffer.toString('utf-8');
      }
    }

    // Run the cleaner on the extracted raw text
    return await this.runCleaner(rawText);
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
