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
      Là một chuyên gia logistics, hãy phân tích các báo giá sau đây dựa trên quy tắc kinh doanh của chúng tôi.
      
      Dữ liệu báo giá (TRÍCH XUẤT TỪ FILE NGƯỜI DÙNG):
      ${JSON.stringify(structuredQuotes, null, 2)}
      
      Quy tắc kinh doanh:
      ${businessRules}
      
      Tóm tắt phân tích:
      - Giá trung bình: ${insights.average_price}
      - Lựa chọn rẻ nhất: ${insights.cheapest_price} bởi ${insights.cheapest_carrier}
      - Tiềm năng tiết kiệm: ${insights.saving_potential}
      
      NHIỆM VỤ CỦA BẠN LÀ PHÂN TÍCH CHÍNH XÁC DATA TRÊN, TUYỆT ĐỐI KHÔNG BỊA ĐẶT (ZERO HALLUCINATION):
      1. Với MỖI 'carrier' có TRONG dữ liệu, hãy đưa ra 'Verdict' (Recommend / Negotiate / Avoid) dựa trên giá so với quy tắc. NẾU KHÔNG CÓ CARRIER NÀO HỢP LỆ, TRẢ VỀ MẢNG RỖNG [].
      2. Xác định các vấn đề tuân thủ (Compliance) cụ thể cho từng báo giá đang xem xét. NẾU KHÔNG BIẾT THÌ BỎ QUA.
      3. Gợi ý 1-3 'Chiến lược đàm phán' (Negotiation Strategies) thực tế dựa trên dữ liệu báo giá này. KHÔNG NÓI CHUNG CHUNG.
      
      YÊU CẦU QUAN TRỌNG:
      - TẤT CẢ nội dung 'reason', 'title', 'point', 'issues' PHẢI BẰNG TIẾNG VIỆT.
      - Trả về DUY NHẤT một đối tượng JSON hợp lệ theo cấu trúc sau:
      {
        "verdicts": [
          { "carrier": "string", "verdict": "Recommend|Negotiate|Avoid", "reason": "nội dung tiếng Việt" }
        ],
        "negotiation_strategies": [
          { "title": "tiêu đề tiếng Việt", "point": "chi tiết tiếng Việt" }
        ],
        "compliance": [
          { "carrier": "string", "issues": ["vấn đề tiếng Việt"], "is_compliant": boolean }
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
                negotiation_strategies: [{ title: "Cần xem xét thủ công", point: "Phản hồi từ AI không đúng định dạng. Vui lòng thử lại hoặc kiểm tra file gốc." }],
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

        const systemPrompt = `Bạn là "Logistics Co-Pilot", một trợ lý AI chuyên về so sánh báo giá vận chuyển và đàm phán hợp đồng.
        
BẮT BUỘC:
- NGÔN NGỮ TRẢ LỜI: LUÔN LUÔN TRẢ LỜI BẰNG TIẾNG VIỆT.
- DỰA TRÊN DỮ LIỆU: Chỉ phân tích dựa trên dữ liệu báo giá người dùng đã cung cấp ở bên dưới.
- ZERO HALLUCINATION: NẾU NGƯỜI DÙNG HỎI THÔNG TIN KHÔNG CÓ TRONG DATA HOẶC FILE, HÃY TRẢ LỜI RẰNG "TÔI KHÔNG TÌM THẤY THÔNG TIN NÀY TRONG BÁO GIÁ". TUYỆT ĐỐI KHÔNG BỊA RA CÂU TRẢ LỜI HOẶC SỐ LIỆU.
- KHÔNG đề cập đến "chế độ thử nghiệm", "mock mode", hoặc tình trạng kết nối.
- Hãy tự tin, súc tích và đưa ra các lời khuyên thực tế.

Thông tin báo giá hiện tại (Dữ liệu gốc từ file của người dùng):
${contextSummary}

${recentHistory ? `Lịch sử trò chuyện:\n${recentHistory}\n` : ''}
Người dùng: ${message}
Trợ lý (Trả lời bằng tiếng Việt):`;

        try {
            const reply = await this.aiService.chat(systemPrompt);
            return { reply: reply.trim() };
        } catch (error) {
            this.logger.error('Chat with AI failed:', error);
            return { reply: 'Xin lỗi, hệ thống AI đang gặp sự cố. Vui lòng thử lại sau.' };
        }
    }
}
