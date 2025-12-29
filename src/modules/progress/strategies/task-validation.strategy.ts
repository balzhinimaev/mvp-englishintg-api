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

