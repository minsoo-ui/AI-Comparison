import { Controller, Get, Post, Body, Logger } from '@nestjs/common';
import { AppService } from './app.service';
import { SpecialTermsService } from './ai/special-terms.service';
import { ExtractService } from './ai/extract.service';
import { HscodeService } from './hscode/hscode.service';
import { AiService } from './ai/ai.service';
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly appService: AppService,
    private readonly specialTermsService: SpecialTermsService,
    private readonly extractService: ExtractService,
    private readonly hscodeService: HscodeService,
    private readonly aiService: AiService,
  ) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health/ai')
  async getAiHealth() {
    return await this.aiService.isOnline();
  }

  @Get('database/files')
  async getDatabaseFiles() {
    const folderPath = path.join(process.cwd(), 'data', 'special_terms');
    await fs.ensureDir(folderPath); // Ensure it exists
    const files = await fs.readdir(folderPath);

    // Build stats for each file
    const fileStats = await Promise.all(
      files.map(async (filename, idx) => {
        const filePath = path.join(folderPath, filename);
        const stats = await fs.stat(filePath);
        return {
          id: idx + 1, // Simple incremental ID for UI map key
          name: filename,
          size: (stats.size / 1024).toFixed(1) + ' KB',
          updatedAt: stats.mtime.toLocaleString(), // Actual modification time
          status: 'Active',
          description: 'Local knowledge base file.' // Can attach more metadata if mapped in a DB
        };
      })
    );

    return fileStats;
  }

  @Get('database/trash')
  async getTrashFiles() {
    const trashPath = path.join(process.cwd(), 'data', '.trash');
    await fs.ensureDir(trashPath);
    let files = await fs.readdir(trashPath);

    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

    const fileStats: any[] = [];
    for (let i = 0; i < files.length; i++) {
      const filename = files[i];
      const filePath = path.join(trashPath, filename);
      const stats = await fs.stat(filePath);

      // Check if older than 30 days -> Auto permanent delete
      if (now - stats.mtimeMs > THIRTY_DAYS) {
        await fs.unlink(filePath);
        continue;
      }

      fileStats.push({
        id: i + 1,
        name: filename,
        size: (stats.size / 1024).toFixed(1) + ' KB',
        deletedAt: stats.mtime.toLocaleString(), // using mtime as deleted time since fs.move updates it
        mtimeMs: stats.mtimeMs
      });
    }

    // Sort by most recently deleted
    return fileStats.sort((a, b) => b.mtimeMs - a.mtimeMs);
  }

  @Post('database/trash/restore')
  async restoreTrashFiles(@Body('filenames') filenames: string[]) {
    const trashPath = path.join(process.cwd(), 'data', '.trash');
    const destPath = path.join(process.cwd(), 'data', 'special_terms');
    const restored: string[] = [];
    for (const filename of filenames) {
      const tPath = path.join(trashPath, filename);
      const dPath = path.join(destPath, filename);
      if (await fs.pathExists(tPath)) {
        await fs.move(tPath, dPath, { overwrite: true });
        restored.push(filename);
      }
    }
    return { message: `Restored ${restored.length} files.`, restored };
  }

  @Post('database/trash/empty')
  async emptyTrash() {
    const trashPath = path.join(process.cwd(), 'data', '.trash');
    await fs.emptyDir(trashPath);
    return { message: 'Trash emptied successfully.' };
  }

  @Get('open-database-folder')
  openDatabaseFolder() {
    const folderPath = path.join(process.cwd(), 'data', 'special_terms');
    const command = process.platform === 'win32' ? `explorer "${folderPath}"` :
      process.platform === 'darwin' ? `open "${folderPath}"` :
        `xdg-open "${folderPath}"`;

    exec(command, (error) => {
      if (error) {
        this.logger.error(`Failed to open folder: ${error.message}`);
      } else {
        this.logger.log(`Opened database folder: ${folderPath}`);
      }
    });
    return { success: true, message: 'Folder opened.' };
  }

  @Get('test-foundation')
  async testFoundation() {
    this.logger.log('Starting Foundation Integration Test (Task 2.8)...');
    let termsResult: any = { status: 'Unknown', length: 0 };
    let extractionResult: any = { status: 'Skipped', data: null };
    let hscodeResult: any = { status: 'Skipped', data: null };

    // 1. Check Special Terms
    try {
      const terms = this.specialTermsService.getTermsContent();
      termsResult = { status: terms.length > 0 ? 'OK' : 'Empty', length: terms.length };
    } catch (e) {
      this.logger.error('SpecialTerms test failed:', e);
      termsResult.status = 'Error: ' + e.message;
    }

    // 2. Test ExtractService (LangExtract) with mock logic in AiService
    try {
      const mockOcrText = 'Quote from FedEx. Total price: 500 USD for 50kg of electronics.';
      const schema = {
        company: 'string',
        total_price: 'number',
        weight: 'number',
        item: 'string',
      };
      extractionResult.data = await this.extractService.extractData(mockOcrText, schema);
      extractionResult.status = 'OK';
    } catch (e) {
      this.logger.error('Extraction test failed:', e);
      extractionResult.status = 'Error: ' + e.message;
    }

    // 3. Test HscodeService (Qdrant Search)
    try {
      const item = extractionResult.data?.item || 'electronics';
      hscodeResult.data = await this.hscodeService.searchHSCode(item);
      hscodeResult.status = 'OK';
    } catch (e) {
      this.logger.error('HSCode search test failed:', e);
      hscodeResult.status = 'Error: ' + e.message;
    }

    return {
      status: 'Completed',
      stage: 'Foundation Integration (Task 2.8)',
      results: {
        specialTerms: termsResult,
        extraction: extractionResult,
        hscodeVectorSearch: hscodeResult,
      },
    };
  }
}
