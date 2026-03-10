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
var ExtractService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtractService = void 0;
const common_1 = require("@nestjs/common");
const ai_service_1 = require("./ai.service");
let ExtractService = ExtractService_1 = class ExtractService {
    aiService;
    logger = new common_1.Logger(ExtractService_1.name);
    constructor(aiService) {
        this.aiService = aiService;
    }
    async extractData(text, schema) {
        const prompt = `
      Extract information from the following shipping quote text based on the provided schema.
      
      CRITICAL INSTRUCTIONS:
      1. IGNORE metadata such as "Microsoft: Print to PDF", printer names, or PDF software.
      2. 'carrier' MUST be the name of the logistics company (e.g., DHL, FedEx, Gemadept, Maersk, v.v.). Nếu KHÔNG TÌM THẤY tên hãng cụ thể, trả về "N/A".
      3. 'total_amount' MUST be the final price found in the quote. If no price is found, do not hallucinate; return 0.
      4. For each extracted field, provide the exact snippet from the text as 'source_snippet' in the 'traceability' object.
      5. ZERO HALLUCINATION POLICY: DO NOT invent, guess, or make up any data. Only extract what is explicitly written in the Text.
      
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
            let jsonStr = response.replace(/```json|```/g, '').trim();
            const firstBrace = jsonStr.indexOf('{');
            const lastBrace = jsonStr.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
            }
            return JSON.parse(jsonStr);
        }
        catch (error) {
            this.logger.error('Error extracting data:', error);
            throw new Error('Failed to extract structured data with traceability');
        }
    }
};
exports.ExtractService = ExtractService;
exports.ExtractService = ExtractService = ExtractService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ai_service_1.AiService])
], ExtractService);
//# sourceMappingURL=extract.service.js.map