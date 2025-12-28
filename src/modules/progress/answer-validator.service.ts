import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Lesson, LessonDocument } from '../common/schemas/lesson.schema';
import { AudioValidationData, ChoiceValidationData, FlashcardValidationData, GapValidationData, MatchingValidationData, OrderValidationData, TranslateValidationData } from '../common/types/validation-data';
import { mapTaskDataToValidationData } from '../common/utils/task-validation-data';

export interface ValidationResult {
  isCorrect: boolean;
  score: number; // 0.0 - 1.0
  feedback?: string;
  correctAnswer?: string; // Для показа пользователю после ответа
  explanation?: string;
}

@Injectable()
export class AnswerValidatorService {
  constructor(
    @InjectModel(Lesson.name) private readonly lessonModel: Model<LessonDocument>,
  ) {}

  async validateAnswer(lessonRef: string, taskRef: string, userAnswer: string): Promise<ValidationResult> {
    // 🔍 ПОЛУЧАЕМ УРОК С ПРАВИЛЬНЫМИ ОТВЕТАМИ (только на сервере!)
    const lesson = await this.lessonModel.findOne({ lessonRef, published: true }).lean();
    if (!lesson) {
      throw new Error('Lesson not found');
    }

    const task = lesson.tasks?.find(t => t.ref === taskRef);
    if (!task) {
      throw new Error('Task not found');
    }

    // 🔒 ВАЛИДАЦИЯ НА СЕРВЕРЕ ПО ТИПУ ЗАДАЧИ
    const validationData = (task as { validationData?: Record<string, any> }).validationData
      ?? mapTaskDataToValidationData({ type: task.type as any, data: task.data });

    if (task.type === 'translate') {
      const expected = (validationData as TranslateValidationData | undefined)?.expected;
      if (!expected?.length) {
        throw new Error('Missing expected answers for translate task');
      }
    }

    if (!validationData) {
      return { isCorrect: false, score: 0, feedback: 'Missing validation data' };
    }

    switch (task.type) {
      case 'choice':
      case 'multiple_choice':
        return this.validateChoiceAnswer(validationData as ChoiceValidationData, userAnswer);
      
      case 'gap':
        return this.validateGapAnswer(validationData as GapValidationData, userAnswer);
      
      case 'order':
        return this.validateOrderAnswer(validationData as OrderValidationData, userAnswer);
      
      case 'translate':
        return this.validateTranslateAnswer(validationData as TranslateValidationData, userAnswer);
      
      case 'listen':
      case 'listening':
      case 'speak':
        return this.validateAudioAnswer(validationData as AudioValidationData, userAnswer);

      case 'match':
      case 'matching':
        return this.validateMatchingAnswer(validationData as MatchingValidationData, userAnswer);

      case 'flashcard':
        return this.validateFlashcardAnswer(validationData as FlashcardValidationData, userAnswer);
      
      default:
        return { isCorrect: false, score: 0, feedback: 'Unknown task type' };
    }
  }

  private validateChoiceAnswer(taskData: ChoiceValidationData, userAnswer: string): ValidationResult {
    const userChoice = parseInt(userAnswer, 10);
    const correctIndex = taskData.correctIndex;
    const isCorrect = userChoice === correctIndex;
    
    return {
      isCorrect,
      score: isCorrect ? 1.0 : 0.0,
      correctAnswer: taskData.options?.[correctIndex],
      feedback: isCorrect ? 'Correct!' : 'Try again'
    };
  }

  private validateGapAnswer(taskData: GapValidationData, userAnswer: string): ValidationResult {
    const correct = taskData.answer?.toLowerCase().trim();
    const user = userAnswer.toLowerCase().trim();
    
    // Простая проверка + возможные варианты
    const alternatives = taskData.alternatives || [];
    const allCorrect = [correct, ...alternatives].map(a => a.toLowerCase().trim());
    
    const isCorrect = allCorrect.includes(user);
    
    return {
      isCorrect,
      score: isCorrect ? 1.0 : 0.0,
      correctAnswer: taskData.answer,
      feedback: isCorrect ? 'Correct!' : `The correct answer is: ${taskData.answer}`
    };
  }

  private validateOrderAnswer(taskData: OrderValidationData, userAnswer: string): ValidationResult {
    try {
      const userOrder = JSON.parse(userAnswer); // ["What", "time", "is", "it", "?"]
      const correctOrder = taskData.tokens;
      
      const isCorrect = JSON.stringify(userOrder) === JSON.stringify(correctOrder);
      
      return {
        isCorrect,
        score: isCorrect ? 1.0 : this.calculatePartialScore(userOrder, correctOrder),
        correctAnswer: correctOrder.join(' '),
        feedback: isCorrect ? 'Perfect!' : 'Check the word order'
      };
    } catch (e) {
      return { isCorrect: false, score: 0, feedback: 'Invalid answer format' };
    }
  }

  private validateTranslateAnswer(taskData: TranslateValidationData, userAnswer: string): ValidationResult {
    if (!taskData.expected?.length) {
      throw new Error('Missing expected answers for translate task');
    }

    const { expected } = taskData;
    const user = userAnswer.toLowerCase().trim();
    
    // Проверяем все возможные варианты перевода
    const isCorrect = expected.some((exp: string) => 
      exp.toLowerCase().trim() === user || 
      this.similarityScore(user, exp.toLowerCase().trim()) > 0.8
    );
    
    return {
      isCorrect,
      score: isCorrect ? 1.0 : 0.0,
      correctAnswer: expected[0],
      feedback: isCorrect ? 'Great translation!' : `Possible answers: ${expected.join(', ')}`
    };
  }

  private validateAudioAnswer(taskData: AudioValidationData, userAnswer: string): ValidationResult {
    // Для аудио заданий - упрощенная проверка или интеграция с speech-to-text
    const target = taskData.target?.toLowerCase().trim();
    const user = userAnswer.toLowerCase().trim();
    
    if (!target) {
      return { isCorrect: true, score: 1.0, feedback: 'Audio recorded!' };
    }
    
    const similarity = this.similarityScore(user, target);
    const isCorrect = similarity > 0.7;
    
    return {
      isCorrect,
      score: similarity,
      correctAnswer: taskData.target,
      feedback: isCorrect ? 'Good pronunciation!' : 'Try again'
    };
  }

  private validateMatchingAnswer(taskData: MatchingValidationData, userAnswer: string): ValidationResult {
    const pairs = taskData.pairs ?? [];
    if (pairs.length === 0) {
      return { isCorrect: true, score: 1.0, feedback: 'No pairs to validate' };
    }

    let parsedAnswer: unknown;
    try {
      parsedAnswer = JSON.parse(userAnswer);
    } catch (e) {
      return { isCorrect: false, score: 0, feedback: 'Invalid answer format' };
    }

    if (!Array.isArray(parsedAnswer)) {
      return { isCorrect: false, score: 0, feedback: 'Invalid answer format' };
    }

    const correctMap = new Map(pairs.map(pair => [pair.left, pair.right]));

    const normalizedPairs = parsedAnswer
      .map((item: any) => {
        if (Array.isArray(item) && item.length >= 2) {
          if (typeof item[0] === 'number' && typeof item[1] === 'number') {
            return {
              left: pairs[item[0]]?.left,
              right: pairs[item[1]]?.right,
            };
          }
          if (typeof item[0] === 'string' && typeof item[1] === 'string') {
            return { left: item[0], right: item[1] };
          }
        }

        if (item && typeof item === 'object') {
          if (typeof item.leftIndex === 'number' && typeof item.rightIndex === 'number') {
            return {
              left: pairs[item.leftIndex]?.left,
              right: pairs[item.rightIndex]?.right,
            };
          }
          if (typeof item.left === 'string' && typeof item.right === 'string') {
            return { left: item.left, right: item.right };
          }
        }

        return undefined;
      })
      .filter((pair: { left?: string; right?: string } | undefined): pair is { left: string; right: string } => Boolean(pair?.left && pair?.right));

    const correctCount = normalizedPairs.reduce((count, pair) => {
      return correctMap.get(pair.left) === pair.right ? count + 1 : count;
    }, 0);

    const totalPairs = pairs.length;
    const score = totalPairs > 0 ? correctCount / totalPairs : 1.0;
    const isCorrect = score === 1.0;

    return {
      isCorrect,
      score,
      feedback: isCorrect ? 'Great job!' : 'Try matching again',
    };
  }

  private validateFlashcardAnswer(taskData: FlashcardValidationData, userAnswer: string): ValidationResult {
    const expected = taskData.back ?? taskData.expected?.[0];
    const user = userAnswer?.toLowerCase().trim();

    if (!expected) {
      return { isCorrect: true, score: 1.0, feedback: 'Flashcard reviewed!' };
    }

    if (!user) {
      return { isCorrect: true, score: 1.0, feedback: 'Flashcard reviewed!' };
    }

    const normalizedExpected = expected.toLowerCase().trim();
    const similarity = this.similarityScore(user, normalizedExpected);
    const isCorrect = similarity > 0.8;

    return {
      isCorrect,
      score: isCorrect ? 1.0 : similarity,
      correctAnswer: expected,
      feedback: isCorrect ? 'Well done!' : 'Review the flashcard'
    };
  }

  private calculatePartialScore(userOrder: string[], correctOrder: string[]): number {
    let correct = 0;
    const minLength = Math.min(userOrder.length, correctOrder.length);
    
    for (let i = 0; i < minLength; i++) {
      if (userOrder[i] === correctOrder[i]) correct++;
    }
    
    return correct / correctOrder.length;
  }

  private similarityScore(a: string, b: string): number {
    // Простая функция схожести строк (можно заменить на более сложную)
    if (a === b) return 1.0;
    
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[b.length][a.length];
  }
}
