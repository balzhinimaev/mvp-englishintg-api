import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { MultilingualText, OptionalMultilingualText } from '../utils/i18n.util';

export type LessonDocument = HydratedDocument<Lesson>;

@Schema({ timestamps: true, collection: 'lessons' })
export class Lesson {
  @Prop({ required: true })
  moduleRef!: string; // e.g., a0.travel

  @Prop({ required: true })
  lessonRef!: string; // e.g., a0.travel.001

  @Prop({ required: true, type: Object })
  title!: MultilingualText;

  @Prop({ type: Object })
  description?: OptionalMultilingualText;

  @Prop({ default: 10 })
  estimatedMinutes?: number;

  @Prop({ type: [Object], default: [] })
  tasks?: Array<{ ref: string; type: string; data: Record<string, any>; validationData?: Record<string, any> }>;

  @Prop({ default: true })
  published?: boolean;

  @Prop({ default: 0 })
  order?: number; // within module

  @Prop({ default: false })
  requiresPro?: boolean; // Явное требование PRO подписки для этого урока

  @Prop({ enum: ['conversation','vocabulary','grammar'], default: 'vocabulary' })
  type?: 'conversation'|'vocabulary'|'grammar';

  @Prop({ enum: ['easy','medium','hard'], default: 'easy' })
  difficulty?: 'easy'|'medium'|'hard';

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop({ default: 25 })
  xpReward?: number;

  @Prop({ default: true })
  hasAudio?: boolean;

  @Prop({ default: false })
  hasVideo?: boolean;

  @Prop()
  previewText?: string;
}

export const LessonSchema = SchemaFactory.createForClass(Lesson);
// Индекс для быстрого поиска уроков по модулю и порядку
LessonSchema.index({ moduleRef: 1, order: 1 });
// Уникальный индекс на lessonRef
LessonSchema.index({ lessonRef: 1 }, { unique: true });
// Уникальный индекс на комбинацию moduleRef + order для предотвращения дубликатов порядка
// Partial index: применяется только к опубликованным урокам с order >= 1
LessonSchema.index(
  { moduleRef: 1, order: 1 }, 
  { 
    unique: true, 
    partialFilterExpression: { 
      published: true, 
      order: { $gte: 1 } 
    },
    name: 'unique_module_order_published'
  }
);

