// src/content/presenter.ts
import { Lesson, LessonDocument } from '../common/schemas/lesson.schema';
import { CourseModule } from '../common/schemas/course-module.schema';
import { UserLessonProgress } from '../common/schemas/user-lesson-progress.schema';
import { LessonItem, ModuleItem, TaskType } from '../common/types/content';
import { getLocalizedText } from '../common/utils/i18n.util';
import { normalizeLessonDefaults } from '../common/utils/lesson-defaults';

const choose = (mt: unknown, lang: string) => getLocalizedText(
  mt as any,
  lang as any,
);

export function presentModule(
  doc: CourseModule,
  progress?: { completed: number; total: number; inProgress: number },
): ModuleItem {
  return {
    moduleRef: doc.moduleRef,
    level: doc.level,
    title: doc.title,
    description: doc.description,
    tags: doc.tags || [],
    difficultyRating: doc.difficultyRating,
    order: doc.order ?? 0,
    // Используем переданные значения, если они есть, иначе вычисляем из схемы
    requiresPro: doc.requiresPro !== undefined ? !!doc.requiresPro : false,
    isAvailable: doc.isAvailable !== undefined ? doc.isAvailable : true,
    author: doc.author,
    progress,
  };
}

export function presentLesson(
  doc: Lesson,
  lang = 'ru',
  progress?: Partial<{
    status: 'completed'|'in_progress'|'not_started';
    score: number; attempts: number; completedAt?: Date; timeSpent?: number;
  }>
): LessonItem {
  const taskTypes: TaskType[] = doc.taskTypes
    ? (doc.taskTypes as TaskType[])
    : (doc.tasks?.map(t => t.type as TaskType) ?? []);
  const defaults = normalizeLessonDefaults(doc);

  return {
    lessonRef: doc.lessonRef,
    moduleRef: doc.moduleRef,
    title: choose(doc.title, lang),
    description: choose(doc.description, lang),
    estimatedMinutes: defaults.estimatedMinutes,
    order: doc.order ?? 0,
    type: defaults.type,
    difficulty: defaults.difficulty,
    tags: doc.tags || [],
    xpReward: defaults.xpReward,
    hasAudio: defaults.hasAudio,
    hasVideo: defaults.hasVideo,
    previewText: doc.previewText,
    taskTypes,
    progress: progress && {
      status: progress.status || 'not_started',
      score: progress.score ?? 0,
      attempts: progress.attempts ?? 0,
      completedAt: progress.completedAt?.toISOString(),
      timeSpent: progress.timeSpent ?? 0,
    },
  };
}
