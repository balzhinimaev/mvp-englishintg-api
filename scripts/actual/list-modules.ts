#!/usr/bin/env ts-node
import 'dotenv/config';
import mongoose from 'mongoose';

import { CourseModule, CourseModuleSchema } from '../../src/modules/common/schemas/course-module.schema';

const LEVELS = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

type Level = typeof LEVELS[number];

function normalizeLevel(raw?: string): Level | undefined {
  if (!raw) return undefined;
  const upper = raw.toUpperCase();
  if (!LEVELS.includes(upper as Level)) {
    throw new Error(`Неизвестный уровень: ${raw}. Допустимые: ${LEVELS.join(', ')}`);
  }
  return upper as Level;
}

function pickTitle(title: { ru?: string; en?: string }): string {
  return title.ru?.trim() || title.en?.trim() || 'Без названия';
}

(async () => {
  const levelArg = process.argv[2];
  const level = normalizeLevel(levelArg);

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/burlive';
  const dbName = process.env.MONGODB_DB_NAME || 'englishintg';

  await mongoose.connect(uri, { dbName });
  console.log(`🔗 MongoDB подключен (db: ${dbName})`);

  const ModuleModel = mongoose.model(CourseModule.name, CourseModuleSchema);

  const filter: { level?: Level } = {};
  if (level) {
    filter.level = level;
  }

  const modules = await ModuleModel.find(filter)
    .sort({ level: 1, order: 1 })
    .lean();

  if (!modules.length) {
    console.log('❗️Модули не найдены');
    await mongoose.disconnect();
    return;
  }

  console.log(`📦 Найдено модулей: ${modules.length}${level ? ` (уровень ${level})` : ''}`);

  for (const module of modules) {
    const title = pickTitle(module.title as { ru?: string; en?: string });
    console.log(`- ${module.level} ${module.moduleRef}: ${title}`);
  }

  await mongoose.disconnect();
})();
