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
exports.HscodeController = void 0;
const common_1 = require("@nestjs/common");
const hscode_service_1 = require("./hscode.service");
let HscodeController = class HscodeController {
    hscodeService;
    constructor(hscodeService) {
        this.hscodeService = hscodeService;
    }
    async search(query) {
        if (!query) {
            throw new common_1.BadRequestException('Query parameter "q" is required.');
        }
        return await this.hscodeService.searchHSCode(query);
    }
    async calculate(value, rate) {
        if (!value || !rate) {
            throw new common_1.BadRequestException('Parameters "value" and "rate" (e.g. 10%) are required.');
        }
        const numericValue = Number(value);
        const tax = await this.hscodeService.calculateTax(numericValue, rate);
        return {
            value: numericValue,
            taxRate: rate,
            taxAmount: tax,
            totalWithTax: numericValue + tax,
        };
    }
};
exports.HscodeController = HscodeController;
__decorate([
    (0, common_1.Get)('search'),
    __param(0, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], HscodeController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('calculate'),
    __param(0, (0, common_1.Query)('value')),
    __param(1, (0, common_1.Query)('rate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], HscodeController.prototype, "calculate", null);
exports.HscodeController = HscodeController = __decorate([
    (0, common_1.Controller)('hscode'),
    __metadata("design:paramtypes", [hscode_service_1.HscodeService])
], HscodeController);
//# sourceMappingURL=hscode.controller.js.map