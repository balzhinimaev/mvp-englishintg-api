// scripts/seed-pricing-data.js
// Запустить: node scripts/seed-pricing-data.js

// Подключение к базе данных (замените на ваши настройки)
db = db.getSiblingDB('englishintg'); // Используем имя БД из app.module.ts

// Очистка существующих данных (опционально)
print('🧹 Очищаем существующие данные...');
db.cohortpricings.deleteMany({});

// Вставка настроек когорт
print('📊 Добавляем настройки ценообразования...');
const result = db.cohortpricings.insertMany([
  {
    cohortName: 'default',
    monthlyDiscount: 10,
    quarterlyDiscount: 20,
    yearlyDiscount: 17,
    promoCode: 'DEFAULT10',
    isActive: true,
    description: 'Базовые скидки для обычных пользователей',
    updatedBy: 'system',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    cohortName: 'new_user',
    monthlyDiscount: 15,
    quarterlyDiscount: 20,
    yearlyDiscount: 25,
    promoCode: 'WELCOME15',
    isActive: true,
    description: 'Умеренные скидки для новых пользователей',
    updatedBy: 'system',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    cohortName: 'returning_user',
    monthlyDiscount: 15,
    quarterlyDiscount: 20,
    yearlyDiscount: 25,
    promoCode: 'COMEBACK15',
    isActive: true,
    description: 'Скидки для возвращающихся пользователей',
    updatedBy: 'system',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    cohortName: 'premium_trial',
    monthlyDiscount: 50,
    quarterlyDiscount: 55,
    yearlyDiscount: 60,
    promoCode: 'TRIAL50',
    isActive: true,
    description: 'Скидки для пользователей с истекшей премиум подпиской',
    updatedBy: 'system',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    cohortName: 'high_engagement',
    monthlyDiscount: 20,
    quarterlyDiscount: 25,
    yearlyDiscount: 30,
    promoCode: 'ACTIVE20',
    isActive: true,
    description: 'Скидки для активных пользователей',
    updatedBy: 'system',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    cohortName: 'low_engagement',
    monthlyDiscount: 40,
    quarterlyDiscount: 45,
    yearlyDiscount: 50,
    promoCode: 'BOOST40',
    isActive: true,
    description: 'Скидки для пользователей с низкой активностью',
    updatedBy: 'system',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    cohortName: 'churned',
    monthlyDiscount: 60,
    quarterlyDiscount: 65,
    yearlyDiscount: 70,
    promoCode: 'WINBACK60',
    isActive: true,
    description: 'Скидки для возврата ушедших пользователей',
    updatedBy: 'system',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    cohortName: 'test_payment',
    monthlyDiscount: 99,
    quarterlyDiscount: 99,
    yearlyDiscount: 99,
    promoCode: 'TEST10',
    isActive: true,
    description: 'Тестовые платежи - символическая цена',
    updatedBy: 'system',
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

// Создание индексов для оптимизации
print('🔍 Создаем индексы...');
db.cohortpricings.createIndex({ cohortName: 1, isActive: 1 });
db.cohortpricings.createIndex({ isActive: 1 });

print('✅ Данные для ценообразования успешно добавлены!');
print(`📊 Добавлено ${result.insertedIds.length} записей`);

// Показываем добавленные данные
print('\n📋 Добавленные когорты:');
db.cohortpricings.find({}, { cohortName: 1, monthlyDiscount: 1, quarterlyDiscount: 1, yearlyDiscount: 1, promoCode: 1 }).forEach(printjson);
