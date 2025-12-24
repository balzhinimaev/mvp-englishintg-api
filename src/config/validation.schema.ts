import * as Joi from 'joi';

/**
 * Схема валидации переменных окружения
 * При запуске приложения проверяет наличие обязательных переменных
 */
export const validationSchema = Joi.object({
  // Обязательные переменные
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  
  PORT: Joi.number().default(7777),
  
  MONGODB_URI: Joi.string()
    .required()
    .description('URI подключения к MongoDB'),
  
  MONGODB_DB_NAME: Joi.string()
    .default('burlang-db')
    .description('Название базы данных MongoDB'),
  
  JWT_SECRET: Joi.string()
    .required()
    .min(32)
    .description('Секретный ключ для подписи JWT токенов (минимум 32 символа)'),
  
  TELEGRAM_BOT_TOKEN: Joi.string()
    .required()
    .description('Токен Telegram бота для верификации init data'),
  
  // Опциональные переменные
  // YooKassa платежи (опционально, требуются только если используется функционал платежей)
  YOOKASSA_MODE: Joi.string()
    .valid('test', 'production')
    .default('production')
    .description('Режим работы YooKassa: test (тестовый магазин) или production (боевой магазин)'),
  
  YOOKASSA_SHOP_ID: Joi.string()
    .optional()
    .description('ID магазина в YooKassa для production режима (требуется для работы платежей)'),
  
  YOOKASSA_SECRET_KEY: Joi.string()
    .optional()
    .description('Секретный ключ YooKassa для production режима (требуется для работы платежей)'),
  
  YOOKASSA_TEST_SHOP_ID: Joi.string()
    .optional()
    .description('ID тестового магазина в YooKassa для test режима'),
  
  YOOKASSA_TEST_SECRET_KEY: Joi.string()
    .optional()
    .description('Секретный ключ тестового магазина YooKassa для test режима'),
  
  YOOKASSA_API_URL: Joi.string()
    .uri()
    .default('https://api.yookassa.ru/v3')
    .description('URL API YooKassa'),
  SELF_EMPLOYED_INN: Joi.string()
    .optional()
    .description('ИНН самозанятого для автоматической регистрации чеков в "Мой налог"'),
  
  BOT_API_URL: Joi.string()
    .uri()
    .optional()
    .description('URL API бота для логирования платежей'),
  
  BOT_API_KEY: Joi.string()
    .optional()
    .description('API ключ для авторизации запросов к боту'),
  
  // Дополнительные переменные для скриптов
  PROGRESS_CLEANUP_INTERVAL_MS: Joi.number()
    .default(60000)
    .description('Интервал очистки устаревших сессий (в миллисекундах)'),
  
  PROGRESS_SESSION_TTL_MINUTES: Joi.number()
    .default(30)
    .description('Время жизни сессии прогресса (в минутах)'),
});

