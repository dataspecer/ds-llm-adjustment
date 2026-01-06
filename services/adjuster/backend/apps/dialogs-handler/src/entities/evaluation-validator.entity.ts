import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity({ name: 'evaluation_validator_checks' })
export class EvaluationValidatorEntity {
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
  stage: 'before' | 'after' | 'preview';

  @Column({ type: 'boolean', nullable: true })
  syntacticValid: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  roundTripOk: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  reportOk: boolean | null;

  @Column({ type: 'jsonb', nullable: true })
  issues: any | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}



