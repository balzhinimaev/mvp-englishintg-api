# Модули API - Документация

## Обзор

API для получения списка учебных модулей с контролем доступа и прогрессом пользователя.

---

## Onboarding API

### Сохранение целей обучения

```
POST /api/v2/profile/learning-goals
```

Request:

```json
{
  "userId": 123,
  "goals": ["work_career", "travel"]
}
```

Response 200:

```json
{ "ok": true }
```

Ограничения:
- `goals[]` допускает значения: `work_career | study_exams | travel | communication | entertainment | relocation | curiosity`

### Сохранение ежедневной цели

```
POST /api/v2/profile/daily-goal
```

Request:

```json
{
  "userId": 123,
  "dailyGoalMinutes": 10,
  "allowsNotifications": true
}
```

Response 200:

```json
{ "ok": true }
```

Ограничения:
- `dailyGoalMinutes` ∈ {5, 10, 15, 20}
- `allowsNotifications` — глобальный флаг уведомлений

### Сохранение настроек напоминаний

```
POST /api/v2/profile/reminder-settings
```

Request:

```json
{
  "userId": 123,
  "reminderSettings": {
    "enabled": true,
    "time": "evening",
    "allowsNotifications": true
  }
}
```

Response 200:

```json
{ "ok": true }
```

Ограничения:
- `time` ∈ {`morning`, `afternoon`, `evening`}
- если указан `allowsNotifications`, обновляет глобальный флаг

### Завершение онбординга

```
PATCH /api/v2/profile/onboarding/complete
```

Request:

```json
{
  "userId": 123,
  "proficiencyLevel": "intermediate"
}
```

Response 200:

```json
{ "ok": true }
```

Заметки:
- Поддерживается обратная совместимость через `englishLevel` (A1–C2) — будет сохранено в поле `englishLevel`.
- Вызов идемпотентен: повторный PATCH возвращает `{ ok: true }` и обновляет только переданные поля.

## Endpoint

```
GET /api/v2/content/modules
```

## Query Parameters

| Параметр | Тип | Обязательный | Описание |
|----------|-----|-------------|----------|
| `userId` | number | Нет | ID пользователя для получения персонального прогресса и прав доступа |
| `level` | string | Нет | Фильтр по уровню (A0, A1, A2, B1, B2, C1, C2) |
| `lang` | string | Нет | Язык локализации (ru, en). По умолчанию: ru |

## Response Format

### Успешный ответ (200)

```json
{
  "modules": [
    {
      "moduleRef": "string",        // Уникальный идентификатор модуля (a0.basics)
      "level": "string",           // Уровень сложности (A0-C2)
      "title": "string",           // Название модуля на выбранном языке
      "description": "string",     // Описание модуля
      "tags": ["string"],          // Тематические теги
      "order": number,             // Порядок в уровне (1, 2, 3...)
      "progress": {                // Прогресс пользователя (только если userId указан)
        "completed": number,       // Завершенные уроки
        "total": number,           // Всего уроков
        "inProgress": number       // Уроки в процессе
      },
      "requiresPro": boolean,      // Требует ли подписки PRO
      "isAvailable": boolean       // Доступен ли пользователю
    }
  ]
}
```

## Бизнес-логика доступа

### Правила платности модулей

1. **Первый модуль каждого уровня** (`order = 1`) - **БЕСПЛАТНЫЙ** для всех пользователей
2. **Остальные модули** (`order > 1`) - требуют **активной PRO-подписки**

### Статус подписки

- Проверяется поле `user.pro.active = true`
- Если подписка активна - доступ ко **всем модулям**
- Если подписки нет - доступ только к первым модулям каждого уровня

### Требование авторизации

- `userId` берётся из JWT
- Если `userId` отсутствует, API возвращает ошибку 400

## Примеры запросов

### Получить все модули уровня A0
```
GET /api/v2/content/modules?level=A0&lang=ru
```

### Получить модули с прогрессом пользователя
```
GET /api/v2/content/modules?level=A1&lang=ru
```

## Примеры ответов

### Для авторизованного пользователя с PRO

```json
{
  "modules": [
    {
      "moduleRef": "a0.basics",
      "level": "A0",
      "title": "Основы A0",
      "description": "Приветствие, числа, время",
      "tags": ["basics"],
      "order": 1,
      "progress": { "completed": 2, "total": 3, "inProgress": 1 },
      "requiresPro": false,
      "isAvailable": true
    },
    {
      "moduleRef": "a0.travel",
      "level": "A0",
      "title": "Путешествия A0",
      "description": "Основы путешествий",
      "tags": ["travel"],
      "order": 2,
      "progress": { "completed": 0, "total": 4, "inProgress": 0 },
      "requiresPro": true,
      "isAvailable": true
    }
  ]
}
```

### Для авторизованного пользователя без PRO

```json
{
  "modules": [
    {
      "moduleRef": "a0.basics",
      "level": "A0",
      "title": "Основы A0",
      "description": "Приветствие, числа, время",
      "tags": ["basics"],
      "order": 1,
      "progress": { "completed": 2, "total": 3, "inProgress": 1 },
      "requiresPro": false,
      "isAvailable": true
    },
    {
      "moduleRef": "a0.travel",
      "level": "A0",
      "title": "Путешествия A0",
      "description": "Основы путешествий",
      "tags": ["travel"],
      "order": 2,
      "progress": { "completed": 0, "total": 4, "inProgress": 0 },
      "requiresPro": true,
      "isAvailable": false
    }
  ]
}
```

### Для анонимного пользователя

```json
{
  "modules": [
    {
      "moduleRef": "a0.basics",
      "level": "A0",
      "title": "Основы A0",
      "description": "Приветствие, числа, время",
      "tags": ["basics"],
      "order": 1,
      "requiresPro": false,
      "isAvailable": true
    },
    {
      "moduleRef": "a0.travel",
      "level": "A0",
      "title": "Путешествия A0",
      "description": "Основы путешествий",
      "tags": ["travel"],
      "order": 2,
      "requiresPro": true,
      "isAvailable": false
    }
  ]
}
```

## Фронтенд интеграция

### Логика отображения

1. **Показывать все модули** - пользователь должен видеть весь доступный контент
2. **Индикация платности** - добавлять значок/текст "PRO" на платных модулях
3. **Блокировка доступа** - неактивные модули должны быть визуально заблокированы
4. **Показ прогресса** - отображать полоску прогресса для активных модулей

### Обработка кликов

```typescript
function handleModuleClick(module: Module) {
  if (module.isAvailable) {
    // Переход к списку уроков модуля
    navigate(`/modules/${module.moduleRef}`);
  } else {
    // Показ экрана подписки
    navigate('/paywall');
  }
}
```

### UI состояния

- **Доступный модуль**: обычный вид, кликабельный
- **Платный модуль**: затемнение + иконка замка + текст "Требуется подписка"
- **Модуль с прогрессом**: полоска прогресса + счетчик "2/5 уроков"

## Мониторинг и аналитика

### Метрики для отслеживания

1. **Показы модулей** - сколько раз показывается каждый модуль
2. **Клики по модулям** - конверсия в клики
3. **Переходы в paywall** - сколько пользователей кликают на платные модули
4. **Конверсия в подписку** - процент пользователей, купивших подписку после просмотра paywall

### Рекомендуемые события аналитики

```typescript
// Показ модуля
analytics.track('module_view', {
  moduleRef: 'a0.travel',
  userId: 12345,
  requiresPro: true,
  isAvailable: false
});

// Клик по модулю
analytics.track('module_click', {
  moduleRef: 'a0.travel',
  userId: 12345,
  requiresPro: true,
  isAvailable: false,
  action: 'paywall_shown' // или 'module_opened'
});
```

## Технические детали

### Производительность

- **Кэширование**: модули можно кэшировать на 5-10 минут
- **Индексы**: обеспечены индексы по `level`, `order`, `published`
- **Оптимизация**: запросы к базе объединены для минимизации обращений

### Обработка ошибок

```json
// 401 Unauthorized
{
  "error": "Authentication required"
}

// 500 Internal Server Error
{
  "error": "Failed to load modules"
}
```

### Лимиты

- Максимум 50 модулей на уровень
- Таймаут запроса: 5 секунд
- Rate limiting: 100 запросов в минуту на пользователя

---

*Последнее обновление: 2024-12-19*
