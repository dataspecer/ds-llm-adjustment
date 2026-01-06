import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EvaluationService } from '../../../services/evaluation/evaluation.service';
import { DiffQualityInputDto, DiffQualityResultDto } from '@app/common/dto/evaluation/diff-quality.dto';
import { computeDiffQuality } from '@app/common/evaluation/metrics';
import { UxSurveyDto } from '@app/common/dto/evaluation/ux-survey.dto';

@ApiTags('evaluation')
@Controller('evaluation')
export class EvaluationController {
  public constructor(private readonly evaluationService: EvaluationService) {}

  @Post('diff')
  public async diff(@Body() payload: DiffQualityInputDto): Promise<DiffQualityResultDto> {
    const result: DiffQualityResultDto = computeDiffQuality(payload);
    await this.evaluationService.storeDiffMetrics(result);
    return result;
  }

  @Post('ux')
  public async ux(@Body() payload: UxSurveyDto): Promise<{ ok: true }> {
    await this.evaluationService.storeUxSurvey(payload);
    return { ok: true };
  }
}



