import { Injectable } from '@nestjs/common';
import { OrderValidationData } from '../../common/types/validation-data';
import { TaskValidationStrategy, ValidationResult } from './task-validation.strategy';

/**
 * Стратегия валидации для задач типа order (расстановка слов по порядку).
 */
@Injectable()
export class OrderValidationStrategy implements TaskValidationStrategy {
  validate(
    userAnswer: string,
    validationData: OrderValidationData,
    taskData?: Record<string, any>
  ): ValidationResult {
    let userTokens: string[];
    
    try {
      userTokens = JSON.parse(userAnswer);
      if (!Array.isArray(userTokens)) {
        throw new Error('Not an array');
      }
    } catch {
      return {
        isCorrect: false,
        score: 0,
        feedback: 'Некорректный формат ответа',
      };
    }

    // Проверяем точное совпадение порядка токенов
    const isCorrect = 
      userTokens.length === validationData.tokens.length &&
      userTokens.every((token, idx) => token === validationData.tokens[idx]);

    return {
      isCorrect,
      score: isCorrect ? 1 : 0,
      correctAnswer: validationData.tokens.join(' '),
      feedback: isCorrect ? undefined : `Правильный порядок: ${validationData.tokens.join(' ')}`,
    };
  }
}

