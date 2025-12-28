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

// Единый источник правды для типов задач
export const TASK_TYPES = [
  'choice',
  'gap',
  'listen',
  'speak',
  'order',
  'translate',
  'match',
  'multiple_choice',
  'flashcard',
  'listening',
  'matching',
] as const;
export type TaskType = typeof TASK_TYPES[number];

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

  @IsOptional()
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
