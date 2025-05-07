"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const specification_dialog_controller_1 = require("./controllers/specification-dialog/specification-dialog.controller");
const specification_processor_service_1 = require("./services/specification-processor/specification-processor.service");
const typeorm_1 = require("@nestjs/typeorm");
const chat_message_entity_1 = require("./entities/chat-message.entity");
const config_1 = require("@nestjs/config");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forRoot({
                type: 'sqlite',
                database: 'database.sqlite',
                entities: [chat_message_entity_1.ChatMessageEntity],
                synchronize: true,
            }),
            config_1.ConfigModule.forRoot(),
            typeorm_1.TypeOrmModule.forFeature([chat_message_entity_1.ChatMessageEntity])
        ],
        controllers: [app_controller_1.AppController, specification_dialog_controller_1.SpecificationDialogController],
        providers: [app_service_1.AppService, specification_processor_service_1.SpecificationProcessorService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map