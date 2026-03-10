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
var SpecialTermsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpecialTermsService = void 0;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const mammoth = __importStar(require("mammoth"));
const { PDFParse } = require('pdf-parse');
let SpecialTermsService = SpecialTermsService_1 = class SpecialTermsService {
    logger = new common_1.Logger(SpecialTermsService_1.name);
    termsPath = path.join(process.cwd(), 'data', 'special_terms');
    termsContent = '';
    async onModuleInit() {
        await this.loadSpecialTerms();
    }
    async parsePdfText(buffer) {
        const parser = new PDFParse({ data: buffer });
        try {
            return await parser.getText();
        }
        finally {
            await parser.destroy();
        }
    }
    async loadSpecialTerms() {
        try {
            if (!fs.existsSync(this.termsPath)) {
                this.logger.warn(`Directory ${this.termsPath} does not exist.`);
                return;
            }
            const files = await fs.readdir(this.termsPath);
            let combinedContent = '';
            for (const file of files) {
                const filePath = path.join(this.termsPath, file);
                const ext = path.extname(file).toLowerCase();
                this.logger.log(`Processing special term file: ${file}`);
                if (ext === '.docx') {
                    const result = await mammoth.extractRawText({ path: filePath });
                    combinedContent += `\n--- SOURCE: ${file} ---\n${result.value}`;
                }
                else if (ext === '.pdf') {
                    const buffer = await fs.readFile(filePath);
                    const data = await this.parsePdfText(buffer);
                    combinedContent += `\n--- SOURCE: ${file} ---\n${data.text}`;
                }
                else if (ext === '.md' || ext === '.txt') {
                    const content = await fs.readFile(filePath, 'utf-8');
                    combinedContent += `\n--- SOURCE: ${file} ---\n${content}`;
                }
            }
            this.termsContent = combinedContent;
            this.logger.log('Special terms loaded successfully.');
        }
        catch (error) {
            this.logger.error('Error loading special terms:', error);
        }
    }
    getTermsContent() {
        return this.termsContent;
    }
};
exports.SpecialTermsService = SpecialTermsService;
exports.SpecialTermsService = SpecialTermsService = SpecialTermsService_1 = __decorate([
    (0, common_1.Injectable)()
], SpecialTermsService);
//# sourceMappingURL=special-terms.service.js.map