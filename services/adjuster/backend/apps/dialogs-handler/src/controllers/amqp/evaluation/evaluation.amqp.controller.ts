import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { EvaluationService } from '../../../services/evaluation/evaluation.service';
import { ValidatorCheckEventDto } from '@app/common/dto/evaluation/validator-check.dto';
import { ApplyMetricEventDto } from '@app/common/dto/evaluation/apply-metric.dto';
import { McpSafetyEventDto } from '@app/common/dto/evaluation/mcp-safety.dto';
import { ModelSelectionEventDto } from '@app/common/dto/evaluation/model-event.dto';

@Controller()
export class EvaluationAmqpController {
  public constructor(private readonly evaluationService: EvaluationService) {}

  @EventPattern('evaluation.validator')
  public async onValidator(@Payload() payload: ValidatorCheckEventDto, @Ctx() ctx: RmqContext): Promise<void> {
    await this.evaluationService.storeValidatorEvent(payload);
    const channel = ctx.getChannelRef();
    const originalMsg = ctx.getMessage();
    channel.ack(originalMsg);
  }

  @EventPattern('evaluation.apply')
  public async onApply(@Payload() payload: ApplyMetricEventDto, @Ctx() ctx: RmqContext): Promise<void> {
    await this.evaluationService.storeApplyEvent(payload);
    const channel = ctx.getChannelRef();
    const originalMsg = ctx.getMessage();
    channel.ack(originalMsg);
  }

  @EventPattern('evaluation.mcp')
  public async onMcp(@Payload() payload: McpSafetyEventDto, @Ctx() ctx: RmqContext): Promise<void> {
    await this.evaluationService.storeMcpSafety(payload);
    const channel = ctx.getChannelRef();
    const originalMsg = ctx.getMessage();
    channel.ack(originalMsg);
  }

  @EventPattern('evaluation.model')
  public async onModel(@Payload() payload: ModelSelectionEventDto, @Ctx() ctx: RmqContext): Promise<void> {
    await this.evaluationService.storeModelSelection(payload);
    const channel = ctx.getChannelRef();
    const originalMsg = ctx.getMessage();
    channel.ack(originalMsg);
  }
}



