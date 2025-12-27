#!/usr/bin/env ts-node
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

import {
  CourseModule,
  CourseModuleSchema,
} from '../src/modules/common/schemas/course-module.schema';

type MultilingualText = { ru: string; en: string };

type ModuleSeedItem = {
  moduleRef: string;
  level: 'A0' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  title: MultilingualText;
  description?: MultilingualText;
  tags?: string[];
  difficultyRating?: number; // 1..5
  order?: number; // >= 0
  published?: boolean;
  requiresPro?: boolean;
  isAvailable?: boolean;
};

type SeedFile = {
  version?: number;
  level?: string;
  items: ModuleSeedItem[];
};

function fail(msg: string): never {
  throw new Error(msg);
}

function readSeedFile(filePath: string): SeedFile {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  if (!fs.existsSync(abs)) fail(`Seed file not found: ${abs}`);
  const raw = fs.readFileSync(abs, 'utf-8');
  return JSON.parse(raw) as SeedFile;
}

function validate(items: ModuleSeedItem[]) {
  const seen = new Set<string>();

  for (const [idx, it] of items.entries()) {
    if (!it.moduleRef?.trim()) fail(`items[${idx}].moduleRef is required`);
    if (seen.has(it.moduleRef)) fail(`Duplicate moduleRef: ${it.moduleRef}`);
    seen.add(it.moduleRef);

    if (!it.level) fail(`items[${idx}].level is required (${it.moduleRef})`);
    if (!it.title?.ru?.trim() || !it.title?.en?.trim()) {
      fail(`items[${idx}].title.ru and title.en are required (${it.moduleRef})`);
    }

    if (it.difficultyRating !== undefined) {
      if (it.difficultyRating < 1 || it.difficultyRating > 5) {
        fail(`difficultyRating must be 1..5 (${it.moduleRef})`);
      }
      // допускаем 0.5 шаг (2.5 и т.п.)
      const x2 = Math.round(it.difficultyRating * 2);
      if (Math.abs(it.difficultyRating * 2 - x2) > 1e-9) {
        fail(`difficultyRating must be in 0.5 steps (${it.moduleRef})`);
      }
    }

    if (it.order !== undefined && it.order < 0) {
      fail(`order must be >= 0 (${it.moduleRef})`);
    }
  }
}

function applyDefaults(items: ModuleSeedItem[]): ModuleSeedItem[] {
  return items.map((it, idx) => ({
    ...it,
    order: typeof it.order === 'number' ? it.order : idx,
    tags: it.tags ?? [],
    published: it.published ?? true,
    requiresPro: it.requiresPro ?? false,
    isAvailable: it.isAvailable ?? true,
  }));
}

(async () => {
  const seedPath = process.argv[2] || 'seeds/a0/a0.modules.json';

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/burlive';
  const dbName = process.env.MONGODB_DB_NAME || 'englishintg';

  const seed = readSeedFile(seedPath);
  if (!seed.items?.length) fail(`No items in seed file: ${seedPath}`);

  validate(seed.items);
  const items = applyDefaults(seed.items);

  await mongoose.connect(uri, { dbName });
  console.log(`🔗 MongoDB connected (db: ${dbName})`);
  console.log(`📦 Seeding modules from: ${seedPath} (${items.length} items)`);

  const ModuleModel = mongoose.model(CourseModule.name, CourseModuleSchema);

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const it of items) {
    const payload = {
      moduleRef: it.moduleRef,
      level: it.level,
      title: it.title,
      description: it.description,
      tags: it.tags,
      difficultyRating: it.difficultyRating,
      order: it.order,
      published: it.published,
      requiresPro: it.requiresPro,
      isAvailable: it.isAvailable,
    };

    const res = await ModuleModel.updateOne(
      { moduleRef: it.moduleRef },
      { $set: payload },
      { upsert: true },
    );

    const upserted = Boolean((res as any).upsertedId);
    const modified = (res as any).modifiedCount ?? 0;
    const matched = (res as any).matchedCount ?? 0;

    if (upserted) {
      created++;
      console.log(`   ✅ created ${it.moduleRef}`);
    } else if (modified > 0) {
      updated++;
      console.log(`   ♻️ updated ${it.moduleRef}`);
    } else if (matched > 0) {
      unchanged++;
      console.log(`   ℹ️ unchanged ${it.moduleRef}`);
    } else {
      console.log(`   ℹ️ processed ${it.moduleRef}`);
    }
  }

  console.log(`🎉 Done. created=${created}, updated=${updated}, unchanged=${unchanged}`);

  await mongoose.disconnect();
})();
