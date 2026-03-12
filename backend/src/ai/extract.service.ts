import { Injectable, Logger } from '@nestjs/common';
import { AiService } from './ai.service';
import { z } from 'zod';

const QuoteValidationSchema = z.object({
  data: z
    .object({
      agent_name: z
        .string()
        .describe(
          "Tên của đại lý forwarder, logistics, hoặc carrier ban hành báo giá (VD: DHL, Maersk). Trả về 'N/A' nếu không thấy.",
        ),
      carrier: z
        .string()
        .describe(
          "Tên hãng tàu hoặc hãng vận chuyển thực tế (VD: Evergreen, CMA CGM). Trả về 'N/A' nếu không thấy.",
        ),
      origin: z
        .string()
        .describe(
          "Cảng đi (Port of Loading - POL). Trả về 'N/A' nếu không thấy.",
        ),
      destination: z
        .string()
        .describe(
          "Cảng đến (Port of Discharge - POD). Trả về 'N/A' nếu không thấy.",
        ),
      total_amount: z
        .number()
        .describe(
          'Tổng chi phí (final price) cuối cùng. Trả về 0 nếu không chắc chắn.',
        ),
      currency: z
        .string()
        .describe(
          "Đơn vị tiền tệ chính sách (VD: USD, VND, EUR). Trả về 'N/A' nếu không thấy.",
        ),
      transit_time_days: z
        .number()
        .describe(
          'Thời gian vận chuyển tính bằng ngày (transit time). Trả về 0 nếu không có.',
        ),
      valid_until: z
        .string()
        .describe(
          "Ngày hết hạn hoặc thời gian báo giá có hiệu lực (Validity). Trả về 'N/A' nếu không thấy.",
        ),
      chargeable_rt: z
        .number()
        .describe(
          'Tổng số khối (CBM/RT) đối với hàng LCL. Trả về 0 nếu là FCL hoặc không có.',
        ),
      of_rate_per_rt: z
        .number()
        .describe(
          'Ocean freight (Cước biển) trên mỗi RT/CBM đối với hàng LCL. Trả về 0 nếu không có.',
        ),
    })
    .describe(
      'Dữ liệu trích xuất phẳng chứa thông tin chung về báo giá FCL/LCL.',
    ),
  traceability: z
    .record(z.string(), z.string())
    .describe(
      "Mapping từ tên trường (VD: 'total_amount') tới ĐOẠN TEXT GỐC TRÍCH XUẤT ĐƯỢC để kiểm chứng hệ thống.",
    ),
});

@Injectable()
export class ExtractService {
  private readonly logger = new Logger(ExtractService.name);

  constructor(private aiService: AiService) {}

  async extractData(text: string, schema: any): Promise<any> {
    const prompt = `
      Extract information from the following shipping quote text based on the provided schema structure.
      
      CRITICAL INSTRUCTIONS:
      1. IGNORE metadata such as "Microsoft: Print to PDF", printer names, or PDF software.
      2. 'agent_name' & 'carrier' MUST be the name of the logistics company or shipping line. Nếu KHÔNG TÌM THẤY tên cụ thể, trả về "N/A".
      3. 'total_amount' MUST be the final explicit price found in the quote. If no price is found, DO NOT hallucinate; return 0.
      4. ZERO HALLUCINATION POLICY: DO NOT invent, guess, or make up any data. Only extract what is explicitly written in the Text.
      5. TRACEABILITY: For extracted fields, copy the EXACT snippet from the source text as the value in the traceability dictionary.
      
      Shipping Quote Text: 
      """
      ${text}
      """
    `;

    try {
      const result = await this.aiService.chatWithStructuredOutput(
        prompt,
        QuoteValidationSchema,
      );

      if (!result) {
        throw new Error(
          'Structured output returned null or rejected construction.',
        );
      }

      return result;
    } catch (error) {
      this.logger.error('Error extracting data:', error);
      // Theo như yêu cầu của ứng dụng, khi ExtractService lỗi, báo giá vẫn cần render map empty
      return {
        data: {
          carrier: 'Không xác định',
          origin: 'N/A',
          destination: 'N/A',
          total_amount: 0,
          currency: 'USD',
        },
        traceability: {},
      };
    }
  }
}
