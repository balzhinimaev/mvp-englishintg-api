import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { MultilingualText } from '../utils/i18n.util';

export type HandbookArticleDocument = HydratedDocument<HandbookArticle>;

/**
 * Справочник (самоучитель): статья с правилами, примерами и шпаргалками-таблицами.
 * Тело статьи — массив типизированных блоков, которые фронт рендерит:
 *   { type: 'heading', text }
 *   { type: 'text',    text }
 *   { type: 'rule',    text }                       — выделенное правило
 *   { type: 'example', en, ru, note? }              — один пример EN + перевод
 *   { type: 'examples', items: [{ en, ru }] }       — список примеров
 *   { type: 'table', title?, headers: [], rows: [[]] } — шпаргалка-таблица
 *   { type: 'tip',  text }                          — совет
 *   { type: 'note', text }                          — важное замечание/исключение
 */
@Schema({ timestamps: true, collection: 'handbook_articles' })
export class HandbookArticle {
  @Prop({ required: true, unique: true })
  ref!: string; // e.g. grammar.to-be

  @Prop({ required: true, enum: ['grammar', 'cheatsheet', 'phrases', 'pronunciation'] })
  category!: 'grammar' | 'cheatsheet' | 'phrases' | 'pronunciation';

  @Prop({ required: true, type: Object })
  title!: MultilingualText;

  @Prop({ type: String })
  summary?: string; // короткое описание (ru)

  @Prop({ enum: ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] })
  level?: 'A0' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

  @Prop({ type: String })
  icon?: string; // короткий слаг иконки (front маппит на SVG)

  @Prop({ default: 0 })
  order?: number;

  @Prop({ type: [Object], default: [] })
  blocks!: Array<Record<string, any>>;

  @Prop({ default: true })
  published?: boolean;
}

export const HandbookArticleSchema = SchemaFactory.createForClass(HandbookArticle);
HandbookArticleSchema.index({ category: 1, order: 1 });
