import { Injectable } from '@nestjs/common';
import { AudioValidationData } from '../../common/types/validation-data';
import { TaskValidationStrategy, ValidationResult } from './task-validation.strategy';

/**
 * Стратегия валидации для задач типа listen/listening/speak.
 */
@Injectable()
export class AudioValidationStrategy implements TaskValidationStrategy {
  validate(
    userAnswer: string,
    validationData: AudioValidationData,
    taskData?: Record<string, any>
  ): ValidationResult {
    // 1) Listen/listening MCQ path: options + correctIndex
    if (
      Array.isArray(validationData.options)
      && validationData.options.length > 0
      && typeof validationData.correctIndex === 'number'
    ) {
      const parsed = this.safeParse(userAnswer);

      // index answer ("1" or 1)
      const asIndex = typeof parsed === 'number'
        ? parsed
        : (typeof parsed === 'string' && /^\d+$/.test(parsed.trim()) ? Number(parsed.trim()) : undefined);

      if (typeof asIndex === 'number' && Number.isInteger(asIndex)) {
        const isCorrect = asIndex === validationData.correctIndex;
        return {
          isCorrect,
          score: isCorrect ? 1 : 0,
          correctAnswer: validationData.options[validationData.correctIndex],
          feedback: isCorrect ? undefined : 'Попробуйте еще раз',
        };
      }

      // text answer path (option text)
      const asText = typeof parsed === 'string' ? parsed : String(userAnswer ?? '');
      const normalizedAnswer = asText.trim().toLowerCase();
      const normalizedCorrect = String(validationData.options[validationData.correctIndex] ?? '').trim().toLowerCase();
      const isCorrect = normalizedAnswer.length > 0 && normalizedAnswer === normalizedCorrect;

      return {
        isCorrect,
        score: isCorrect ? 1 : 0,
        correctAnswer: validationData.options[validationData.correctIndex],
        feedback: isCorrect ? undefined : 'Попробуйте еще раз',
      };
    }

    // 2) target-based path (speak / legacy listen)
    const parsed = this.safeParse(userAnswer);
    const asText = typeof parsed === 'string' ? parsed : String(userAnswer ?? '');
    const normalizedAnswer = asText.trim().toLowerCase();
    const normalizedTarget = validationData.target?.toLowerCase() || '';

    const isCorrect = normalizedAnswer === normalizedTarget;

    return {
      isCorrect,
      score: isCorrect ? 1 : 0,
      correctAnswer: validationData.target,
      feedback: isCorrect ? undefined : 'Попробуйте еще раз',
    };
  }

  private safeParse(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}

