# Переменные окружения

Документация по всем переменным окружения, используемым в проекте Burlive API.

## Быстрый старт

1. Скопируйте пример конфигурации:
   ```bash
   cp .env.example .env
   ```

2. Заполните обязательные переменные в файле `.env`

3. Запустите приложение

## Обязательные переменные

Эти переменные должны быть установлены для работы приложения:

### `NODE_ENV`
- **Тип**: `string`
- **Значения**: `development` | `production` | `test`
- **По умолчанию**: `development`
- **Описание**: Окружение приложения

### `PORT`
- **Тип**: `number`
- **По умолчанию**: `7777`
- **Описание**: Порт, на котором будет запущен сервер

### `MONGODB_URI`
- **Тип**: `string`
- **Обязательно**: Да
- **Пример**: `mongodb://localhost:27017` или `mongodb+srv://user:password@cluster.mongodb.net`
- **Описание**: URI подключения к MongoDB

### `MONGODB_DB_NAME`
- **Тип**: `string`
- **По умолчанию**: `englishintg`
- **Описание**: Название базы данных MongoDB

### `JWT_SECRET`
- **Тип**: `string`
- **Обязательно**: Да
- **Минимум**: 32 символа
- **Описание**: Секретный ключ для подписи JWT токенов
- **Генерация**: `openssl rand -base64 32`

### `TELEGRAM_BOT_TOKEN`
- **Тип**: `string`
- **Обязательно**: Да
- **Описание**: Токен Telegram бота для верификации init data
- **Получение**: У @BotFather в Telegram

## Опциональные переменные

### `YOOKASSA_MODE`
- **Тип**: `string`
- **Значения**: `test` | `production`
- **По умолчанию**: `production`
- **Описание**: Режим работы YooKassa: `test` (тестовый магазин) или `production` (боевой магазин)
- **Примечание**: В зависимости от режима используются разные credentials (см. ниже)

### `YOOKASSA_SHOP_ID`
- **Тип**: `string`
- **Обязательно**: Нет
- **Описание**: ID магазина в YooKassa для production режима
- **Где найти**: В личном кабинете YooKassa
- **Примечание**: Используется только когда `YOOKASSA_MODE=production`. Требуется только если используется функционал платежей YooKassa. Если не указан, методы создания платежей будут возвращать ошибку "YooKassa credentials not configured"

### `YOOKASSA_SECRET_KEY`
- **Тип**: `string`
- **Обязательно**: Нет
- **Описание**: Секретный ключ YooKassa для production режима
- **Где найти**: В личном кабинете YooKassa
- **Примечание**: Используется только когда `YOOKASSA_MODE=production`. Требуется только если используется функционал платежей YooKassa. Если не указан, методы создания платежей будут возвращать ошибку "YooKassa credentials not configured"

### `YOOKASSA_TEST_SHOP_ID`
- **Тип**: `string`
- **Обязательно**: Нет
- **Описание**: ID тестового магазина в YooKassa для test режима
- **Где найти**: В личном кабинете YooKassa (тестовый магазин)
- **Примечание**: Используется только когда `YOOKASSA_MODE=test`

### `YOOKASSA_TEST_SECRET_KEY`
- **Тип**: `string`
- **Обязательно**: Нет
- **Описание**: Секретный ключ тестового магазина YooKassa для test режима
- **Где найти**: В личном кабинете YooKassa (тестовый магазин)
- **Примечание**: Используется только когда `YOOKASSA_MODE=test`

### `YOOKASSA_API_URL`
- **Тип**: `string`
- **По умолчанию**: `https://api.yookassa.ru/v3`
- **Описание**: URL API YooKassa

### `SELF_EMPLOYED_INN`
- **Тип**: `string`
- **Обязательно**: Нет
- **Описание**: ИНН самозанятого для автоматической регистрации чеков в "Мой налог"
- **Важно**: Убедитесь, что в личном кабинете YooKassa настроено разрешение на регистрацию чеков для самозанятого с данным ИНН

### `BOT_API_URL`
- **Тип**: `string`
- **Обязательно**: Нет
- **Описание**: URL API бота для логирования платежей
- **Примечание**: Если не указан, логирование платежей в бот отключено

### `BOT_API_KEY`
- **Тип**: `string`
- **Обязательно**: Нет
- **Описание**: API ключ для авторизации запросов к боту
- **Примечание**: Используется вместе с `BOT_API_URL`

### `PROGRESS_CLEANUP_INTERVAL_MS`
- **Тип**: `number`
- **По умолчанию**: `60000` (1 минута)
- **Описание**: Интервал очистки устаревших сессий прогресса (в миллисекундах)

### `PROGRESS_SESSION_TTL_MINUTES`
- **Тип**: `number`
- **По умолчанию**: `30`
- **Описание**: Время жизни сессии прогресса (в минутах)

## Пример файла .env

```env
# Окружение
NODE_ENV=development
PORT=7777

# База данных
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=englishintg

# Аутентификация
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Платежи YooKassa (опционально, требуются только если используется функционал платежей)
# Режим работы: test (тестовый магазин) или production (боевой магазин)
YOOKASSA_MODE=production

# Production магазин (используется когда YOOKASSA_MODE=production)
# YOOKASSA_SHOP_ID=123456
# YOOKASSA_SECRET_KEY=live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Test магазин (используется когда YOOKASSA_MODE=test)
# YOOKASSA_TEST_SHOP_ID=123456
# YOOKASSA_TEST_SECRET_KEY=test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# URL API YooKassa (по умолчанию https://api.yookassa.ru/v3)
# YOOKASSA_API_URL=https://api.yookassa.ru/v3

# ИНН самозанятого для автоматической регистрации чеков в "Мой налог"
# SELF_EMPLOYED_INN=123456789012

# API бота (опционально)
# BOT_API_URL=https://your-bot-api-domain.com
# BOT_API_KEY=your-bot-api-key-here

# Дополнительные настройки
# PROGRESS_CLEANUP_INTERVAL_MS=60000
# PROGRESS_SESSION_TTL_MINUTES=30
```

## Валидация

При запуске приложения автоматически проверяется наличие всех обязательных переменных окружения. Если какая-то обязательная переменная отсутствует или имеет неверный формат, приложение не запустится и выведет ошибку.

## Использование в коде

Рекомендуется использовать `ConfigService` из `@nestjs/config` вместо прямого доступа к `process.env`:

```typescript
import { ConfigService } from '@nestjs/config';

constructor(private readonly configService: ConfigService) {}

// Получение значения
const dbUri = this.configService.get<string>('app.database.uri');
const jwtSecret = this.configService.get<string>('app.auth.jwtSecret');
```

## Безопасность

⚠️ **ВАЖНО**: 
- Никогда не коммитьте файл `.env` в репозиторий
- Используйте разные значения для `development` и `production`
- Регулярно обновляйте секретные ключи
- Используйте длинные случайные строки для `JWT_SECRET` (минимум 32 символа)

