# API Documentation: POST /payments/create

## Общая информация

**Endpoint:** `POST /payments/create`  
**HTTP Status Code (Success):** `201 Created`  
**Требуется аутентификация:** Да (JWT Bearer Token)

Создает новый платеж через YooKassa API и возвращает URL для оплаты. `userId` автоматически извлекается из JWT токена, что защищает от IDOR (Insecure Direct Object Reference) атак.

---

## Заголовки запроса

### Обязательные заголовки

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Authorization:**
- Тип: Bearer Token
- Формат: `Bearer <jwt-token>`
- Описание: JWT токен, полученный через `/auth/verify` после Telegram аутентификации
- Токен содержит `userId` в payload

**Content-Type:**
- Должен быть: `application/json`

---

## Тело запроса

```json
{
  "product": "monthly",
  "returnUrl": "https://burlive.ru/payment/success",
  "description": "Инглиш в ТГ - месячная подписка (30 дней) • 299 ₽"
}
```

### Параметры запроса

| Параметр | Тип | Обязательный | Описание | Допустимые значения |
|----------|-----|--------------|----------|---------------------|
| `product` | string | ✅ Да | Тип подписки | `"monthly"`, `"quarterly"`, `"yearly"` |
| `returnUrl` | string | ✅ Да | URL для возврата после оплаты | Любой валидный URL (например: `https://burlive.ru/payment/success`) |
| `description` | string | ❌ Нет | Описание платежа | Любая строка. Если не указано, генерируется автоматически |

**Примечание:** `userId` НЕ передается в теле запроса - он извлекается из JWT токена автоматически.

---

## Успешный ответ

**HTTP Status:** `201 Created`

```json
{
  "paymentUrl": "https://yoomoney.ru/api-pages/v2/payment-confirm/epl?orderId=23d93cac-000f-5000-8000-126628f15141",
  "paymentId": "23d93cac-000f-5000-8000-126628f15141"
}
```

### Поля ответа

| Поле | Тип | Описание |
|------|-----|----------|
| `paymentUrl` | string | URL для перенаправления пользователя на страницу оплаты YooKassa |
| `paymentId` | string | Уникальный ID платежа в YooKassa (UUID формат) |

---

## Ошибки и коды ответов

### 1. Ошибки аутентификации (401 Unauthorized)

#### 1.1. Отсутствует токен

**Статус:** `401 Unauthorized`

**Условие:** Заголовок `Authorization` отсутствует или имеет неверный формат

**Ответ:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

#### 1.2. Неверный или истекший токен

**Статус:** `401 Unauthorized`

**Условие:** JWT токен невалиден, истек или не может быть расшифрован

**Ответ:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

#### 1.3. Пользователь не найден в базе данных

**Статус:** `401 Unauthorized`

**Условие:** `userId` из JWT токена не существует в базе данных

**Ответ:**
```json
{
  "statusCode": 401,
  "message": "User not found"
}
```

---

### 2. Ошибки валидации (400 Bad Request)

#### 2.1. Невалидный формат запроса

**Статус:** `400 Bad Request`

**Условие:** Тело запроса не соответствует схеме или содержит недопустимые поля

**Примеры:**
- Отсутствует обязательное поле `product`
- Отсутствует обязательное поле `returnUrl`
- `product` имеет значение не из списка допустимых
- `product` не является строкой
- `returnUrl` не является строкой
- Присутствуют неизвестные поля (если `forbidNonWhitelisted: true`)

**Ответ:**
```json
{
  "statusCode": 400,
  "message": [
    "product must be one of the following values: monthly, quarterly, yearly",
    "returnUrl must be a string",
    "property should not exist"
  ],
  "error": "Bad Request"
}
```

#### 2.2. Пользователь не найден

**Статус:** `400 Bad Request`

**Условие:** Пользователь с `userId` из JWT токена не найден в базе данных (несмотря на валидный токен)

**Ответ:**
```json
{
  "statusCode": 400,
  "message": "User not found"
}
```

#### 2.3. Превышен лимит незавершенных платежей

**Статус:** `400 Bad Request`

**Условие:** У пользователя уже есть 10 или более незавершенных платежей за последние 5 минут

**Ответ:**
```json
{
  "statusCode": 400,
  "message": "Too many pending payments. Please wait before creating a new one."
}
```

**Логика rate limiting:**
- Проверяются платежи со статусом `pending`
- Временное окно: последние 5 минут (`createdAt >= now - 5 minutes`)
- Лимит: 10 платежей

#### 2.4. Невалидный тип продукта (внутренняя ошибка)

**Статус:** `400 Bad Request`

**Условие:** Значение `product` не соответствует ожидаемым значениям (не должно происходить при корректной валидации DTO)

**Ответ:**
```json
{
  "statusCode": 400,
  "message": "Invalid product type"
}
```

#### 2.5. YooKassa credentials не настроены

**Статус:** `400 Bad Request`

**Условие:** Не настроены учетные данные YooKassa (отсутствуют `YOOKASSA_SHOP_ID` или `YOOKASSA_SECRET_KEY`)

**Ответ:**
```json
{
  "statusCode": 400,
  "message": "YooKassa credentials not configured"
}
```

#### 2.6. Ошибка создания платежа в YooKassa API

**Статус:** `400 Bad Request`

**Условие:** YooKassa API вернул ошибку при создании платежа

**Ответ:**
```json
{
  "statusCode": 400,
  "message": "Payment creation failed: <HTTP_STATUS_CODE>"
}
```

**Возможные причины:**
- Неверные учетные данные магазина
- Превышен лимит запросов к YooKassa API
- Невалидные данные платежа (сумма, валюта, etc.)
- Проблемы на стороне YooKassa

**Логи:** Подробная информация об ошибке записывается в лог приложения

#### 2.7. Общая ошибка создания платежа

**Статус:** `400 Bad Request`

**Условие:** Произошла неожиданная ошибка при создании платежа (catch-all)

**Ответ:**
```json
{
  "statusCode": 400,
  "message": "Failed to create payment"
}
```

**Примечание:** Детальная информация об ошибке записывается в лог приложения

---

### 3. Ошибки сервера (500 Internal Server Error)

**Статус:** `500 Internal Server Error`

**Условие:** Внутренняя ошибка сервера (например, ошибка подключения к базе данных, неожиданное исключение)

**Ответ:**
```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

---

## Логика работы

### 1. Аутентификация
- `JwtAuthGuard` проверяет наличие и валидность JWT токена
- `userId` извлекается из payload токена (`req.user.userId`)
- Проверяется существование пользователя в базе данных

### 2. Валидация входных данных
- `ValidationPipe` проверяет соответствие DTO
- Проверяется наличие обязательных полей
- Проверяется корректность значений (`product` из списка допустимых)

### 3. Rate Limiting
- Проверяется количество незавершенных платежей за последние 5 минут
- Максимум: 10 платежей

### 4. Расчет цены
- Определяется когорта пользователя на основе:
  - Количества пройденных уроков
  - Наличия активной подписки
  - Статуса онбординга
  - Даты последней активности
  - `userId` (для определения тестовых пользователей)
- Получается ценообразование для когорты
- Выбирается цена для указанного `product`

### 5. Создание платежа в YooKassa
- Генерируется уникальный ключ идемпотентности
- Формируется запрос к YooKassa API:
  - Сумма в рублях (цена в копейках / 100)
  - Описание платежа (автоматически или из запроса)
  - Email пользователя для чека (или fallback `user_{userId}@burlive.ru`)
  - Метаданные: `userId`, `product`, `cohort`
- Отправляется POST запрос к `https://api.yookassa.ru/v3/payments`

### 6. Сохранение в базу данных
- Создается запись `Payment` со статусом `pending`
- Сохраняется `paymentId`, `providerId`, `idempotencyKey`

### 7. Логирование
- Создается событие `payment_created` в коллекции `events`
- Отправляется лог создания платежа в Bot API (если настроено)

### 8. Возврат результата
- Возвращается `paymentUrl` и `paymentId`

---

## Типы подписок

| Тип | Длительность | Описание |
|-----|--------------|----------|
| `monthly` | 30 дней | Месячная подписка |
| `quarterly` | 90 дней | Квартальная подписка |
| `yearly` | 365 дней | Годовая подписка |

---

## Примеры запросов

### Пример 1: Создание месячной подписки

**Запрос:**
```bash
curl -X POST https://burlive.ru/payments/create \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "product": "monthly",
    "returnUrl": "https://burlive.ru/payment/success"
  }'
```

**Ответ:**
```json
{
  "paymentUrl": "https://yoomoney.ru/api-pages/v2/payment-confirm/epl?orderId=23d93cac-000f-5000-8000-126628f15141",
  "paymentId": "23d93cac-000f-5000-8000-126628f15141"
}
```

### Пример 2: Создание квартальной подписки с описанием

**Запрос:**
```bash
curl -X POST https://burlive.ru/payments/create \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "product": "quarterly",
    "returnUrl": "https://burlive.ru/payment/success",
    "description": "Квартальная подписка на BurLive"
  }'
```

### Пример 3: Ошибка - отсутствует токен

**Запрос:**
```bash
curl -X POST https://burlive.ru/payments/create \
  -H "Content-Type: application/json" \
  -d '{
    "product": "monthly",
    "returnUrl": "https://burlive.ru/payment/success"
  }'
```

**Ответ:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### Пример 4: Ошибка - невалидный product

**Запрос:**
```bash
curl -X POST https://burlive.ru/payments/create \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "product": "invalid",
    "returnUrl": "https://burlive.ru/payment/success"
  }'
```

**Ответ:**
```json
{
  "statusCode": 400,
  "message": [
    "product must be one of the following values: monthly, quarterly, yearly"
  ],
  "error": "Bad Request"
}
```

---

## Интеграция с фронтендом

### Типичный поток:

1. **Получение JWT токена:**
   ```javascript
   const authResponse = await fetch('/auth/verify?user=...');
   const { accessToken } = await authResponse.json();
   ```

2. **Создание платежа:**
   ```javascript
   const paymentResponse = await fetch('/payments/create', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${accessToken}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       product: 'monthly',
       returnUrl: 'https://burlive.ru/payment/success'
     })
   });
   
   if (!paymentResponse.ok) {
     const error = await paymentResponse.json();
     console.error('Payment creation failed:', error);
     return;
   }
   
   const { paymentUrl, paymentId } = await paymentResponse.json();
   ```

3. **Перенаправление на оплату:**
   ```javascript
   window.location.href = paymentUrl;
   ```

4. **После оплаты пользователь возвращается на `returnUrl`**

5. **Проверка статуса платежа:**
   ```javascript
   const statusResponse = await fetch(`/payments/status?paymentId=${paymentId}`);
   const { status, paid } = await statusResponse.json();
   ```

6. **Webhook автоматически обновит подписку при успешной оплате**

---

## Особенности

### Автоматическое описание платежа

Если `description` не указан, генерируется автоматически:
- Формат: `"Инглиш в ТГ - {тип} подписка ({длительность}) • {цена} ₽"`
- Пример: `"Инглиш в ТГ - месячная подписка (30 дней) • 299 ₽"`

Для тестовых платежей (10₽):
- Формат: `"[ТЕСТ] Инглиш в ТГ - {тип} подписка ({длительность}) • 10 ₽"`

### Система ценообразования

Цена определяется динамически на основе:
- Когорты пользователя
- Настроек скидок в базе данных
- Типа подписки

Тестовые пользователи (userId содержит "test" или равен "1272270574"):
- Всегда получают цену 10₽ (1000 копеек) независимо от типа подписки

### Идемпотентность

Каждый запрос создает уникальный ключ идемпотентности:
- Формат: `payment_{userId}_{timestamp}_{random}`
- Предотвращает создание дубликатов платежей

### Метаданные платежа

В YooKassa сохраняются метаданные:
- `userId` - ID пользователя
- `product` - тип подписки
- `cohort` - когорта пользователя для аналитики

---

## Безопасность

### Защита от IDOR
- `userId` НЕ принимается в запросе
- `userId` извлекается из JWT токена
- Невозможно создать платеж для другого пользователя

### Rate Limiting
- Максимум 10 незавершенных платежей за 5 минут
- Защита от злоупотреблений API

### Валидация
- Строгая валидация входных данных через DTO
- Проверка типов и допустимых значений
- Удаление неизвестных полей (whitelist)

---

## Логирование

При создании платежа логируется:
- Детали платежа (описание, сумма, когорта)
- ID платежа в YooKassa
- Статус создания
- Ошибки (если есть)

События в базе данных:
- `payment_created` - создание платежа с полной информацией о цене и когорте

---

## Тестирование

Для тестирования используйте userId, содержащий "test":
- Например: `test_user_123`, `user_test_456`
- Или специальный ID: `1272270574`

Тестовые платежи всегда имеют цену 10₽ независимо от типа подписки.

