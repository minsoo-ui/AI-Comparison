export declare class UploadService {
    private readonly uploadPath;
    constructor();
    saveFile(file: any): Promise<string>;
    getFileContent(filePath: string): Promise<Buffer>;
}
