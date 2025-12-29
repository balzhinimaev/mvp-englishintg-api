import { Injectable } from '@nestjs/common';
import { AudioValidationData } from '../../common/types/validation-data';
import { TaskValidationStrategy, ValidationResult } from './task-validation.strategy';

/**
 * Стратегия валидации для задач типа listen/listening/speak.
 * Пока это упрощенная проверка (на фронте или требует ASR на сервере).
 */
@Injectable()
export class AudioValidationStrategy implements TaskValidationStrategy {
  validate(
    userAnswer: string,
    validationData: AudioValidationData,
    taskData?: Record<string, any>
  ): ValidationResult {
    // Для listen/speak задач обычно требуется специальная обработка:
    // - ASR (Speech-to-Text) для speak
    // - Проверка транскрипта для listen
    
    // Временная реализация: считаем правильным, если пользователь что-то ответил
    // TODO: Интегрировать ASR или проверять транскрипт
    
    const normalizedAnswer = userAnswer.trim().toLowerCase();
    const normalizedTarget = validationData.target?.toLowerCase() || '';

    const isCorrect = normalizedAnswer === normalizedTarget;

    return {
      isCorrect,
      score: isCorrect ? 1 : 0,
      correctAnswer: validationData.target,
      feedback: isCorrect ? undefined : 'Попробуйте еще раз',
    };
  }
}

