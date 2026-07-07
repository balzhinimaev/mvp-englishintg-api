# Авторский контракт статей справочника (самоучитель English-in-TG)

Сгенерируй статьи грамматики и запиши валидный JSON через Write в указанный путь.
Формат критичен. Заливка: `SEED_FILE=<файл> npm run seed:handbook` (upsert по ref).

## Структура файла
```json
{ "articles": [ <статья>, <статья>, ... ] }
```

## Статья (все ключи)
```json
{ "ref": "grammar.past-simple-a2", "category": "grammar",
  "title": { "ru": "Past Simple", "en": "Past Simple" },
  "summary": "Прошедшее простое: правильные и неправильные глаголы, вопросы и отрицания.",
  "level": "A2", "icon": "clock", "order": 40,
  "blocks": [ <блоки> ] }
```
- `ref`: уникальный, строчный, формат `<category-часть>.<slug>` через точку, напр. `grammar.present-perfect`, `cheatsheet.irregular-verbs-a2`. ВАЖНО: ref должен быть УНИКАЛЕН и НЕ совпадать с существующими (существующие A0/A1: grammar.to-be, grammar.pronouns, grammar.articles, grammar.plural, grammar.this-that, grammar.possessives, grammar.present-simple, grammar.present-continuous, grammar.can, grammar.there-is и т.п.). Чтобы точно не конфликтовать — добавляй суффикс уровня к слагу, напр. `grammar.past-simple` НЕ занят, но безопаснее `grammar.past-simple` если уверен; при сомнении суффикс `-a2`/`-b1`.
- `category`: строго одно из `grammar` | `cheatsheet` | `phrases` | `pronunciation`.
- `title`: ОБА языка ru+en.
- `summary`: короткое описание на русском (1 предложение).
- `level`: `A2`|`B1`|`B2`|`C1`|`C2`.
- `icon`: короткий слаг (book, clock, list, chat, star, check, pencil, globe — любой разумный).
- `order`: число (для сортировки; используй 40+ чтобы не пересекаться с A0/A1).
- `blocks`: непустой массив.

## Типы блоков (8) — комбинируй в статье
```json
{ "type": "heading", "text": "Как образуется" }
{ "type": "text", "text": "Past Simple описывает завершённое действие в прошлом..." }
{ "type": "rule", "text": "Правильные глаголы: глагол + -ed. Неправильные — по таблице." }
{ "type": "example", "en": "I watched a film yesterday.", "ru": "Я посмотрел фильм вчера." }
{ "type": "examples", "items": [ {"en":"She went home.","ru":"Она пошла домой."}, {"en":"They didn't come.","ru":"Они не пришли."} ] }
{ "type": "table", "title": "Формы", "headers": ["Инфинитив","Past Simple","Перевод"], "rows": [ ["go","went","идти"], ["have","had","иметь"] ] }
{ "type": "tip", "text": "Совет: неправильные глаголы учите тройками (go-went-gone)." }
{ "type": "note", "text": "Важно: did/didn't уже показывают прошедшее — основной глагол остаётся в инфинитиве." }
```
- `heading/text/rule/tip/note`: непустой `text`.
- `example`: обязательно `en` + `ru` (audioUrl НЕ пиши — проставит скрипт озвучки).
- `examples`: непустой `items[]` с `en`+`ru`.
- `table`: `headers[]` + непустой `rows[]`, каждая строка = массив ячеек той же длины что headers. Опц. `title`.

## Хорошая статья грамматики (структура)
1. heading «Что это» + text (объяснение простыми словами на русском)
2. rule (правило образования)
3. table (формы/схема) если уместно
4. examples (3-5 примеров en+ru)
5. heading «Вопросы и отрицания» + rule + examples (если применимо)
6. tip и/или note (частые ошибки, лайфхаки)
7. Для сложных тем — раздел «Когда используем» с примерами.

Объяснения — на русском, чёткие, практичные. Примеры — естественный современный английский, релевантный уровню статьи.

## Перед сдачей
JSON парсится; у каждой статьи ref/category/title(ru+en)/blocks; example имеет en+ru; table rows той же длины что headers; refs уникальны в файле.
Верни: путь, число статей, их refs.
