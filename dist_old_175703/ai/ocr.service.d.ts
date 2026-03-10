export declare class OcrService {
    private readonly logger;
    private paddleOcr;
    constructor();
    private initPaddleOcr;
    private parsePdfText;
    private parsePdfInfo;
    extractText(buffer: Buffer, fileName?: string): Promise<string>;
    extractTextFromPdf(buffer: Buffer): Promise<string>;
    extractMetadata(buffer: Buffer): Promise<any>;
}
