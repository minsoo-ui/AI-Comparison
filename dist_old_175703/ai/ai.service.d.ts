import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
export declare class AiService implements OnModuleInit {
    private configService;
    private readonly logger;
    private llm;
    private qdrant;
    private ollamaBaseUrl;
    private modelName;
    constructor(configService: ConfigService);
    onModuleInit(): Promise<void>;
    private ensureOllamaRunning;
    private pingOllama;
    private sleep;
    chat(prompt: string): Promise<string>;
    chatLong(prompt: string): Promise<string>;
    getQdrantClient(): QdrantClient;
    isOnline(): Promise<{
        online: boolean;
        model: string;
    }>;
}
