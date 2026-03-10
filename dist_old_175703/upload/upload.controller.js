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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const upload_service_1 = require("./upload.service");
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
let UploadController = class UploadController {
    uploadService;
    constructor(uploadService) {
        this.uploadService = uploadService;
    }
    async uploadFiles(files) {
        const filePaths = await Promise.all(files.map((file) => this.uploadService.saveFile(file)));
        return {
            message: 'Files uploaded successfully',
            paths: filePaths,
        };
    }
    async uploadRuleFiles(files) {
        const destPath = path.join(process.cwd(), 'data', 'special_terms');
        await fs.ensureDir(destPath);
        const filePaths = await Promise.all(files.map(async (file) => {
            const filePath = path.join(destPath, file.originalname);
            await fs.writeFile(filePath, file.buffer);
            return filePath;
        }));
        return {
            message: 'Rule files uploaded successfully',
            paths: filePaths,
        };
    }
    async deleteRuleFile(filename) {
        const filePath = path.join(process.cwd(), 'data', 'special_terms', filename);
        const trashPath = path.join(process.cwd(), 'data', '.trash', filename);
        if (await fs.pathExists(filePath)) {
            await fs.ensureDir(path.join(process.cwd(), 'data', '.trash'));
            await fs.move(filePath, trashPath, { overwrite: true });
            return { message: `File ${filename} moved to trash successfully` };
        }
        return { message: `File ${filename} not found` };
    }
    async multiDeleteRuleFiles(filenames) {
        const destPath = path.join(process.cwd(), 'data', 'special_terms');
        const trashDir = path.join(process.cwd(), 'data', '.trash');
        await fs.ensureDir(trashDir);
        const deleted = [];
        for (const filename of filenames) {
            const filePath = path.join(destPath, filename);
            const trashPath = path.join(trashDir, filename);
            if (await fs.pathExists(filePath)) {
                await fs.move(filePath, trashPath, { overwrite: true });
                deleted.push(filename);
            }
        }
        return { message: `Moved ${deleted.length} files to trash successfully`, deleted };
    }
};
exports.UploadController = UploadController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files')),
    __param(0, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", Promise)
], UploadController.prototype, "uploadFiles", null);
__decorate([
    (0, common_1.Post)('rule'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files')),
    __param(0, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", Promise)
], UploadController.prototype, "uploadRuleFiles", null);
__decorate([
    (0, common_1.Delete)('rule/:filename'),
    __param(0, (0, common_1.Param)('filename')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UploadController.prototype, "deleteRuleFile", null);
__decorate([
    (0, common_1.Post)('rule/multi-delete'),
    __param(0, (0, common_1.Body)('filenames')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", Promise)
], UploadController.prototype, "multiDeleteRuleFiles", null);
exports.UploadController = UploadController = __decorate([
    (0, common_1.Controller)('upload'),
    __metadata("design:paramtypes", [upload_service_1.UploadService])
], UploadController);
//# sourceMappingURL=upload.controller.js.map