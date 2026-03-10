import { Injectable, Logger } from '@nestjs/common';
import { UploadService } from '../upload/upload.service';
import { OcrService } from '../ai/ocr.service';
import { ExtractService } from '../ai/extract.service';
import { SpecialTermsService } from '../ai/special-terms.service';
import { AiService } from '../ai/ai.service';
import * as path from 'path';

@Injectable()
export class QuoteService {
    private readonly logger = new Logger(QuoteService.name);

    constructor(
        private uploadService: UploadService,
        private ocrService: OcrService,
        private extractService: ExtractService,
        private specialTermsService: SpecialTermsService,
        private aiService: AiService,
    ) { }

    async compareQuotes(filePaths: string[]): Promise<any> {
        this.logger.log(`Comparing ${filePaths.length} quotes...`);

        // 1. Extract raw text from all files
        const rawTexts = await Promise.all(
            filePaths.map(async (filePath) => {
                const buffer = await this.uploadService.getFileContent(filePath);
                const fileName = path.basename(filePath);
                const text = await this.ocrService.extractText(buffer, fileName);
                return { path: filePath, text };
            })
        );

        // 2. Extract structured JSON with Traceability for each quote
        const quoteSchema = {
            carrier: 'string',
            origin: 'string',
            destination: 'string',
            total_amount: 'number',
            currency: 'string',
            transit_time_days: 'number',
            valid_until: 'string',
        };

        const structuredQuotes = await Promise.all(
            rawTexts.map(async (item) => {
                const extraction = await this.extractService.extractData(item.text, quoteSchema);
                return {
                    ...extraction.data,
                    traceability: extraction.traceability,
                    sourceFile: item.path
                };
            })
        );

        // 3. Analytic Insights
        const insights = this.calculateInsights(structuredQuotes);
        if (!insights) {
            return {
                summary: null,
                quotes: structuredQuotes,
                ai_analysis: { verdicts: [], negotiation_strategies: [], compliance: [] },
            };
        }

        // 4. AI Analysis
        const businessRules = this.specialTermsService.getTermsContent();
        const analysisPrompt = `
      As a freight logistics expert, analyze these quotes against our business rules.
      
      Quotes Data:
      ${JSON.stringify(structuredQuotes, null, 2)}
      
      Business Rules:
      ${businessRules}
      
      Analytical Summary:
      - Average Price: ${insights.average_price}
      - Cheapest Option: ${insights.cheapest_price} by ${insights.cheapest_carrier}
      - Potential Savings: ${insights.saving_potential}
      
      Tasks:
      1. For EACH carrier, provide a 'Verdict' (Recommend / Negotiate / Avoid) based on price vs rules.
      2. Identify specific Rule Compliance issues for each quote.
      3. Suggest 3-5 high-impact 'Negotiation Strategies' for the user.
      
      CRITICAL: Return ONLY a valid JSON object with the following structure:
      {
        "verdicts": [
          { "carrier": "string", "verdict": "Recommend|Negotiate|Avoid", "reason": "string" }
        ],
        "negotiation_strategies": [
          { "title": "string", "point": "string" }
        ],
        "compliance": [
          { "carrier": "string", "issues": ["string"], "is_compliant": boolean }
        ]
      }
    `;

        const aiResponse = await this.aiService.chat(analysisPrompt);
        let aiAnalysis: any;
        try {
            const jsonStr = aiResponse.replace(/```json|```/g, '').trim();
            aiAnalysis = JSON.parse(jsonStr);
        } catch (e) {
            this.logger.error('Failed to parse AI analysis JSON. Raw response:', aiResponse);
            aiAnalysis = {
                verdicts: [],
                negotiation_strategies: [{ title: "Manual Review Needed", point: "AI response was not in expected format." }],
                compliance: [],
                rawText: aiResponse
            };
        }

        return {
            summary: insights,
            quotes: structuredQuotes,
            ai_analysis: aiAnalysis,
        };
    }

    private calculateInsights(quotes: any[]) {
        if (quotes.length === 0) return null;

        const validQuotes = quotes.filter(q => q.total_amount > 0);
        const prices = validQuotes.map(q => q.total_amount);
        const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

        const cheapest = [...validQuotes].sort((a, b) => a.total_amount - b.total_amount)[0];
        const fastest = [...validQuotes].sort((a, b) => a.transit_time_days - b.transit_time_days)[0];

        const outliers = validQuotes.filter(q => q.total_amount > avgPrice * 1.5);

        // Calculate saving potential (Max - Cheapest)
        const savingPotential = maxPrice > 0 && cheapest ? maxPrice - cheapest.total_amount : 0;

        return {
            total_quotes: quotes.length,
            average_price: avgPrice,
            cheapest_carrier: cheapest?.carrier,
            cheapest_price: cheapest?.total_amount,
            fastest_carrier: fastest?.carrier,
            fastest_days: fastest?.transit_time_days,
            outlier_warnings: outliers.map(q => q.carrier),
            saving_potential: savingPotential,
            currency: cheapest?.currency || 'USD'
        };
    }

    /**
     * Chat with AI about the quotes context (Logistics Co-Pilot).
     * Sends the user message + conversation history + quote analysis context to LLM.
     */
    async chatWithQuotesContext(
        message: string,
        history: { role: string; content: string }[],
        context: any,
    ): Promise<{ reply: string }> {
        this.logger.log(`Chat request: "${message.substring(0, 50)}..."`);

        // Build conversation context for AI
        const contextSummary = context
            ? `\nHere is the quote analysis data the user is looking at:\n${JSON.stringify(context, null, 2)}`
            : '\nNo quote analysis data available yet.';

        // Filter out old mock/system messages from history before sending
        const cleanHistory = history
            .filter(m => !m.content.toLowerCase().includes('mock mode') && !m.content.toLowerCase().includes('chế độ thử nghiệm'))
            .slice(-6);

        const recentHistory = cleanHistory.map(m =>
            `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
        ).join('\n');

        const systemPrompt = `You are "Logistics Co-Pilot", an AI assistant specializing in freight quote comparison and negotiation.

IMPORTANT RULES:
- NEVER mention "mock mode", "testing mode", "chế độ thử nghiệm", or connection status.
- You ARE fully operational. Always answer confidently.
- Respond in the SAME LANGUAGE as the user's message.
- Be concise, practical, and actionable.

Your capabilities:
- Analyze and compare shipping quotes
- Provide cost optimization advice
- Suggest negotiation strategies
- Answer questions about carriers, transit times, rates, and trade terms
${contextSummary}

${recentHistory ? `Recent conversation:\n${recentHistory}\n` : ''}
User: ${message}
Assistant:`;

        try {
            const reply = await this.aiService.chat(systemPrompt);
            return { reply: reply.trim() };
        } catch (error) {
            this.logger.error('Chat with AI failed:', error);
            return { reply: 'Xin lỗi, hệ thống AI đang gặp sự cố. Vui lòng thử lại sau.' };
        }
    }
}
