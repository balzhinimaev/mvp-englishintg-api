#!/usr/bin/env ts-node
import 'dotenv/config';
import mongoose from 'mongoose';

// Импортируем схему урока
import { Lesson, LessonSchema } from '../../src/modules/common/schemas/lesson.schema';

/**
 * Хелпер для безопасного получения текста
 */
function pickText(textObj: any, lang: 'en' | 'ru' = 'en'): string {
  if (!textObj) return '-';
  if (typeof textObj === 'string') return textObj;
  return textObj[lang]?.trim() || textObj['en']?.trim() || textObj['ru']?.trim() || '-';
}

/**
 * Хелпер для обрезки текста
 */
function truncate(str: string, maxLen: number): string {
  if (!str) return '';
  const oneline = str.replace(/[\r\n]+/g, ' ');
  return oneline.length > maxLen ? oneline.slice(0, maxLen) + '...' : oneline;
}

(async () => {
  // 1. Получаем аргумент (a0 или a0.basics)
  const arg = process.argv[2];

  if (!arg) {
    console.error('❌ Ошибка: Не указан уровень или модуль.');
    console.log('👉 Пример (весь уровень): npx ts-node scripts/inspect-lessons.ts a0');
    console.log('👉 Пример (один модуль): npx ts-node scripts/inspect-lessons.ts a0.basics');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/burlive';
  const dbName = process.env.MONGODB_DB_NAME || 'englishintg';

  try {
    await mongoose.connect(uri, { dbName });
    const LessonModel = mongoose.model(Lesson.name, LessonSchema);

    // 2. Определяем стратегию поиска
    // Если аргумент содержит точку (a0.basics), ищем точное совпадение
    // Если нет (a0), ищем все модули, начинающиеся с этого префикса
    const isSpecificModule = arg.includes('.');
    const filter = isSpecificModule
      ? { moduleRef: arg }
      : { moduleRef: { $regex: new RegExp(`^${arg}\\.`, 'i') } };

    console.log(`🔍 Поиск уроков по фильтру: ${JSON.stringify(filter)}...\n`);

    // 3. Загружаем уроки
    const lessons = await LessonModel.find(filter)
      .sort({ moduleRef: 1, order: 1 }) // Сортируем сначала по модулю, потом по порядку урока
      .lean();

    if (!lessons.length) {
      console.log(`❗️ Уроки не найдены.`);
      await mongoose.disconnect();
      return;
    }

    // 4. Группируем по moduleRef
    const groupedTasks: Record<string, typeof lessons> = {};

    lessons.forEach((lesson) => {
      const mRef = lesson.moduleRef;
      if (!groupedTasks[mRef]) {
        groupedTasks[mRef] = [];
      }
      groupedTasks[mRef].push(lesson);
    });

    // 5. Выводим результаты по каждому модулю
    const moduleKeys = Object.keys(groupedTasks).sort(); // Алфавитный порядок модулей

    for (const modRef of moduleKeys) {
      const modLessons = groupedTasks[modRef];

      // Заголовок модуля
      console.log(`\n📦 MODULE: \x1b[36m${modRef}\x1b[0m (Уроков: ${modLessons.length})`);

      // Шапка таблицы
      const colRef = 'LESSON REF'.padEnd(22);
      const colTitle = 'TITLE (EN)'.padEnd(35);
      const colTags = 'TAGS'.padEnd(20);
      const colDesc = 'DESCRIPTION (EN)';

      const header = `${colRef} | ${colTitle} | ${colTags} | ${colDesc}`;
      console.log('\x1b[90m' + '-'.repeat(header.length + 20) + '\x1b[0m'); // Серый разделитель
      console.log(header);
      console.log('\x1b[90m' + '-'.repeat(header.length + 20) + '\x1b[0m');

      // Строки таблицы
      for (const lesson of modLessons) {
        const ref = (lesson.lessonRef || '???').padEnd(22);
        const title = truncate(pickText(lesson.title, 'en'), 32).padEnd(35);

        const tagsRaw = Array.isArray(lesson.tags) ? lesson.tags.join(', ') : '';
        const tags = truncate(tagsRaw, 17).padEnd(20);

        const desc = truncate(pickText(lesson.description, 'en'), 60);

        // Подсветка для опубликованных/неопубликованных (опционально)
        const statusColor = lesson.published ? '' : '\x1b[33m'; // Желтый если скрыт
        const reset = '\x1b[0m';

        console.log(`${statusColor}${ref} | ${title} | ${tags} | ${desc}${reset}`);
      }
      console.log(''); // Пустая строка между модулями
    }

    console.log(`✅ Всего найдено уроков: ${lessons.length}`);
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await mongoose.disconnect();
  }
})();
