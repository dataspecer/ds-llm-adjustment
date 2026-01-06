import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EvaluationDiffEntity } from '../../entities/evaluation-diff.entity';
import { EvaluationValidatorEntity } from '../../entities/evaluation-validator.entity';
import { EvaluationApplyEntity } from '../../entities/evaluation-apply.entity';
import { EvaluationUxEntity } from '../../entities/evaluation-ux.entity';
import { EvaluationMcpEntity } from '../../entities/evaluation-mcp.entity';
import { DiffQualityResultDto } from '@app/common/dto/evaluation/diff-quality.dto';
import { ValidatorCheckEventDto } from '@app/common/dto/evaluation/validator-check.dto';
import { ApplyMetricEventDto } from '@app/common/dto/evaluation/apply-metric.dto';
import { UxSurveyDto } from '@app/common/dto/evaluation/ux-survey.dto';
import { McpSafetyEventDto } from '@app/common/dto/evaluation/mcp-safety.dto';
import { EvaluationModelEntity } from '../../entities/evaluation-model.entity';
import { ModelSelectionEventDto } from '@app/common/dto/evaluation/model-event.dto';

@Injectable()
export class EvaluationService {
  public constructor(
    @InjectRepository(EvaluationDiffEntity) private readonly diffRepo: Repository<EvaluationDiffEntity>,
    @InjectRepository(EvaluationValidatorEntity) private readonly validatorRepo: Repository<EvaluationValidatorEntity>,
    @InjectRepository(EvaluationApplyEntity) private readonly applyRepo: Repository<EvaluationApplyEntity>,
    @InjectRepository(EvaluationUxEntity) private readonly uxRepo: Repository<EvaluationUxEntity>,
    @InjectRepository(EvaluationMcpEntity) private readonly mcpRepo: Repository<EvaluationMcpEntity>,
    @InjectRepository(EvaluationModelEntity) private readonly modelRepo: Repository<EvaluationModelEntity>,
  ) {}

  public async storeDiffMetrics(result: DiffQualityResultDto): Promise<void> {
    await this.diffRepo.save({
      runId: result.runId,
      perType: result.perType,
      microAveraged: result.microAveraged,
    });
  }

  public async storeValidatorEvent(evt: ValidatorCheckEventDto): Promise<void> {
    await this.validatorRepo.save({
      runId: evt.runId ?? null,
      dialogId: evt.dialogId ?? null,
      planId: evt.planId ?? null,
      stage: evt.stage,
      syntacticValid: evt.syntacticValid ?? null,
      roundTripOk: evt.roundTripOk ?? null,
      reportOk: evt.reportOk ?? null,
      issues: evt.issues ?? null,
    });
  }

  public async storeApplyEvent(evt: ApplyMetricEventDto): Promise<void> {
    await this.applyRepo.save({
      runId: evt.runId ?? null,
      dialogId: evt.dialogId ?? null,
      planId: evt.planId ?? null,
      acceptedActions: evt.acceptedActions ?? null,
      appliedOk: evt.appliedOk ?? null,
      validatorFailed: evt.validatorFailed ?? null,
      changedIrisCount: evt.changedIrisCount ?? null,
    });
  }

  public async storeUxSurvey(survey: UxSurveyDto): Promise<void> {
    await this.uxRepo.save({
      runId: survey.runId ?? null,
      dialogId: survey.dialogId ?? null,
      role: survey.role,
      helpfulnessLikert: survey.helpfulnessLikert,
      susScore: survey.susScore ?? null,
      susItems: Array.isArray(survey.susItems) ? survey.susItems : null,
      comments: survey.comments ?? null,
    });
  }

  public async storeMcpSafety(evt: McpSafetyEventDto): Promise<void> {
    await this.mcpRepo.save({
      runId: evt.runId ?? null,
      dialogId: evt.dialogId ?? null,
      planId: evt.planId ?? null,
      eventType: evt.eventType,
      hadPriorPreview: evt.hadPriorPreview ?? null,
      blockedByGuardrails: evt.blockedByGuardrails ?? null,
      auditId: evt.auditId ?? null,
      issuesCount: evt.issuesCount ?? null,
      ok: evt.ok ?? null,
    });
  }

  public async storeModelSelection(evt: ModelSelectionEventDto): Promise<void> {
    await this.modelRepo.save({
      runId: evt.runId,
      service: evt.service,
      operation: evt.operation,
      modelName: evt.modelName,
    });
  }
}



