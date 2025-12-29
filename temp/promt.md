# Структурное дерево файлов, связанных с сущностью Task

## Обзор сущности Task

Сущность Task представляет собой учебное задание в системе обучения английскому языку. Каждый Task имеет:
- `ref`: уникальный идентификатор (например, "a0.basics.001.t1")
- `type`: тип задачи (choice, gap, translate и т.д.)
- `data`: специфичные для типа данные задачи
- `validationData`: данные для валидации ответов (генерируются автоматически)

## Основные компоненты системы Task

### 1. **Типы и перечисления**
```
src/modules/common/
├── enums/task-type.enum.ts           # Единый источник типов задач (TaskTypeEnum)
├── types/content.ts                  # Основные интерфейсы (Task, LessonItem и т.д.)
└── types/validation-data.ts          # Типы данных для валидации ответов
    ├── ChoiceValidationData          # options[], correctIndex
    ├── GapValidationData             # answer, alternatives[]
    ├── OrderValidationData           # tokens[]
    ├── TranslateValidationData       # expected[]
    ├── AudioValidationData           # target?
    ├── MatchingValidationData        # pairs[]
    └── FlashcardValidationData       # back?, expected[]
```

### 2. **DTO (Data Transfer Objects)**
```
src/modules/content/dto/
├── task-data.dto.ts                  # Основной TaskDto + специфичные DTO для каждого типа задач
│   ├── ChoiceTaskDataDto
│   ├── GapTaskDataDto
│   ├── ListenTaskDataDto
│   ├── SpeakTaskDataDto
│   ├── OrderTaskDataDto
│   ├── TranslateTaskDataDto
│   ├── FlashcardTaskDataDto
│   └── MatchingTaskDataDto
├── task-response.dto.ts              # DTO для безопасного ответа клиенту (без правильных ответов)
└── lesson-item.dto.ts                # TaskDto для API + LessonItemDto с прогрессом

src/modules/progress/dto/
└── submit-answer.dto.ts              # DTO для отправки ответов на задачи пользователями
```

### 3. **Схемы базы данных**
```
src/modules/common/schemas/
├── lesson.schema.ts                  # Схема урока (содержит массив tasks)
└── user-task-attempt.schema.ts       # Схема попыток решения задач пользователями
```

### 4. **Утилиты и мапперы**
```
src/modules/common/utils/
├── mappers.ts                        # Функции преобразования данных (toTaskResponseDto)
├── task-validation-data.ts           # Генерация validationData из task.data
└── lesson-defaults.ts                # Нормализация данных уроков
```

### 5. **Сервисы и бизнес-логика**
```
src/modules/content/
├── content.service.ts                 # Сервис управления контентом (уроки, модули, задачи)
├── admin-content.controller.ts        # Админ API для создания/редактирования контента
├── content.presenter.ts               # Форматирование данных контента для API
└── utils/
    └── task-lint.ts                   # Линтер и валидатор задач

src/modules/progress/
├── progress.service.ts                # Основной сервис прогресса обучения
├── answer-validator.service.ts        # Сервис валидации ответов задач
├── progress.controller.ts             # REST API для работы с прогрессом
└── strategies/                        # Стратегии валидации по типам задач
    ├── task-validation.strategy.ts    # Базовая стратегия
    ├── choice-validation.strategy.ts  # Валидация choice/multiple_choice
    ├── gap-validation.strategy.ts     # Валидация gap
    ├── order-validation.strategy.ts   # Валидация order
    ├── translate-validation.strategy.ts # Валидация translate
    ├── audio-validation.strategy.ts   # Валидация listen/speak
    ├── matching-validation.strategy.ts # Валидация match/matching
    └── flashcard-validation.strategy.ts # Валидация flashcard
```

### 6. **Модули и конфигурация**
```
src/modules/
├── progress/progress.module.ts        # Модуль прогресса (импортирует все стратегии)
└── content/content.module.ts          # Модуль контента (управление задачами)
```

### 7. **Тесты**
```
src/modules/
├── common/__tests__/mappers.spec.ts   # Тесты мапперов
├── content/__tests__/
│   ├── task-data.dto.spec.ts          # Тесты DTO задач
│   └── task-lint.spec.ts              # Тесты линтера задач
└── progress/__tests__/
    ├── progress.service.spec.ts       # Тесты сервиса прогресса
    ├── answer-validator.service.spec.ts # Тесты валидатора ответов
    └── progress.controller.spec.ts    # Тесты контроллера прогресса
```

### 8. **Скрипты и утилиты**
```
scripts/
├── content-lint.ts                    # Линтер контента (проверка задач)
├── validate-content.ts                # Валидация контента
├── seed-content.ts                    # Наполнение БД контентом
└── task-lint.ts                       # Линтер задач (внутри content/utils/task-lint.ts)
```

## Поток данных Task

### Создание и управление задачами:
1. **Валидация структуры**: `task-lint.ts` → проверка корректности данных задачи
2. **Создание/обновление**: `admin-content.controller.ts` → `content.service.ts` → `task-data.dto.ts`
3. **Сохранение в БД**: `lesson.schema.ts` (массив tasks + validationData)

### Решение задач пользователями:
1. **Отправка ответа**: `submit-answer.dto.ts` → `progress.controller.ts`
2. **Валидация ответа**: `answer-validator.service.ts` → выбор стратегии валидации
3. **Проверка логики**: `ValidationStrategy` (gap, choice, translate и т.д.)
4. **Сохранение попытки**: `user-task-attempt.schema.ts`

### Получение данных для клиента:
1. **Форматирование**: `content.presenter.ts` → `lesson-item.dto.ts`
2. **Безопасность**: `task-response.dto.ts` → скрытие правильных ответов через `@Expose()`

## Типы задач

- `choice` / `multiple_choice`: Выбор правильного ответа из вариантов
- `gap`: Заполнение пропуска в тексте
- `listen` / `listening`: Аудирование
- `speak`: Произношение
- `order`: Расстановка слов в правильном порядке
- `translate`: Перевод текста
- `match` / `matching`: Сопоставление пар
- `flashcard`: Флэш-карточки (слово + перевод)

## Ключевые взаимосвязи

- **Task** принадлежит **Lesson** (через `lessonRef`)
- **Task** имеет **TaskType** из enum
- **Task** содержит **data** специфичную для типа
- **data** преобразуется в **validationData** для проверки ответов
- **UserTaskAttempt** сохраняет попытки решения задач пользователями
- **ValidationStrategy** определяет логику проверки для каждого типа задач

## Важные аспекты системы

### Линтинг и валидация контента
- **task-lint.ts**: Проверяет структуру задач перед публикацией
- **content-lint.ts**: Скрипт для проверки всего контента
- Автоматическая генерация `validationData` в `lesson.schema.ts` pre-save hook

### Форматы идентификаторов
- `lessonRef`: `{level}.{module}.{order}` (a0.basics.001)
- `taskRef`: `{lessonRef}.{taskId}` (a0.basics.001.t1)
- `moduleRef`: `{level}.{module}` (a0.basics)

### Дубликаты типов задач
- `listen`/`listening`, `match`/`matching`, `choice`/`multiple_choice`
- `normalizeTaskType()` в enum приводит к каноническим типам
- TODO: планируется удаление дубликатов в будущем

## Безопасность данных

- `TaskResponseDto` использует `@Expose()` для показа только безопасных полей клиенту
- Правильные ответы (`validationData`) никогда не передаются на клиент
- Валидация ответов происходит только на сервере через стратегии
- `SubmitAnswerDto` принимает только ответ пользователя, без правильных данных

---

## Исходный код ключевых файлов

### Фундаментальные типы и Enum

## src/modules/common/types/content.ts
```typescript
// src/common/types/content.ts
import { MultilingualText, OptionalMultilingualText } from '../utils/i18n.util';
import { TaskTypeEnum } from '../enums/task-type.enum';

export type CEFR = 'A0'|'A1'|'A2'|'B1'|'B2'|'C1'|'C2';

export interface ModuleProgress {
  completed: number;
  total: number;
  inProgress: number;
}

export interface ModuleItem {
  moduleRef: string;
  level: CEFR;
  title: MultilingualText;
  description?: OptionalMultilingualText;
  tags: string[];
  difficultyRating?: number;
  order: number;
  requiresPro: boolean;
  isAvailable: boolean;
  author?: {
    userId: string;
    name?: string;
  };
  progress?: ModuleProgress;  // вычисляется для текущего userId
}

export type LessonStatus = 'completed' | 'in_progress' | 'not_started';
export type LessonType = 'conversation' | 'vocabulary' | 'grammar';
export type LessonDifficulty = 'easy' | 'medium' | 'hard';

// Используем enum как единый источник правды для типов задач
export type TaskType = TaskTypeEnum;

export interface LessonProgress {
  status: LessonStatus;
  score: number;
  attempts: number;
  completedAt?: string;
  timeSpent?: number; // seconds
}

export interface Task {
  ref: string;
  type: TaskType;
  data: Record<string, any>;
}

export interface LessonItem {
  lessonRef: string;
  moduleRef: string;
  title: string;
  description?: string;
  estimatedMinutes: number;
  order: number;
  type?: LessonType;
  difficulty?: LessonDifficulty;
  tags?: string[];
  xpReward?: number;
  hasAudio?: boolean;
  hasVideo?: boolean;
  previewText?: string;
  taskTypes?: TaskType[];
  progress?: LessonProgress;
  tasks?: Task[]; // для detailed
}

export interface VocabularyItem {
  id: string;
  word: string;
  translation?: string;
  transcription?: string;
  pronunciation?: string;
  partOfSpeech?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  examples?: Array<{ original: string; translation: string }>;
  tags?: string[];
  lessonRefs?: string[];
  moduleRefs?: string[];
  audioKey?: string;
  occurrenceCount?: number;
}

export type VocabularyStatus = 'not_started' | 'learning' | 'learned';

export interface UserVocabularyProgress {
  userId: string;
  moduleRef: string;
  wordId: string;
  status: VocabularyStatus;
  score?: number;
  attempts?: number;
  timeSpent?: number;
  lastStudiedAt?: Date;
  learnedAt?: Date;
  correctAttempts?: number;
  totalAttempts?: number;
  lessonRefs?: string[];
}

export interface VocabularyProgressStats {
  totalWords: number;
  learnedWords: number;
  learningWords: number;
  notStartedWords: number;
  progressPercentage: number;
}

export type UserCohort =
  | 'new_user' | 'returning_user' | 'premium_trial'
  | 'high_engagement' | 'low_engagement' | 'churned' | 'test_payment' | 'default';

export interface CohortPricing {
  cohort: UserCohort;
  monthlyPrice: number;
  monthlyOriginalPrice: number;
  quarterlyPrice: number;
  quarterlyOriginalPrice: number;
  yearlyPrice: number;
  yearlyOriginalPrice: number;
  promoCode?: string;
  discountPercentage?: number;
  quarterlyDiscountPercentage?: number;
  yearlyDiscountPercentage?: number;
}

export interface PaywallProduct {
  id: 'monthly' | 'quarterly' | 'yearly';
  name: string;
  description: string;
  price: number;
  originalPrice?: number; // Original price for strikethrough display
  currency: 'RUB';
  duration: 'month'|'quarter'|'year';
  discount?: number;
  isPopular?: boolean;
  monthlyEquivalent?: number; // Monthly equivalent price in kopecks for yearly subscription
  savingsPercentage?: number; // Percentage savings compared to monthly subscription
}
```

## src/modules/common/enums/task-type.enum.ts
```typescript
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
```

### DTO (Структура данных задач)

## src/modules/content/dto/task-data.dto.ts
```typescript
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { TASK_TYPES, TaskTypeEnum } from '../../common/enums/task-type.enum';

// Re-export для обратной совместимости
export type TaskType = TaskTypeEnum;

// --- DTO для каждого типа задач ---

export class ChoiceTaskDataDto {
  @IsString()
  @IsNotEmpty()
  question!: string;

  @IsArray()
  @IsString({ each: true })
  options!: string[];

  @IsNumber()
  correctIndex!: number; // Index of correct answer

  @IsOptional()
  @IsString()
  explanation?: string; // Explanation of the correct answer
}

export class GapTaskDataDto {
  @IsString()
  @IsNotEmpty()
  text!: string; // e.g., "It costs ____ dollars"

  @IsString()
  @IsNotEmpty()
  answer!: string; // correct answer for the gap

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  hints?: string[];

  @IsOptional()
  @IsString()
  hint?: string; // RU подсказка, 6–12 слов

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  accept?: string[]; // синонимы/варианты: регистр, цифры/слова

  @IsOptional()
  @IsString()
  explanation?: string; // RU объяснение, зачем именно такой ответ

  @IsOptional()
  @IsString()
  context?: string; // 1 строка сцены/ситуации

  @IsOptional()
  @IsString()
  audioKey?: string; // короткая подсказка-аудио

  @IsOptional()
  @IsBoolean()
  caseInsensitive?: boolean; // true по умолчанию для A0–A1
}

export class ListenTaskDataDto {
  @IsString()
  @IsNotEmpty()
  audioKey!: string; // Changed from audioUrl to audioKey

  @IsString()
  @IsOptional()
  transcript?: string; // Может быть на клиенте для self-check

  @IsOptional()
  @IsString()
  question?: string; // Question for listening task

  @IsOptional()
  @IsString()
  translation?: string; // Translation of the transcript
}

export class SpeakTaskDataDto {
  @IsString()
  @IsNotEmpty()
  prompt!: string; // e.g., "Say: 'Hello'"
}

export class OrderTaskDataDto {
  @IsArray()
  @IsString({ each: true })
  tokens!: string[]; // e.g., ["What", "time", "is", "it", "?"]
}

export class TranslateTaskDataDto {
  @IsString()
  @IsNotEmpty()
  question!: string; // e.g., "Переведи: 'сколько это стоит?'"

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  expected!: string[];
}

export class FlashcardTaskDataDto {
  @IsString()
  @IsNotEmpty()
  front!: string; // e.g., "Hello"

  @IsString()
  @IsNotEmpty()
  back!: string; // e.g., "Привет"

  @IsOptional()
  @IsString()
  example?: string; // e.g., "Hello, my name is John"

  @IsOptional()
  @IsString()
  audioKey?: string; // e.g., "a0.basics.001.t1.hello"

  @IsOptional()
  @IsString()
  transcript?: string;

  @IsOptional()
  @IsString()
  translation?: string;
}

export class MatchingPairDto {
  @IsString()
  @IsNotEmpty()
  left!: string; // e.g., "Hello"

  @IsString()
  @IsNotEmpty()
  right!: string; // e.g., "Привет"

  @IsOptional()
  @IsString()
  audioKey?: string; // audio for left item
}

export class MatchingTaskDataDto {
  @IsOptional()
  @IsString()
  instruction?: string; // e.g., "Соедините английские слова с переводом"

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MatchingPairDto)
  pairs!: MatchingPairDto[]; // 6-10 pairs
}

// --- Базовый Task DTO ---
export class TaskDto {
  @IsString()
  ref!: string; // a0.travel.001.t1

  @IsIn(TASK_TYPES)
  type!: TaskType;

  @IsObject()
  @ValidateNested()
  @Type(({ object }: any) => {
    switch (object.type as TaskType) {
      case 'choice':
      case 'multiple_choice':
        return ChoiceTaskDataDto;
      case 'gap':
        return GapTaskDataDto;
      case 'listen':
      case 'listening':
        return ListenTaskDataDto;
      case 'speak':
        return SpeakTaskDataDto;
      case 'order':
        return OrderTaskDataDto;
      case 'translate':
        return TranslateTaskDataDto;
      case 'flashcard':
        return FlashcardTaskDataDto;
      case 'match':
      case 'matching':
        return MatchingTaskDataDto;
      default:
        class DefaultTaskData {}
        return DefaultTaskData;
    }
  })
  data!:
    | ChoiceTaskDataDto
    | GapTaskDataDto
    | ListenTaskDataDto
    | SpeakTaskDataDto
    | OrderTaskDataDto
    | TranslateTaskDataDto
    | FlashcardTaskDataDto
    | MatchingTaskDataDto
    | Record<string, any>;

  @IsOptional()
  @IsObject()
  validationData?: Record<string, any>;
}
```

### Генерация валидации и Схемы БД

## src/modules/common/utils/task-validation-data.ts
```typescript
import { TaskTypeEnum } from '../enums/task-type.enum';
import { AudioValidationData, ChoiceValidationData, FlashcardValidationData, GapValidationData, MatchingValidationData, OrderValidationData, TaskValidationData, TranslateValidationData } from '../types/validation-data';

const toStringArray = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every(item => typeof item === 'string') ? value : undefined;

export const mapTaskDataToValidationData = (task: { type: TaskTypeEnum | string; data?: Record<string, any> }): TaskValidationData | undefined => {
  const data = task.data;
  if (!data) return undefined;

  switch (task.type) {
    case 'choice':
    case 'multiple_choice': {
      if (!Array.isArray(data.options) || typeof data.correctIndex !== 'number') return undefined;
      return {
        options: data.options,
        correctIndex: data.correctIndex,
      } satisfies ChoiceValidationData;
    }
    case 'gap': {
      if (typeof data.answer !== 'string') return undefined;
      const alternatives = toStringArray(data.accept) ?? toStringArray(data.alternatives);
      return {
        answer: data.answer,
        alternatives,
      } satisfies GapValidationData;
    }
    case 'order': {
      const tokens = toStringArray(data.tokens);
      if (!tokens) return undefined;
      return { tokens } satisfies OrderValidationData;
    }
    case 'translate': {
      const expected = toStringArray(data.expected);
      if (!expected) return undefined;
      return { expected } satisfies TranslateValidationData;
    }
    case 'listen':
    case 'listening':
    case 'speak': {
      return {
        target: typeof data.target === 'string' ? data.target : undefined,
      } satisfies AudioValidationData;
    }
    case 'match':
    case 'matching': {
      if (!Array.isArray(data.pairs)) return undefined;
      const pairs = data.pairs
        .filter((pair: { left?: unknown; right?: unknown }) => typeof pair?.left === 'string' && typeof pair?.right === 'string')
        .map((pair: { left: string; right: string }) => ({ left: pair.left, right: pair.right }));
      return {
        pairs,
      } satisfies MatchingValidationData;
    }
    case 'flashcard': {
      const expected = toStringArray(data.expected);
      return {
        back: typeof data.back === 'string' ? data.back : undefined,
        expected,
      } satisfies FlashcardValidationData;
    }
    default:
      return undefined;
  }
};
```

## src/modules/common/schemas/lesson.schema.ts
```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { MultilingualText, OptionalMultilingualText } from '../utils/i18n.util';
import { mapTaskDataToValidationData } from '../utils/task-validation-data';

export type LessonDocument = HydratedDocument<Lesson>;

@Schema({ timestamps: true, collection: 'lessons' })
export class Lesson {
  @Prop({ required: true })
  moduleRef!: string; // e.g., a0.travel

  @Prop({ required: true })
  lessonRef!: string; // e.g., a0.travel.001

  @Prop({ required: true, type: Object })
  title!: MultilingualText;

  @Prop({ type: Object })
  description?: OptionalMultilingualText;

  @Prop({ default: 10 })
  estimatedMinutes?: number;

  @Prop({ type: [Object], default: [] })
  tasks?: Array<{ ref: string; type: string; data: Record<string, any>; validationData?: Record<string, any> }>;

  @Prop({ type: [String], default: [] })
  taskTypes?: string[];

  @Prop({ default: true })
  published?: boolean;

  @Prop({ default: 0 })
  order?: number; // within module

  @Prop({ default: false })
  requiresPro?: boolean; // Явное требование PRO подписки для этого урока

  @Prop({ enum: ['conversation','vocabulary','grammar'], default: 'vocabulary' })
  type?: 'conversation'|'vocabulary'|'grammar';

  @Prop({ enum: ['easy','medium','hard'], default: 'easy' })
  difficulty?: 'easy'|'medium'|'hard';

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop({ default: 25 })
  xpReward?: number;

  @Prop({ default: true })
  hasAudio?: boolean;

  @Prop({ default: false })
  hasVideo?: boolean;

  @Prop()
  previewText?: string;
}

export const LessonSchema = SchemaFactory.createForClass(Lesson);

/**
 * Pre-save hook: автоматически генерирует validationData для каждой задачи.
 * Это гарантирует, что validationData всегда актуальна и синхронизирована с taskData.
 * Предотвращает рассинхрон данных между data и validationData.
 */
LessonSchema.pre('save', function(next) {
  if (this.tasks && Array.isArray(this.tasks)) {
    this.tasks.forEach((task: any) => {
      // Автоматически генерируем данные для валидации перед сохранением
      const validationData = mapTaskDataToValidationData({
        type: task.type as any,
        data: task.data,
      });
      
      if (validationData) {
        task.validationData = validationData;
      }
    });
  }
  next();
});

// Индекс для быстрого поиска уроков по модулю и порядку
LessonSchema.index({ moduleRef: 1, order: 1 });
// Уникальный индекс на lessonRef
LessonSchema.index({ lessonRef: 1 }, { unique: true });
// Уникальный индекс на комбинацию moduleRef + order для предотвращения дубликатов порядка
// Partial index: применяется только к опубликованным урокам с order >= 1
LessonSchema.index(
  { moduleRef: 1, order: 1 }, 
  { 
    unique: true, 
    partialFilterExpression: { 
      published: true, 
      order: { $gte: 1 } 
    },
    name: 'unique_module_order_published'
  }
);
```

### Логика проверки (Сервис и Стратегии)

## src/modules/progress/answer-validator.service.ts
```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Lesson, LessonDocument } from '../common/schemas/lesson.schema';
import { TaskTypeEnum, normalizeTaskType } from '../common/enums/task-type.enum';
import { mapTaskDataToValidationData } from '../common/utils/task-validation-data';
import { TaskValidationStrategyRegistry } from './strategies/task-validation.strategy';
import { ChoiceValidationStrategy } from './strategies/choice-validation.strategy';
import { GapValidationStrategy } from './strategies/gap-validation.strategy';
import { OrderValidationStrategy } from './strategies/order-validation.strategy';
import { TranslateValidationStrategy } from './strategies/translate-validation.strategy';
import { AudioValidationStrategy } from './strategies/audio-validation.strategy';
import { MatchingValidationStrategy } from './strategies/matching-validation.strategy';
import { FlashcardValidationStrategy } from './strategies/flashcard-validation.strategy';

export interface ValidationResult {
  isCorrect: boolean;
  score: number; // 0.0 - 1.0
  feedback?: string;
  correctAnswer?: string; // Для показа пользователю после ответа
  explanation?: string;
}

export class LessonNotFoundError extends Error {
  constructor() {
    super('Lesson not found');
    this.name = 'LessonNotFoundError';
  }
}

export class TaskNotFoundError extends Error {
  constructor() {
    super('Task not found');
    this.name = 'TaskNotFoundError';
  }
}

export class InvalidAnswerFormatError extends Error {
  constructor(message = 'Неверный формат ответа') {
    super(message);
    this.name = 'InvalidAnswerFormatError';
  }
}

export class ValidationDataError extends Error {
  constructor(message = 'Отсутствуют данные для валидации') {
    super(message);
    this.name = 'ValidationDataError';
  }
}

export class UnsupportedTaskTypeError extends Error {
  constructor(taskType: string) {
    super(`Unsupported task type: ${taskType}`);
    this.name = 'UnsupportedTaskTypeError';
  }
}

/**
 * Сервис валидации ответов пользователя.
 * Использует Strategy Pattern для разделения логики валидации разных типов задач.
 */
@Injectable()
export class AnswerValidatorService implements OnModuleInit {
  private readonly strategyRegistry = new TaskValidationStrategyRegistry();

  constructor(
    @InjectModel(Lesson.name) private readonly lessonModel: Model<LessonDocument>,
    private readonly choiceStrategy: ChoiceValidationStrategy,
    private readonly gapStrategy: GapValidationStrategy,
    private readonly orderStrategy: OrderValidationStrategy,
    private readonly translateStrategy: TranslateValidationStrategy,
    private readonly audioStrategy: AudioValidationStrategy,
    private readonly matchingStrategy: MatchingValidationStrategy,
    private readonly flashcardStrategy: FlashcardValidationStrategy,
  ) {}

  /**
   * Регистрируем стратегии валидации при инициализации модуля.
   */
  onModuleInit() {
    this.strategyRegistry.register(TaskTypeEnum.CHOICE, this.choiceStrategy);
    this.strategyRegistry.register(TaskTypeEnum.MULTIPLE_CHOICE, this.choiceStrategy);
    this.strategyRegistry.register(TaskTypeEnum.GAP, this.gapStrategy);
    this.strategyRegistry.register(TaskTypeEnum.ORDER, this.orderStrategy);
    this.strategyRegistry.register(TaskTypeEnum.TRANSLATE, this.translateStrategy);
    this.strategyRegistry.register(TaskTypeEnum.LISTEN, this.audioStrategy);
    this.strategyRegistry.register(TaskTypeEnum.LISTENING, this.audioStrategy);
    this.strategyRegistry.register(TaskTypeEnum.SPEAK, this.audioStrategy);
    this.strategyRegistry.register(TaskTypeEnum.MATCH, this.matchingStrategy);
    this.strategyRegistry.register(TaskTypeEnum.MATCHING, this.matchingStrategy);
    this.strategyRegistry.register(TaskTypeEnum.FLASHCARD, this.flashcardStrategy);
  }

  /**
   * Валидирует ответ пользователя на задачу.
   * @param lessonRef - Ссылка на урок.
   * @param taskRef - Ссылка на задачу.
   * @param userAnswer - Ответ пользователя (строка или JSON).
   * @returns Результат валидации.
   */
  async validateAnswer(lessonRef: string, taskRef: string, userAnswer: string): Promise<ValidationResult> {
    // 🔍 Получаем урок с правильными ответами (только на сервере!)
    const lesson = await this.lessonModel.findOne({ lessonRef, published: true }).lean();
    if (!lesson) {
      throw new LessonNotFoundError();
    }

    const task = lesson.tasks?.find(t => t.ref === taskRef);
    if (!task) {
      throw new TaskNotFoundError();
    }

    // 🔒 Получаем данные для валидации
    const validationData = (task as { validationData?: Record<string, any> }).validationData
      ?? mapTaskDataToValidationData({ type: task.type as any, data: task.data });

    if (!validationData) {
      throw new ValidationDataError();
    }

    // Нормализуем тип задачи (убираем дубликаты listen/listening, match/matching)
    const normalizedType = normalizeTaskType(task.type);
    if (!normalizedType) {
      throw new UnsupportedTaskTypeError(task.type);
    }

    // Получаем стратегию валидации для данного типа задачи
    const strategy = this.strategyRegistry.get(normalizedType);
    if (!strategy) {
      throw new UnsupportedTaskTypeError(task.type);
    }

    // Выполняем валидацию с помощью стратегии
    return strategy.validate(userAnswer, validationData, task.data);
  }
}
```

## src/modules/progress/strategies/task-validation.strategy.ts
```typescript
import { TaskTypeEnum } from '../../common/enums/task-type.enum';
import { TaskValidationData } from '../../common/types/validation-data';

/**
 * Результат валидации ответа пользователя.
 */
export interface ValidationResult {
  isCorrect: boolean;
  score: number; // 0.0 - 1.0
  feedback?: string;
  correctAnswer?: string;
  explanation?: string;
}

/**
 * Интерфейс стратегии валидации для конкретного типа задачи.
 * Каждый тип задачи имеет свою реализацию.
 */
export interface TaskValidationStrategy {
  /**
   * Проверяет ответ пользователя.
   * @param userAnswer - Ответ пользователя (строка, JSON).
   * @param validationData - Данные для валидации (правильные ответы).
   * @param taskData - Полные данные задачи (может содержать дополнительную информацию).
   * @returns Результат валидации.
   */
  validate(
    userAnswer: string,
    validationData: TaskValidationData,
    taskData?: Record<string, any>
  ): ValidationResult;
}

/**
 * Реестр стратегий валидации.
 * Позволяет получить стратегию по типу задачи.
 */
export class TaskValidationStrategyRegistry {
  private strategies = new Map<TaskTypeEnum, TaskValidationStrategy>();

  register(taskType: TaskTypeEnum, strategy: TaskValidationStrategy): void {
    this.strategies.set(taskType, strategy);
  }

  get(taskType: TaskTypeEnum): TaskValidationStrategy | undefined {
    return this.strategies.get(taskType);
  }

  has(taskType: TaskTypeEnum): boolean {
    return this.strategies.has(taskType);
  }
}
```

## src/modules/progress/strategies/gap-validation.strategy.ts
```typescript
import { Injectable } from '@nestjs/common';
import { GapValidationData } from '../../common/types/validation-data';
import { TaskValidationStrategy, ValidationResult } from './task-validation.strategy';

/**
 * Стратегия валидации для задач типа gap (заполнение пропусков).
 */
@Injectable()
export class GapValidationStrategy implements TaskValidationStrategy {
  validate(
    userAnswer: string,
    validationData: GapValidationData,
    taskData?: Record<string, any>
  ): ValidationResult {
    const caseInsensitive = taskData?.caseInsensitive !== false; // По умолчанию true
    const normalizedAnswer = caseInsensitive ? userAnswer.trim().toLowerCase() : userAnswer.trim();
    const normalizedCorrect = caseInsensitive 
      ? validationData.answer.toLowerCase() 
      : validationData.answer;

    // Проверяем основной ответ
    let isCorrect = normalizedAnswer === normalizedCorrect;

    // Проверяем альтернативы
    if (!isCorrect && validationData.alternatives) {
      isCorrect = validationData.alternatives.some(alt => {
        const normalizedAlt = caseInsensitive ? alt.toLowerCase() : alt;
        return normalizedAnswer === normalizedAlt;
      });
    }

    return {
      isCorrect,
      score: isCorrect ? 1 : 0,
      correctAnswer: validationData.answer,
      explanation: taskData?.explanation,
      feedback: isCorrect ? undefined : `Правильный ответ: ${validationData.answer}`,
    };
  }
}
```

### Линтинг и Валидация контента

## src/modules/content/utils/task-lint.ts
```typescript
import { TaskDto } from '../dto/task-data.dto';
import { matchesModuleRef } from '../../common/utils/lesson-ref';
const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isTrimmedNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.trim() === value;

export function lintLessonTasks(
  lessonRef: string,
  tasks?: TaskDto[],
  moduleRef?: string,
  published?: boolean,
  order?: number
): string[] {
  const errors: string[] = [];
  if (moduleRef) {
    if (!matchesModuleRef(lessonRef, moduleRef)) {
      errors.push(`lessonRef must match ${moduleRef}.NNN`);
    }
  }
  if (published === true) {
    if (!tasks || tasks.length === 0) {
      errors.push('published lesson requires tasks');
      return errors;
    }
    // Проверка order для опубликованных уроков
    if (order === undefined || order === null || order < 1) {
      errors.push('published lesson requires order >= 1');
    }
  }
  if (!tasks || tasks.length === 0) return errors;
  const seen = new Set<string>();
  tasks.forEach((t, i) => {
    if (seen.has(t.ref)) errors.push(`duplicate task.ref: ${t.ref}`);
    seen.add(t.ref);
    if (!t.ref.startsWith(`${lessonRef}.`)) errors.push(`task[${i}].ref must start with ${lessonRef}.`);
    if (t.type === 'choice' || t.type === 'multiple_choice') {
      const label = t.type;
      const d = t.data as any;
      if (!Array.isArray(d.options) || d.options.length < 2) errors.push(`${label}[${i}] requires >=2 options`);
      if (typeof d.correctIndex !== 'number') errors.push(`${label}[${i}] missing correctIndex`);
    }
    if (t.type === 'gap') {
      const d = t.data as any;
      if (typeof d.text !== 'string' || !d.text.includes('____')) errors.push(`gap[${i}].text must contain ____`);
      if (typeof d.answer !== 'string' || !d.answer) errors.push(`gap[${i}].answer is required`);
    }
    if (t.type === 'translate') {
      const d = t.data as any;
      if (!Array.isArray(d.expected) || d.expected.length === 0 || !d.expected.every(isNonEmptyString)) {
        errors.push(`translate[${i}].expected must be non-empty string array`);
      }
    }
    if (t.type === 'order') {
      const d = t.data as any;
      if (!Array.isArray(d.tokens) || d.tokens.length === 0 || !d.tokens.every(isNonEmptyString)) {
        errors.push(`order[${i}].tokens must be non-empty string array`);
      }
    }
    if (t.type === 'matching' || t.type === 'match') {
      const d = t.data as any;
      const pairsValid =
        Array.isArray(d.pairs) &&
        d.pairs.length > 0 &&
        d.pairs.every((pair: any) => isNonEmptyString(pair?.left) && isNonEmptyString(pair?.right));
      if (!pairsValid) errors.push(`${t.type}[${i}].pairs must include left/right`);
    }
    if (t.type === 'listen' || t.type === 'listening') {
      const d = t.data as any;
      if (!isTrimmedNonEmptyString(d.audioKey)) errors.push(`${t.type}[${i}].audioKey is required`);
    }
    if (t.type === 'flashcard') {
      const d = t.data as any;
      if (!isNonEmptyString(d.front) || !isNonEmptyString(d.back)) {
        errors.push(`flashcard[${i}].front/back are required`);
      }
    }
    if (t.type === 'speak') {
      const d = t.data as any;
      if (!isNonEmptyString(d.prompt)) errors.push(`speak[${i}].prompt is required`);
    }
  });
  return errors;
}
```
