import { Allow, IsBoolean, IsIn, IsOptional } from 'class-validator';
import { ALLOWED_DAILY_GOALS, DailyGoalMinutes } from '../profile.constants';

/**
 * POST /profile/daily-goal
 * Фронт шлёт { userId, dailyGoalMinutes, notificationsAllowed }.
 * Исторический контракт использовал allowsNotifications — принимаем оба варианта.
 */
export class SaveDailyGoalDto {
  /** Игнорируется сервером (userId берётся из JWT). Может быть числом (Telegram) или строкой (em_* веб). */
  @Allow()
  userId?: number | string;

  @IsIn(ALLOWED_DAILY_GOALS, { message: 'dailyGoalMinutes must be one of 5, 10, 15, 20' })
  dailyGoalMinutes!: DailyGoalMinutes;

  @IsOptional()
  @IsBoolean()
  allowsNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationsAllowed?: boolean;
}
