import { OnModuleInit } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
export declare class HscodeService implements OnModuleInit {
    private aiService;
    private readonly logger;
    private readonly collectionName;
    constructor(aiService: AiService);
    onModuleInit(): Promise<void>;
    private initCollection;
    private seedSampleData;
    searchHSCode(description: string): Promise<{
        item: string;
        suggestedHSCode: any;
        confidence: number;
        taxRate: any;
    } | null>;
    calculateTax(value: number, rate: string): Promise<number>;
}
