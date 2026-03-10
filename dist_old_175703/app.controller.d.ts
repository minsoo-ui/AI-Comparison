import { AppService } from './app.service';
import { SpecialTermsService } from './ai/special-terms.service';
import { ExtractService } from './ai/extract.service';
import { HscodeService } from './hscode/hscode.service';
import { AiService } from './ai/ai.service';
export declare class AppController {
    private readonly appService;
    private readonly specialTermsService;
    private readonly extractService;
    private readonly hscodeService;
    private readonly aiService;
    private readonly logger;
    constructor(appService: AppService, specialTermsService: SpecialTermsService, extractService: ExtractService, hscodeService: HscodeService, aiService: AiService);
    getHello(): string;
    getAiHealth(): Promise<{
        online: boolean;
        model: string;
    }>;
    getDatabaseFiles(): Promise<{
        id: number;
        name: string;
        size: string;
        updatedAt: string;
        status: string;
        description: string;
    }[]>;
    getTrashFiles(): Promise<any[]>;
    restoreTrashFiles(filenames: string[]): Promise<{
        message: string;
        restored: string[];
    }>;
    emptyTrash(): Promise<{
        message: string;
    }>;
    openDatabaseFolder(): {
        success: boolean;
        message: string;
    };
    testFoundation(): Promise<{
        status: string;
        stage: string;
        results: {
            specialTerms: any;
            extraction: any;
            hscodeVectorSearch: any;
        };
    }>;
}
