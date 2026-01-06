import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity({ name: 'evaluation_apply_metrics' })
export class EvaluationApplyEntity {
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

  @Column({ type: 'int', nullable: true })
  acceptedActions: number | null;

  @Column({ type: 'boolean', nullable: true })
  appliedOk: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  validatorFailed: boolean | null;

  @Column({ type: 'int', nullable: true })
  changedIrisCount: number | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}



