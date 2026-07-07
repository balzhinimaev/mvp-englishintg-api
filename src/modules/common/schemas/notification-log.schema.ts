import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NotificationType =
  | 'daily_reminder'
  | 'lead_followup'
  | 'onboarding_nudge'
  | 'streak_at_risk';

export type NotificationLogDocument = HydratedDocument<NotificationLog>;

/**
 * Журнал отправленных пушей — гарантия at-most-once.
 * Запись вставляется ПЕРЕД отправкой: уникальный индекс {userId, type, dateKey}
 * делает повторную вставку (после рестарта/повторного запуска крона) ошибкой,
 * которую сервис ловит и пропускает. Лучше не дослать, чем задолбать.
 */
@Schema({ timestamps: true, collection: 'notification_log' })
export class NotificationLog {
  @Prop({ type: String, required: true })
  userId!: string;

  @Prop({ type: String, required: true })
  type!: NotificationType;

  // YYYY-MM-DD в МСК — «слот» дедупликации на сутки
  @Prop({ type: String, required: true })
  dateKey!: string;

  @Prop({ type: Boolean, default: false })
  delivered?: boolean;

  @Prop({ type: Date, default: () => new Date() })
  sentAt!: Date;
}

export const NotificationLogSchema = SchemaFactory.createForClass(NotificationLog);
NotificationLogSchema.index({ userId: 1, type: 1, dateKey: 1 }, { unique: true });
// TTL 90 дней — журнал не растёт бесконечно
NotificationLogSchema.index({ sentAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
