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
