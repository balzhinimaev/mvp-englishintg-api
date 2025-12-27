/**
 * Smart content seeder for modules/lessons/tasks
 * Stack: Node + Mongoose + TypeScript
 *
 * Goals
 * - Idempotent upserts with safe defaults (no accidental overwrites of published content)
 * - Dry‑run mode with clear diff output
 * - Referential integrity (lesson.moduleRef must exist)
 * - Basic validation & linting of refs, orders, tasks
 * - Transactional writes
 * - Optional selective seeding by module/lesson
 * - Optional update & prune modes
 *
 * Usage examples
 *   ts-node scripts/seed-content.ts --dry
 *   ts-node scripts/seed-content.ts --apply
 *   ts-node scripts/seed-content.ts --apply --update            # update existing docs (safe fields)
 *   ts-node scripts/seed-content.ts --apply --force             # override even published
 *   ts-node scripts/seed-content.ts --apply --modules=a0.travel,a1.food
 *   ts-node scripts/seed-content.ts --apply --lessons=a0.travel.001
 *   ts-node scripts/seed-content.ts --apply --prune-tasks       # replace tasks array by seed version
 *
 * Env
 *   MONGODB_URI (required)
 *   MONGODB_DB_NAME (default: englishintg)
 */

import 'dotenv/config';
import mongoose, { ClientSession } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { CourseModule, CourseModuleSchema } from '../src/modules/common/schemas/course-module.schema';
import { Lesson, LessonSchema } from '../src/modules/common/schemas/lesson.schema';
import { MultilingualText, OptionalMultilingualText, validateMultilingualText } from '../src/modules/common/utils/i18n.util';

// ------------------------ Types ------------------------

type CEFR = 'A0'|'A1'|'A2'|'B1'|'B2'|'C1'|'C2';

type TaskType = 'choice'|'gap'|'match'|'listen'|'speak'|'order'|'translate';

interface ModuleSeed {
  moduleRef: string; // a0.travel
  level: CEFR;
  title: MultilingualText;
  description?: OptionalMultilingualText;
  tags?: string[];
  order?: number;
  published?: boolean;
}

interface TaskSeed {
  ref: string; // a0.travel.001.t1
  type: TaskType;
  data: Record<string, any>;
}

interface LessonSeed {
  moduleRef: string; // denorm
  lessonRef: string; // a0.travel.001
  title: MultilingualText;
  description?: OptionalMultilingualText;
  order?: number;
  published?: boolean;
  estimatedMinutes?: number; // 1..60
  tasks: TaskSeed[];
}

// ------------------------ CLI options ------------------------

const args = process.argv.slice(2);
function hasFlag(name: string) { return args.includes(`--${name}`); }
function getArg(name: string): string | undefined {
  const pfx = `--${name}=`; const a = args.find(a => a.startsWith(pfx));
  return a ? a.slice(pfx.length) : undefined;
}

const OPT = {
  dry: hasFlag('dry') || !hasFlag('apply'),
  update: hasFlag('update'),
  force: hasFlag('force'),
  pruneTasks: hasFlag('prune-tasks'),
  modulesFilter: (getArg('modules')||'').split(',').filter(Boolean),
  lessonsFilter: (getArg('lessons')||'').split(',').filter(Boolean),
};

function logMode() {
  // eslint-disable-next-line no-console
  console.log(`\nMode: ${OPT.dry ? 'DRY‑RUN (no writes)' : 'APPLY (writes enabled)'}${OPT.update?' + update':''}${OPT.force?' + FORCE':''}${OPT.pruneTasks?' + prune-tasks':''}`);
}

// ------------------------ Validation helpers ------------------------

const R_MODULE_REF = /^([a-z]\d?\.[a-z0-9-]+)$/i;            // a0.travel, a1.food, b1.work
const R_LESSON_REF = /^([a-z]\d?\.[a-z0-9-]+)\.(\d{3})$/i;  // a0.travel.001
const R_TASK_REF   = /^([a-z]\d?\.[a-z0-9-]+\.\d{3})\.t\d+$/i; // a0.travel.001.t1

function assertModule(m: ModuleSeed) {
  const errs: string[] = [];
  if (!R_MODULE_REF.test(m.moduleRef)) errs.push(`moduleRef invalid: ${m.moduleRef}`);
  if (!['A0','A1','A2','B1','B2','C1','C2'].includes(m.level)) errs.push(`level invalid: ${m.level}`);
  if (!m.title || !validateMultilingualText(m.title)) errs.push('title must have both ru and en translations');
  if (m.description && !validateMultilingualText(m.description, ['ru'])) errs.push('description must have at least ru translation when provided');
  if ((m as any).estimatedMinutes !== undefined) errs.push('module should not have estimatedMinutes');
  return errs;
}

function assertLesson(l: LessonSeed) {
  const errs: string[] = [];
  if (!R_LESSON_REF.test(l.lessonRef)) errs.push(`lessonRef invalid: ${l.lessonRef}`);
  if (l.moduleRef !== l.lessonRef.split('.').slice(0,2).join('.')) errs.push(`lessonRef prefix must match moduleRef (${l.moduleRef})`);
  if (!l.title || !validateMultilingualText(l.title)) errs.push('title must have both ru and en translations');
  if (l.description && !validateMultilingualText(l.description, ['ru'])) errs.push('description must have at least ru translation when provided');
  const seen = new Set<string>();
  if (!l.tasks || l.tasks.length < 2) errs.push('lesson must have at least 2 tasks');
  l.tasks?.forEach((t, i) => {
    if (!R_TASK_REF.test(t.ref)) errs.push(`task[${i}].ref invalid: ${t.ref}`);
    if (!t.ref.startsWith(`${l.lessonRef}.`)) errs.push(`task[${i}].ref must start with ${l.lessonRef}.`);
    if (seen.has(t.ref)) errs.push(`duplicate task.ref: ${t.ref}`); else seen.add(t.ref);
    if (!t.type) errs.push(`task[${i}].type required`);
    // quick type‑specific checks
    if (t.type === 'choice') {
      const o = t.data?.options; const ci = t.data?.correctIndex;
      if (!Array.isArray(o) || o.length < 2) errs.push(`choice[${i}] needs >=2 options`);
      if (typeof ci !== 'number' || ci < 0 || ci >= (o?.length||0)) errs.push(`choice[${i}] correctIndex out of range`);
    }
    if (t.type === 'gap') {
      if (typeof t.data?.text !== 'string' || !t.data.text.includes('____')) errs.push(`gap[${i}] text must contain ____ placeholder`);
      if (typeof t.data?.answer !== 'string' || !t.data.answer) errs.push(`gap[${i}] answer required`);
    }
  });
  if (typeof l.estimatedMinutes === 'number' && (l.estimatedMinutes < 1 || l.estimatedMinutes > 60)) errs.push('estimatedMinutes must be 1..60');
  return errs;
}

// ------------------------ Models ------------------------

const ModuleModel = mongoose.model<CourseModule>('CourseModule', CourseModuleSchema, 'course_modules');
const LessonModel  = mongoose.model<Lesson>("Lesson", LessonSchema, 'lessons');

// ------------------------ Seed data ------------------------

// Default inline seeds; can be overridden by --file=seeds/content.json
const defaultModules: ModuleSeed[] = [
  { 
    moduleRef: 'a0.travel', 
    level: 'A0', 
    title: { ru: 'Путешествия A0', en: 'Travel A0' }, 
    description: { ru: 'Основы путешествий', en: 'Basics for travel' }, 
    tags: ['travel'], 
    order: 1, 
    published: true 
  },
  { 
    moduleRef: 'a1.food', 
    level: 'A1', 
    title: { ru: 'Еда A1', en: 'Food A1' }, 
    description: { ru: 'Еда и заказы', en: 'Food & Ordering' }, 
    tags: ['food'], 
    order: 1, 
    published: true 
  },
  { 
    moduleRef: 'a1.intro', 
    level: 'A1', 
    title: { ru: 'Знакомство', en: 'Introductions' }, 
    description: { ru: 'Приветствие и люди', en: 'Greetings & People' }, 
    tags: ['speaking'], 
    order: 2, 
    published: true 
  },
];

const defaultLessons: LessonSeed[] = [
  {
    moduleRef: 'a0.travel', 
    lessonRef: 'a0.travel.001', 
    title: { ru: 'В аэропорту', en: 'At the airport' }, 
    order: 1, 
    published: true, 
    estimatedMinutes: 10,
    tasks: [
      { ref: 'a0.travel.001.t1', type: 'choice', data: { question: 'How do you greet the officer?', options: ['Hello','Bye','Thanks'], correctIndex: 0, explanation: 'Formal greeting is appropriate here' } },
      { ref: 'a0.travel.001.t2', type: 'gap', data: { text: 'May I see your ____?', answer: 'passport', hints: ['document'] } },
      { ref: 'a0.travel.001.t3', type: 'choice', data: { question: 'Where is the gate?', options: ['At gate A12','In baggage claim'], correctIndex: 0 } },
    ],
  },
  {
    moduleRef: 'a0.travel', 
    lessonRef: 'a0.travel.002', 
    title: { ru: 'В самолете', en: 'On the plane' }, 
    order: 2, 
    published: true, 
    estimatedMinutes: 9,
    tasks: [
      { ref: 'a0.travel.002.t1', type: 'choice', data: { question: 'Window or aisle?', options: ['Window','Aisle'], correctIndex: 1 } },
      { ref: 'a0.travel.002.t2', type: 'gap', data: { text: 'Fasten your ____', answer: 'seatbelt' } },
      { ref: 'a0.travel.002.t3', type: 'translate', data: { question: 'Переведи: «вода без газа»', expected: ['still water'] } },
    ],
  },
  {
    moduleRef: 'a1.food', 
    lessonRef: 'a1.food.001', 
    title: { ru: 'В кафе', en: 'At the cafe' }, 
    order: 1, 
    published: true, 
    estimatedMinutes: 8,
    tasks: [
      { ref: 'a1.food.001.t1', type: 'choice', data: { question: 'Coffee or tea?', options: ['Coffee','Tea'], correctIndex: 0 } },
      { ref: 'a1.food.001.t2', type: 'gap', data: { text: 'I would like a ____ of water', answer: 'glass' } },
      { ref: 'a1.food.001.t3', type: 'order', data: { tokens: ['I','would','like','a','coffee'] } },
    ],
  },
  {
    moduleRef: 'a1.intro', 
    lessonRef: 'a1.intro.001', 
    title: { ru: 'Приветствие', en: 'Greetings' }, 
    order: 1, 
    published: true, 
    estimatedMinutes: 7,
    tasks: [
      { ref: 'a1.intro.001.t1', type: 'choice', data: { question: 'Formal greeting?', options: ['Hey','Hi','Good morning'], correctIndex: 2 } },
      { ref: 'a1.intro.001.t2', type: 'gap', data: { text: 'Nice to ____ you', answer: 'meet' } },
      { ref: 'a1.intro.001.t3', type: 'speak', data: { prompt: 'Say: "Nice to meet you"', target: 'Nice to meet you' } },
    ],
  },
];

function loadSeedsFromFile(): { modules: ModuleSeed[]; lessons: LessonSeed[] } {
  // Prefer SEED_FILE env var, then --file=..., fallback to default seeds/content.json
  const file = process.env.SEED_FILE || getArg('file') || 'seeds/content.json';
  try {
    const p = path.resolve(file);
    const raw = fs.readFileSync(p, 'utf8');
    const json = JSON.parse(raw);
    return {
      modules: Array.isArray(json.modules) ? json.modules : defaultModules,
      lessons: Array.isArray(json.lessons) ? json.lessons : defaultLessons,
    };
  } catch (err) {
    console.warn(`Warning: Could not load seeds from ${file}, using defaults:`, (err as Error).message);
    return { modules: defaultModules, lessons: defaultLessons };
  }
}

// ------------------------ Diff helpers ------------------------

type Diff = Record<string, { from: any; to: any }>;
function makeDiff<T extends Record<string, any>>(current: T, patch: T, allowed: string[]): Diff {
  const diff: Diff = {};
  for (const k of allowed) {
    const a = (current as any)[k];
    const b = (patch as any)[k];
    const same = Array.isArray(a) && Array.isArray(b) ? JSON.stringify(a) === JSON.stringify(b) : a === b;
    if (!same && b !== undefined) diff[k] = { from: a, to: b };
  }
  return diff;
}

function printDiff(title: string, id: string, diff: Diff) {
  const keys = Object.keys(diff);
  if (!keys.length) return;
  // eslint-disable-next-line no-console
  console.log(`  ~ ${title} ${id} changes:`);
  for (const k of keys) // eslint-disable-next-line no-console
    console.log(`    • ${k}:`, JSON.stringify(diff[k].from), '→', JSON.stringify(diff[k].to));
}

// ------------------------ Seeder core ------------------------

async function upsertModules(modules: ModuleSeed[], session: ClientSession | null) {
  const modsToSeed = OPT.modulesFilter.length ? modules.filter(m => OPT.modulesFilter.includes(m.moduleRef)) : modules;
  const insertedOrUpdated: string[] = [];
  for (const m of modsToSeed) {
    const errs = assertModule(m);
    if (errs.length) throw new Error(`Module ${m.moduleRef} failed validation:\n - ${errs.join('\n - ')}`);

    const existing = session ? await ModuleModel.findOne({ moduleRef: m.moduleRef }).session(session) : await ModuleModel.findOne({ moduleRef: m.moduleRef });
    if (!existing) {
      // eslint-disable-next-line no-console
      console.log(`+ create module ${m.moduleRef}`);
      if (!OPT.dry) await (session ? ModuleModel.create([{ ...m }], { session }) : ModuleModel.create([{ ...m }]));
      insertedOrUpdated.push(m.moduleRef);
      continue;
    }

    // Make a safe diff (allowed updatable fields)
    const diff = makeDiff(existing.toObject(), m as any, ['title','description','tags','order','level','published']);
    if (Object.keys(diff).length === 0) { // eslint-disable-next-line no-console
      console.log(`= module ${m.moduleRef} up‑to‑date`); continue; }

    if (!OPT.update && !OPT.force) { // eslint-disable-next-line no-console
      console.log(`~ skip update module ${m.moduleRef} (use --update)`); printDiff('module', m.moduleRef, diff); continue; }
    if ((existing as any).published && !OPT.force) { // eslint-disable-next-line no-console
      console.log(`~ skip published module ${m.moduleRef} (use --force)`); printDiff('module', m.moduleRef, diff); continue; }

    // eslint-disable-next-line no-console
    console.log(`* update module ${m.moduleRef}`);
    printDiff('module', m.moduleRef, diff);
    if (!OPT.dry) {
      const updateOp = ModuleModel.updateOne({ _id: existing._id }, { $set: m });
      await (session ? updateOp.session(session) : updateOp);
    }
    insertedOrUpdated.push(m.moduleRef);
  }
  return insertedOrUpdated;
}

async function upsertLessons(lessons: LessonSeed[], session: ClientSession | null) {
  const lessonsToSeed = OPT.lessonsFilter.length ? lessons.filter(l => OPT.lessonsFilter.includes(l.lessonRef)) : lessons;
  const insertedOrUpdated: string[] = [];

  // build set of existing modules for referential integrity
  const moduleQuery = ModuleModel.find({}, 'moduleRef').lean();
  const mrefs = new Set((await (session ? moduleQuery.session(session) : moduleQuery)).map(m => (m as any).moduleRef));

  for (const l of lessonsToSeed) {
    const errs = assertLesson(l);
    if (errs.length) throw new Error(`Lesson ${l.lessonRef} failed validation:\n - ${errs.join('\n - ')}`);
    if (!mrefs.has(l.moduleRef)) throw new Error(`Lesson ${l.lessonRef} references missing module ${l.moduleRef}`);

    const lessonQuery = LessonModel.findOne({ lessonRef: l.lessonRef });
    const existing = await (session ? lessonQuery.session(session) : lessonQuery);
    if (!existing) {
      // eslint-disable-next-line no-console
      console.log(`+ create lesson ${l.lessonRef}`);
      if (!OPT.dry) await (session ? LessonModel.create([{ ...l }], { session }) : LessonModel.create([{ ...l }]));
      insertedOrUpdated.push(l.lessonRef);
      continue;
    }

    const allowed = ['title','description','order','estimatedMinutes','published'];
    const diff = makeDiff(existing.toObject(), l as any, allowed);

    // compare tasks
    const tasksEqual = JSON.stringify((existing as any).tasks || []) === JSON.stringify(l.tasks || []);
    const needTasksUpdate = (!tasksEqual) && (OPT.pruneTasks || OPT.update || OPT.force);

    if (Object.keys(diff).length === 0 && !needTasksUpdate) { // eslint-disable-next-line no-console
      console.log(`= lesson ${l.lessonRef} up‑to‑date`); continue; }

    if (!OPT.update && !OPT.force && !OPT.pruneTasks) {
      // eslint-disable-next-line no-console
      console.log(`~ skip update lesson ${l.lessonRef} (use --update or --prune-tasks)`);
      printDiff('lesson', l.lessonRef, diff);
      if (!tasksEqual) // eslint-disable-next-line no-console
        console.log('    • tasks: different');
      continue;
    }
    if ((existing as any).published && !OPT.force) {
      // eslint-disable-next-line no-console
      console.log(`~ skip published lesson ${l.lessonRef} (use --force)`);
      printDiff('lesson', l.lessonRef, diff);
      if (!tasksEqual) // eslint-disable-next-line no-console
        console.log('    • tasks: different');
      continue;
    }

    const patch: any = { $set: { ...l } };
    if (!OPT.pruneTasks) { // keep existing tasks if not pruning
      patch.$set.tasks = (existing as any).tasks; // revert tasks change by default
    }

    // eslint-disable-next-line no-console
    console.log(`* update lesson ${l.lessonRef}${OPT.pruneTasks?' (replace tasks)':''}`);
    printDiff('lesson', l.lessonRef, diff);
    if (!tasksEqual) // eslint-disable-next-line no-console
      console.log('    • tasks: will be ' + (OPT.pruneTasks ? 'replaced by seed array' : 'kept as is'));
    if (!OPT.dry) {
      const updateOp = LessonModel.updateOne({ _id: existing._id }, patch);
      await (session ? updateOp.session(session) : updateOp);
    }
    insertedOrUpdated.push(l.lessonRef);
  }
  return insertedOrUpdated;
}

// ------------------------ Main ------------------------

async function main() {
  const uri = process.env.MONGODB_URI || '';
  const dbName = process.env.MONGODB_DB_NAME || 'englishintg';
  if (!uri) throw new Error('MONGODB_URI is required');

  logMode();
  await mongoose.connect(uri, { dbName });

  // Ensure useful indexes (do not fail if exist)
  try { await ModuleModel.collection.createIndex({ moduleRef: 1 }, { unique: true }); } catch {}
  try { await LessonModel.collection.createIndex({ lessonRef: 1 }, { unique: true }); } catch {}
  try { await LessonModel.collection.createIndex({ moduleRef: 1, order: 1 }); } catch {}

  const { modules, lessons } = loadSeedsFromFile();

  // Basic global lint: duplicate lessonRef across seed
  const dupCheck = new Set<string>();
  for (const l of lessons) { if (dupCheck.has(l.lessonRef)) throw new Error(`Duplicate lessonRef in seed: ${l.lessonRef}`); dupCheck.add(l.lessonRef); }

  // Try to use transaction, fallback to non-transactional if replica set is not available
  let useTransaction = false;
  try {
    const adminDb = mongoose.connection.db?.admin();
    if (adminDb) {
      const serverStatus = await adminDb.serverStatus();
      useTransaction = serverStatus.repl !== undefined;
    }
  } catch (e) {
    // If we can't check, assume no replica set
    useTransaction = false;
  }

  if (useTransaction) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const modUpdated = await upsertModules(modules, session);
        const lesUpdated = await upsertLessons(lessons, session);
        // eslint-disable-next-line no-console
        console.log(`\nSummary:`);
        // eslint-disable-next-line no-console
        console.log(`  Modules touched: ${modUpdated.length}`);
        // eslint-disable-next-line no-console
        console.log(`  Lessons touched: ${lesUpdated.length}`);
      });
    } finally {
      await session.endSession();
      await mongoose.disconnect();
    }
  } else {
    // Fallback: execute without transaction for standalone MongoDB
    // eslint-disable-next-line no-console
    console.log('⚠️  Standalone MongoDB detected, executing without transactions');
    try {
      const modUpdated = await upsertModules(modules, null as any);
      const lesUpdated = await upsertLessons(lessons, null as any);
      // eslint-disable-next-line no-console
      console.log(`\nSummary:`);
      // eslint-disable-next-line no-console
      console.log(`  Modules touched: ${modUpdated.length}`);
      // eslint-disable-next-line no-console
      console.log(`  Lessons touched: ${lesUpdated.length}`);
    } finally {
      await mongoose.disconnect();
    }
  }
  // eslint-disable-next-line no-console
  console.log('\nSeed completed');
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('\nSeed failed:', e?.message || e);
  process.exit(1);
});


