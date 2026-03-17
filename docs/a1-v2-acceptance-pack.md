# A1 v2 — Acceptance Pack

Цель: проверить новую A1 программу (24 урока) end-to-end через `/progress/submit-answer`.

## Scope

- Модули: `a1.intro`, `a1.food`, `a1.directions`, `a1.routines`
- Проверка: 15 positive + 3 negative кейса
- Файл векторов: `docs/a1-v2-acceptance-cases.json`

## Автозапуск

```bash
BASE_URL=http://127.0.0.1:7788 \
API_PREFIX='' \
MONGODB_URI='mongodb://admin:***@127.0.0.1:27017/englishintg?authSource=admin&directConnection=true' \
ACCEPTANCE_FORCE_PUBLISH=true \
ACCEPTANCE_MODULE_REFS=a1.intro,a1.food,a1.directions,a1.routines \
CASES_PATH=docs/a1-v2-acceptance-cases.json \
LESSON_SEED_PATH=seeds/content.json \
npm run accept:phase1:v3
```

или коротко:

```bash
BASE_URL=http://127.0.0.1:7788 \
API_PREFIX='' \
MONGODB_URI='mongodb://admin:***@127.0.0.1:27017/englishintg?authSource=admin&directConnection=true' \
npm run accept:a1:v2
```

## Release Gate (A1 v2)

- 15/15 positive кейсов проходят
- 3/3 negative кейсов корректно падают
- Нет 5xx на `/progress/submit-answer`
- Session start/end проходят стабильно
- После теста published-флаги возвращаются в исходное состояние
