import { Injectable } from '@nestjs/common';
import { GapValidationData } from '../../common/types/validation-data';
import { TaskValidationStrategy, ValidationResult } from './task-validation.strategy';
import { normalizeAnswer } from './normalize';

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
    // Единая нормализация (как в translate): trim, кавычки, финальная пунктуация,
    // двойные пробелы. Регистр — по флагу caseInsensitive.
    const normalizedAnswer = normalizeAnswer(userAnswer, { caseInsensitive });

    // Проверяем основной ответ
    let isCorrect = normalizedAnswer === normalizeAnswer(validationData.answer, { caseInsensitive });

    // Проверяем альтернативы
    if (!isCorrect && validationData.alternatives) {
      isCorrect = validationData.alternatives.some(
        alt => normalizedAnswer === normalizeAnswer(alt, { caseInsensitive }),
      );
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

