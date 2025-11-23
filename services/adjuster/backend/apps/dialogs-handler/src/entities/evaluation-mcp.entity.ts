import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity({ name: 'evaluation_mcp_safety' })
export class EvaluationMcpEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 128, nullable: true })
  runId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 128, nullable: true })
  dialogId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 128, nullable: true })
  planId: string | null;

  @Column({ type: 'varchar', length: 32 })
  eventType: 'preview_apply' | 'apply_changes';

  @Column({ type: 'boolean', nullable: true })
  hadPriorPreview: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  blockedByGuardrails: boolean | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  auditId: string | null;

  @Column({ type: 'int', nullable: true })
  issuesCount: number | null;

  @Column({ type: 'boolean', nullable: true })
  ok: boolean | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}



