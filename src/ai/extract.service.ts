import { Injectable, Logger } from '@nestjs/common';
import { AiService } from './ai.service';

@Injectable()
export class ExtractService {
    private readonly logger = new Logger(ExtractService.name);

    constructor(private aiService: AiService) { }

    async extractData(text: string, schema: any): Promise<any> {
        const prompt = `
      Extract information from the following shipping quote text based on the provided schema.
      
      CRITICAL INSTRUCTIONS:
      1. IGNORE metadata such as "Microsoft: Print to PDF", printer names, or PDF software.
      2. 'carrier' MUST be the name of the logistics company (e.g., DHL, FedEx, Gemadept, Maersk, etc.).
      3. 'total_amount' MUST be the final price found in the quote. If no price is found, do not hallucinate; return 0.
      4. For each extracted field, provide the exact snippet from the text as 'source_snippet' in the 'traceability' object.
      
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
