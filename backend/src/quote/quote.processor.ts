import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QuoteService } from './quote.service';
import { QuoteGateway } from './quote.gateway';

@Processor('quote-extraction', { concurrency: 1 })
export class QuoteProcessor extends WorkerHost {
    private readonly logger = new Logger(QuoteProcessor.name);

    constructor(
        private readonly quoteService: QuoteService,
        private readonly quoteGateway: QuoteGateway,
    ) {
        super();
    }

    async process(job: Job<{ filePaths: string[] }, any, string>): Promise<any> {
        this.logger.log(`Processing extraction job ${job.id} for ${job.data.filePaths.length} files...`);
        this.quoteGateway.emitStatus(job.id as string, { status: 'active', progress: 0 });

        try {
            // Update job progress if needed
            await job.updateProgress(10);
            this.quoteGateway.emitStatus(job.id as string, { status: 'active', progress: 10 });

            // Execute the existing heavy logic from QuoteService
            // Note: In a real Map-Reduce, we might split this into sub-jobs, 
            // but for now, we're just moving the main task to background.
            const result = await this.quoteService.compareQuotes(job.data.filePaths);

            await job.updateProgress(100);
            this.quoteGateway.emitStatus(job.id as string, { status: 'completed', progress: 100, result });
            this.logger.log(`Job ${job.id} completed successfully.`);
            
            return result;
        } catch (error) {
            this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
            this.quoteGateway.emitStatus(job.id as string, { status: 'failed', progress: 0, error: error.message });
            throw error;
        }
    }
}
