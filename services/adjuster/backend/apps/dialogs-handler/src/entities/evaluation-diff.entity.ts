import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity({ name: 'evaluation_diff_metrics' })
export class EvaluationDiffEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 128 })
  runId: string;

  @Column({ type: 'jsonb' })
  perType: any;

  @Column({ type: 'jsonb' })
  microAveraged: any;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}



