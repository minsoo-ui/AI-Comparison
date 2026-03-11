import { Injectable, Logger } from '@nestjs/common';
import { AiService } from './ai.service';

@Injectable()
export class ExtractService {
  private readonly logger = new Logger(ExtractService.name);

  constructor(private aiService: AiService) {}

  async extractData(text: string, schema: any): Promise<any> {
    // Performance Patch 2.0: Prioritize cleaned tables to reduce context size
    let contextText = text;
    const cleanMarker = '--- CLEANED DATA ---';
    const endCleanMarker = '--- END CLEANED DATA ---';
    
    const startIdx = text.indexOf(cleanMarker);
    const endIdx = text.indexOf(endCleanMarker);
    
    if (startIdx !== -1 && endIdx !== -1) {
      this.logger.log('Optimizing extraction context: Using only cleaned table data.');
      contextText = text.substring(startIdx + cleanMarker.length, endIdx).trim();
    } else {
      // If no cleaned data, at least truncate raw text to 8000 chars
      contextText = text.substring(0, 8000);
    }

    const prompt = `
      Extract information from the following shipping quote text based on the provided schema.
      
      CRITICAL INSTRUCTIONS:
      1. IGNORE metadata such as "Microsoft: Print to PDF", printer names, or PDF software.
      2. 'carrier' MUST be the name of the logistics company (e.g., DHL, FedEx, Gemadept, Maersk, v.v.). Nếu KHÔNG TÌM THẤY tên hãng cụ thể, trả về "N/A".
      3. 'total_amount' MUST be the final price found in the quote. If no price is found, do not hallucinate; return 0.
      4. For each extracted field, provide the exact snippet from the text as 'source_snippet' in the 'traceability' object.
      5. ZERO HALLUCINATION POLICY: DO NOT invent, guess, or make up any data. Only extract what is explicitly written in the Text.
      
      Text Content: "${contextText}"
      Schema: ${JSON.stringify(schema)}
      
      Return as JSON with format:
      {
        "data": { ...extracted fields... },
        "traceability": { "field_name": "original text snippet", ... }
      }
    `;

    try {
      // Disable repeat_penalty for structured data to avoid breaking JSON syntax
      const response = await this.aiService.chat(prompt, [], { repeatPenalty: 1.0 });
      let jsonStr = response.replace(/```json|```/g, '').trim();

      const firstBrace = jsonStr.indexOf('{');
      const lastBrace = jsonStr.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
      }

      try {
        return JSON.parse(jsonStr);
      } catch (parseError) {
        this.logger.warn('Initial JSON.parse failed, attempting resilient repair...');
        return this.repairJson(jsonStr, schema);
      }
    } catch (error) {
      this.logger.error('Error extracting data:', error);
      throw new Error('Failed to extract structured data with traceability');
    }
  }

  /**
   * Resiliently extract fields using Regex if JSON parsing fails.
   */
  private repairJson(jsonStr: string, schema: any): any {
    this.logger.log('Executing Regex-based emergency data salvage...');
    
    const result: any = {
      data: {},
      traceability: {}
    };

    // Extract basic fields using common patterns
    const extractField = (field: string, text: string) => {
      // Look for "field": "value" or "field": value
      const regex = new RegExp(`"${field}"\\s*:\\s*["']?([^"',}\\s]+)["']?`, 'i');
      const match = text.match(regex);
      return match ? match[1] : null;
    };

    for (const key of Object.keys(schema)) {
      const val = extractField(key, jsonStr);
      if (val !== null) {
        if (schema[key] === 'number') {
          result.data[key] = parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
        } else {
          result.data[key] = val;
        }
        result.traceability[key] = "Extracted via Regex Recovery";
      } else {
        result.data[key] = schema[key] === 'number' ? 0 : 'N/A';
      }
    }

    // Ensure essential logistics fields have defaults if missing
    if (!result.data.carrier || result.data.carrier === 'N/A') {
      result.data.carrier = extractField('carrier', jsonStr) || 'N/A';
    }

    return result;
  }
}
