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
exports.SpecificationDialogController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const specification_processor_service_1 = require("../../services/specification-processor/specification-processor.service");
let SpecificationDialogController = class SpecificationDialogController {
    constructor(_specificationProcessorService) {
        this._specificationProcessorService = _specificationProcessorService;
    }
    async processDefinitions(files, action, artifactFormat, useRemote = 'false') {
        const psmFile = files.psmArtifact?.[0];
        const oldApi = files.oldApi?.[0];
        const newApi = files.newApi?.[0];
        if (!psmFile || !oldApi || !newApi || !action) {
            throw new Error('Missing required files or action.');
        }
        const psmContent = psmFile.buffer.toString('utf8');
        const oldApiContent = oldApi.buffer.toString('utf8');
        const newApiContent = newApi.buffer.toString('utf8');
        const result = await this._specificationProcessorService.processDefinitions(psmContent, oldApiContent, newApiContent, action, artifactFormat, useRemote === 'true');
        result['url'] = `http://localhost:3010/specification-dialog/dialog/${result.id}`;
        return result;
    }
    async processDifference(files, useOpenAi = 'false') {
        const psmFile = files.psmArtifact?.[0];
        const oldApi = files.oldApi?.[0];
        const newApi = files.newApi?.[0];
        if (!psmFile || !oldApi || !newApi) {
            throw new Error('Missing required files or action.');
        }
        const psmContent = psmFile.buffer.toString('utf8');
        const oldApiContent = oldApi.buffer.toString('utf8');
        const newApiContent = newApi.buffer.toString('utf8');
        const result = await this._specificationProcessorService.processSchemaDifferences(oldApiContent, newApiContent, psmContent);
        result['url'] = `http://localhost:3010/specification-dialog/dialog/${result.id}`;
        return result;
    }
    async getRequestById(id) {
        const result = await this._specificationProcessorService.getRequestById(id);
        result['url'] = `http://localhost:3010/specification-dialog/dialog/${result.id}`;
        return result;
    }
};
exports.SpecificationDialogController = SpecificationDialogController;
__decorate([
    (0, common_1.Post)('dialog'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileFieldsInterceptor)([
        { name: 'psmArtifact', maxCount: 1 },
        { name: 'newApi', maxCount: 1 },
        { name: 'oldApi', maxCount: 1 },
    ])),
    __param(0, (0, common_1.UploadedFiles)()),
    __param(1, (0, common_1.Body)('action')),
    __param(2, (0, common_1.Body)('artifactFormat')),
    __param(3, (0, common_1.Body)('useRemote')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], SpecificationDialogController.prototype, "processDefinitions", null);
__decorate([
    (0, common_1.Post)('dialog/difference'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileFieldsInterceptor)([
        { name: 'psmArtifact', maxCount: 1 },
        { name: 'newApi', maxCount: 1 },
        { name: 'oldApi', maxCount: 1 },
    ])),
    __param(0, (0, common_1.UploadedFiles)()),
    __param(1, (0, common_1.Query)('useOpenAi')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SpecificationDialogController.prototype, "processDifference", null);
__decorate([
    (0, common_1.Get)('dialog/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], SpecificationDialogController.prototype, "getRequestById", null);
exports.SpecificationDialogController = SpecificationDialogController = __decorate([
    (0, common_1.Controller)('specification-dialog'),
    __metadata("design:paramtypes", [specification_processor_service_1.SpecificationProcessorService])
], SpecificationDialogController);
//# sourceMappingURL=specification-dialog.controller.js.map