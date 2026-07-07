import { Type } from 'class-transformer';
import { Allow, IsBoolean, IsDefined, IsIn, IsOptional, ValidateNested } from 'class-validator';
import { ALLOWED_REMINDER_TIMES, ReminderTime } from '../profile.constants';

export class ReminderSettingsPayloadDto {
  @IsBoolean({ message: 'reminderSettings.enabled must be boolean' })
  enabled!: boolean;

  @IsIn(ALLOWED_REMINDER_TIMES, {
    message: "reminderSettings.time must be 'morning' | 'afternoon' | 'evening'",
  })
  time!: ReminderTime;

  @IsOptional()
  @IsBoolean()
  allowsNotifications?: boolean;
}

/**
 * POST /profile/reminder-settings
 * Фронт шлёт { userId, reminderSettings: { enabled, time }, notificationsAllowed }.
 * Исторический контракт клал allowsNotifications внутрь reminderSettings — принимаем оба варианта.
 */
export class SaveReminderSettingsDto {
  /** Игнорируется сервером (userId берётся из JWT). Может быть числом (Telegram) или строкой (em_* веб). */
  @Allow()
  userId?: number | string;

  @IsDefined({ message: 'reminderSettings is required' })
  @ValidateNested()
  @Type(() => ReminderSettingsPayloadDto)
  reminderSettings!: ReminderSettingsPayloadDto;

  @IsOptional()
  @IsBoolean()
  notificationsAllowed?: boolean;
}
