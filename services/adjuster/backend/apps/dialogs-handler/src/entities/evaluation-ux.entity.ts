import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity({ name: 'evaluation_ux_surveys' })
export class EvaluationUxEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 128, nullable: true })
  runId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 128, nullable: true })
  dialogId: string | null;

  @Column({ type: 'varchar', length: 32 })
  role: 'Developer' | 'Maintainer' | 'Other';

  @Column({ type: 'int' })
  helpfulnessLikert: number;

  @Column({ type: 'int', nullable: true })
  susScore: number | null;

  @Column({ type: 'text', nullable: true })
  comments: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}



