import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ChangesDetectorService } from '../services/changes-detector.service';
import { DetectedChangesDto } from '@app/common/dto/detected-changes.dto';
import { DetectChangesDto, DetectChangesFromIriDto, DetectChangesHybridDto, DetectChangesAutomaticDto } from '@app/common/dto/detect-changes.dto';

@ApiTags('changes')
@Controller('changes')
export class ChangesDetectorController {
    constructor(private readonly _changesDetectorService: ChangesDetectorService) {}

    @Post('detections/raw')
    @ApiOperation({ summary: 'Detect changes from raw API strings' })
    @ApiBody({ schema: { $ref: '#/components/schemas/DetectChangesDto' } })
    @ApiOkResponse({ type: DetectedChangesDto })
    public async detectChangesHttp(@Body() dto: DetectChangesDto): Promise<DetectedChangesDto> {
      const runId: string = dto.runId || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const changes: DetectedChangesDto = await this._changesDetectorService.detect({ ...dto, runId });
      return changes;
    }

    @Post('detections/from-iri')
    @ApiOperation({ summary: 'Detect changes using PSM and schema IRIs' })
    @ApiBody({ schema: { $ref: '#/components/schemas/DetectChangesFromIriDto' } })
    @ApiOkResponse({ type: DetectedChangesDto })
    public async detectChangesFromIriHttp(@Body() dto: DetectChangesFromIriDto): Promise<DetectedChangesDto> {
      const runId: string = dto.runId || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const changes: DetectedChangesDto = await this._changesDetectorService.detectFromIri({ ...dto, runId } as any);
      return changes;
    }

    @Post('detections/hybrid')
    @ApiOperation({ summary: 'Detect changes using PSM IRI and JSON schemas' })
    @ApiBody({ schema: { $ref: '#/components/schemas/DetectChangesHybridDto' } })
    @ApiOkResponse({ type: DetectedChangesDto })
    public async detectChangesHybridHttp(@Body() dto: DetectChangesHybridDto): Promise<DetectedChangesDto> {
      const runId: string = dto.runId || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const changes: DetectedChangesDto = await this._changesDetectorService.detectHybrid({ ...dto, runId } as any);
      return changes;
    }

    @Post('detections/automatic')
    @ApiOperation({ summary: 'Automatically detect changes based on Dataspecer' })
    @ApiBody({ schema: { $ref: '#/components/schemas/DetectChangesAutomaticDto' } })
    @ApiOkResponse({ type: DetectedChangesDto })
    public async detectChangesAutomaticHttp(@Body() dto: DetectChangesAutomaticDto): Promise<DetectedChangesDto> {
      const runId: string = dto.runId || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const changes: DetectedChangesDto = await this._changesDetectorService.detectAutomatic({ ...dto, runId } as any);
      return changes;
    }

    @Get('schemas/dsv')
    @ApiOperation({ summary: 'Fetch JSON schema via Dataspecer' })
    @ApiQuery({ name: 'dataSpecificationIri', required: true })
    @ApiOkResponse({ schema: { type: 'object', properties: { content: { type: 'string' }, name: { type: 'string' } } } })
    public async fetchJsonSchemaDsvHttp(@Query('dataSpecificationIri') dataSpecificationIri: string): Promise<{ content: string; name: string }> {
      const jsonSchemaContent: string = await this._changesDetectorService.fetchJsonSchemaViaDsv(dataSpecificationIri);
      return {
        content: jsonSchemaContent,
        name: 'schema.json'
      };
    }
}
