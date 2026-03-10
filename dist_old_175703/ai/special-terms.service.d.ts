import { OnModuleInit } from '@nestjs/common';
export declare class SpecialTermsService implements OnModuleInit {
    private readonly logger;
    private readonly termsPath;
    private termsContent;
    onModuleInit(): Promise<void>;
    private parsePdfText;
    loadSpecialTerms(): Promise<void>;
    getTermsContent(): string;
}
