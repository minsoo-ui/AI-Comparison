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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuoteController = void 0;
const common_1 = require("@nestjs/common");
const quote_service_1 = require("./quote.service");
let QuoteController = class QuoteController {
    quoteService;
    constructor(quoteService) {
        this.quoteService = quoteService;
    }
    async compare(filePaths) {
        if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
            throw new common_1.BadRequestException('Provide an array of filePaths to compare.');
        }
        return await this.quoteService.compareQuotes(filePaths);
    }
    async chat(payload) {
        if (!payload.message) {
            throw new common_1.BadRequestException('Bắt buộc phải có message.');
        }
        return await this.quoteService.chatWithQuotesContext(payload.message, payload.history || [], payload.context || null);
    }
};
exports.QuoteController = QuoteController;
__decorate([
    (0, common_1.Post)('compare'),
    __param(0, (0, common_1.Body)('filePaths')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", Promise)
], QuoteController.prototype, "compare", null);
__decorate([
    (0, common_1.Post)('chat'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], QuoteController.prototype, "chat", null);
exports.QuoteController = QuoteController = __decorate([
    (0, common_1.Controller)('quote'),
    __metadata("design:paramtypes", [quote_service_1.QuoteService])
], QuoteController);
//# sourceMappingURL=quote.controller.js.map