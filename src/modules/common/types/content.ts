// src/common/types/content.ts
import { MultilingualText, OptionalMultilingualText } from '../utils/i18n.util';
import { TaskTypeEnum } from '../enums/task-type.enum';

export type CEFR = 'A0'|'A1'|'A2'|'B1'|'B2'|'C1'|'C2';

export interface ModuleProgress {
  completed: number;
  total: number;
  inProgress: number;
}

export interface ModuleItem {
  moduleRef: string;
  level: CEFR;
  title: MultilingualText;
  description?: OptionalMultilingualText;
  tags: string[];
  difficultyRating?: number;
  order: number;
  requiresPro: boolean;
  isAvailable: boolean;
  author?: {
    userId: string;
    name?: string;
  };
  progress?: ModuleProgress;  // вычисляется для текущего userId
}

export type LessonStatus = 'completed' | 'in_progress' | 'not_started';
export type LessonType = 'conversation' | 'vocabulary' | 'grammar';
export type LessonDifficulty = 'easy' | 'medium' | 'hard';

// Используем enum как единый источник правды для типов задач
export type TaskType = TaskTypeEnum;

export interface LessonProgress {
  status: LessonStatus;
  score: number;
  attempts: number;
  completedAt?: string;
  timeSpent?: number; // seconds
}

export interface Task {
  ref: string;
  type: TaskType;
  data: Record<string, any>;
}

export interface LessonItem {
  lessonRef: string;
  moduleRef: string;
  title: string;
  description?: string;
  estimatedMinutes: number;
  order: number;
  type?: LessonType;
  difficulty?: LessonDifficulty;
  tags?: string[];
  xpReward?: number;
  hasAudio?: boolean;
  hasVideo?: boolean;
  previewText?: string;
  taskTypes?: TaskType[];
  progress?: LessonProgress;
  tasks?: Task[]; // для detailed
}

export interface VocabularyItem {
  id: string;
  word: string;
  translation?: string;
  transcription?: string;
  pronunciation?: string;
  partOfSpeech?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  examples?: Array<{ original: string; translation: string }>;
  tags?: string[];
  lessonRefs?: string[];
  moduleRefs?: string[];
  audioKey?: string;
  occurrenceCount?: number;
}

export type VocabularyStatus = 'not_started' | 'learning' | 'learned';

export interface UserVocabularyProgress {
  userId: string;
  moduleRef: string;
  wordId: string;
  status: VocabularyStatus;
  score?: number;
  attempts?: number;
  timeSpent?: number;
  lastStudiedAt?: Date;
  learnedAt?: Date;
  correctAttempts?: number;
  totalAttempts?: number;
  lessonRefs?: string[];
}

export interface VocabularyProgressStats {
  totalWords: number;
  learnedWords: number;
  learningWords: number;
  notStartedWords: number;
  progressPercentage: number;
}

export type UserCohort =
  | 'new_user' | 'returning_user' | 'premium_trial'
  | 'high_engagement' | 'low_engagement' | 'churned' | 'test_payment' | 'default';

export interface CohortPricing {
  cohort: UserCohort;
  monthlyPrice: number;
  monthlyOriginalPrice: number;
  quarterlyPrice: number;
  quarterlyOriginalPrice: number;
  yearlyPrice: number;
  yearlyOriginalPrice: number;
  promoCode?: string;
  discountPercentage?: number;
  quarterlyDiscountPercentage?: number;
  yearlyDiscountPercentage?: number;
}

export interface PaywallProduct {
  id: 'monthly' | 'quarterly' | 'yearly';
  name: string;
  description: string;
  price: number;
  originalPrice?: number; // Original price for strikethrough display
  currency: 'RUB';
  duration: 'month'|'quarter'|'year';
  discount?: number;
  isPopular?: boolean;
  monthlyEquivalent?: number; // Monthly equivalent price in kopecks for yearly subscription
  savingsPercentage?: number; // Percentage savings compared to monthly subscription
}
