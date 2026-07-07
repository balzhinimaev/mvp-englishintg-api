/**
 * Общие константы онбординга/профиля.
 * Единый источник правды для контроллеров и DTO (не дублировать по файлам).
 * Значения зеркалят контракт фронтенда (frontend/src/utils/constants.ts).
 */
export const ALLOWED_GOALS = [
  'work_career',
  'study_exams',
  'travel',
  'communication',
  'entertainment',
  'relocation',
  'curiosity',
] as const;
export type AllowedGoal = (typeof ALLOWED_GOALS)[number];

export const ALLOWED_REMINDER_TIMES = ['morning', 'afternoon', 'evening'] as const;
export type ReminderTime = (typeof ALLOWED_REMINDER_TIMES)[number];

export const ALLOWED_DAILY_GOALS = [5, 10, 15, 20] as const;
export type DailyGoalMinutes = (typeof ALLOWED_DAILY_GOALS)[number];

export const ENGLISH_LEVELS = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type EnglishLevel = (typeof ENGLISH_LEVELS)[number];

export const PROFICIENCY_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type ProficiencyLevel = (typeof PROFICIENCY_LEVELS)[number];
