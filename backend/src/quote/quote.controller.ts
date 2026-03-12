import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { QuoteService } from './quote.service';

@Controller('quote')
export class QuoteController {
    constructor(private readonly quoteService: QuoteService) { }

    @Post('compare')
    async compare(@Body('filePaths') filePaths: string[]) {
        if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
            throw new BadRequestException('Provide an array of filePaths to compare.');
        }
        return await this.quoteService.queueExtraction(filePaths);
    }

    @Post('job-status')
    async getStatus(@Body('jobId') jobId: string) {
        if (!jobId) {
            throw new BadRequestException('Provide a jobId.');
        }
        const status = await this.quoteService.getJobStatus(jobId);
        if (!status) {
            throw new BadRequestException('Job not found.');
        }
        return status;
    }

    @Post('chat')
    async chat(@Body() payload: { message: string; history: any[]; context: any }) {
        if (!payload.message) {
            throw new BadRequestException('Bắt buộc phải có message.');
        }
        return await this.quoteService.chatWithQuotesContext(
            payload.message,
            payload.history || [],
            payload.context || null
        );
    }
}
