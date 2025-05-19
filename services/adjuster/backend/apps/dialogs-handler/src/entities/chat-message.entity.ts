import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class ChatMessageEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  action: string;

  @Column({ type: 'text', nullable: true })
  psm: string;

  @Column({ type: 'text', nullable: true })
  oldApi: string;

  @Column({ type: 'text', nullable: true })
  newApi: string;

  @Column({ type: 'text', nullable: true })
  result: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
} 