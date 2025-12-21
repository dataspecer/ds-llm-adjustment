import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SpecificationMaintainerService } from '../../../services/specification-maintainer/specification-maintainer.service';
import { SharedAnalysisDto } from '../../../dto/shared-analysis.dto';

@Controller()
export class SpecificationMaintainerAmqpController {
  public constructor(private readonly _specificationMaintainerService: SpecificationMaintainerService) {}

  @MessagePattern('analysis.get')
  public async getSharedAnalysis(@Payload() payload: { analysisId: string }): Promise<SharedAnalysisDto> {
    return this._specificationMaintainerService.getSharedAnalysis(payload.analysisId);
  }
}


