import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'shared_analyses' })
export class SharedAnalysisEntity {
  @PrimaryColumn()
  analysisId: string;

  @Column()
  oldSchemaName: string;

  @Column()
  newSchemaName: string;

  @Column()
  psmFileName: string;

  @Column({ type: 'jsonb' })
  changes: object[];

  @Column({ type: 'text' })
  schema: string;

  @Column({ type: 'timestamptz' })
  timestamp: Date;

  @Column({ type: 'jsonb', nullable: true })
  decisions?: object[] | null;

  @Column({ nullable: true })
  sharedBy?: string | null;
}


