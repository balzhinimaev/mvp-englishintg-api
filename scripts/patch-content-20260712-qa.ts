/**
 * Правки по итогам ГЛУБОКОЙ верификации перегенерированного A1 (2026-07-12).
 * 42 находки QA-агента: скупые accept/expected (ложные отказы), 4 русизма,
 * двусмысленные order, русские огрехи в объяснениях, 3 хвоста в массовых фиксах.
 * Запуск: npx ts-node scripts/patch-content-20260712-qa.ts [--apply]
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { Lesson, LessonSchema } from '../src/modules/common/schemas/lesson.schema';

const APPLY = process.argv.includes('--apply');
type TaskPatch = (d: Record<string, any>) => string[];

const addAccept = (...words: string[]): TaskPatch => (d) => {
  const acc: string[] = Array.isArray(d.accept) ? d.accept : [];
  const added = words.filter((w) => !acc.includes(w));
  if (added.length) d.accept = [...acc, ...added];
  return added.length ? [`accept += ${added.join(', ')}`] : [];
};
const addExpected = (...variants: string[]): TaskPatch => (d) => {
  const exp: string[] = Array.isArray(d.expected) ? d.expected : [d.expected].filter(Boolean);
  const added = variants.filter((v) => !exp.includes(v));
  if (added.length) d.expected = [...exp, ...added];
  return added.length ? [`expected += ${added.length} вариантов`] : [];
};
const set = (patch: Record<string, any>): TaskPatch => (d) => {
  const out: string[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (JSON.stringify(d[k]) !== JSON.stringify(v)) { out.push(`${k} обновлён`); d[k] = v; }
  }
  return out;
};
const replaceIn = (field: string, from: string, to: string): TaskPatch => (d) => {
  if (typeof d[field] === 'string' && d[field].includes(from)) {
    d[field] = d[field].replace(from, to);
    return [`${field}: "${from.slice(0, 40)}" -> "${to.slice(0, 40)}"`];
  }
  return [];
};

const FIXES: Record<string, TaskPatch[]> = {
  // ── русизмы в эталонном английском ──
  'a1.workplace.008.t6': [set({
    transcript: 'The project is going well. We usually finish our tasks on time.',
    options: ['It is going badly', 'It is going well', 'It is late', 'It is finished'],
    audioKey: 'a1.workplace.008.t6.project-going-well',
    explanation: 'The project is going well — «проект идёт хорошо»: о текущем состоянии говорим в Present Continuous.',
  })],
  'a1.workplace.009.t2': [replaceIn('text', ' work again.', ' work.')],
  'a1.workplace.010.t5': [set({ question: 'Что говорящий делает в пять часов?' })],
  'a1.digital.010.t3': [(d) => {
    if (Array.isArray(d.tokens) && d.tokens.includes('forget')) {
      d.tokens = d.tokens.map((t: string) => (t === 'forget' ? 'leave' : t));
      d.explanation = "Don't leave your charger at home — «не оставь зарядку дома». Отрицательный императив: Don't + глагол.";
      return ['tokens: forget -> leave'];
    }
    return [];
  }],
  // ── gap: принимаем законные альтернативы ──
  'a1.communication.005.t2': [addAccept('It')],
  'a1.communication.003.t3': [addAccept('Can', 'Could')],
  'a1.workplace.006.t2': [addAccept('Would', 'Will')],
  'a1.travel.001.t2': [addAccept('inside')],
  'a1.health.001.t3': [replaceIn('text', "can't eat an apple", "can't bite an apple")],
  'a1.health.004.t2': [addAccept('sick', 'ill', 'bad')],
  'a1.health.010.t3': [addAccept('must')],
  'a1.health.003.t2': [addAccept('get')],
  'a1.intro.009.t2': [addAccept('write')],
  'a1.digital.004.t2': [addAccept('show', 'give')],
  'a1.digital.002.t1': [addAccept('Write')],
  'a1.shopping.006.t2': [addAccept('offer')],
  'b2.media.008.t2': [addAccept('Obtained', 'Gathered')],
  // ── translate: полнота expected ──
  'a1.health.001.t6': [addExpected("I don't feel well", 'I feel sick')],
  'a1.health.004.t4': [addExpected('I have a sore throat and I feel bad')],
  'a1.health.010.t4': [addExpected('She has a fever and she should stay at home')],
  'a1.health.008.t3': [addExpected("I caught a cold and I can't sleep")],
  'a1.shopping.007.t4': [addExpected("I'd like to return these pants", 'I would like to return these pants')],
  'a1.shopping.009.t3': [addExpected('How much is a kilogram of tomatoes?')],
  'a1.shopping.010.t5': [addExpected("I'll pay with cash", 'I will pay with cash')],
  'a1.intro.009.t5': [addExpected("I'll write you tomorrow", "I'll message you tomorrow")],
  'a1.food.009.t5': [addExpected('Please give my compliments to the chef', 'Give my compliments to the chef', 'Please pass my compliments to the chef')],
  'a1.food.010.t5': [addExpected("I'll have the steak, but without onions", "I'll take the steak, but no onions")],
  'a1.directions.010.t5': [addExpected('Do I have to get off at the next stop?')],
  // ── order: единственный порядок ──
  'a1.travel.002.t4': [set({
    tokens: ['Where', 'can', 'we', 'leave', 'our', 'luggage', '?'],
    explanation: 'Where can we leave our luggage? — «где можно оставить багаж?» Порядок вопроса: слово-вопрос + can + подлежащее + глагол.',
  })],
  'a1.shopping.007.t3': [(d) => {
    if (Array.isArray(d.tokens) && d.tokens.includes('the')) {
      d.tokens = d.tokens.map((t: string) => (t === 'the' ? 'a' : t));
      return ['tokens: the -> a (артикли одинаковые, порядок единственный)'];
    }
    return [];
  }],
  'a1.digital.001.t4': [set({
    tokens: ['Open', 'the', 'camera', 'to', 'take', 'a', 'photo', '.'],
    explanation: 'Open the camera to take a photo — «открой камеру, чтобы сделать фото».',
  })],
  'a1.travel.001.t4': [set({
    tokens: ['We', 'can', 'buy', 'tickets', 'on', 'the', 'website', '.'],
    explanation: 'We can buy tickets on the website — «мы можем купить билеты на сайте».',
  })],
  // ── choice/listen: однозначность ──
  'a1.workplace.004.t1': [set({
    question: 'Спроси про встречу с руководителем: ___ your manager meet the team on Mondays?',
    explanation: 'Вопрос в Present Simple строится через do/does. Your manager — единственное число, поэтому Does your manager meet...? Is/Are здесь не нужны: уже есть глагол meet.',
  })],
  'a1.workplace.006.t6': [(d) => {
    const i = (d.options || []).indexOf("He can't help now");
    if (i >= 0) { d.options[i] = "He can't help today"; return ['дистрактор: now -> today']; }
    return [];
  }],
  // ── подсказки/объяснения ──
  'a1.workplace.005.t4': [set({
    hint: 'Английское отрицание не удваивается: одно из наречий уже отрицательное само по себе, вспомогательный don’t ему не нужен.',
  })],
  'a1.shopping.002.t5': [set({
    explanation: 'ThirTEEN (13) и THIRty (30) различаются ударением и концовкой: -teen — ударное и длинное, -ty — короткое. Эти пары легко перепутать на слух — переспрашивай цену, если не уверен.',
  })],
  'a1.travel.006.t3': [replaceIn('explanation', 'Товары номера', 'Предметы в номере')],
  'a1.travel.006.t1': [replaceIn('explanation', 'first noun', 'первое существительное')],
  'a1.routines.010.t4': [replaceIn('explanation', 'have breakfast (не eat breakfast в формулах)', 'have breakfast (самая частая коллокация)')],
  'a1.digital.002.t2': [
    set({ hint: 'Перед существительным нужна краткая притяжательная форма; та, что живёт без существительного, сюда не подходит.' }),
    replaceIn('explanation', ', а формы your\'s не существует', ''),
  ],
  'c2.idiomatic.005.t2': [set({ hint: 'Идиома из тенниса: право следующего шага перешло к другой стороне.' })],
  'c1.abstract.005.t1': [set({ hint: 'Оборот «если бы не…» о настоящем: в инверсии вперёд выходит сослагательная форма be.' })],
};

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!, { dbName: process.env.MONGODB_DB_NAME || 'englishintg' });
  const M = mongoose.model(Lesson.name, LessonSchema);
  const byLesson: Record<string, string[]> = {};
  for (const ref of Object.keys(FIXES)) (byLesson[ref.replace(/\.t\d+$/, '')] ||= []).push(ref);
  let changed = 0;
  for (const [lessonRef, refs] of Object.entries(byLesson)) {
    const doc: any = await M.findOne({ lessonRef });
    if (!doc) { console.log(`!! lesson not found: ${lessonRef}`); continue; }
    let dirty = false;
    for (const ref of refs) {
      const task = (doc.tasks || []).find((t: any) => t.ref === ref);
      if (!task) { console.log(`!! task not found: ${ref}`); continue; }
      for (const p of FIXES[ref]) {
        const diffs = p(task.data);
        if (diffs.length) { dirty = true; changed++; console.log(`* ${ref}`); diffs.forEach((x) => console.log(`    ${x}`)); }
      }
    }
    if (dirty) { doc.markModified('tasks'); if (APPLY) await doc.save(); }
  }
  console.log(`\n${APPLY ? 'APPLIED' : 'DRY-RUN'}: патчей ${changed}`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
