import { Controller, Get, Inject, Post, Body } from '@nestjs/common';
import { ChangesDetectorService } from '../changes-detector.service';
import { DetectedChangesDto } from '@app/common/dto/detected-changes.dto';
import { DetectChangesDto, DetectChangesFromIriDto, DetectChangesHybridDto } from '@app/common/dto/detect-changes.dto';

@Controller('api')
export class ChangesDetectorController {
    constructor(private readonly _changesDetectorService: ChangesDetectorService) {}

    @Post('detect-changes')
    async detectChangesHttp(@Body() dto: DetectChangesDto): Promise<DetectedChangesDto> {
      const changes = await this._changesDetectorService.detect(dto);
      return changes;
    }

    @Post('detect-changes-from-iri')
    async detectChangesFromIriHttp(@Body() dto: DetectChangesFromIriDto): Promise<DetectedChangesDto> {
      const changes = await this._changesDetectorService.detectFromIri(dto);
      return changes;
    }

    @Post('detect-changes-hybrid')
    async detectChangesHybridHttp(@Body() dto: DetectChangesHybridDto): Promise<DetectedChangesDto> {
      const changes = await this._changesDetectorService.detectHybrid(dto);
      return changes;
    }
}
