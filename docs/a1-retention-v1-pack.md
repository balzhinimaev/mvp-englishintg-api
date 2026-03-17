# A1.1 Retention v1 — Acceptance Pack

Проверка review/checkpoint уроков:
- `a1.intro.007-008`
- `a1.food.007-008`
- `a1.directions.007-008`
- `a1.routines.007-008`

## Автозапуск

```bash
BASE_URL=http://127.0.0.1:7788 \
API_PREFIX='' \
MONGODB_URI='mongodb://admin:***@127.0.0.1:27017/englishintg?authSource=admin&directConnection=true' \
npm run accept:a1:retention
```

## Критерии

- 8/8 positive
- 3/3 negative
- Нет 5xx в `/progress/submit-answer`
- После теста `published` флаги восстановлены
