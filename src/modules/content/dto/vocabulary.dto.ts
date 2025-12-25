import { IsString, IsOptional, IsEnum, IsBoolean, IsNumber, Min, Max } from 'class-validator';

export class GetModuleVocabularyDto {
  @IsString()
  moduleRef!: string;

  @IsOptional()
  @IsString()
  lang?: string;
}

export class MarkWordLearnedDto {
  @IsString()
  userId!: string;

  @IsString()
  moduleRef!: string;

  @IsString()
  wordId!: string;
}

export class UpdateWordProgressDto {
  @IsString()
  userId!: string;

  @IsString()
  moduleRef!: string;

  @IsString()
  wordId!: string;

  @IsBoolean()
  isCorrect!: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  timeSpent?: number;
}

export class SyncModuleVocabularyDto {
  @IsString()
  moduleRef!: string;
}

export class GetVocabularyProgressDto {
  @IsString()
  userId!: string;

  @IsString()
  moduleRef!: string;
}

export class GetUserWordProgressDto {
  @IsString()
  userId!: string;

  @IsString()
  moduleRef!: string;

  @IsString()
  wordId!: string;
}

export interface VocabularyResponseDto {
  words: Array<{
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
    isLearned?: boolean;
  }>;
  progress?: {
    totalWords: number;
    learnedWords: number;
    learningWords: number;
    notStartedWords: number;
    progressPercentage: number;
  };
}

export interface VocabularyProgressResponseDto {
  totalWords: number;
  learnedWords: number;
  learningWords: number;
  notStartedWords: number;
  progressPercentage: number;
}

export interface UserWordProgressResponseDto {
  userId: string;
  moduleRef: string;
  wordId: string;
  status: 'not_started' | 'learning' | 'learned';
  score?: number;
  attempts?: number;
  timeSpent?: number;
  lastStudiedAt?: Date;
  learnedAt?: Date;
  correctAttempts?: number;
  totalAttempts?: number;
  lessonRefs?: string[];
}

export interface SyncVocabularyResponseDto {
  created: number;
  updated: number;
  message: string;
}

// ============= VocabularyStats DTOs =============

export interface VocabularySummaryDto {
  learned: number;
  learning: number;
  notStarted: number;
  total: number;
  learnedPercentage: number;
}

export interface VocabularyDifficultyStatsDto {
  learned: number;
  learning: number;
  notStarted: number;
  total: number;
  learnedPercentage: number;
  averageTimeToLearn?: number; // in minutes
}

export interface VocabularyByDifficultyDto {
  easy: VocabularyDifficultyStatsDto;
  medium: VocabularyDifficultyStatsDto;
  hard: VocabularyDifficultyStatsDto;
}

export interface VocabularyCategoryStatsDto {
  categoryKey: string;
  categoryName: string;
  learned: number;
  learning: number;
  notStarted: number;
  total: number;
  learnedPercentage: number;
  priority: 'high' | 'medium' | 'low';
}

export interface VocabularyPartOfSpeechStatsDto {
  partOfSpeech: string;
  learned: number;
  total: number;
  learnedPercentage: number;
}

export interface VocabularyRecentActivityDto {
  id: string;
  wordId: string;
  word: string;
  action: 'learned' | 'reviewed' | 'forgot';
  timestamp: string; // ISO 8601
  difficulty: 'easy' | 'medium' | 'hard';
  timeSpent: number; // in seconds
  score?: number; // 0-100, only for "reviewed"
}

export interface VocabularyStreakDto {
  current: number;
  longest: number;
  lastLearnedAt?: string; // ISO 8601
}

export interface VocabularyWeeklyProgressDto {
  week: string; // format "YYYY-WW"
  learned: number;
  reviewed: number;
  totalTimeSpent: number; // in minutes
}

export interface VocabularyStatsResponseDto {
  summary: VocabularySummaryDto;
  byDifficulty: VocabularyByDifficultyDto;
  byCategory: Record<string, VocabularyCategoryStatsDto>;
  byPartOfSpeech: Record<string, VocabularyPartOfSpeechStatsDto>;
  recentActivity: VocabularyRecentActivityDto[];
  streak: VocabularyStreakDto;
  weeklyProgress: VocabularyWeeklyProgressDto[];
}