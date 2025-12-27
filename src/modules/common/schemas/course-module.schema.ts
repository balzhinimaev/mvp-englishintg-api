import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { MultilingualText, OptionalMultilingualText } from '../utils/i18n.util';

export type CourseModuleDocument = HydratedDocument<CourseModule>;

@Schema({ timestamps: true, collection: 'course_modules' })
export class CourseModule {
  @Prop({ required: true, unique: true })
  moduleRef!: string; // e.g., a0.travel

  @Prop({ required: true })
  level!: 'A0' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

  @Prop({ required: true, type: Object })
  title!: MultilingualText;

  @Prop({ type: Object })
  description?: OptionalMultilingualText;

  @Prop({ type: [String], default: [] })
  tags?: string[]; // e.g., travel, speaking

  @Prop({ min: 1, max: 5 })
  difficultyRating?: number;

  @Prop({ default: true })
  published?: boolean;

  @Prop({ default: 0 })
  order?: number;

  @Prop({ default: false })
  requiresPro?: boolean;

  @Prop({ default: true })
  isAvailable?: boolean;
}

export const CourseModuleSchema = SchemaFactory.createForClass(CourseModule);
CourseModuleSchema.index({ level: 1, order: 1 });

