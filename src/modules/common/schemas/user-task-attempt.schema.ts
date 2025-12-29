import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserTaskAttemptDocument = HydratedDocument<UserTaskAttempt>;

export type AttemptSource = 'lesson' | 'review' | 'practice';

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'user_task_attempts' })
export class UserTaskAttempt {
  @Prop({ type: String, required: true })
  userId!: string;

  @Prop({ required: true })
  lessonRef!: string; // a0.travel.001

  @Prop({ required: true })
  taskRef!: string; // a0.travel.001.t3

  @Prop({ required: true })
  attemptNo!: number; // sequential per (userId, lessonRef, taskRef)

  @Prop({ required: true })
  correct!: boolean;

  @Prop()
  score?: number; // 0..1

  @Prop()
  durationMs?: number;

  @Prop()
  variantKey?: string;

  @Prop({ required: true, enum: ['lesson', 'review', 'practice'], default: 'lesson' })
  source!: AttemptSource;

  @Prop()
  sessionId?: string;

  @Prop()
  clientAttemptId?: string; // idempotency key from client

  @Prop({ type: Object })
  metadata?: Record<string, any>; // Дополнительная информация о попытке (для анализа)

  @Prop()
  userAnswer?: string; // Сырой ответ пользователя (для анализа типичных ошибок)

  @Prop()
  correctAnswer?: string; // Правильный ответ (для показа пользователю после проверки)
}

export const UserTaskAttemptSchema = SchemaFactory.createForClass(UserTaskAttempt);
// Идемпотентность: уникальный индекс по userId, taskRef, clientAttemptId
UserTaskAttemptSchema.index({ userId: 1, taskRef: 1, clientAttemptId: 1 }, { unique: true });
UserTaskAttemptSchema.index({ userId: 1, lessonRef: 1, taskRef: 1, attemptNo: 1 }, { unique: true });
UserTaskAttemptSchema.index({ lessonRef: 1, taskRef: 1 });
// Индекс для аналитики: как пользователь отвечает на задания (правильно/неправильно)
UserTaskAttemptSchema.index({ userId: 1, correct: 1 });


