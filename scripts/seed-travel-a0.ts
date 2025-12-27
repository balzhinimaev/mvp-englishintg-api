#!/usr/bin/env ts-node

/**
 * Сидирование реальными данными вместо моков
 * 
 * Создаёт модуль a0.travel + 8 уроков, если их ещё нет
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Импортируем схемы
import { CourseModule, CourseModuleSchema } from '../src/modules/common/schemas/course-module.schema';
import { Lesson, LessonSchema } from '../src/modules/common/schemas/lesson.schema';

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/burlive', {
        dbName: 'englishintg',
    });
    console.log('🔗 Подключились к MongoDB');
    
    const ModuleModel = mongoose.model(CourseModule.name, CourseModuleSchema);
    const LessonModel = mongoose.model(Lesson.name, LessonSchema);

    const moduleRef = 'a0.travel';
    
    // Проверяем, существует ли модуль
    const exists = await ModuleModel.findOne({ moduleRef });
    if (!exists) {
      console.log('📦 Создаём модуль a0.travel...');
      await ModuleModel.create({
        moduleRef,
        level: 'A0',
        title: { ru: 'Путешествия (начальный)', en: 'Travel (Beginner)' },
        description: { ru: 'Основы общения в аэропорту', en: 'Airport basics' },
        tags: ['travel','airport','beginner'],
        order: 1,
        published: true,
        requiresPro: false,
        isAvailable: true,
      });
      console.log('   ✅ Модуль создан');
    } else {
      console.log('   ℹ️ Модуль уже существует');
    }

    // Создаём уроки
    const lessons = [
      ['a0.travel.001','Приветствие и знакомство'],
      ['a0.travel.002','Досмотр безопасности'],
      ['a0.travel.003','Посадка на самолёт'],
      ['a0.travel.004','Во время полёта'],
      ['a0.travel.005','Прибытие и паспортный контроль'],
      ['a0.travel.006','Заселение в отель'],
      ['a0.travel.007','В ресторане'],
      ['a0.travel.008','Спросить дорогу'],
    ];
    
    console.log('📚 Создаём уроки...');
    for (let i = 0; i < lessons.length; i++) {
      const [lessonRef, title] = lessons[i];
      const ex = await LessonModel.findOne({ lessonRef });
      if (!ex) {
        await LessonModel.create({
          moduleRef,
          lessonRef,
          title: { ru: title, en: '...' },
          description: { ru: '...', en: '...' },
          estimatedMinutes: 8,
          order: i + 1,
          type: 'vocabulary',
          difficulty: 'easy',
          tags: ['basics'],
          xpReward: 25,
          hasAudio: true,
          hasVideo: false,
          tasks: [], // позже подложишь реальные
          published: true,
        });
        console.log(`   ✅ Создан урок ${lessonRef}`);
      } else {
        console.log(`   ℹ️ Урок ${lessonRef} уже существует`);
      }
    }
    
    console.log('🎉 Сидирование завершено успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка при сидировании:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
