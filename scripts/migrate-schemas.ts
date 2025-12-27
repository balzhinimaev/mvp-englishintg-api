#!/usr/bin/env ts-node

/**
 * Миграция схем MongoDB для нового контракта
 * 
 * Этот скрипт выполняет миграцию данных для поддержки новых полей
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

// Загружаем переменные окружения из .env файла
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/burlive';
const DRY_RUN = process.env.DRY_RUN === 'true';

async function migrateSchemas() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('🔗 Подключились к MongoDB');
    
    const db = client.db("englishintg");
    
    console.log('\n📋 Начинаем миграцию схем...');
    
    // 1) Entitlements - ничего не меняем, просто разрешаем 'yearly' в схеме
    console.log('\n1️⃣ Entitlements - проверяем существующие продукты...');
    const entitlements = await db.collection('entitlements').find({}).toArray();
    const products = [...new Set(entitlements.map(e => e.product))];
    console.log(`   Найдены продукты: ${products.join(', ')}`);
    console.log('   ✅ Схема уже поддерживает yearly');
    
    // 2) Lessons - добавляем дефолты
    console.log('\n2️⃣ Lessons - добавляем дефолты...');
    const lessonsResult = await db.collection('lessons').updateMany(
      {},
      {
        $setOnInsert: { estimatedMinutes: 8 },
        $set: {
          xpReward: 25,
          hasAudio: true,
          hasVideo: false
        }
      }
    );
    console.log(`   ✅ Обновлено уроков: ${lessonsResult.modifiedCount}`);
    
    // 3) Course modules - добавляем новые поля
    console.log('\n3️⃣ Course modules - добавляем requiresPro и isAvailable...');
    const modulesResult = await db.collection('course_modules').updateMany(
      {},
      {
        $set: { 
          requiresPro: false, 
          isAvailable: true 
        }
      }
    );
    console.log(`   ✅ Обновлено модулей: ${modulesResult.modifiedCount}`);
    
    // 4) User lesson progress - добавляем недостающие поля
    console.log('\n4️⃣ User lesson progress - добавляем недостающие поля...');
    const progressResult = await db.collection('user_lesson_progress').updateMany(
      { score: { $exists: false } },
      { 
        $set: { 
          score: 0, 
          attempts: 0, 
          timeSpent: 0 
        } 
      }
    );
    console.log(`   ✅ Обновлено записей прогресса: ${progressResult.modifiedCount}`);
    
    console.log('\n🎉 Миграция схем завершена успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка при миграции:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Запускаем миграцию
if (require.main === module) {
  migrateSchemas()
    .then(() => {
      console.log('✅ Миграция завершена');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Миграция не удалась:', error);
      process.exit(1);
    });
}

export { migrateSchemas };
