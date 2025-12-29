import { Injectable } from '@nestjs/common';
import { MatchingValidationData } from '../../common/types/validation-data';
import { TaskValidationStrategy, ValidationResult } from './task-validation.strategy';

/**
 * Стратегия валидации для задач типа match/matching.
 */
@Injectable()
export class MatchingValidationStrategy implements TaskValidationStrategy {
  validate(
    userAnswer: string,
    validationData: MatchingValidationData,
    taskData?: Record<string, any>
  ): ValidationResult {
    let userPairs: Array<{ left: string; right: string }>;
    
    try {
      userPairs = JSON.parse(userAnswer);
      if (!Array.isArray(userPairs)) {
        throw new Error('Not an array');
      }
    } catch {
      return {
        isCorrect: false,
        score: 0,
        feedback: 'Некорректный формат ответа',
      };
    }

    // Проверяем, все ли пары совпадают
    const correctPairsSet = new Set(
      validationData.pairs.map(p => `${p.left}::${p.right}`)
    );

    let correctCount = 0;
    for (const pair of userPairs) {
      const key = `${pair.left}::${pair.right}`;
      if (correctPairsSet.has(key)) {
        correctCount++;
      }
    }

    const isCorrect = correctCount === validationData.pairs.length;
    const score = correctCount / validationData.pairs.length;

    return {
      isCorrect,
      score,
      correctAnswer: validationData.pairs
        .map(p => `${p.left} → ${p.right}`)
        .join(', '),
      feedback: isCorrect ? undefined : `Правильно: ${correctCount} из ${validationData.pairs.length}`,
    };
  }
}

