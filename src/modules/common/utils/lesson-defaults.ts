import { Lesson } from '../schemas/lesson.schema';
import { LessonDifficulty, LessonType } from '../types/content';

export type LessonDefaults = {
  type: LessonType;
  difficulty: LessonDifficulty;
  hasAudio: boolean;
  hasVideo: boolean;
  xpReward: number;
  estimatedMinutes: number;
};

export const normalizeLessonDefaults = (
  lesson: Pick<
    Lesson,
    'type' | 'difficulty' | 'hasAudio' | 'hasVideo' | 'xpReward' | 'estimatedMinutes'
  >
): LessonDefaults => ({
  type: lesson.type ?? 'vocabulary',
  difficulty: lesson.difficulty ?? 'easy',
  hasAudio: lesson.hasAudio ?? true,
  hasVideo: lesson.hasVideo ?? false,
  xpReward: lesson.xpReward ?? 25,
  estimatedMinutes: lesson.estimatedMinutes ?? 10,
});
