# 🔒 Состояние безопасности API

Актуализировано 2026-07-06 (после аудита). Исторический документ про «JWT не используется» устарел и заменён — JWT активирован на всех защищённых эндпоинтах.

## ✅ Реализовано

1. **JWT везде**: все content/progress/profile/entitlements/payments-эндпоинты под `JwtAuthGuard`; публичные эндпоинты помечены `PublicGuard` осознанно.
2. **Telegram initData**: HMAC по спецификации (`HMAC_SHA256("WebAppData", bot_token)`), `timingSafeEqual`, TTL 24ч по `auth_date`; JWT-секрет принудительно ≥32 символов.
3. **Legacy-guard'ы удалены** (2026-07-06): `TelegramAuthGuard` и `OptionalUserGuard` (доверяли `userId` из query/body — IDOR-механика) удалены из кодовой базы. Мёртвые эндпоинты с захардкоженными ценами (`GET /content/lesson1`, `GET /content/paywall`) удалены.
4. **Гейтинг PRO** — по активному entitlement (`endsAt > now`) в `ContentService.hasActivePro`; денормализованный `user.pro.active` в выдаче доступа не участвует.
5. **Платежи**: вебхук YooKassa берёт из тела только providerId+eventType, статус/сумма перепроверяются напрямую в YooKassa API, идемпотентная транзакционная выдача; nginx-allowlist по IP YooKassa на location вебхука; reconcile-эндпоинт под JWT с проверкой владельца.
6. **Rate limiting**: @nestjs/throttler 300/60с глобально, 8–10/мин на register/login; `trust proxy 1`.
7. **CORS** — whitelist доменов в проде; Swagger в проде выключен; ответы заданий (correctIndex/answer/expected) срезаются презентером.
8. Глобальный `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })` + строгие DTO в content/progress/auth.

## ⚠️ Известные остатки (Фаза 2 роадмапа аудита 2026-07-06)

1. **Inline-типы вместо DTO-классов** — ValidationPipe не срабатывает: `POST /leads/bot_start` (публичный, анонимный upsert лида по любому userId), `POST /events`, `POST /progress/sessions/*` (клиентский `extraXp`), `POST /promo/redeem`, `PATCH /profile/*` (whitelist руками, но элементы `learningGoals` не проверяются), `YooKassaWebhookDto` без декораторов. → Конвертировать в классы с class-validator.
2. **`GET /auth/verify` принимает initData в query** — hash/user оседают в access-логах nginx. → Перевести на POST с телом.
3. **`GET /auth/onboarding/status/:userId` публичен** — уровень/цели перечислимы по Telegram ID. → Закрыть JWT или убрать.
4. **PII в логах**: вебхук логирует полные headers+body, `createPayment` — paymentData с email, лог успеха — имя/фамилию. → Вычистить/маскировать.
5. **Подпись вебхука YooKassa не проверяется** (компенсировано перепроверкой через API + nginx IP-allowlist); IP-проверка в коде опирается на `x-forwarded-for`. → Использовать `req.ip`.
6. **`OnboardingGuard`** читает userId из query/body, а не из `req.user` — противоречит JWT-модели.
7. Нет глобального exception filter — часть эндпоинтов отвечает `200 {error}` вместо HTTP-ошибок.
8. Чек 54-ФЗ уходит на фейковый email `user_<id>@burlive.ru` при отсутствии реального.
