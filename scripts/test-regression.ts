#!/usr/bin/env ts-node

/**
 * Тест-скрипт для проверки регресса после миграции
 * 
 * Проверяет:
 * 1. userId как строка работает корректно
 * 2. Идемпотентность попыток
 * 3. Денормализованный moduleRef
 * 4. Большие userId (> 2^53)
 */

import { MongoClient } from 'mongodb';
import axios from 'axios';
import * as dotenv from 'dotenv';

// Загружаем переменные окружения из .env файла
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/burlive';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

async function runRegressionTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('englishintg');
    
    console.log('🧪 Запускаем тесты регресса...\n');
    
    // Тест 1: Проверка userId как строка
    results.push(await testUserIdAsString(db));
    
    // Тест 2: Проверка больших userId
    results.push(await testLargeUserId(db));
    
    // Тест 3: Проверка идемпотентности
    results.push(await testIdempotency(db));
    
    // Тест 4: Проверка денормализованного moduleRef
    results.push(await testModuleRefDenormalization(db));
    
    // Тест 5: Проверка API endpoints
    results.push(await testApiEndpoints());
    
  } catch (error) {
    results.push({
      name: 'Общая ошибка',
      passed: false,
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    await client.close();
  }
  
  return results;
}

async function testUserIdAsString(db: any): Promise<TestResult> {
  try {
    console.log('🔍 Тест 1: userId как строка');
    
    // Проверяем, что все userId в коллекциях имеют тип string
    const collections = [
      'users', 'user_lesson_progress', 'user_task_attempts', 
      'learning_sessions', 'daily_stats', 'xp_transactions'
    ];
    
    const issues: string[] = [];
    
    for (const collectionName of collections) {
      const collection = db.collection(collectionName);
      const count = await collection.countDocuments({ userId: { $type: "int" } });
      
      if (count > 0) {
        issues.push(`${collectionName}: ${count} документов с userId типа int`);
      }
    }
    
    if (issues.length > 0) {
      return {
        name: 'userId как строка',
        passed: false,
        error: `Найдены документы с userId типа int: ${issues.join(', ')}`
      };
    }
    
    console.log('   ✅ Все userId имеют тип string');
    return { name: 'userId как строка', passed: true };
    
  } catch (error) {
    return {
      name: 'userId как строка',
      passed: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function testLargeUserId(db: any): Promise<TestResult> {
  try {
    console.log('🔍 Тест 2: Большие userId (> 2^53)');
    
    const largeUserId = '9007199254740993'; // > 2^53
    const usersCollection = db.collection('users');
    
    // Создаем тестового пользователя с большим ID
    await usersCollection.updateOne(
      { userId: largeUserId },
      { 
        $set: { 
          userId: largeUserId,
          firstName: 'Test',
          lastName: 'LargeId',
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
    
    // Проверяем, что пользователь создался и читается
    const user = await usersCollection.findOne({ userId: largeUserId });
    
    if (!user) {
      return {
        name: 'Большие userId',
        passed: false,
        error: 'Не удалось создать/найти пользователя с большим userId'
      };
    }
    
    // Проверяем, что userId сохранился как строка
    if (typeof user.userId !== 'string') {
      return {
        name: 'Большие userId',
        passed: false,
        error: `userId имеет тип ${typeof user.userId}, ожидался string`
      };
    }
    
    console.log(`   ✅ Пользователь с большим userId создан: ${user.userId}`);
    
    // Очищаем тестовые данные
    await usersCollection.deleteOne({ userId: largeUserId });
    
    return { name: 'Большие userId', passed: true };
    
  } catch (error) {
    return {
      name: 'Большие userId',
      passed: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function testIdempotency(db: any): Promise<TestResult> {
  try {
    console.log('🔍 Тест 3: Идемпотентность попыток');
    
    const attemptsCollection = db.collection('user_task_attempts');
    const testUserId = '123456789';
    const testTaskRef = 'test.task.001';
    const testClientAttemptId = 'test-idempotency-' + Date.now();
    
    // Создаем первую попытку
    const attempt1 = await attemptsCollection.insertOne({
      userId: testUserId,
      lessonRef: 'test.lesson.001',
      taskRef: testTaskRef,
      attemptNo: 1,
      correct: true,
      clientAttemptId: testClientAttemptId,
      createdAt: new Date()
    });
    
    // Пытаемся создать дублирующую попытку
    try {
      await attemptsCollection.insertOne({
        userId: testUserId,
        lessonRef: 'test.lesson.001',
        taskRef: testTaskRef,
        attemptNo: 2,
        correct: false,
        clientAttemptId: testClientAttemptId,
        createdAt: new Date()
      });
      
      return {
        name: 'Идемпотентность попыток',
        passed: false,
        error: 'Дублирующая попытка была создана (нарушение уникальности)'
      };
    } catch (error: any) {
      if (error.code === 11000) {
        console.log('   ✅ Дублирующая попытка корректно отклонена (E11000)');
      } else {
        throw error;
      }
    }
    
    // Очищаем тестовые данные
    await attemptsCollection.deleteOne({ _id: attempt1.insertedId });
    
    return { name: 'Идемпотентность попыток', passed: true };
    
  } catch (error) {
    return {
      name: 'Идемпотентность попыток',
      passed: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function testModuleRefDenormalization(db: any): Promise<TestResult> {
  try {
    console.log('🔍 Тест 4: Денормализованный moduleRef');
    
    const progressCollection = db.collection('user_lesson_progress');
    
    // Проверяем, что есть документы с moduleRef
    const withModuleRef = await progressCollection.countDocuments({ 
      moduleRef: { $exists: true } 
    });
    
    const withoutModuleRef = await progressCollection.countDocuments({ 
      moduleRef: { $exists: false } 
    });
    
    console.log(`   📊 Документов с moduleRef: ${withModuleRef}`);
    console.log(`   📊 Документов без moduleRef: ${withoutModuleRef}`);
    
    if (withoutModuleRef > 0) {
      return {
        name: 'Денормализованный moduleRef',
        passed: false,
        error: `${withoutModuleRef} документов не имеют moduleRef`
      };
    }
    
    // Проверяем корректность moduleRef
    const sampleDoc = await progressCollection.findOne({ 
      moduleRef: { $exists: true } 
    });
    
    if (sampleDoc) {
      const expectedModuleRef = sampleDoc.lessonRef.split('.').slice(0, 2).join('.');
      if (sampleDoc.moduleRef !== expectedModuleRef) {
        return {
          name: 'Денормализованный moduleRef',
          passed: false,
          error: `Некорректный moduleRef: ${sampleDoc.moduleRef}, ожидался: ${expectedModuleRef}`
        };
      }
    }
    
    console.log('   ✅ Все документы имеют корректный moduleRef');
    return { name: 'Денормализованный moduleRef', passed: true };
    
  } catch (error) {
    return {
      name: 'Денормализованный moduleRef',
      passed: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function testApiEndpoints(): Promise<TestResult> {
  try {
    console.log('🔍 Тест 5: API endpoints');
    
    const testUserId = '123456789';
    
    // Тестируем основные endpoints
    const endpoints = [
      `/profile/${testUserId}`,
      `/content/modules?userId=${testUserId}`,
      `/progress/stats/daily/${testUserId}`,
      `/progress/xp/${testUserId}`,
      `/progress/lessons/${testUserId}`,
    ];
    
    const issues: string[] = [];
    
    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(`${API_BASE_URL}${endpoint}`, {
          timeout: 5000,
          validateStatus: () => true // Принимаем любые статус-коды
        });
        
        if (response.status >= 500) {
          issues.push(`${endpoint}: HTTP ${response.status}`);
        }
      } catch (error) {
        issues.push(`${endpoint}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    if (issues.length > 0) {
      return {
        name: 'API endpoints',
        passed: false,
        error: `Проблемы с endpoints: ${issues.join(', ')}`
      };
    }
    
    console.log('   ✅ Все API endpoints отвечают корректно');
    return { name: 'API endpoints', passed: true };
    
  } catch (error) {
    return {
      name: 'API endpoints',
      passed: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Запуск тестов
if (require.main === module) {
  runRegressionTests()
    .then((results) => {
      console.log('\n📊 Результаты тестов регресса:');
      console.log('=====================================');
      
      let passedCount = 0;
      let failedCount = 0;
      
      results.forEach((result) => {
        const status = result.passed ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} ${result.name}`);
        
        if (!result.passed && result.error) {
          console.log(`   Ошибка: ${result.error}`);
        }
        
        if (result.passed) {
          passedCount++;
        } else {
          failedCount++;
        }
      });
      
      console.log('=====================================');
      console.log(`Всего тестов: ${results.length}`);
      console.log(`Прошло: ${passedCount}`);
      console.log(`Провалено: ${failedCount}`);
      
      if (failedCount === 0) {
        console.log('\n🎉 Все тесты прошли успешно!');
        process.exit(0);
      } else {
        console.log('\n💥 Некоторые тесты провалились!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('💥 Критическая ошибка при запуске тестов:', error);
      process.exit(1);
    });
}

export { runRegressionTests };
