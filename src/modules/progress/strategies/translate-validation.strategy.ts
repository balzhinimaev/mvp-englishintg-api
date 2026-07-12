import { Injectable } from '@nestjs/common';
import { TranslateValidationData } from '../../common/types/validation-data';
import { TaskValidationStrategy, ValidationResult } from './task-validation.strategy';
import { normalizeAnswer } from './normalize';

/**
 * Стратегия валидации для задач типа translate.
 */
@Injectable()
export class TranslateValidationStrategy implements TaskValidationStrategy {
  validate(
    userAnswer: string,
    validationData: TranslateValidationData,
    taskData?: Record<string, any>
  ): ValidationResult {
    // Нормализуем обе стороны: не штрафуем за пропущенную финальную точку/кавычки.
    const normalizedAnswer = normalizeAnswer(userAnswer);

    // Проверяем, совпадает ли ответ с одним из ожидаемых переводов
    const isCorrect = validationData.expected.some(
      expected => normalizedAnswer === normalizeAnswer(expected)
    );

    return {
      isCorrect,
      score: isCorrect ? 1 : 0,
      correctAnswer: validationData.expected[0], // Показываем первый вариант как основной
      explanation: taskData?.explanation,
      feedback: isCorrect ? undefined : `Правильный перевод: ${validationData.expected[0]}`,
    };
  }
}

