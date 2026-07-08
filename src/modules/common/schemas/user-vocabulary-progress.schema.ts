import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserVocabularyProgressDocument = HydratedDocument<UserVocabularyProgress>;

export type VocabularyStatus = 'not_started' | 'learning' | 'learned';

@Schema({ timestamps: true, collection: 'user_vocabulary_progress' })
export class UserVocabularyProgress {
  @Prop({ type: String, required: true })
  userId!: string;

  @Prop({ required: true })
  moduleRef!: string; // e.g., a0.travel

  @Prop({ required: true })
  wordId!: string; // e.g., 'hello'

  @Prop({ required: true, enum: ['not_started', 'learning', 'learned'], default: 'not_started' })
  status!: VocabularyStatus;

  @Prop({ min: 0, max: 1, default: 0 })
  score?: number; // 0..1, learning progress

  @Prop({ default: 0 })
  attempts?: number; // Number of study attempts

  @Prop({ default: 0 })
  timeSpent?: number; // seconds spent studying this word

  @Prop()
  lastStudiedAt?: Date; // Last time user studied this word

  @Prop()
  learnedAt?: Date; // When word was marked as learned

  @Prop({ default: 0 })
  correctAttempts?: number; // Number of correct attempts

  @Prop({ default: 0 })
  totalAttempts?: number; // Total number of attempts

  @Prop({ type: [String], default: [] })
  lessonRefs?: string[]; // Lessons where this word was encountered

  // --- SRS: интервальное повторение (SM-2-lite) ---
  @Prop({ default: 0 })
  repetitions?: number; // подряд успешных повторений

  @Prop({ default: 0 })
  intervalDays?: number; // текущий интервал в днях

  @Prop({ default: 2.5 })
  ease?: number; // фактор лёгкости

  @Prop()
  dueAt?: Date; // когда атом пора повторить

  @Prop({ default: 0 })
  lapses?: number; // сколько раз забывал

  @Prop()
  introducedAt?: Date; // когда впервые показан
}

export const UserVocabularyProgressSchema = SchemaFactory.createForClass(UserVocabularyProgress);

// Create compound index for efficient queries
UserVocabularyProgressSchema.index({ userId: 1, moduleRef: 1 });
UserVocabularyProgressSchema.index({ userId: 1, wordId: 1 });
UserVocabularyProgressSchema.index({ userId: 1, moduleRef: 1, status: 1 });
UserVocabularyProgressSchema.index({ userId: 1, dueAt: 1 }); // очередь повторений
