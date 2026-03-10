import { HscodeService } from './hscode.service';
export declare class HscodeController {
    private readonly hscodeService;
    constructor(hscodeService: HscodeService);
    search(query: string): Promise<{
        item: string;
        suggestedHSCode: any;
        confidence: number;
        taxRate: any;
    } | null>;
    calculate(value: number, rate: string): Promise<{
        value: number;
        taxRate: string;
        taxAmount: number;
        totalWithTax: number;
    }>;
}
