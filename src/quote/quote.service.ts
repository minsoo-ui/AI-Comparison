import { Injectable, Logger } from '@nestjs/common';
import { UploadService } from '../upload/upload.service';
import { OcrService } from '../ai/ocr.service';
import { ExtractService } from '../ai/extract.service';
import { SpecialTermsService } from '../ai/special-terms.service';
import { AiService } from '../ai/ai.service';
import { QuoteGateway } from './quote.gateway';
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
    private quoteGateway: QuoteGateway,
  ) {}

  async compareQuotes(filePaths: string[]): Promise<any> {
    this.logger.log(`Comparing ${filePaths.length} quotes...`);
    this.quoteGateway.emitLog('info', 'SYSTEM', `Starting comparison for ${filePaths.length} files...`);

    // ── STEP 1: OCR — Extract raw text from ALL files (parallel) ──
    const rawTexts = await Promise.all(
      filePaths.map(async (filePath) => {
        const buffer = await this.uploadService.getFileContent(filePath);
        const fileName = path.basename(filePath);
        this.quoteGateway.emitLog('info', 'OCR', `Processing file: ${fileName}`);
        const text = await this.ocrService.extractText(buffer, fileName);
        this.quoteGateway.emitLog('success', 'OCR', `Extracted & Cleaned: ${fileName}`);
        return { path: filePath, fileName, text };
      }),
    );

    // ── STEP 2: Classify files ──
    const commonTermsTexts: string[] = [];
    const rfqTexts: string[] = [];
    const quoteItems: typeof rawTexts = [];

    for (const item of rawTexts) {
      const lowerName = item.fileName.toLowerCase();
      if (
        lowerName.includes('common') ||
        lowerName.includes('term') ||
        lowerName.includes('thuật ngữ')
      ) {
        commonTermsTexts.push(
          `--- Thuật ngữ từ "${item.fileName}" ---\n${item.text}`,
        );
      } else if (
        lowerName.includes('hỏi cước') ||
        lowerName.includes('thông tin') ||
        lowerName.includes('rfq') ||
        lowerName.includes('request')
      ) {
        rfqTexts.push(
          `--- Yêu cầu hỏi cước từ "${item.fileName}" ---\n${item.text}`,
        );
      } else {
        quoteItems.push(item);
      }
    }

    this.logger.log(
      `Classified: ${commonTermsTexts.length} terms, ${rfqTexts.length} RFQ, ${quoteItems.length} quotes`,
    );
    this.quoteGateway.emitLog('info', 'SYSTEM', `Classified: ${quoteItems.length} quotes found.`);

    // ── STEP 3: Per-file structured extraction (batched to keep Ollama responsive) ──
    const quoteSchema = {
      carrier: 'string',
      origin: 'string',
      destination: 'string',
      total_amount: 'number',
      currency: 'string',
      transit_time_days: 'number',
      valid_until: 'string',
    };

    const structuredQuotes: any[] = [];
    const BATCH_SIZE = 2;
    
    for (let i = 0; i < quoteItems.length; i += BATCH_SIZE) {
      const batch = quoteItems.slice(i, i + BATCH_SIZE);
      this.logger.log(`Processing extraction batch ${Math.floor(i/BATCH_SIZE) + 1}...`);
      
      const batchResults = await Promise.all(
        batch.map(async (item) => {
          this.quoteGateway.emitLog('info', 'LLM', `Extracting structured data from: ${item.fileName}`);
          const extraction = await this.extractService.extractData(
            item.text,
            quoteSchema,
          );
          this.quoteGateway.emitLog('success', 'LLM', `Structured data extracted for: ${item.fileName}`);
          return {
            ...extraction.data,
            ...extraction.data,
            traceability: extraction.traceability,
            sourceFile: item.fileName, // Use base filename for easy cross-referencing in citations
          };
        })
      );
      structuredQuotes.push(...batchResults);
    }

    // ── STEP 4: Calculate stat card insights from structured data ──
    const summary = this.calculateInsights(structuredQuotes);

    // ── STEP 5: Build context and generate Markdown expert report ──
    const staticTerms = this.specialTermsService.getTermsContent();
    const allTerms = [staticTerms, ...commonTermsTexts]
      .filter(Boolean)
      .join('\n\n');
    const rfqContext = rfqTexts.join('\n\n');

    const quoteTextsBlock = quoteItems
      .map(
        (item, i) =>
          `=== BÁO GIÁ #${i + 1}: "${item.fileName}" ===\n${item.text}\n=== KẾT THÚC BÁO GIÁ #${i + 1} ===`,
      )
      .join('\n\n');

    const analysisPrompt = this.buildAnalysisPrompt(
      quoteTextsBlock,
      allTerms,
      rfqContext,
      structuredQuotes,
    );

    this.logger.log('Generating Markdown expert report via chatLong...');
    this.quoteGateway.emitLog('info', 'LLM', 'Generating final expert comparison report...');

    // Implement LangChain callbacks for tracing
    const callbacks = [
      {
        handleLLMStart: () => this.quoteGateway.emitLog('info', 'LLM', 'AI Analysis started...'),
        handleLLMNewToken: (token: string) => {
          // Optional: handle streaming tokens if needed
        },
        handleLLMEnd: () => this.quoteGateway.emitLog('success', 'LLM', 'AI Analysis complete.'),
        handleLLMError: (err: any) => this.quoteGateway.emitLog('error', 'LLM', `AI Error: ${err.message}`),
      },
    ];

    const rawMarkdownReport = await this.aiService.chatLong(analysisPrompt, callbacks);
    const markdownReport = this.deduplicateText(rawMarkdownReport);
    this.quoteGateway.emitLog('success', 'SYSTEM', 'Comparison finished successfully.');

    // ── STEP 6: Return combined result ──
    return {
      summary,
      quotes: structuredQuotes,
      markdown_report: markdownReport,
      file_classification: {
        common_terms: commonTermsTexts.length,
        rfq: rfqTexts.length,
        quotes: quoteItems.map((q) => q.fileName),
      },
    };
  }

  /**
   * Build the expert analysis prompt for generating a Markdown report.
   */
  private buildAnalysisPrompt(
    quoteTexts: string,
    terms: string,
    rfqContext: string,
    structuredQuotes: any[],
  ): string {
    const quoteCount = structuredQuotes.length;
    // Prepare a summary of extracted data for LLM to use as ground truth for citations
    const groundTruth = structuredQuotes.map((q, i) => {
      return `BÁO GIÁ #${i+1} (${q.sourceFile}): 
- Carrier: ${q.carrier} (Nguồn trích dẫn: "${q.traceability?.carrier || 'N/A'}")
- Ocean Freight: ${q.total_amount} ${q.currency} (Nguồn trích dẫn: "${q.traceability?.total_amount || 'N/A'}")
- Transit Time: ${q.transit_time_days} days (Nguồn trích dẫn: "${q.traceability?.transit_time_days || 'N/A'}")
- Validity: ${q.valid_until} (Nguồn trích dẫn: "${q.traceability?.valid_until || 'N/A'}")`;
    }).join('\n\n');

    return `/no_think
Bạn là một CHUYÊN GIA LOGISTICS cao cấp với hơn 15 năm kinh nghiệm trong ngành vận tải biển quốc tế.

NHIỆM VỤ: Phân tích ${quoteCount} báo giá vận chuyển dưới đây và viết một BÁO CÁO PHÂN TÍCH CHI TIẾT bằng tiếng Việt.

${rfqContext ? `## YÊU CẦU HỎI CƯỚC CỦA KHÁCH HÀNG:\n${rfqContext}\n` : ''}

## THUẬT NGỮ CHUYÊN MÔN (dùng để hiểu các viết tắt trong báo giá):
${terms || 'Không có thuật ngữ bổ sung.'}

## CÁC BÁO GIÁ CẦN PHÂN TÍCH:
${quoteTexts}

## DỮ LIỆU ĐÃ TRÍCH XUẤT (Dùng để lấy văn bản gốc làm dẫn chứng):
${groundTruth}

## YÊU CẦU BÁO CÁO:

Hãy viết báo cáo với cấu trúc Markdown sau. PHẢI dựa 100% trên dữ liệu có trong file, KHÔNG được bịa đặt:

### Phân tích báo giá từ các file uploaded
- Phân tích từng đại lý cung cấp báo giá gì (FCL hay LCL, POL nào, POD nào)
- So sánh với yêu cầu hỏi cước của khách (nếu có)
- Nêu rõ khác biệt quan trọng (VD: yêu cầu FCL từ Ningbo nhưng được báo LCL từ Shenzhen)

### Lưu ý quan trọng
- Validity (hiệu lực báo giá)
- Đơn vị tiền tệ
- Cách tính phí (CBM, RT, per container...)
- Các khoản chưa bao gồm (PSS, CAF, v.v.): PHẢI LIỆT KÊ DUY NHẤT 1 LẦN, KHÔNG LẶP LẠI.

### Bảng so sánh chi tiết
Tạo bảng Markdown với các cột phù hợp, ví dụ:
| Đại lý / Carrier | Loại hàng | POL → POD | Ocean Freight | Local Charges tại POD | FCA Charges | Tổng chi phí ước tính (USD) | Transit Time | Free Time tại POD |

Mỗi hàng là một option từ báo giá. Nếu một file có nhiều option (nhiều hãng tàu), tách thành nhiều hàng.

### Kết luận: Bên nào có giá tốt nhất?
- Phân tích ưu nhược từng bên dựa trên yêu cầu hỏi cước
- So sánh tổng chi phí ước tính
- Đưa ra lời khuyên cụ thể

### Insight thêm
- Gợi ý đàm phán cụ thể
- Cảnh báo về phí ẩn, mùa cao điểm, validity sắp hết
- Lưu ý về sự khác biệt FCL vs LCL cho volume đã cho

QUAN TRỌNG VỀ TRÍCH DẪN NGUỒN (EVIDENCE TRACEABILITY):
- Mỗi khi nêu một con số quan trọng (Carrier, Ocean Freight, Transit Time), PHẢI kèm theo trích dẫn nguồn ngay sau đó.
- Định dạng trích dẫn: \`[Nguồn: "text gốc", file: "tên_file.pdf"]\`
- Ví dụ: "...mức giá **450 USD** [Nguồn: "Freight: 450USD/CTR", file: "FedEx_Quote.pdf"]..."
- TUYỆT ĐỐI KHÔNG BỊA ĐẶT số liệu hoặc tên hãng tàu
- TUYỆT ĐỐI KHÔNG lặp lại cùng một thông tin nhiều lần.
- Nếu thông tin không có trong file, ghi rõ "Không chỉ định" hoặc "Không có dữ liệu"
- Tất cả nội dung PHẢI BẰNG TIẾNG VIỆT
- Trả về DUY NHẤT nội dung Markdown, KHÔNG kèm lời giải thích bên ngoài
`;
  }

  /**
   * Calculate stat card insights from per-file structured extraction data.
   */
  private calculateInsights(quotes: any[]) {
    if (quotes.length === 0) return null;

    const validQuotes = quotes.filter((q) => q.total_amount > 0);
    const prices = validQuotes.map((q) => q.total_amount);
    const avgPrice =
      prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

    const cheapest = [...validQuotes].sort(
      (a, b) => a.total_amount - b.total_amount,
    )[0];
    const fastest = [...validQuotes].sort(
      (a, b) => a.transit_time_days - b.transit_time_days,
    )[0];

    const outliers = validQuotes.filter((q) => q.total_amount > avgPrice * 1.5);
    const savingPotential =
      maxPrice > 0 && cheapest ? maxPrice - cheapest.total_amount : 0;

    return {
      total_quotes: quotes.length,
      average_price: avgPrice,
      cheapest_carrier: cheapest?.carrier,
      cheapest_price: cheapest?.total_amount,
      fastest_carrier: fastest?.carrier,
      fastest_days: fastest?.transit_time_days,
      outlier_warnings: outliers.map((q) => q.carrier),
      saving_potential: savingPotential,
      currency: cheapest?.currency || 'USD',
    };
  }

  /**
   * Chat with AI about the quotes context (Logistics Co-Pilot).
   */
  async chatWithQuotesContext(
    message: string,
    history: { role: string; content: string }[],
    context: any,
  ): Promise<{ reply: string }> {
    this.logger.log(`Chat request: "${message.substring(0, 50)}..."`);

    // Use markdown_report as primary context if available
    let contextSummary: string;
    if (context?.markdown_report) {
      contextSummary = `\nDưới đây là báo cáo phân tích báo giá:\n${context.markdown_report}`;
    } else if (context) {
      contextSummary = `\nDữ liệu phân tích:\n${JSON.stringify(context, null, 2)}`;
    } else {
      contextSummary = '\nChưa có dữ liệu phân tích báo giá.';
    }

    const cleanHistory = history
      .filter(
        (m) =>
          !m.content.toLowerCase().includes('mock mode') &&
          !m.content.toLowerCase().includes('chế độ thử nghiệm'),
      )
      .slice(-6);

    const recentHistory = cleanHistory
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const systemPrompt = `/no_think
Bạn là "Logistics Co-Pilot", một trợ lý AI chuyên về so sánh báo giá vận chuyển và đàm phán hợp đồng.
        
BẮT BUỘC:
- NGÔN NGỮ: LUÔN TRẢ LỜI BẰNG TIẾNG VIỆT.
- DỰA TRÊN DỮ LIỆU: Chỉ phân tích dựa trên báo cáo phân tích bên dưới.
- ZERO HALLUCINATION: Nếu không tìm thấy thông tin, trả lời "Tôi không tìm thấy thông tin này trong báo giá".
- KHÔNG đề cập "chế độ thử nghiệm" hoặc "mock mode".
- Trả lời súc tích, thực tế.

${contextSummary}

${recentHistory ? `Lịch sử trò chuyện:\n${recentHistory}\n` : ''}
Người dùng: ${message}
Trợ lý (Trả lời bằng tiếng Việt):`;

    try {
      const reply = await this.aiService.chat(systemPrompt);
      return { reply: reply.trim() };
    } catch (error) {
      this.logger.error('Chat with AI failed:', error);
      return {
        reply: 'Xin lỗi, hệ thống AI đang gặp sự cố. Vui lòng thử lại sau.',
      };
    }
  }

  /**
   * Helper to remove repetitive phrases or sequences that sometimes occur in small LLM outputs.
   */
  private deduplicateText(text: string): string {
    if (!text) return text;

    // Pattern 1: Deduplicate comma-separated lists (like "PSS, CAF, PSS, CAF")
    // This looks for 2-8 uppercase chars followed by comma, repeating 2+ times.
    let cleaned = text.replace(/(([A-Z]{2,8}),\s?)\1+/g, '$1'); 

    // Pattern 2: Deduplicate longer sentence chunks (20-150 chars) that repeat exactly.
    // We use a non-greedy catch to find the smallest repeating unit.
    cleaned = cleaned.replace(/(.{20,150}?)\1{2,}/g, '$1');

    return cleaned;
  }
}
