import { Injectable } from '@nestjs/common';
import { FlashcardValidationData } from '../../common/types/validation-data';
import { TaskValidationStrategy, ValidationResult } from './task-validation.strategy';

/**
 * Стратегия валидации для задач типа flashcard.
 */
@Injectable()
export class FlashcardValidationStrategy implements TaskValidationStrategy {
  validate(
    userAnswer: string,
    validationData: FlashcardValidationData,
    taskData?: Record<string, any>
  ): ValidationResult {
    const normalizedAnswer = userAnswer.trim().toLowerCase();

    // Проверяем основной ответ (back стороны карточки)
    let isCorrect = false;
    
    if (validationData.back) {
      isCorrect = normalizedAnswer === validationData.back.toLowerCase();
    }

    // Проверяем альтернативные ответы
    if (!isCorrect && validationData.expected) {
      isCorrect = validationData.expected.some(
        expected => normalizedAnswer === expected.toLowerCase()
      );
    }

    const correctAnswer = validationData.back || validationData.expected?.[0];

    return {
      isCorrect,
      score: isCorrect ? 1 : 0,
      correctAnswer,
      feedback: isCorrect ? undefined : `Правильный ответ: ${correctAnswer}`,
    };
  }
}

