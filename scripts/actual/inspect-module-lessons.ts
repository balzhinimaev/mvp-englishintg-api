#!/usr/bin/env ts-node
import 'dotenv/config';
import mongoose from 'mongoose';

// Импортируем схему урока из твоего проекта
import { Lesson, LessonSchema } from '../../src/modules/common/schemas/lesson.schema';

/**
 * Хелпер для безопасного получения текста (en приоритет, потом ru, иначе '-')
 */
function pickText(textObj: any, lang: 'en' | 'ru' = 'en'): string {
  if (!textObj) return '-';
  // Если это строка (на случай старых данных)
  if (typeof textObj === 'string') return textObj;

  return textObj[lang]?.trim() || textObj['en']?.trim() || textObj['ru']?.trim() || '-';
}

(async () => {
  // 1. Получаем аргумент (moduleRef)
  const moduleRefArg = process.argv[2];

  if (!moduleRefArg) {
    console.error('❌ Ошибка: Не указан moduleRef.');
    console.log('👉 Пример запуска: npx ts-node scripts/inspect-module-lessons.ts a0.basics');
    process.exit(1);
  }

  // 2. Настройка подключения (как в твоем примере)
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/burlive';
  const dbName = process.env.MONGODB_DB_NAME || 'englishintg'; // Или твой дефолтный

  try {
    await mongoose.connect(uri, { dbName });
    console.log(`🔗 MongoDB подключен (db: ${dbName})`);

    // 3. Создаем модель на основе существующей схемы
    // Важно: имя коллекции 'lessons' должно совпадать с тем, что в декораторе @Schema
    const LessonModel = mongoose.model(Lesson.name, LessonSchema);

    // 4. Ищем уроки конкретного модуля
    const lessons = await LessonModel.find({ moduleRef: moduleRefArg })
      .sort({ order: 1 }) // Сортируем по порядку прохождения
      .lean();

    if (!lessons.length) {
      console.log(`❗️ Уроки для модуля "${moduleRefArg}" не найдены.`);
      await mongoose.disconnect();
      return;
    }

    console.log(`📦 Найдено уроков: ${lessons.length} (модуль ${moduleRefArg})\n`);

    // 5. Вывод данных
    // Формат: lessonRef | Title (en) | Tags | Description (en)

    // Заголовок таблицы
    const header = `${'LESSON REF'.padEnd(20)} | ${'TITLE (EN)'.padEnd(30)} | ${'TAGS'.padEnd(20)} | DESCRIPTION (EN)`;
    console.log(header);
    console.log('-'.repeat(header.length + 20));

    for (const lesson of lessons) {
      const ref = lesson.lessonRef || '???';
      const title = pickText(lesson.title, 'en');
      const desc = pickText(lesson.description, 'en');
      const tags = Array.isArray(lesson.tags) ? lesson.tags.join(', ') : '';

      // Обрезаем слишком длинные строки для красивого вывода
      const fRef = ref.padEnd(20);
      const fTitle = (title.length > 27 ? title.slice(0, 27) + '...' : title).padEnd(30);
      const fTags = (tags.length > 17 ? tags.slice(0, 17) + '...' : tags).padEnd(20);

      // Если описание длинное, урезаем до одной строки
      const fDesc = desc.replace(/[\r\n]+/g, ' ').slice(0, 50) + (desc.length > 50 ? '...' : '');

      console.log(`${fRef} | ${fTitle} | ${fTags} | ${fDesc}`);
    }
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await mongoose.disconnect();
    // console.log('\n🔌 Отключено');
  }
})();
