import { Allow, ArrayNotEmpty, IsArray, IsIn } from 'class-validator';
import { ALLOWED_GOALS, AllowedGoal } from '../profile.constants';

/**
 * POST /profile/learning-goals
 * Фронт шлёт { userId, goals } — userId принимаем, но игнорируем (авторитет — JWT).
 */
export class SaveLearningGoalsDto {
  /** Игнорируется сервером (userId берётся из JWT). Может быть числом (Telegram) или строкой (em_* веб). */
  @Allow()
  userId?: number | string;

  @IsArray()
  @ArrayNotEmpty({ message: 'goals must be a non-empty array' })
  @IsIn(ALLOWED_GOALS, { each: true })
  goals!: AllowedGoal[];
}
