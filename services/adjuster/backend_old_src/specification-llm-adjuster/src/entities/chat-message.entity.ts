import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('chat_message')
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

  @Column({ type: 'json', nullable: true })
  result: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
