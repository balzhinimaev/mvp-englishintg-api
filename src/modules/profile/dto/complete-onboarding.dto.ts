import { Allow, IsArray, IsIn, IsOptional } from 'class-validator';
import {
  ALLOWED_GOALS,
  AllowedGoal,
  ENGLISH_LEVELS,
  EnglishLevel,
  PROFICIENCY_LEVELS,
  ProficiencyLevel,
} from '../profile.constants';

/**
 * PATCH /profile/onboarding/complete
 * Фронт (OnboardingCompleteRequest) шлёт { userId, proficiencyLevel, learningGoals? } —
 * userId принимаем, но игнорируем (авторитет — JWT). englishLevel — обратная совместимость.
 */
export class CompleteOnboardingDto {
  /** Игнорируется сервером (userId берётся из JWT). Может быть числом (Telegram) или строкой (em_* веб). */
  @Allow()
  userId?: number | string;

  @IsOptional()
  @IsIn(ENGLISH_LEVELS)
  englishLevel?: EnglishLevel;

  @IsOptional()
  @IsIn(PROFICIENCY_LEVELS)
  proficiencyLevel?: ProficiencyLevel;

  @IsOptional()
  @IsArray()
  @IsIn(ALLOWED_GOALS, { each: true })
  learningGoals?: AllowedGoal[];
}
