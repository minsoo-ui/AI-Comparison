import { Injectable, Logger } from '@nestjs/common';
import { AiService } from './ai.service';

@Injectable()
export class ExtractService {
    private readonly logger = new Logger(ExtractService.name);

    constructor(private aiService: AiService) { }

    async extractData(text: string, schema: any): Promise<any> {
        const prompt = `
      Extract information from the following shipping quote text based on the provided schema.
      For each extracted field, also provide the exact snippet from the text as 'source_snippet'.
      
      Text: "${text}"
      Schema: ${JSON.stringify(schema)}
      
      Return as JSON with format:
      {
        "data": { ...extracted fields... },
        "traceability": { "field_name": "original text snippet", ... }
      }
    `;

        try {
            const response = await this.aiService.chat(prompt);
            const jsonStr = response.replace(/```json|```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (error) {
            this.logger.error('Error extracting data:', error);
            throw new Error('Failed to extract structured data with traceability');
        }
    }
}
