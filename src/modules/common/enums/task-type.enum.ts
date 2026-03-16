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
 * Канонические типы для выдачи в API-контрактах.
 */
export const CANONICAL_TASK_TYPES: TaskTypeEnum[] = [
  TaskTypeEnum.MULTIPLE_CHOICE,
  TaskTypeEnum.GAP,
  TaskTypeEnum.LISTENING,
  TaskTypeEnum.MATCHING,
  TaskTypeEnum.FLASHCARD,
  TaskTypeEnum.ORDER,
  TaskTypeEnum.TRANSLATE,
  TaskTypeEnum.SPEAK,
];

/**
 * Маппинг алиасов/наследия к каноническим типам.
 */
export const TASK_TYPE_ALIASES: Record<string, TaskTypeEnum> = {
  choice: TaskTypeEnum.MULTIPLE_CHOICE,
  listen: TaskTypeEnum.LISTENING,
  match: TaskTypeEnum.MATCHING,
};

/**
 * Нормализует тип задачи. Если тип неизвестен — возвращает undefined.
 */
export function normalizeTaskType(type: string): TaskTypeEnum | undefined {
  const enumValue = Object.values(TaskTypeEnum).find(v => v === type);
  if (enumValue) return enumValue as TaskTypeEnum;
  return TASK_TYPE_ALIASES[type];
}

/**
 * Возвращает канонический тип для API-контракта.
 */
export function canonicalizeTaskType(type: string): TaskTypeEnum | undefined {
  const normalized = normalizeTaskType(type);
  if (!normalized) return undefined;
  return TASK_TYPE_ALIASES[normalized] ?? normalized;
}

