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
var HscodeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HscodeService = void 0;
const common_1 = require("@nestjs/common");
const ai_service_1 = require("../ai/ai.service");
let HscodeService = HscodeService_1 = class HscodeService {
    aiService;
    logger = new common_1.Logger(HscodeService_1.name);
    collectionName = 'hscode_vectors';
    constructor(aiService) {
        this.aiService = aiService;
    }
    async onModuleInit() {
        await this.initCollection();
    }
    async initCollection() {
        try {
            const client = this.aiService.getQdrantClient();
            const collections = await client.getCollections();
            const exists = collections.collections.some(c => c.name === this.collectionName);
            if (!exists) {
                this.logger.log(`Creating Qdrant collection: ${this.collectionName}`);
                await client.createCollection(this.collectionName, {
                    vectors: { size: 768, distance: 'Cosine' },
                });
                await this.seedSampleData();
            }
        }
        catch (error) {
            this.logger.error('Error initializing Qdrant collection:', error);
        }
    }
    async seedSampleData() {
        const client = this.aiService.getQdrantClient();
        const points = [
            {
                id: 1,
                vector: new Array(768).fill(0).map(() => Math.random()),
                payload: { description: 'Macbook Air M2', hscode: '8471.30.00', tax_rate: '10%' },
            },
            {
                id: 2,
                vector: new Array(768).fill(0).map(() => Math.random()),
                payload: { description: 'iPhone 15 Pro Max', hscode: '8517.13.00', tax_rate: '12%' },
            }
        ];
        await client.upsert(this.collectionName, { points });
        this.logger.log('Sample HSCode data seeded.');
    }
    async searchHSCode(description) {
        const client = this.aiService.getQdrantClient();
        const searchResult = await client.search(this.collectionName, {
            vector: new Array(768).fill(0.1),
            limit: 1,
            with_payload: true,
        });
        if (searchResult.length > 0 && searchResult[0].payload) {
            const payload = searchResult[0].payload;
            return {
                item: description,
                suggestedHSCode: payload.hscode,
                confidence: searchResult[0].score,
                taxRate: payload.tax_rate,
            };
        }
        return null;
    }
    async calculateTax(value, rate) {
        const numericValue = Number(value);
        const numericRate = parseFloat(rate) / 100;
        return numericValue * numericRate;
    }
};
exports.HscodeService = HscodeService;
exports.HscodeService = HscodeService = HscodeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ai_service_1.AiService])
], HscodeService);
//# sourceMappingURL=hscode.service.js.map