import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOllama } from '@langchain/ollama';
import { QdrantClient } from '@qdrant/js-client-rest';
import { spawn } from 'child_process';

@Injectable()
export class AiService implements OnModuleInit {
    private readonly logger = new Logger(AiService.name);
    private llm: any;
    private qdrant: QdrantClient;
    private ollamaBaseUrl: string;
    private modelName: string;

    constructor(private configService: ConfigService) { }

    async onModuleInit() {
        const apiBase = this.configService.get<string>('LLM_API_BASE') || 'http://localhost:11434/v1';
        this.ollamaBaseUrl = apiBase.replace('/v1', '');
        this.modelName = this.configService.get<string>('LLM_MODEL') || 'qwen3:4b';

        this.logger.log(`Initializing AI Service with model: ${this.modelName} at ${this.ollamaBaseUrl}`);

        // Step 1: Auto-start Ollama if not running
        await this.ensureOllamaRunning();

        // Step 2: Initialize LLM client
        this.llm = new ChatOllama({
            baseUrl: this.ollamaBaseUrl,
            model: this.modelName,
            temperature: 0, // Force strict adherence to prompts, disable hallucination
        });

        // Step 3: Initialize Qdrant
        this.qdrant = new QdrantClient({
            url: this.configService.get<string>('QDRANT_URL') || 'http://localhost:6333',
        });
    }

    /**
     * Check if Ollama is running, if not → spawn `ollama serve` automatically.
     */
    private async ensureOllamaRunning(): Promise<void> {
        const isRunning = await this.pingOllama();
        if (isRunning) {
            this.logger.log('✅ Ollama is already running.');
            return;
        }

        this.logger.warn('⚠️ Ollama not running. Auto-starting `ollama serve`...');

        try {
            // Spawn ollama serve as a detached background process
            const child = spawn('ollama', ['serve'], {
                detached: true,
                stdio: 'ignore',
                shell: true,
            });
            child.unref(); // Don't keep parent waiting for this child

            // Wait for Ollama to come online (max 15 seconds)
            for (let i = 0; i < 15; i++) {
                await this.sleep(1000);
                const online = await this.pingOllama();
                if (online) {
                    this.logger.log('✅ Ollama auto-started successfully!');
                    return;
                }
                this.logger.log(`⏳ Waiting for Ollama to start... (${i + 1}s)`);
            }

            this.logger.warn('⚠️ Ollama did not start within 15s. AI will run in Mock Mode.');
        } catch (error) {
            this.logger.error(`Failed to auto-start Ollama: ${error.message}`);
            this.logger.warn('💡 Please install Ollama from https://ollama.com and ensure it is in PATH.');
        }
    }

    /**
     * Lightweight ping: check if Ollama HTTP server is responding.
     */
    private async pingOllama(): Promise<boolean> {
        try {
            const response = await fetch(`${this.ollamaBaseUrl}/api/tags`, {
                signal: AbortSignal.timeout(2000),
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Main chat method for user interaction about quote analysis.
     */
    async chat(prompt: string): Promise<string> {
        try {
            const response = await this.llm.invoke(prompt);
            return response.content.toString();
        } catch (error) {
            this.logger.warn(`LLM call failed (${error.message}), returning placeholder response.`);

            if (prompt.includes('Extract information')) {
                return JSON.stringify({
                    data: {
                        carrier: 'Không xác định',
                        total_amount: 0,
                        currency: 'USD',
                        origin: 'N/A',
                        destination: 'N/A'
                    },
                    traceability: {}
                });
            }
            return 'Xin lỗi, tôi không thể kết nối với bộ não AI lúc này. Vui lòng kiểm tra Ollama và thử lại nhé!';
        }
    }

    /**
     * Extended chat method for generating long Markdown reports.
     * Uses higher num_predict to allow the model to write comprehensive analyses.
     */
    async chatLong(prompt: string): Promise<string> {
        try {
            const longLlm = new ChatOllama({
                baseUrl: this.ollamaBaseUrl,
                model: this.modelName,
                temperature: 0,
                numPredict: 4096,
            });
            const response = await longLlm.invoke(prompt);
            return response.content.toString();
        } catch (error) {
            this.logger.warn(`Long LLM call failed (${error.message})`);
            return 'Xin lỗi, AI không thể tạo báo cáo phân tích lúc này. Vui lòng thử lại.';
        }
    }

    getQdrantClient() {
        return this.qdrant;
    }

    /**
     * Health check: ping Ollama to verify if the LLM is reachable.
     */
    async isOnline(): Promise<{ online: boolean; model: string }> {
        const online = await this.pingOllama();
        return { online, model: this.modelName || 'unknown' };
    }
}

