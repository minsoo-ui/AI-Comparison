import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { UploadService } from '../upload/upload.service';
import { OcrService } from '../ai/ocr.service';
import { ExtractService } from '../ai/extract.service';
import { SpecialTermsService } from '../ai/special-terms.service';
import { TermPreprocessorService } from '../ai/term-preprocessor.service';
import { AiService } from '../ai/ai.service';
import * as path from 'path';

@Injectable()
export class QuoteService {
  private readonly logger = new Logger(QuoteService.name);

  constructor(
    @InjectQueue('quote-extraction') private readonly quoteQueue: Queue,
    private uploadService: UploadService,
    private ocrService: OcrService,
    private extractService: ExtractService,
    private specialTermsService: SpecialTermsService,
    private termPreprocessorService: TermPreprocessorService,
    private aiService: AiService,
  ) {}

  async queueExtraction(filePaths: string[]): Promise<{ jobId: string }> {
    const job = await this.quoteQueue.add('extract', { filePaths });
    return { jobId: job.id as string };
  }

  async getJobStatus(jobId: string): Promise<any> {
    const job = await this.quoteQueue.getJob(jobId);
    if (!job) return null;

    return {
      id: job.id,
      status: await job.getState(),
      progress: job.progress,
      result: job.returnvalue,
      failedReason: job.failedReason,
    };
  }

  async compareQuotes(filePaths: string[]): Promise<any> {
    this.logger.log(
      `[Map-Reduce] Starting comparison for ${filePaths.length} files...`,
    );

    // ── PHASE 1: MAP — Process each file individually ──
    const mapResults = await Promise.all(
      filePaths.map(async (filePath) => this.mapProcessFile(filePath)),
    );

    // ── PHASE 2: REDUCE — Synthesize results ──
    return await this.reduceResults(mapResults);
  }

  /**
   * MAP Phase: Process a single file to extract raw text and structured data.
   */
  private async mapProcessFile(filePath: string) {
    const fileName = path.basename(filePath);
    this.logger.log(`[Map] Processing file: ${fileName}`);

    const buffer = await this.uploadService.getFileContent(filePath);
    // 1. OCR
    const ocrResult = await this.ocrService.extractText(buffer, fileName);
    let text = ocrResult.text;
    this.logger.log(
      `OCR complete for ${fileName}, text length: ${text.length}`,
    );

    // Classification within Map phase
    const type = this.classifyFile(fileName, text);

    let structuredData = null;
    let traceability = null;
    if (type === 'quote') {
      const quoteSchema = {
        carrier: 'string',
        origin: 'string',
        destination: 'string',
        total_amount: 'number',
        currency: 'string',
        transit_time_days: 'number',
        valid_until: 'string',
      };

      // 2. Preprocess specialized terminology
      text = this.termPreprocessorService.processText(text);
      this.logger.log(
        `Term preprocessing complete for ${fileName}, new text length: ${text.length}`,
      );

      // 3. Phân tích trích xuất dữ liệu có cấu trúc (Structured Extraction)
      // Dùng text đã qua tiền xử lý

      const extraction = await this.extractService.extractData(
        text,
        quoteSchema,
      );
      structuredData = extraction.data;
      traceability = extraction.traceability;
      this.logger.log(`Extraction complete for ${fileName}`);
    }

    return {
      path: filePath,
      fileName,
      text,
      ocrResult, // Lưu trữ toàn bộ kết quả OCR bao gồm bbox/pages
      type,
      structuredData,
      traceability,
    };
  }

  private classifyFile(
    fileName: string,
    text: string,
  ): 'quote' | 'rfq' | 'terms' {
    const lowerText = (fileName + ' ' + text).toLowerCase();
    if (
      lowerText.includes('common') ||
      lowerText.includes('term') ||
      lowerText.includes('thuật ngữ')
    ) {
      return 'terms';
    } else if (
      lowerText.includes('hỏi cước') ||
      lowerText.includes('thông tin') ||
      lowerText.includes('rfq') ||
      lowerText.includes('request')
    ) {
      return 'rfq';
    }
    return 'quote';
  }

  /**
   * REDUCE Phase: Aggregate all results and generate reports.
   */
  private async reduceResults(mapResults: any[]) {
    this.logger.log(
      `[Reduce] Aggregating results from ${mapResults.length} maps...`,
    );

    const terms = mapResults
      .filter((r) => r.type === 'terms')
      .map((r) => r.text);
    const rfqContext = mapResults
      .filter((r) => r.type === 'rfq')
      .map((r) => r.text)
      .join('\n\n');
    const quotes = mapResults.filter((r) => r.type === 'quote');

    // Global terms logic
    const staticTerms = this.specialTermsService.getTermsContent();
    const allTerms = [staticTerms, ...terms].filter(Boolean).join('\n\n');

    // Structured data stats
    const structuredQuotes = quotes.map((q) => ({
      ...q.structuredData,
      sourceFile: q.path,
    }));
    const summary = this.calculateInsights(structuredQuotes);

    // Markdown report synthesis
    const quoteTextsBlock = quotes
      .map(
        (q, i) =>
          `=== BÁO GIÁ #${i + 1}: "${q.fileName}" ===\n${q.text}\n=== KẾT THÚC BÁO GIÁ #${i + 1} ===`,
      )
      .join('\n\n');

    const analysisPrompt = this.buildAnalysisPrompt(
      quoteTextsBlock,
      allTerms,
      rfqContext,
      quotes.length,
    );

    this.logger.log('[Reduce] Generating Markdown expert report...');
    const markdownReport = await this.aiService.chatLong(analysisPrompt);

    // Build traceability map for expert report
    const traceabilityMap = {};
    quotes.forEach((q) => {
      const data = q.structuredData;
      // q.ocrResult is from ocrService.extractText
      const pages = q.ocrResult.pages || [];

      const fieldsToTrace = [
        { key: 'total_amount', label: `${data.total_amount}` },
        { key: 'carrier', label: data.carrier },
        { key: 'origin', label: data.origin },
        { key: 'destination', label: data.destination },
      ];

      fieldsToTrace.forEach((f) => {
        const val = data[f.key];
        if (val) {
          // Search in OCR pages for this value
          for (const page of pages) {
            const match = page.blocks.find((block) =>
              block.text.toLowerCase().includes(String(val).toLowerCase()),
            );
            if (match) {
              // Map the EXACT string appearing in report to this trace
              traceabilityMap[String(val)] = {
                filename: q.fileName,
                bbox: match.bbox,
                carrier: data.carrier,
                sourceFile: q.path,
                confidence: data.confidence || 0.9,
              };
              // Also map the label if it's different
              if (f.label !== String(val)) {
                traceabilityMap[f.label] = traceabilityMap[String(val)];
              }
              break;
            }
          }
        }
      });
    });

    return {
      summary,
      quotes: structuredQuotes,
      markdown_report: markdownReport,
      traceability_map: traceabilityMap,
      file_classification: {
        common_terms: terms.length,
        rfq: rfqContext ? 1 : 0,
        quotes: quotes.map((q) => q.fileName),
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
    quoteCount: number,
  ): string {
    return `/no_think
Bạn là một CHUYÊN GIA LOGISTICS cao cấp với hơn 15 năm kinh nghiệm trong ngành vận tải biển quốc tế.

NHIỆM VỤ: Phân tích ${quoteCount} báo giá vận chuyển dưới đây và viết một BÁO CÁO PHÂN TÍCH CHI TIẾT bằng tiếng Việt.

${rfqContext ? `## YÊU CẦU HỎI CƯỚC CỦA KHÁCH HÀNG:\n${rfqContext}\n` : ''}

## THUẬT NGỮ CHUYÊN MÔN (dùng để hiểu các viết tắt trong báo giá):
${terms || 'Không có thuật ngữ bổ sung.'}

## CÁC BÁO GIÁ CẦN PHÂN TÍCH:
${quoteTexts}

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
- Các khoản chưa bao gồm (PSS, CAF, v.v.)

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

QUAN TRỌNG:
- TUYỆT ĐỐI KHÔNG BỊA ĐẶT số liệu hoặc tên hãng tàu
- Nếu thông tin không có trong file, ghi rõ "Không chỉ định" hoặc "Không có dữ liệu"
- Tất cả nội dung PHẢI BẰNG TIẾNG VIỆT
- TRACEABILITY: Hãy wrap các giá trị quan trọng (tên carrier, số tiền, tên cảng) trong dấu **bold** (VD: **CMA CGM**, **USD 1200**) để hệ thống kích hoạt tính năng truy xuất nguồn gốc.
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
}
