import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GrammarAtomDocument = HydratedDocument<GrammarAtom>;

/**
 * Грамматический атом знания — короткая проба на паттерн (MCQ),
 * которая входит в ту же систему интервального повторения, что и слова.
 * Источник — грам-задания уроков; связывается со статьёй справочника.
 */
@Schema({ timestamps: true, collection: 'grammar_atoms' })
export class GrammarAtom {
  @Prop({ required: true, unique: true })
  id!: string; // gram_<hash>

  @Prop({ required: true, default: 'grammar' })
  kind!: string; // 'grammar' | 'phrase'

  @Prop({ required: true })
  title!: string; // паттерн / грам-фокус (напр. «Past Simple: was/were»)

  @Prop({ required: true })
  prompt!: string; // вопрос пробы

  @Prop({ type: [String], required: true })
  options!: string[];

  @Prop({ required: true })
  correctIndex!: number;

  @Prop({ default: '' })
  explanation?: string;

  @Prop()
  handbookRef?: string; // связанная статья справочника (ref, напр. grammar.past-simple)

  @Prop({ enum: ['easy', 'medium', 'hard'], default: 'medium' })
  difficulty?: 'easy' | 'medium' | 'hard';

  @Prop()
  level?: string;

  @Prop({ type: [String], default: [] })
  moduleRefs?: string[];

  @Prop({ type: [String], default: [] })
  lessonRefs?: string[];
}

export const GrammarAtomSchema = SchemaFactory.createForClass(GrammarAtom);
GrammarAtomSchema.index({ level: 1 });
