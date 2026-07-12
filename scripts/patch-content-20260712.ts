/**
 * Точечные правки контента по аудиту 2026-07-12 (см. отчёт-артефакт).
 * Применение: MONGODB_URI=... npx ts-node scripts/patch-content-20260712.ts [--apply]
 * Без --apply — dry-run (печатает изменения, не пишет).
 * Пишет через doc.save(), чтобы pre-save хук перегенерировал validationData.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { Lesson, LessonSchema } from '../src/modules/common/schemas/lesson.schema';

const APPLY = process.argv.includes('--apply');

type TaskPatch = (data: Record<string, any>) => string[]; // возвращает список описаний изменений

const addAccept = (...words: string[]): TaskPatch => (d) => {
  const acc: string[] = Array.isArray(d.accept) ? d.accept : [];
  const added = words.filter((w) => !acc.includes(w));
  if (added.length) d.accept = [...acc, ...added];
  return added.length ? [`accept += ${added.join(', ')}`] : [];
};

const set = (patch: Record<string, any>): TaskPatch => (d) => {
  const out: string[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (JSON.stringify(d[k]) !== JSON.stringify(v)) {
      out.push(`${k}: ${JSON.stringify(d[k])?.slice(0, 60)} -> ${JSON.stringify(v).slice(0, 60)}`);
      d[k] = v;
    }
  }
  return out;
};

const editPair = (matchLeft: string, patch: { left?: string; right?: string }): TaskPatch => (d) => {
  const out: string[] = [];
  for (const p of d.pairs || []) {
    if (p.left === matchLeft) {
      if (patch.left && p.left !== patch.left) { out.push(`pair.left: ${p.left} -> ${patch.left}`); p.left = patch.left; }
      if (patch.right && p.right !== patch.right) { out.push(`pair.right: ${p.right} -> ${patch.right}`); p.right = patch.right; }
    }
  }
  return out;
};

const editPairRight = (matchRight: string, newRight: string): TaskPatch => (d) => {
  const out: string[] = [];
  for (const p of d.pairs || []) {
    if (p.right === matchRight) { out.push(`pair.right: ${p.right} -> ${newRight}`); p.right = newRight; }
  }
  return out;
};

// ref задания -> список патчей
const FIXES: Record<string, TaskPatch[]> = {
  // A0: дистракторы тоже верны (на досмотре снимают и куртку, и часы)
  'a0.travel.003.t1': [set({
    options: ['Shoes', 'Passport', 'Boarding pass', 'Suitcase'],
    correctIndex: 0,
    explanation: 'На досмотре снимают обувь — shoes. Паспорт и посадочный показывают, а чемодан кладут на ленту: их не «снимают».',
  })],
  // Просторечное «нету»
  'a0.food.006.t5': [editPairRight('Нет, нету.', 'Нет, нет.')],
  // gap: несколько слов подходят — принимаем законные альтернативы
  'a1.food.001.t2': [addAccept('coffee')],
  'a1.food.002.t2': [addAccept('have', 'order')],
  'a1.directions.003.t2': [addAccept('train', 'bus')],
  'a1.routines.001.t2': [addAccept('eat')],
  'a1.routines.002.t2': [addAccept('read', 'send', 'write', 'answer')],
  // «I need ____ bottles» — ничто не задавало число
  'a1.routines.003.t2': [set({ text: 'I need ____ bottles of water — one for me and one for you.' })],
  // order: симметричные куски вокруг and — фиксируем порядок через then
  'a1.routines.008.t5': [set({
    tokens: ['I', 'wake', 'up', 'at', 'seven', 'and', 'then', 'leave', 'home', 'at', 'eight'],
    hint: 'Порядок событий: сначала подъём, затем выход из дома.',
    explanation: '«and then» задаёт последовательность: wake up → leave home.',
  })],
  // принимался неграмматичный вариант (present simple + since)
  'a2.services.008.t4': [(d) => {
    const bad = 'The internet doesn\'t work since yesterday.';
    if (Array.isArray(d.expected) && d.expected.includes(bad)) {
      d.expected = d.expected.filter((e: string) => e !== bad);
      return [`expected -= "${bad}"`];
    }
    return [];
  }],
  'a2.food.005.t3': [addAccept('any')],
  'a2.food.007.t2': [addAccept('any')],
  // doctor/nurse взаимозаменяемы
  'a2.work.001.t3': [
    editPair('doctor', { right: 'treats sick people' }),
    editPair('nurse', { right: 'helps doctors and cares for patients' }),
  ],
  'b1.money.003.t2': [addAccept('very')],
  // «been spending on your phone» без объекта
  'b1.technology.006.t2': [set({
    text: 'How much time ____ you been spending on your phone today?',
    explanation: 'How much time have you been spending…? — вспомогательный have стоит перед подлежащим you.',
  })],
  // пассив состояния вместо процесса
  'b1.environment.006.t2': [set({
    text: 'The climate ____ being changed by human activity.',
    explanation: '«The climate is being changed by human activity» — процесс идёт прямо сейчас (Present Continuous Passive).',
  })],
  'b1.environment.006.t4': [set({
    tokens: ['The', 'ice', 'is', 'being', 'melted', 'by', 'rising', 'temperatures', '.'],
    explanation: '«The ice is being melted by rising temperatures» — пассив в Continuous: процесс происходит сейчас.',
  })],
  // два взаимозаменяемых обстоятельства времени — оставляем одно
  'b1.work.007.t4': [set({ tokens: ['I', 'am', 'meeting', 'the', 'manager', 'at', 'three', '.'] })],
  // prompt не содержал target (сокращение You'd против полного You had)
  'b1.health.006.t6': [set({ prompt: "Say: 'You had better give up energy drinks if you want to sleep well.'" })],
  // теряется будущее время
  'b2.reported.007.t3': [editPair('Experts think prices will rise.', {
    left: 'Experts expect that prices will rise.',
    right: 'Prices are expected to rise.',
  })],
  // дубль в expected
  'b2.business.003.t4': [(d) => {
    if (Array.isArray(d.expected)) {
      const seen = new Set<string>(); const out: string[] = [];
      d.expected = d.expected.filter((e: string) => (seen.has(e) ? false : (seen.add(e), true)));
      if (!d.expected.includes('Any questions?')) { d.expected.push('Any questions?'); out.push('expected += "Any questions?"'); }
      return out.concat(['expected dedup']);
    }
    return [];
  }],
  // сломанное задание: «he can too, too»
  'c1.register.006.t2': [set({
    text: 'She can play the violin, and so ____ he.',
    answer: 'can',
    hint: 'Инверсия с so: so + вспомогательный глагол + подлежащее.',
    explanation: '«…and so can he» — «и он тоже», без повтора глагольной группы (so + can + he).',
  })],
};

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB_NAME || 'englishintg' });
  const LessonModel = mongoose.model(Lesson.name, LessonSchema);

  const byLesson: Record<string, string[]> = {};
  for (const ref of Object.keys(FIXES)) {
    const lessonRef = ref.replace(/\.t\d+$/, '');
    (byLesson[lessonRef] ||= []).push(ref);
  }

  let changed = 0;
  for (const [lessonRef, taskRefs] of Object.entries(byLesson)) {
    const doc: any = await LessonModel.findOne({ lessonRef });
    if (!doc) { console.log(`!! lesson not found: ${lessonRef}`); continue; }
    let dirty = false;
    for (const taskRef of taskRefs) {
      const task = (doc.tasks || []).find((t: any) => t.ref === taskRef);
      if (!task) { console.log(`!! task not found: ${taskRef}`); continue; }
      for (const patch of FIXES[taskRef]) {
        const diffs = patch(task.data);
        if (diffs.length) {
          dirty = true; changed++;
          console.log(`* ${taskRef}`);
          diffs.forEach((d) => console.log(`    ${d}`));
        }
      }
      if (dirty) doc.markModified('tasks');
    }
    if (dirty && APPLY) await doc.save(); // pre-save хук перегенерит validationData
  }
  console.log(`\n${APPLY ? 'APPLIED' : 'DRY-RUN'}: изменено патчей: ${changed}`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
