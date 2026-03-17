# Phase1 v3 — Acceptance Pack (A2)

Цель: быстро проверить, что новый контент phase1 проходит end-to-end флоу и корректно валидируется через `/progress/submit-answer`.

## Preconditions

- Пользователь авторизован (JWT в `Authorization: Bearer <token>`)
- Для пользователя доступен `a2.work` и `a2.services`
- Тестовый пользователь имеет доступ к урокам по prerequisite (или проходить уроки по порядку)

## Runtime API flow (минимум)

1. `POST /progress/sessions/start`
2. Для каждого кейса: `POST /progress/submit-answer`
3. На последнем задании урока: завершить урок (`isLastTask=true`)
4. `POST /progress/sessions/{sessionId}/end`

---

## 15 контрольных кейсов (positive)

> В `userAnswer` ниже указано значение поля **как отправлять в API** (строка).

1) **WORK-001-CHOICE**
- taskRef: `a2.work.001.t1`
- type: `choice`
- userAnswer: `"0"`
- expected: `isCorrect=true`

2) **WORK-001-ORDER**
- taskRef: `a2.work.001.t5`
- type: `order`
- userAnswer: `"[\"Can\",\"we\",\"move\",\"this\",\"task\",\"to\",\"next\",\"week\",\"?\"]"`
- expected: `isCorrect=true`

3) **WORK-002-LISTEN**
- taskRef: `a2.work.002.t3`
- type: `listen`
- userAnswer: `"1"`
- expected: `isCorrect=true`

4) **WORK-002-SPEAK**
- taskRef: `a2.work.002.t7`
- type: `speak`
- userAnswer: `"I am blocked on API access and need help."`
- expected: `isCorrect=true`

5) **WORK-003-GAP**
- taskRef: `a2.work.003.t2`
- type: `gap`
- userAnswer: `"needs"`
- expected: `isCorrect=true`

6) **WORK-003-TRANSLATE**
- taskRef: `a2.work.003.t6`
- type: `translate`
- userAnswer: `"Thanks for the comments, I will make revisions"`
- expected: `isCorrect=true`

7) **WORK-004-MATCH**
- taskRef: `a2.work.004.t4`
- type: `match`
- userAnswer: `"[{\"left\":\"deadline\",\"right\":\"дедлайн\"},{\"left\":\"extension\",\"right\":\"продление\"},{\"left\":\"dependency\",\"right\":\"зависимость\"},{\"left\":\"scope\",\"right\":\"объём работ\"}]"`
- expected: `isCorrect=true`

8) **WORK-004-CHOICE**
- taskRef: `a2.work.004.t1`
- type: `choice`
- userAnswer: `"0"`
- expected: `isCorrect=true`

9) **WORK-005-LISTEN**
- taskRef: `a2.work.005.t3`
- type: `listen`
- userAnswer: `"1"`
- expected: `isCorrect=true`

10) **WORK-005-ORDER**
- taskRef: `a2.work.005.t5`
- type: `order`
- userAnswer: `"[\"Let's\",\"escalate\",\"this\",\"issue\",\"to\",\"the\",\"project\",\"manager\"]"`
- expected: `isCorrect=true`

11) **SERV-001-GAP**
- taskRef: `a2.services.001.t2`
- type: `gap`
- userAnswer: `"transfer"`
- expected: `isCorrect=true`

12) **SERV-001-TRANSLATE**
- taskRef: `a2.services.001.t6`
- type: `translate`
- userAnswer: `"I want to open a new account"`
- expected: `isCorrect=true`

13) **SERV-002-LISTEN**
- taskRef: `a2.services.002.t3`
- type: `listen`
- userAnswer: `"1"`
- expected: `isCorrect=true`

14) **SERV-003-ORDER**
- taskRef: `a2.services.003.t5`
- type: `order`
- userAnswer: `"[\"The\",\"issue\",\"happens\",\"every\",\"time\",\"I\",\"upload\",\"a\",\"file\"]"`
- expected: `isCorrect=true`

15) **SERV-005-SPEAK**
- taskRef: `a2.services.005.t7`
- type: `speak`
- userAnswer: `"I confirm that the issue is fully resolved now."`
- expected: `isCorrect=true`

---

## Regression negative checks (must fail)

A) **MATCH-BAD-FORMAT**
- taskRef: `a2.work.004.t4`
- userAnswer: `"not-json"`
- expected: `isCorrect=false`, feedback contains `Некорректный формат`

B) **LISTEN-WRONG-INDEX**
- taskRef: `a2.services.002.t3`
- userAnswer: `"0"`
- expected: `isCorrect=false`

C) **ORDER-WRONG-ORDER**
- taskRef: `a2.work.001.t5`
- userAnswer: `"[\"Can\",\"move\",\"we\",\"this\",\"task\",\"to\",\"next\",\"week\",\"?\"]"`
- expected: `isCorrect=false`

---

## Release gate (Phase1 v3)

Go/No-Go критерии:
- 15/15 positive кейсов проходят
- 3/3 negative кейсов корректно падают
- Нет 5xx в `/progress/submit-answer`
- Уроки корректно переходят в `completed` при прохождении всех задач
- XP начисляется для task + lesson completion
