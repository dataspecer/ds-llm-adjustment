import { DetectChangesDto, DetectChangesFromIriDto, DetectChangesHybridDto, DetectChangesAutomaticDto } from '@app/common/dto/detect-changes.dto';
import { DetectedChangesDto } from '@app/common/dto/detected-changes.dto';

export interface ChangesDetectorServiceInterface {
  detectFromIri(dto: DetectChangesFromIriDto): Promise<DetectedChangesDto>;
  detectHybrid(dto: DetectChangesHybridDto): Promise<DetectedChangesDto>;
  detectAutomatic(dto: DetectChangesAutomaticDto): Promise<DetectedChangesDto>;
  fetchJsonSchemaViaDsv(dataSpecificationIri: string): Promise<string>;
  detect(dto: DetectChangesDto): Promise<DetectedChangesDto>;
  processChanges(dto: DetectedChangesDto): Promise<DetectedChangesDto>;
}


