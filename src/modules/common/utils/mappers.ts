import { CourseModule } from '../schemas/course-module.schema';
import { Lesson } from '../schemas/lesson.schema';
import { UserLessonProgress } from '../schemas/user-lesson-progress.schema';
import { VocabularyItem } from '../schemas/vocabulary.schema';
import { UserVocabularyProgress } from '../schemas/user-vocabulary-progress.schema';
import { User } from '../schemas/user.schema';
import { ModuleItem, LessonItem, LessonProgress, VocabularyItem as VocabType, TaskType, UserVocabularyProgress as UserVocabularyProgressType, VocabularyProgressStats } from '../types/content';
import { getLocalizedText, SupportedLanguage } from './i18n.util';

const STRIP = new Set(['correct','isCorrect','correctIndex','correctIndexes','answer','answers','expected','expectedAnswers','target','targets','solution','solutions']);
export const redact = (v: any): any =>
  Array.isArray(v) ? v.map(redact)
  : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).filter(([k]) => !STRIP.has(k)).map(([k, val]) => [k, redact(val)]))
    : v;

/**
 * Маппер для преобразования CourseModule схемы в ModuleItem DTO
 */
export class ModuleMapper {
  static toDto(
    module: CourseModule,
    progress?: { completed: number; total: number; inProgress: number }
  ): ModuleItem {
    return {
      moduleRef: module.moduleRef,
      level: module.level,
      title: module.title,
      description: module.description,
      tags: module.tags || [],
      difficultyRating: module.difficultyRating,
      order: module.order || 0,
      requiresPro: module.requiresPro || false,
      isAvailable: module.isAvailable ?? true,
      author: module.author,
      progress: progress || { completed: 0, total: 0, inProgress: 0 }
    };
  }
}

/**
 * Маппер для преобразования Lesson схемы в LessonItem DTO
 */
export class LessonMapper {
  static toDto(
    lesson: Lesson,
    language: SupportedLanguage = 'ru',
    progress?: LessonProgress,
    taskTypes?: TaskType[]
  ): LessonItem {
    return {
      lessonRef: lesson.lessonRef,
      moduleRef: lesson.moduleRef,
      title: getLocalizedText(lesson.title, language),
      description: getLocalizedText(lesson.description, language),
      estimatedMinutes: lesson.estimatedMinutes || 10,
      order: lesson.order || 0,
      type: lesson.type,
      difficulty: lesson.difficulty,
      tags: lesson.tags || [],
      xpReward: lesson.xpReward || 25,
      hasAudio: lesson.hasAudio ?? true,
      hasVideo: lesson.hasVideo ?? false,
      previewText: lesson.previewText,
      taskTypes: taskTypes || lesson.tasks?.map(t => t.type as TaskType) || [],
      progress: progress,
      tasks: lesson.tasks?.map(({ ref, type, data }) => ({ ref, type: type as TaskType, data: redact(data) }))
    };
  }
}

/**
 * Маппер для преобразования UserLessonProgress схемы в LessonProgress DTO
 */
export class LessonProgressMapper {
  static toDto(progress: UserLessonProgress): LessonProgress {
    return {
      status: progress.status,
      score: progress.score || 0,
      attempts: progress.attempts || 0,
      completedAt: progress.completedAt?.toISOString(),
      timeSpent: progress.timeSpent || 0
    };
  }
}

/**
 * Маппер для преобразования VocabularyItem схемы в VocabType DTO
 */
export class VocabularyMapper {
  static toDto(vocab: VocabularyItem): VocabType {
    return {
      id: vocab.id,
      word: vocab.word,
      translation: vocab.translation || '',
      transcription: vocab.transcription,
      pronunciation: vocab.pronunciation,
      partOfSpeech: vocab.partOfSpeech,
      difficulty: vocab.difficulty,
      examples: vocab.examples || [],
      tags: vocab.tags || [],
      lessonRefs: vocab.lessonRefs || [],
      moduleRefs: vocab.moduleRefs || [],
      audioKey: vocab.audioKey,
      occurrenceCount: vocab.occurrenceCount || 0
    };
  }
}

/**
 * Маппер для преобразования UserVocabularyProgress схемы в DTO
 */
export class UserVocabularyProgressMapper {
  static toDto(progress: UserVocabularyProgress): UserVocabularyProgressType {
    return {
      userId: progress.userId,
      moduleRef: progress.moduleRef,
      wordId: progress.wordId,
      status: progress.status,
      score: progress.score || 0,
      attempts: progress.attempts || 0,
      timeSpent: progress.timeSpent || 0,
      lastStudiedAt: progress.lastStudiedAt,
      learnedAt: progress.learnedAt,
      correctAttempts: progress.correctAttempts || 0,
      totalAttempts: progress.totalAttempts || 0,
      lessonRefs: progress.lessonRefs || []
    };
  }
}

/**
 * Маппер для преобразования User схемы в упрощенный пользовательский объект
 */
export class UserMapper {
  static toPublicProfile(user: User) {
    return {
      userId: user.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      languageCode: user.languageCode,
      photoUrl: user.photoUrl,
      englishLevel: user.englishLevel,
      learningGoals: user.learningGoals,
      xpTotal: user.xpTotal,
      streak: user.streak,
      pro: user.pro
    };
  }
}
