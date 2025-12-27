#!/usr/bin/env ts-node

/**
 * Миграция userId с Number на String
 * 
 * Этот скрипт выполняет миграцию всех коллекций MongoDB,
 * преобразуя userId из Number в String для поддержки больших ID (> 2^53)
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

// Загружаем переменные окружения из .env файла
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/burlive';
const DRY_RUN = process.env.DRY_RUN === 'true';

interface MigrationStats {
  users: number;
  userLessonProgress: number;
  userTaskAttempts: number;
  learningSessions: number;
  dailyStats: number;
  xpTransactions: number;
  events: number;
  achievements: number;
  leads: number;
  promoRedemptions: number;
  entitlements: number;
  payments: number;
}

async function migrateUserIdToString() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('englishintg');
    
    console.log(`🚀 Начинаем миграцию userId: Number → String${DRY_RUN ? ' (DRY RUN)' : ''}`);
    
    const stats: MigrationStats = {
      users: 0,
      userLessonProgress: 0,
      userTaskAttempts: 0,
      learningSessions: 0,
      dailyStats: 0,
      xpTransactions: 0,
      events: 0,
      achievements: 0,
      leads: 0,
      promoRedemptions: 0,
      entitlements: 0,
      payments: 0,
    };

    // Список коллекций для миграции
    const collections = [
      'users',
      'user_lesson_progress', 
      'user_task_attempts',
      'learning_sessions',
      'daily_stats',
      'xp_transactions',
      'events',
      'achievements',
      'leads',
      'promo_redemptions',
      'entitlements',
      'payments'
    ];

    for (const collectionName of collections) {
      console.log(`\n📋 Обрабатываем коллекцию: ${collectionName}`);
      
      const collection = db.collection(collectionName);
      
      // Находим документы с userId типа int
      const documentsToUpdate = await collection.find({ 
        userId: { $type: "int" } 
      }).toArray();
      
      console.log(`   Найдено документов для обновления: ${documentsToUpdate.length}`);
      
      if (documentsToUpdate.length === 0) {
        continue;
      }
      
      if (!DRY_RUN) {
        // Обновляем документы, преобразуя userId в строку
        const result = await collection.updateMany(
          { userId: { $type: "int" } },
          [{ $set: { userId: { $toString: "$userId" } } }]
        );
        
        console.log(`   ✅ Обновлено документов: ${result.modifiedCount}`);
        stats[collectionName as keyof MigrationStats] = result.modifiedCount;
      } else {
        console.log(`   🔍 DRY RUN: было бы обновлено ${documentsToUpdate.length} документов`);
        stats[collectionName as keyof MigrationStats] = documentsToUpdate.length;
      }
    }

    // Пересоздаем индексы
    console.log('\n🔧 Пересоздаем индексы...');
    
    if (!DRY_RUN) {
      // Удаляем старые индексы и создаем новые
      const indexOperations: Array<{
        collection: string;
        drop: string;
        create: Record<string, 1 | -1>;
        options: any;
      }> = [
        // users
        { collection: 'users', drop: 'userId_1', create: { userId: 1 }, options: { unique: true } },
        
        // user_lesson_progress
        { collection: 'user_lesson_progress', drop: 'userId_1_lessonRef_1', create: { userId: 1, lessonRef: 1 }, options: { unique: true } },
        { collection: 'user_lesson_progress', drop: 'userId_1_status_1', create: { userId: 1, status: 1 }, options: {} },
        { collection: 'user_lesson_progress', drop: 'userId_1_moduleRef_1_status_1', create: { userId: 1, moduleRef: 1, status: 1 }, options: {} },
        
        // user_task_attempts
        { collection: 'user_task_attempts', drop: 'userId_1_taskRef_1_clientAttemptId_1', create: { userId: 1, taskRef: 1, clientAttemptId: 1 }, options: { unique: true } },
        { collection: 'user_task_attempts', drop: 'userId_1_lessonRef_1_taskRef_1_attemptNo_1', create: { userId: 1, lessonRef: 1, taskRef: 1, attemptNo: 1 }, options: { unique: true } },
        
        // learning_sessions
        { collection: 'learning_sessions', drop: 'userId_1_startedAt_-1', create: { userId: 1, startedAt: -1 }, options: {} },
        
        // daily_stats
        { collection: 'daily_stats', drop: 'userId_1_dayKey_1', create: { userId: 1, dayKey: 1 }, options: { unique: true } },
        
        // xp_transactions
        { collection: 'xp_transactions', drop: 'userId_1_createdAt_-1', create: { userId: 1, createdAt: -1 }, options: {} },
        
        // achievements
        { collection: 'achievements', drop: 'userId_1_key_1', create: { userId: 1, key: 1 }, options: { unique: true } },
        
        // leads
        { collection: 'leads', drop: 'userId_1', create: { userId: 1 }, options: { unique: true } },
        
        // promo_redemptions
        { collection: 'promo_redemptions', drop: 'promoId_1_userId_1', create: { promoId: 1, userId: 1 }, options: { unique: true } },
        
        // entitlements
        { collection: 'entitlements', drop: 'userId_1_product_1', create: { userId: 1, product: 1 }, options: { unique: true } },
        { collection: 'entitlements', drop: 'endsAt_1', create: { endsAt: 1 }, options: {} },
      ];

      for (const op of indexOperations) {
        try {
          const collection = db.collection(op.collection);
          
          // Удаляем старый индекс
          try {
            await collection.dropIndex(op.drop);
            console.log(`   🗑️  Удален индекс: ${op.collection}.${op.drop}`);
          } catch (e) {
            // Индекс может не существовать
          }
          
          // Создаем новый индекс
          await collection.createIndex(op.create, op.options);
          console.log(`   ✅ Создан индекс: ${op.collection}.${Object.keys(op.create).join('_')}`);
        } catch (error) {
          console.error(`   ❌ Ошибка при работе с индексом ${op.collection}:`, error);
        }
      }
    } else {
      console.log('   🔍 DRY RUN: индексы не пересоздаются');
    }

    // Итоговая статистика
    console.log('\n📊 Итоговая статистика миграции:');
    console.log('=====================================');
    Object.entries(stats).forEach(([collection, count]) => {
      console.log(`${collection.padEnd(20)}: ${count} документов`);
    });
    
    const totalUpdated = Object.values(stats).reduce((sum, count) => sum + count, 0);
    console.log('=====================================');
    console.log(`Всего обновлено: ${totalUpdated} документов`);
    
    if (DRY_RUN) {
      console.log('\n⚠️  Это был DRY RUN. Для выполнения реальной миграции запустите:');
      console.log('   DRY_RUN=false npm run migrate:userid');
    } else {
      console.log('\n✅ Миграция userId: Number → String завершена успешно!');
    }

  } catch (error) {
    console.error('❌ Ошибка при выполнении миграции:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Запуск миграции
if (require.main === module) {
  migrateUserIdToString()
    .then(() => {
      console.log('\n🎉 Миграция завершена');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Критическая ошибка:', error);
      process.exit(1);
    });
}

export { migrateUserIdToString };
