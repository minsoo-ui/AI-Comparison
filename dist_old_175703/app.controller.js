"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AppController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppController = void 0;
const common_1 = require("@nestjs/common");
const app_service_1 = require("./app.service");
const special_terms_service_1 = require("./ai/special-terms.service");
const extract_service_1 = require("./ai/extract.service");
const hscode_service_1 = require("./hscode/hscode.service");
const ai_service_1 = require("./ai/ai.service");
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs-extra"));
let AppController = AppController_1 = class AppController {
    appService;
    specialTermsService;
    extractService;
    hscodeService;
    aiService;
    logger = new common_1.Logger(AppController_1.name);
    constructor(appService, specialTermsService, extractService, hscodeService, aiService) {
        this.appService = appService;
        this.specialTermsService = specialTermsService;
        this.extractService = extractService;
        this.hscodeService = hscodeService;
        this.aiService = aiService;
    }
    getHello() {
        return this.appService.getHello();
    }
    async getAiHealth() {
        return await this.aiService.isOnline();
    }
    async getDatabaseFiles() {
        const folderPath = path.join(process.cwd(), 'data', 'special_terms');
        await fs.ensureDir(folderPath);
        const files = await fs.readdir(folderPath);
        const fileStats = await Promise.all(files.map(async (filename, idx) => {
            const filePath = path.join(folderPath, filename);
            const stats = await fs.stat(filePath);
            return {
                id: idx + 1,
                name: filename,
                size: (stats.size / 1024).toFixed(1) + ' KB',
                updatedAt: stats.mtime.toLocaleString(),
                status: 'Active',
                description: 'Local knowledge base file.'
            };
        }));
        return fileStats;
    }
    async getTrashFiles() {
        const trashPath = path.join(process.cwd(), 'data', '.trash');
        await fs.ensureDir(trashPath);
        let files = await fs.readdir(trashPath);
        const now = Date.now();
        const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
        const fileStats = [];
        for (let i = 0; i < files.length; i++) {
            const filename = files[i];
            const filePath = path.join(trashPath, filename);
            const stats = await fs.stat(filePath);
            if (now - stats.mtimeMs > THIRTY_DAYS) {
                await fs.unlink(filePath);
                continue;
            }
            fileStats.push({
                id: i + 1,
                name: filename,
                size: (stats.size / 1024).toFixed(1) + ' KB',
                deletedAt: stats.mtime.toLocaleString(),
                mtimeMs: stats.mtimeMs
            });
        }
        return fileStats.sort((a, b) => b.mtimeMs - a.mtimeMs);
    }
    async restoreTrashFiles(filenames) {
        const trashPath = path.join(process.cwd(), 'data', '.trash');
        const destPath = path.join(process.cwd(), 'data', 'special_terms');
        const restored = [];
        for (const filename of filenames) {
            const tPath = path.join(trashPath, filename);
            const dPath = path.join(destPath, filename);
            if (await fs.pathExists(tPath)) {
                await fs.move(tPath, dPath, { overwrite: true });
                restored.push(filename);
            }
        }
        return { message: `Restored ${restored.length} files.`, restored };
    }
    async emptyTrash() {
        const trashPath = path.join(process.cwd(), 'data', '.trash');
        await fs.emptyDir(trashPath);
        return { message: 'Trash emptied successfully.' };
    }
    openDatabaseFolder() {
        const folderPath = path.join(process.cwd(), 'data', 'special_terms');
        const command = process.platform === 'win32' ? `explorer "${folderPath}"` :
            process.platform === 'darwin' ? `open "${folderPath}"` :
                `xdg-open "${folderPath}"`;
        (0, child_process_1.exec)(command, (error) => {
            if (error) {
                this.logger.error(`Failed to open folder: ${error.message}`);
            }
            else {
                this.logger.log(`Opened database folder: ${folderPath}`);
            }
        });
        return { success: true, message: 'Folder opened.' };
    }
    async testFoundation() {
        this.logger.log('Starting Foundation Integration Test (Task 2.8)...');
        let termsResult = { status: 'Unknown', length: 0 };
        let extractionResult = { status: 'Skipped', data: null };
        let hscodeResult = { status: 'Skipped', data: null };
        try {
            const terms = this.specialTermsService.getTermsContent();
            termsResult = { status: terms.length > 0 ? 'OK' : 'Empty', length: terms.length };
        }
        catch (e) {
            this.logger.error('SpecialTerms test failed:', e);
            termsResult.status = 'Error: ' + e.message;
        }
        try {
            const mockOcrText = 'Quote from FedEx. Total price: 500 USD for 50kg of electronics.';
            const schema = {
                company: 'string',
                total_price: 'number',
                weight: 'number',
                item: 'string',
            };
            extractionResult.data = await this.extractService.extractData(mockOcrText, schema);
            extractionResult.status = 'OK';
        }
        catch (e) {
            this.logger.error('Extraction test failed:', e);
            extractionResult.status = 'Error: ' + e.message;
        }
        try {
            const item = extractionResult.data?.item || 'electronics';
            hscodeResult.data = await this.hscodeService.searchHSCode(item);
            hscodeResult.status = 'OK';
        }
        catch (e) {
            this.logger.error('HSCode search test failed:', e);
            hscodeResult.status = 'Error: ' + e.message;
        }
        return {
            status: 'Completed',
            stage: 'Foundation Integration (Task 2.8)',
            results: {
                specialTerms: termsResult,
                extraction: extractionResult,
                hscodeVectorSearch: hscodeResult,
            },
        };
    }
};
exports.AppController = AppController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", String)
], AppController.prototype, "getHello", null);
__decorate([
    (0, common_1.Get)('health/ai'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AppController.prototype, "getAiHealth", null);
__decorate([
    (0, common_1.Get)('database/files'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AppController.prototype, "getDatabaseFiles", null);
__decorate([
    (0, common_1.Get)('database/trash'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AppController.prototype, "getTrashFiles", null);
__decorate([
    (0, common_1.Post)('database/trash/restore'),
    __param(0, (0, common_1.Body)('filenames')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "restoreTrashFiles", null);
__decorate([
    (0, common_1.Post)('database/trash/empty'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AppController.prototype, "emptyTrash", null);
__decorate([
    (0, common_1.Get)('open-database-folder'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "openDatabaseFolder", null);
__decorate([
    (0, common_1.Get)('test-foundation'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AppController.prototype, "testFoundation", null);
exports.AppController = AppController = AppController_1 = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [app_service_1.AppService,
        special_terms_service_1.SpecialTermsService,
        extract_service_1.ExtractService,
        hscode_service_1.HscodeService,
        ai_service_1.AiService])
], AppController);
//# sourceMappingURL=app.controller.js.map