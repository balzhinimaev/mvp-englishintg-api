import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ type: String, required: true })
  userId!: string;

  @Prop({ type: Object })
  firstUtm?: Record<string, string>;

  @Prop({ type: Object })
  lastUtm?: Record<string, string>;

  @Prop()
  firstName?: string;

  @Prop()
  lastName?: string;

  @Prop()
  username?: string;

  @Prop()
  email?: string;

  // Email-аутентификация (веб-версия). Для Telegram-пользователей пусто.
  @Prop({ select: false })
  passwordHash?: string;

  @Prop({ enum: ['telegram', 'email'], default: 'telegram' })
  authProvider?: 'telegram' | 'email';

  @Prop()
  emailVerified?: boolean;

  // Токены ниже хранятся как sha256-хэши: утечка БД не даёт рабочих ссылок
  @Prop({ select: false })
  emailVerificationToken?: string;

  @Prop({ select: false })
  emailVerificationExpires?: Date;

  @Prop({ select: false })
  passwordResetToken?: string;

  @Prop({ select: false })
  passwordResetExpires?: Date;

  @Prop()
  languageCode?: string;

  @Prop()
  photoUrl?: string;

  @Prop()
  onboardingCompletedAt?: Date;

  @Prop()
  englishLevel?: 'A0' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

  @Prop()
  learningGoals?: string[];

  @Prop()
  dailyGoalMinutes?: 5 | 10 | 15 | 20;

  @Prop({ default: false })
  notificationsAllowed?: boolean;

  @Prop({ type: Object })
  reminderSettings?: { enabled: boolean; time: 'morning' | 'afternoon' | 'evening' };

  @Prop()
  proficiencyLevel?: 'beginner' | 'intermediate' | 'advanced';

  @Prop({ default: 'UTC' })
  tz?: string;

  @Prop()
  locale?: string;

  @Prop({ type: Object })
  hints?: { script?: 'cyr' | 'translit' | 'both' };

  @Prop({ default: 0 })
  xpTotal?: number;

  @Prop({ type: Object })
  streak?: { current: number; longest: number; lastActiveDayKey?: string };

  @Prop()
  lastLessonRef?: string;

  @Prop({ type: Object })
  pro?: { active: boolean; since?: Date; plan?: string };

  @Prop({ default: false })
  isAdmin?: boolean;

  // Timestamps fields (automatically added by Mongoose with timestamps: true)
  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ userId: 1 }, { unique: true });
// Email уникален только среди email-аккаунтов (у Telegram-юзеров email из чеков не мешает)
UserSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { authProvider: 'email' } },
);
// Поиск по одноразовым токенам (sparse — поля есть только у email-аккаунтов в процессе флоу)
UserSchema.index({ emailVerificationToken: 1 }, { sparse: true });
UserSchema.index({ passwordResetToken: 1 }, { sparse: true });


