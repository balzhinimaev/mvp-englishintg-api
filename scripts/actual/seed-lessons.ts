#!/usr/bin/env ts-node
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';

import { Lesson, LessonSchema } from '../../src/modules/common/schemas/lesson.schema';
import { MultilingualText, OptionalMultilingualText, validateMultilingualText } from '../../src/modules/common/utils/i18n.util';
import { isValidLessonRef, matchesModuleRef } from '../../src/modules/common/utils/lesson-ref';

const LEVELS = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
type Level = typeof LEVELS[number];

type LessonSeed = {
  lessonRef: string;
  moduleRef?: string;
  title: MultilingualText;
  description?: OptionalMultilingualText;
  estimatedMinutes?: number;
  order?: number;
  published?: boolean;
  requiresPro?: boolean;
  type?: 'conversation' | 'vocabulary' | 'grammar';
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
  xpReward?: number;
  hasAudio?: boolean;
  hasVideo?: boolean;
  previewText?: string;
};

function normalizeLevelFromModuleRef(moduleRef: string): Level {
  const rawLevel = moduleRef.split('.')[0]?.toUpperCase();
  if (!LEVELS.includes(rawLevel as Level)) {
    throw new Error(`Не удалось определить уровень из moduleRef: ${moduleRef}. Пример: a0.basics`);
  }
  return rawLevel as Level;
}

function resolveLessonsPath(level: Level, moduleRef: string): string {
  return path.join(__dirname, 'content', level, moduleRef, 'lessons.json');
}

function readLessons(filePath: string): LessonSeed[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Файл не найден: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Ожидался JSON-массив уроков');
  }
  return parsed as LessonSeed[];
}

function validateLessonSeed(seed: LessonSeed, moduleRef: string): string[] {
  const errors: string[] = [];
  if (!seed.lessonRef || !isValidLessonRef(seed.lessonRef)) {
    errors.push(`Некорректный lessonRef: ${seed.lessonRef}`);
  }
  const seedModuleRef = seed.moduleRef ?? moduleRef;
  if (!matchesModuleRef(seed.lessonRef, seedModuleRef)) {
    errors.push(`lessonRef должен соответствовать moduleRef (${seedModuleRef}.NNN)`);
  }
  if (!seed.title || !validateMultilingualText(seed.title)) {
    errors.push('title должен содержать переводы ru и en');
  }
  if (seed.description && !validateMultilingualText(seed.description, ['ru'])) {
    errors.push('description должен содержать хотя бы ru, если указан');
  }
  if (seed.published === true) {
    errors.push('published=true недопустим для сидера без задач');
  }
  return errors;
}

(async () => {
  const moduleRef = process.argv[2];
  if (!moduleRef) {
    throw new Error('Укажите moduleRef. Пример: ts-node scripts/actual/seed-lessons.ts a0.basics');
  }

  const level = normalizeLevelFromModuleRef(moduleRef);
  const filePath = resolveLessonsPath(level, moduleRef);

  const lessons = readLessons(filePath);
  if (!lessons.length) {
    console.log('❗️Файл lessons.json пустой');
    return;
  }

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/burlive';
  const dbName = process.env.MONGODB_DB_NAME || 'englishintg';

  await mongoose.connect(uri, { dbName });
  console.log(`🔗 MongoDB подключен (db: ${dbName})`);

  const LessonModel = mongoose.model<Lesson>(Lesson.name, LessonSchema);

  let successCount = 0;
  let skippedCount = 0;

  for (const lesson of lessons) {
    const errors = validateLessonSeed(lesson, moduleRef);
    if (errors.length) {
      console.log(`⚠️ Пропуск ${lesson.lessonRef || '<без lessonRef>'}: ${errors.join('; ')}`);
      skippedCount += 1;
      continue;
    }

    const payload: Partial<Lesson> = {
      lessonRef: lesson.lessonRef,
      moduleRef,
      title: lesson.title,
      description: lesson.description,
      estimatedMinutes: lesson.estimatedMinutes,
      order: lesson.order,
      published: lesson.published ?? false,
      requiresPro: lesson.requiresPro,
      type: lesson.type,
      difficulty: lesson.difficulty,
      tags: lesson.tags,
      xpReward: lesson.xpReward,
      hasAudio: lesson.hasAudio,
      hasVideo: lesson.hasVideo,
      previewText: lesson.previewText,
    };

    await LessonModel.updateOne(
      { lessonRef: lesson.lessonRef },
      { $set: payload },
      { upsert: true },
    );
    successCount += 1;
  }

  console.log(`✅ Готово. Обработано: ${lessons.length}, успешно: ${successCount}, пропущено: ${skippedCount}`);
  await mongoose.disconnect();
})().catch(async error => {
  console.error('❌ Ошибка сидера:', error instanceof Error ? error.message : error);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    console.error('⚠️ Не удалось корректно отключиться от MongoDB', disconnectError);
  }
  process.exit(1);
});
