import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserLessonProgressDocument = HydratedDocument<UserLessonProgress>;

export type LessonStatus = 'not_started' | 'in_progress' | 'completed';

@Schema({ timestamps: true, collection: 'user_lesson_progress' })
export class UserLessonProgress {
  @Prop({ type: String, required: true })
  userId!: string;

  @Prop()
  moduleRef?: string; // optional content module reference

  @Prop({ required: true })
  lessonRef!: string; // e.g. a0.travel.001

  @Prop({ required: true, enum: ['not_started', 'in_progress', 'completed'], default: 'not_started' })
  status!: LessonStatus;

  @Prop({ min: 0, max: 1, default: 0 })
  score?: number; // 0..1, aggregated

  @Prop({ default: 0 })
  attempts?: number;

  @Prop({ default: 0 })
  timeSpent?: number; // seconds — вычисляется из totalTimeMs

  // Агрегаты для точного расчёта среднего score и времени
  @Prop({ default: 0 })
  totalScore?: number; // сумма всех score попыток

  @Prop({ default: 0 })
  totalTimeMs?: number; // сумма времени в миллисекундах

  @Prop()
  lastTaskIndex?: number;

  @Prop()
  startedAt?: Date;

  @Prop()
  completedAt?: Date;
}

export const UserLessonProgressSchema = SchemaFactory.createForClass(UserLessonProgress);
UserLessonProgressSchema.index({ userId: 1, lessonRef: 1 }, { unique: true });
UserLessonProgressSchema.index({ userId: 1, status: 1 });
// Индекс для быстрого поиска прогресса по модулям
UserLessonProgressSchema.index({ userId: 1, moduleRef: 1, status: 1 });


