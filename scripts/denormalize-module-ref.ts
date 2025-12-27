#!/usr/bin/env ts-node

/**
 * Денормализация moduleRef в user_lesson_progress
 * 
 * Этот скрипт добавляет поле moduleRef в коллекцию user_lesson_progress
 * для оптимизации запросов по модулям
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

// Загружаем переменные окружения из .env файла
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/burlive';
const DRY_RUN = process.env.DRY_RUN === 'true';

async function denormalizeModuleRef() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('englishintg');
    
    console.log(`🚀 Начинаем денормализацию moduleRef${DRY_RUN ? ' (DRY RUN)' : ''}`);
    
    const collection = db.collection('user_lesson_progress');
    
    // Находим документы без moduleRef
    const documentsWithoutModuleRef = await collection.find({ 
      moduleRef: { $exists: false } 
    }).toArray();
    
    console.log(`📋 Найдено документов без moduleRef: ${documentsWithoutModuleRef.length}`);
    
    if (documentsWithoutModuleRef.length === 0) {
      console.log('✅ Все документы уже имеют moduleRef');
      return;
    }
    
    if (!DRY_RUN) {
      // Обновляем документы, добавляя moduleRef
      const result = await collection.updateMany(
        { moduleRef: { $exists: false } },
        [{ 
          $set: { 
            moduleRef: { 
              $substrBytes: [
                "$lessonRef", 
                0, 
                { $subtract: [{ $strLenBytes: "$lessonRef" }, 4] }
              ]
            }
          } 
        }]
      );
      
      console.log(`✅ Обновлено документов: ${result.modifiedCount}`);
      
      // Создаем индекс для быстрого поиска по moduleRef
      await collection.createIndex(
        { userId: 1, moduleRef: 1, status: 1 },
        { name: 'userId_1_moduleRef_1_status_1' }
      );
      
      console.log('✅ Создан индекс: userId_1_moduleRef_1_status_1');
      
    } else {
      console.log(`🔍 DRY RUN: было бы обновлено ${documentsWithoutModuleRef.length} документов`);
      
      // Показываем примеры того, что будет обновлено
      console.log('\n📝 Примеры обновлений:');
      documentsWithoutModuleRef.slice(0, 5).forEach((doc, index) => {
        const lessonRef = doc.lessonRef;
        const moduleRef = lessonRef ? lessonRef.split('.').slice(0, 2).join('.') : 'unknown';
        console.log(`   ${index + 1}. ${lessonRef} → moduleRef: ${moduleRef}`);
      });
    }
    
    // Проверяем результат
    const remainingWithoutModuleRef = await collection.countDocuments({ 
      moduleRef: { $exists: false } 
    });
    
    console.log(`\n📊 Документов без moduleRef осталось: ${remainingWithoutModuleRef}`);
    
    if (DRY_RUN) {
      console.log('\n⚠️  Это был DRY RUN. Для выполнения реальной денормализации запустите:');
      console.log('   DRY_RUN=false npm run migrate:module-ref');
    } else {
      console.log('\n✅ Денормализация moduleRef завершена успешно!');
    }

  } catch (error) {
    console.error('❌ Ошибка при выполнении денормализации:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Запуск денормализации
if (require.main === module) {
  denormalizeModuleRef()
    .then(() => {
      console.log('\n🎉 Денормализация завершена');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Критическая ошибка:', error);
      process.exit(1);
    });
}

export { denormalizeModuleRef };
