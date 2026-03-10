import { QuoteService } from './quote.service';
export declare class QuoteController {
    private readonly quoteService;
    constructor(quoteService: QuoteService);
    compare(filePaths: string[]): Promise<any>;
    chat(payload: {
        message: string;
        history: any[];
        context: any;
    }): Promise<{
        reply: string;
    }>;
}
