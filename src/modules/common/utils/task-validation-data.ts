import { TaskTypeEnum } from '../enums/task-type.enum';
import { AudioValidationData, ChoiceValidationData, FlashcardValidationData, GapValidationData, MatchingValidationData, OrderValidationData, TaskValidationData, TranslateValidationData } from '../types/validation-data';

const toStringArray = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every(item => typeof item === 'string') ? value : undefined;

export const mapTaskDataToValidationData = (task: { type: TaskTypeEnum | string; data?: Record<string, any> }): TaskValidationData | undefined => {
  const data = task.data;
  if (!data) return undefined;

  switch (task.type) {
    case 'choice':
    case 'multiple_choice': {
      if (!Array.isArray(data.options) || typeof data.correctIndex !== 'number') return undefined;
      return {
        options: data.options,
        correctIndex: data.correctIndex,
      } satisfies ChoiceValidationData;
    }
    case 'gap': {
      if (typeof data.answer !== 'string') return undefined;
      const alternatives = toStringArray(data.accept) ?? toStringArray(data.alternatives);
      return {
        answer: data.answer,
        alternatives,
      } satisfies GapValidationData;
    }
    case 'order': {
      const tokens = toStringArray(data.tokens);
      if (!tokens) return undefined;
      return { tokens } satisfies OrderValidationData;
    }
    case 'translate': {
      const expected = toStringArray(data.expected);
      if (!expected) return undefined;
      return { expected } satisfies TranslateValidationData;
    }
    case 'listen':
    case 'listening':
    case 'speak': {
      return {
        target: typeof data.target === 'string' ? data.target : undefined,
      } satisfies AudioValidationData;
    }
    case 'match':
    case 'matching': {
      if (!Array.isArray(data.pairs)) return undefined;
      const pairs = data.pairs
        .filter((pair: { left?: unknown; right?: unknown }) => typeof pair?.left === 'string' && typeof pair?.right === 'string')
        .map((pair: { left: string; right: string }) => ({ left: pair.left, right: pair.right }));
      return {
        pairs,
      } satisfies MatchingValidationData;
    }
    case 'flashcard': {
      const expected = toStringArray(data.expected);
      return {
        back: typeof data.back === 'string' ? data.back : undefined,
        expected,
      } satisfies FlashcardValidationData;
    }
    default:
      return undefined;
  }
};
