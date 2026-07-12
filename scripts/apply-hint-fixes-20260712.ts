/**
 * Применение массовых редакторских фиксов по аудиту 2026-07-12:
 *  - fixes-gap.json:      {hints:[{ref,hint}], texts:[{ref,text}|{ref,skip,reason}]}
 *  - fixes-choice.json:   {hints:[{ref,hint}]}
 *  - fixes-translate.json:{expected:[{ref,expected}|{ref,unchanged}]}
 * Запуск: npx ts-node scripts/apply-hint-fixes-20260712.ts <dir-с-json> [--apply]
 * Пишет через doc.save() (pre-save хук перегенерирует validationData).
 * Защита: hint-фикс не применяется, если новый hint содержит ответ.
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';
import { Lesson, LessonSchema } from '../src/modules/common/schemas/lesson.schema';

const DIR = process.argv[2];
const APPLY = process.argv.includes('--apply');
if (!DIR) { console.error('usage: ... <dir> [--apply]'); process.exit(1); }

const read = (f: string) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-zа-яё0-9 ]/gi, ' ').replace(/\s+/g, ' ').trim();
const containsWord = (hay: string, needle: string) =>
  needle.length > 0 && new RegExp(`(^| )${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(hay);

type Fix = { ref: string; field: 'hint' | 'text' | 'expected'; value: any };

async function main() {
  const fixes: Fix[] = [];
  const gap = read('fixes-gap.json');
  for (const h of gap.hints || []) fixes.push({ ref: h.ref, field: 'hint', value: h.hint });
  for (const t of gap.texts || []) { if (!t.skip) fixes.push({ ref: t.ref, field: 'text', value: t.text }); else console.log(`~ skip text ${t.ref}: ${t.reason}`); }
  const choice = read('fixes-choice.json');
  for (const h of choice.hints || []) fixes.push({ ref: h.ref, field: 'hint', value: h.hint });
  const tr = read('fixes-translate.json');
  for (const e of tr.expected || []) if (!e.unchanged) fixes.push({ ref: e.ref, field: 'expected', value: e.expected });

  await mongoose.connect(process.env.MONGODB_URI!, { dbName: process.env.MONGODB_DB_NAME || 'englishintg' });
  const LessonModel = mongoose.model(Lesson.name, LessonSchema);

  const byLesson = new Map<string, Fix[]>();
  for (const f of fixes) {
    const lr = f.ref.replace(/\.t\d+$/, '');
    if (!byLesson.has(lr)) byLesson.set(lr, []);
    byLesson.get(lr)!.push(f);
  }

  let applied = 0, guarded = 0, missing = 0;
  for (const [lessonRef, fs2] of byLesson) {
    const doc: any = await LessonModel.findOne({ lessonRef });
    if (!doc) { console.log(`!! lesson not found ${lessonRef}`); missing += fs2.length; continue; }
    let dirty = false;
    for (const f of fs2) {
      const task = (doc.tasks || []).find((t: any) => t.ref === f.ref);
      if (!task) { console.log(`!! task not found ${f.ref}`); missing++; continue; }
      const d = task.data;

      if (f.field === 'hint') {
        // защита: новый hint не должен содержать ответ
        const answers: string[] = [];
        if (task.type === 'gap') answers.push(d.answer, ...(d.accept || []));
        if ((task.type === 'choice' || task.type === 'listen') && Array.isArray(d.options)) answers.push(d.options[d.correctIndex]);
        const nh = norm(f.value);
        if (answers.some((a) => a && containsWord(nh, norm(a)))) {
          console.log(`⚠ guard: hint для ${f.ref} всё ещё содержит ответ — пропущен`);
          guarded++; continue;
        }
        d.hint = f.value; dirty = true; applied++;
      } else if (f.field === 'text') {
        if (!String(f.value).includes('____')) { console.log(`⚠ guard: text без ____ у ${f.ref} — пропущен`); guarded++; continue; }
        const ans = norm(d.answer);
        const outside = norm(String(f.value).replace(/_{2,}/g, ' '));
        if (ans && containsWord(outside, ans)) { console.log(`⚠ guard: ответ в новом text у ${f.ref} — пропущен`); guarded++; continue; }
        d.text = f.value; dirty = true; applied++;
      } else if (f.field === 'expected') {
        if (!Array.isArray(f.value) || !f.value.length || f.value[0] !== (Array.isArray(d.expected) ? d.expected[0] : d.expected)) {
          console.log(`⚠ guard: expected[0] изменился у ${f.ref} — пропущен`); guarded++; continue;
        }
        d.expected = f.value; dirty = true; applied++;
      }
    }
    if (dirty) { doc.markModified('tasks'); if (APPLY) await doc.save(); }
  }
  console.log(`\n${APPLY ? 'APPLIED' : 'DRY-RUN'}: применено ${applied}, отсечено защитой ${guarded}, не найдено ${missing}`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
