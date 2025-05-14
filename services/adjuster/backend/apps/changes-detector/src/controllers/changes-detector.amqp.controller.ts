import { Controller, Inject } from '@nestjs/common';
import { ClientProxy, MessagePattern, Payload } from '@nestjs/microservices';
import { ChangesDetectorService } from '../changes-detector.service';
import { DetectChangesDto } from '@app/common/dto/detect-changes.dto';
import { DetectedChangesDto } from '@app/common/dto/detected-changes.dto';

@Controller()
export class ChangesDetectorAmqpController {
  constructor(
    private readonly _changesDetectorService: ChangesDetectorService,
    @Inject('DIALOG_SERVICE')
    private readonly client: ClientProxy
  ) {}

  @MessagePattern('detect.changes')
  async detectChanges(@Payload() dto: DetectChangesDto): Promise<DetectedChangesDto> {
    const changes = await this._changesDetectorService.detect(dto);
    this.client.emit('changes.detected', changes);
    return changes;
  }
} 