// src/content/presenter.ts
import { Lesson, LessonDocument } from '../common/schemas/lesson.schema';
import { CourseModule } from '../common/schemas/course-module.schema';
import { UserLessonProgress } from '../common/schemas/user-lesson-progress.schema';
import { LessonItem, ModuleItem, TaskType } from '../common/types/content';

const choose = (mt: any, lang: string) => {
  // Простой выбор языка из MultilingualText; fallback на 'ru'/'en'
  if (!mt) return '';
  return mt[lang] || mt['en'] || mt['ru'] || Object.values(mt)[0] || '';
};

export function presentModule(
  doc: CourseModule,
  lang = 'ru',
  progress?: { completed: number; total: number; inProgress: number },
): ModuleItem {
  return {
    moduleRef: doc.moduleRef,
    level: doc.level,
    title: choose(doc.title, lang),
    description: choose(doc.description, lang),
    tags: doc.tags || [],
    order: doc.order ?? 0,
    // Используем переданные значения, если они есть, иначе вычисляем из схемы
    requiresPro: doc.requiresPro !== undefined ? !!doc.requiresPro : false,
    isAvailable: doc.isAvailable !== undefined ? doc.isAvailable : true,
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
  const taskTypes: TaskType[] = (doc.tasks || []).map(t => t.type as TaskType);
  return {
    lessonRef: doc.lessonRef,
    moduleRef: doc.moduleRef,
    title: choose(doc.title, lang),
    description: choose(doc.description, lang),
    estimatedMinutes: doc.estimatedMinutes ?? 8,
    order: doc.order ?? 0,
    type: doc.type || 'vocabulary',
    difficulty: doc.difficulty || 'easy',
    tags: doc.tags || [],
    xpReward: doc.xpReward ?? 25,
    hasAudio: doc.hasAudio !== false,
    hasVideo: !!doc.hasVideo,
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
