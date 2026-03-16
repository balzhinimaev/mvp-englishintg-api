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
    const userPairs = this.parseUserPairs(userAnswer);

    if (!userPairs) {
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
    const score = validationData.pairs.length > 0 ? (correctCount / validationData.pairs.length) : 0;

    return {
      isCorrect,
      score,
      correctAnswer: validationData.pairs
        .map(p => `${p.left} → ${p.right}`)
        .join(', '),
      feedback: isCorrect ? undefined : `Правильно: ${correctCount} из ${validationData.pairs.length}`,
    };
  }

  private parseUserPairs(userAnswer: string): Array<{ left: string; right: string }> | null {
    let parsed: unknown;

    try {
      parsed = JSON.parse(userAnswer);
    } catch {
      return null;
    }

    // Variant A: [{left,right}]
    if (Array.isArray(parsed)) {
      const pairs = parsed
        .filter((item: any) => item && typeof item.left === 'string' && typeof item.right === 'string')
        .map((item: any) => ({ left: item.left, right: item.right }));

      return pairs.length > 0 ? pairs : null;
    }

    // Variant B: { leftValue: rightValue }
    if (parsed && typeof parsed === 'object') {
      const entries = Object.entries(parsed as Record<string, unknown>)
        .filter(([left, right]) => typeof left === 'string' && typeof right === 'string')
        .map(([left, right]) => ({ left, right: right as string }));

      return entries.length > 0 ? entries : null;
    }

    return null;
  }
}

