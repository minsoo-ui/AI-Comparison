import { AiService } from './ai.service';
export declare class ExtractService {
    private aiService;
    private readonly logger;
    constructor(aiService: AiService);
    extractData(text: string, schema: any): Promise<any>;
}
