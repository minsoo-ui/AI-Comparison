import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as mammoth from 'mammoth';
const { PDFParse } = require('pdf-parse');

@Injectable()
export class SpecialTermsService implements OnModuleInit {
    private readonly logger = new Logger(SpecialTermsService.name);
    private readonly termsPath = path.join(process.cwd(), 'data', 'special_terms');
    private termsContent: string = '';

    async onModuleInit() {
        await this.loadSpecialTerms();
    }

    private async parsePdfText(buffer: Buffer) {
        const parser = new PDFParse({ data: buffer });
        try {
            return await parser.getText();
        } finally {
            await parser.destroy();
        }
    }

    async loadSpecialTerms() {
        try {
            if (!fs.existsSync(this.termsPath)) {
                this.logger.warn(`Directory ${this.termsPath} does not exist.`);
                return;
            }

            const files = await fs.readdir(this.termsPath);
            let combinedContent = '';

            for (const file of files) {
                const filePath = path.join(this.termsPath, file);
                const ext = path.extname(file).toLowerCase();

                this.logger.log(`Processing special term file: ${file}`);

                if (ext === '.docx') {
                    const result = await mammoth.extractRawText({ path: filePath });
                    combinedContent += `\n--- SOURCE: ${file} ---\n${result.value}`;
                } else if (ext === '.pdf') {
                    const buffer = await fs.readFile(filePath);
                    const data = await this.parsePdfText(buffer);
                    combinedContent += `\n--- SOURCE: ${file} ---\n${data.text}`;
                } else if (ext === '.md' || ext === '.txt') {
                    const content = await fs.readFile(filePath, 'utf-8');
                    combinedContent += `\n--- SOURCE: ${file} ---\n${content}`;
                }
            }

            this.termsContent = combinedContent;
            this.logger.log('Special terms loaded successfully.');
        } catch (error) {
            this.logger.error('Error loading special terms:', error);
        }
    }

    getTermsContent(): string {
        return this.termsContent;
    }
}
