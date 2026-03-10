import { UploadService } from './upload.service';
export declare class UploadController {
    private readonly uploadService;
    constructor(uploadService: UploadService);
    uploadFiles(files: any[]): Promise<{
        message: string;
        paths: string[];
    }>;
    uploadRuleFiles(files: any[]): Promise<{
        message: string;
        paths: string[];
    }>;
    deleteRuleFile(filename: string): Promise<{
        message: string;
    }>;
    multiDeleteRuleFiles(filenames: string[]): Promise<{
        message: string;
        deleted: string[];
    }>;
}
