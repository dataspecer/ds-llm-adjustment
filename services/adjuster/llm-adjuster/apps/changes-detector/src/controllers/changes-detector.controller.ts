import { Controller, Get, Inject } from '@nestjs/common';
import { ChangesDetectorService } from '../changes-detector.service';
import { ClientProxy, MessagePattern, Payload } from '@nestjs/microservices';

@Controller()
export class ChangesDetectorController {
    constructor(private readonly _changesDetectorService: ChangesDetectorService,
      @Inject('DIALOG_SERVICE')
      private readonly client: ClientProxy
    ) {}

    @MessagePattern('detect.changes')
    async detectChanges(@Payload() dto: DetectChangeDto): Promise<DetectedChangesDto> {
      const changes = await this._changesDetectorService.detect(dto);
      this.client.emit('changes.detected', changes); // Notify dialog service
      return changes;
}

}
