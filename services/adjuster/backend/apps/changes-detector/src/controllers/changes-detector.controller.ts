import { Controller, Get, Inject, Post, Body } from '@nestjs/common';
import { ChangesDetectorService } from '../changes-detector.service';
import { ClientProxy, MessagePattern, Payload } from '@nestjs/microservices';
import { DetectedChangesDto } from '@app/common/dto/detected-changes.dto';
import { DetectChangesDto } from '@app/common/dto/detect-changes.dto';

@Controller('api')
export class ChangesDetectorController {
    constructor(private readonly _changesDetectorService: ChangesDetectorService,
      @Inject('DIALOG_SERVICE')
      private readonly client: ClientProxy
    ) {}

    @Post('detect-changes')
    async detectChangesHttp(@Body() dto: DetectChangesDto): Promise<DetectedChangesDto> {
      const changes = await this._changesDetectorService.detect(dto);
      this.client.emit('changes.detected', changes);
      return changes;
    }
}
