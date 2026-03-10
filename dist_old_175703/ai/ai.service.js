"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ollama_1 = require("@langchain/ollama");
const js_client_rest_1 = require("@qdrant/js-client-rest");
const child_process_1 = require("child_process");
let AiService = AiService_1 = class AiService {
    configService;
    logger = new common_1.Logger(AiService_1.name);
    llm;
    qdrant;
    ollamaBaseUrl;
    modelName;
    constructor(configService) {
        this.configService = configService;
    }
    async onModuleInit() {
        const apiBase = this.configService.get('LLM_API_BASE') || 'http://localhost:11434/v1';
        this.ollamaBaseUrl = apiBase.replace('/v1', '');
        this.modelName = this.configService.get('LLM_MODEL') || 'qwen3:4b';
        this.logger.log(`Initializing AI Service with model: ${this.modelName} at ${this.ollamaBaseUrl}`);
        await this.ensureOllamaRunning();
        this.llm = new ollama_1.ChatOllama({
            baseUrl: this.ollamaBaseUrl,
            model: this.modelName,
            temperature: 0,
        });
        this.qdrant = new js_client_rest_1.QdrantClient({
            url: this.configService.get('QDRANT_URL') || 'http://localhost:6333',
        });
    }
    async ensureOllamaRunning() {
        const isRunning = await this.pingOllama();
        if (isRunning) {
            this.logger.log('✅ Ollama is already running.');
            return;
        }
        this.logger.warn('⚠️ Ollama not running. Auto-starting `ollama serve`...');
        try {
            const child = (0, child_process_1.spawn)('ollama', ['serve'], {
                detached: true,
                stdio: 'ignore',
                shell: true,
            });
            child.unref();
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
        }
        catch (error) {
            this.logger.error(`Failed to auto-start Ollama: ${error.message}`);
            this.logger.warn('💡 Please install Ollama from https://ollama.com and ensure it is in PATH.');
        }
    }
    async pingOllama() {
        try {
            const response = await fetch(`${this.ollamaBaseUrl}/api/tags`, {
                signal: AbortSignal.timeout(2000),
            });
            return response.ok;
        }
        catch {
            return false;
        }
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async chat(prompt) {
        try {
            const response = await this.llm.invoke(prompt);
            return response.content.toString();
        }
        catch (error) {
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
    async chatLong(prompt) {
        try {
            const longLlm = new ollama_1.ChatOllama({
                baseUrl: this.ollamaBaseUrl,
                model: this.modelName,
                temperature: 0,
                numPredict: 4096,
            });
            const response = await longLlm.invoke(prompt);
            return response.content.toString();
        }
        catch (error) {
            this.logger.warn(`Long LLM call failed (${error.message})`);
            return 'Xin lỗi, AI không thể tạo báo cáo phân tích lúc này. Vui lòng thử lại.';
        }
    }
    getQdrantClient() {
        return this.qdrant;
    }
    async isOnline() {
        const online = await this.pingOllama();
        return { online, model: this.modelName || 'unknown' };
    }
};
exports.AiService = AiService;
exports.AiService = AiService = AiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AiService);
//# sourceMappingURL=ai.service.js.map