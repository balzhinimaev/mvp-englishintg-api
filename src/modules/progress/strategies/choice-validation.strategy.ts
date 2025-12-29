import { Injectable } from '@nestjs/common';
import { ChoiceValidationData } from '../../common/types/validation-data';
import { TaskValidationStrategy, ValidationResult } from './task-validation.strategy';

/**
 * Стратегия валидации для задач типа choice/multiple_choice.
 */
@Injectable()
export class ChoiceValidationStrategy implements TaskValidationStrategy {
  validate(
    userAnswer: string,
    validationData: ChoiceValidationData,
    taskData?: Record<string, any>
  ): ValidationResult {
    const userIndex = Number(userAnswer);
    
    if (isNaN(userIndex)) {
      return {
        isCorrect: false,
        score: 0,
        feedback: 'Некорректный формат ответа',
      };
    }

    const isCorrect = userIndex === validationData.correctIndex;
    const correctAnswer = validationData.options[validationData.correctIndex];

    return {
      isCorrect,
      score: isCorrect ? 1 : 0,
      correctAnswer,
      explanation: taskData?.explanation,
    };
  }
}

