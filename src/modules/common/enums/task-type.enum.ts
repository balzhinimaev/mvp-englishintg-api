/**
 * Единый источник правды для типов задач.
 * Используется везде: в схемах, DTO, валидации и бизнес-логике.
 */
export enum TaskTypeEnum {
  CHOICE = 'choice',
  MULTIPLE_CHOICE = 'multiple_choice',
  GAP = 'gap',
  LISTEN = 'listen',
  LISTENING = 'listening',
  SPEAK = 'speak',
  ORDER = 'order',
  TRANSLATE = 'translate',
  MATCH = 'match',
  MATCHING = 'matching',
  FLASHCARD = 'flashcard',
}

/**
 * Массив всех типов задач для валидации.
 */
export const TASK_TYPES = Object.values(TaskTypeEnum);

/**
 * Type для TypeScript.
 */
export type TaskType = TaskTypeEnum;

/**
 * Маппинг дубликатов (listen/listening, match/matching) на канонические типы.
 * TODO: в будущем стоит убрать дубликаты полностью и мигрировать данные.
 */
export const TASK_TYPE_ALIASES: Record<string, TaskTypeEnum> = {
  listen: TaskTypeEnum.LISTENING,
  match: TaskTypeEnum.MATCHING,
};

/**
 * Нормализует тип задачи (убирает дубликаты).
 */
export function normalizeTaskType(type: string): TaskTypeEnum | undefined {
  const enumValue = Object.values(TaskTypeEnum).find(v => v === type);
  if (enumValue) return enumValue as TaskTypeEnum;
  return TASK_TYPE_ALIASES[type];
}

