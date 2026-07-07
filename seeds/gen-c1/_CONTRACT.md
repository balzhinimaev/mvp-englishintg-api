# Авторский контракт генерации модуля (English-in-TG, русскоязычная аудитория)

Сгенерируй ОДИН модуль и запиши валидный JSON через Write в указанный тебе путь.
Формат критичен — отклонение = незаливаемый контент. Пилот a2.past по этому контракту прошёл линт+заливку+проверку, следуй ему точно.

## Структура файла
```json
{ "modules": [ <один модуль> ], "lessons": [ <8 уроков> ] }
```

## Модуль (ключи ровно эти; НЕ добавляй estimatedMinutes на модуль!)
```json
{ "moduleRef": "<REF>", "level": "<LEVEL>",
  "title": { "ru": "<ru>", "en": "<en>" },
  "description": { "ru": "<ru>", "en": "<en>" },
  "tags": ["..."], "order": <ORDER>, "published": true }
```

## Урок (8 штук, order 1..8)
```json
{ "moduleRef": "<REF>", "lessonRef": "<REF>.001",
  "title": { "ru": "...", "en": "..." }, "description": { "ru": "...", "en": "..." },
  "order": 1, "published": true, "estimatedMinutes": 12,
  "type": "grammar", "difficulty": "easy", "xpReward": 25, "hasAudio": true,
  "tasks": [ <6 заданий> ] }
```
- type ∈ grammar|vocabulary|conversation. difficulty ∈ easy|medium|hard (растёт: уроки 1-3 easy, 4-6 medium, 7-8 hard). title обязателен с ru И en.

## Рефы (строгие регексы — гейт заливки)
- lessonRef: `<REF>.NNN` — ровно 3 цифры (001..008).
- taskRef: `<REF>.NNN.tN` — обязан начинаться с lessonRef. Пример `<REF>.001.t1`.
- Только строчные, дефисы ок, БЕЗ подчёркиваний.

## 6 заданий в каждом уроке, поле `type` строго: choice | gap | match | order | translate | speak | listen
Микс: в каждом уроке ≥4 разных типа. Включай listen и speak регулярно (приложение про аудио — минимум по одному listen и одному speak на 1-2 урока).

### choice
```json
{ "ref":"<REF>.001.t1", "type":"choice", "data":{
  "question":"...", "options":["...","...","...","..."], "correctIndex":1,
  "hint":"<ru подсказка>", "explanation":"<ru объяснение>" } }
```
Обяз: question, options(≥2), correctIndex(0-based, в диапазоне), hint, explanation.

### gap (text ОБЯЗАН содержать `____`, ≥4 подчёркивания; hint И explanation обязательны!)
```json
{ "ref":"<REF>.001.t2", "type":"gap", "data":{
  "text":"She ____ to work by bus.", "answer":"goes",
  "hint":"<ru>", "explanation":"<ru>", "caseInsensitive":true } }
```
Обяз: text(с ____), answer, hint, explanation. accept — массив альтернатив (опц). Если answer — числительное словом (one..twenty) → добавь цифру в accept, напр "accept":["3"].

### match (ровно 6 пар)
```json
{ "ref":"<REF>.001.t3", "type":"match", "data":{
  "pairs":[{"left":"..","right":".."}, ... 6 пар ..],
  "hint":"<ru>", "explanation":"<ru>" } }
```

### order (tokens в ПРАВИЛЬНОМ порядке; знаки препинания — отдельные токены)
```json
{ "ref":"<REF>.001.t4", "type":"order", "data":{
  "tokens":["Where","do","you","live","?"], "hint":"<ru>", "explanation":"<ru>" } }
```

### translate (question на русском; expected — 2-3 естественных варианта; сравнение регистронезависимо)
```json
{ "ref":"<REF>.001.t5", "type":"translate", "data":{
  "question":"Переведи: '...'", "expected":["...","..."], "hint":"<ru>", "explanation":"<ru>" } }
```

### speak (target — осмысленная фраза урока, по ней генерится озвучка)
```json
{ "ref":"<REF>.001.t6", "type":"speak", "data":{
  "prompt":"Say: '...'", "target":"...", "audioKey":"<REF>.001.t6.<slug>",
  "hint":"<ru>", "explanation":"<ru>" } }
```
audioKey уникальный.

### listen (transcript — короткая фраза для TTS; обязательны options(4)+correctIndex)
```json
{ "ref":"<REF>.001.t1", "type":"listen", "data":{
  "audioKey":"<REF>.001.t1.<slug>", "transcript":"...", "translation":"<ru>",
  "question":"What did you hear?", "options":["...","...","...","..."], "correctIndex":0,
  "hint":"<ru>", "explanation":"<ru>" } }
```
audioKey уникальный.

## Качество
- Естественный современный английский строго уровня модуля. Объяснения на русском — коротко и по делу.
- Лексика/грамматика по теме и грам-фокусу модуля. Прогрессия сложности по урокам.
- Уникальные lessonRef и taskRef. Ровно 6 заданий в уроке, ≥2 всегда.

## Перед сдачей
Проверь: JSON парсится; все refs по регексам; каждый gap с ____ + hint + explanation; choice/listen correctIndex в диапазоне options; match ровно 6 пар; listen options=4. В финале верни путь, число уроков/заданий, распределение типов.
