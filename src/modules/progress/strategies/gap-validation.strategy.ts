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

