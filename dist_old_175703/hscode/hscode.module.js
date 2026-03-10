"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HscodeModule = void 0;
const common_1 = require("@nestjs/common");
const hscode_service_1 = require("./hscode.service");
const ai_module_1 = require("../ai/ai.module");
const hscode_controller_1 = require("./hscode.controller");
let HscodeModule = class HscodeModule {
};
exports.HscodeModule = HscodeModule;
exports.HscodeModule = HscodeModule = __decorate([
    (0, common_1.Module)({
        imports: [ai_module_1.AiModule],
        controllers: [hscode_controller_1.HscodeController],
        providers: [hscode_service_1.HscodeService],
        exports: [hscode_service_1.HscodeService],
    })
], HscodeModule);
//# sourceMappingURL=hscode.module.js.map