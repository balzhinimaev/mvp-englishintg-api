import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';
import * as jwt from 'jsonwebtoken';

type AcceptanceCase = {
  id: string;
  taskRef: string;
  type?: string;
  userAnswer: string;
  expectedIsCorrect: boolean;
};

type CasesFile = {
  positive: AcceptanceCase[];
  negative: AcceptanceCase[];
};

type SubmitResponse = {
  attemptId?: string;
  isCorrect?: boolean;
  score?: number;
  feedback?: string;
  correctAnswer?: string;
  explanation?: string;
  statusCode?: number;
  message?: string;
};

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:7777';
const API_PREFIX_ENV = process.env.API_PREFIX;
let API_BASE = '';
const CASES_PATH = process.env.CASES_PATH || path.join('docs', 'phase1-v3-acceptance-cases.json');
const LESSON_SEED_PATH = process.env.LESSON_SEED_PATH || path.join('seeds', 'content.phase1.a2.json');
const JWT_SECRET = process.env.JWT_SECRET || '';
const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'englishintg';
const USER_ID = process.env.ACCEPTANCE_USER_ID || 'phase1-acceptance-runner';
const FORCE_PUBLISH = String(process.env.ACCEPTANCE_FORCE_PUBLISH || 'false').toLowerCase() === 'true';
const TARGET_MODULE_REFS = (process.env.ACCEPTANCE_MODULE_REFS || 'a2.work,a2.services')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

async function ensureRunnerUser(): Promise<void> {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is required when JWT_TOKEN is not provided');
  }

  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB_NAME });
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Mongo database handle is unavailable');
  }

  const existing = await db.collection('users').findOne({ userId: USER_ID });
  if (!existing) {
    await db.collection('users').insertOne({
      userId: USER_ID,
      firstName: 'Phase1',
      lastName: 'Runner',
      username: 'phase1_runner',
      tz: 'UTC',
      locale: 'ru',
      xpTotal: 0,
      pro: { active: true, plan: 'qa' },
      onboardingCompletedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(green(`✓ Created test user ${USER_ID}`));
  } else {
    await db.collection('users').updateOne(
      { userId: USER_ID },
      { $set: { pro: { active: true, plan: 'qa' }, onboardingCompletedAt: existing.onboardingCompletedAt || new Date(), updatedAt: new Date() } }
    );
    console.log(green(`✓ Reusing test user ${USER_ID}`));
  }

  await mongoose.disconnect();
}

async function enablePublishedForAcceptance(): Promise<() => Promise<void>> {
  if (!FORCE_PUBLISH) {
    return async () => {};
  }
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is required when ACCEPTANCE_FORCE_PUBLISH=true');
  }

  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB_NAME });
  const db = mongoose.connection.db;
  if (!db) throw new Error('Mongo database handle is unavailable');

  const lessonRegexes = TARGET_MODULE_REFS.map((m) => new RegExp(`^${m.replace('.', '\\.')}\\.`));
  const lessonQuery = { $or: lessonRegexes.map((r) => ({ lessonRef: r })) };
  const moduleQuery = { moduleRef: { $in: TARGET_MODULE_REFS } };

  const modulesBefore = await db.collection('course_modules').find(moduleQuery).project({ _id: 0, moduleRef: 1, published: 1 }).toArray();
  const lessonsBefore = await db.collection('lessons').find(lessonQuery).project({ _id: 0, lessonRef: 1, published: 1 }).toArray();

  await db.collection('course_modules').updateMany(moduleQuery, { $set: { published: true } });
  await db.collection('lessons').updateMany(lessonQuery, { $set: { published: true } });

  console.log(green(`✓ Temporarily published target modules/lessons for acceptance`));

  await mongoose.disconnect();

  return async () => {
    await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB_NAME });
    const db2 = mongoose.connection.db;
    if (!db2) throw new Error('Mongo database handle is unavailable');

    for (const m of modulesBefore) {
      await db2.collection('course_modules').updateOne({ moduleRef: (m as any).moduleRef }, { $set: { published: Boolean((m as any).published) } });
    }
    for (const l of lessonsBefore) {
      await db2.collection('lessons').updateOne({ lessonRef: (l as any).lessonRef }, { $set: { published: Boolean((l as any).published) } });
    }

    await mongoose.disconnect();
    console.log(green(`✓ Restored original published flags after acceptance`));
  };
}

function getJwtToken(): string {
  const fromEnv = process.env.JWT_TOKEN;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();

  if (!JWT_SECRET) {
    throw new Error('JWT_TOKEN not provided and JWT_SECRET is missing');
  }

  const token = jwt.sign({ userId: USER_ID }, JWT_SECRET, { expiresIn: '2h' });
  return token;
}

async function healthcheck(): Promise<void> {
  const candidates = [`${BASE_URL}/health`, `${BASE_URL}/api/health`];
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        console.log(green(`✓ Healthcheck OK (${res.status}) -> ${url}`));
        return;
      }
    } catch {
      // ignore and try next
    }
  }
  throw new Error(`Healthcheck failed for ${candidates.join(' | ')}`);
}

async function detectApiBase(): Promise<string> {
  const prefixes = API_PREFIX_ENV !== undefined
    ? [API_PREFIX_ENV]
    : ['', '/api'];

  for (const prefix of prefixes) {
    const cleanPrefix = prefix === '/' ? '' : prefix;
    const base = `${BASE_URL}${cleanPrefix}`;
    try {
      const res = await fetch(`${base}/progress/sessions/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // route exists if auth/validation triggers
      if ([400, 401, 403].includes(res.status)) {
        console.log(green(`✓ API detected: ${base}`));
        return base;
      }
    } catch {
      // try next
    }
  }

  throw new Error(`Could not detect API base. Tried prefixes: ${prefixes.join(', ')}`);
}

function buildTaskToLessonMap(seedPath: string): Record<string, string> {
  const seed = readJson<{ lessons: Array<{ lessonRef: string; tasks: Array<{ ref: string }> }> }>(seedPath);
  const map: Record<string, string> = {};
  for (const lesson of seed.lessons || []) {
    for (const task of lesson.tasks || []) {
      map[task.ref] = lesson.lessonRef;
    }
  }
  return map;
}

async function startSession(token: string, lessonRef: string): Promise<string> {
  const moduleRef = lessonRef.split('.').slice(0, 2).join('.');
  const res = await fetch(`${API_BASE}/progress/sessions/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ moduleRef, lessonRef, source: 'home' }),
  });

  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || !body?.sessionId) {
    throw new Error(`Failed to start session for ${lessonRef}: ${res.status} ${JSON.stringify(body)}`);
  }
  return String(body.sessionId);
}

async function endSession(token: string, sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/progress/sessions/${sessionId}/end`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ extraXp: 0 }),
  });
  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || body?.ok !== true) {
    throw new Error(`Failed to end session ${sessionId}: ${res.status} ${JSON.stringify(body)}`);
  }
}

async function submitCase(token: string, c: AcceptanceCase, lessonRef: string, sessionId?: string): Promise<SubmitResponse> {
  const idem = `acc-${c.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const res = await fetch(`${API_BASE}/progress/submit-answer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': idem,
    },
    body: JSON.stringify({
      lessonRef,
      taskRef: c.taskRef,
      userAnswer: c.userAnswer,
      durationMs: 1200,
      sessionId,
      isLastTask: false,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as SubmitResponse;
  if (!res.ok) {
    return { statusCode: res.status, message: body?.message || `HTTP ${res.status}` };
  }
  return body;
}

async function runSuite(name: 'positive' | 'negative', cases: AcceptanceCase[], token: string, taskToLesson: Record<string, string>) {
  console.log(`\n${yellow(`== ${name.toUpperCase()} suite (${cases.length}) ==`)}`);

  const lessonSessions = new Map<string, string>();
  let passed = 0;
  const failures: Array<{ id: string; reason: string }> = [];

  // start one session per lesson used in suite
  const lessons = Array.from(new Set(cases.map(c => taskToLesson[c.taskRef]).filter(Boolean))) as string[];
  for (const lessonRef of lessons) {
    const sid = await startSession(token, lessonRef);
    lessonSessions.set(lessonRef, sid);
    console.log(green(`✓ session ${lessonRef} -> ${sid}`));
  }

  for (const c of cases) {
    const lessonRef = taskToLesson[c.taskRef];
    if (!lessonRef) {
      failures.push({ id: c.id, reason: `taskRef not found in seed: ${c.taskRef}` });
      console.log(red(`✗ ${c.id}: taskRef not found in seed`));
      continue;
    }

    const resp = await submitCase(token, c, lessonRef, lessonSessions.get(lessonRef));
    if (resp.statusCode) {
      failures.push({ id: c.id, reason: `HTTP ${resp.statusCode}: ${resp.message}` });
      console.log(red(`✗ ${c.id}: HTTP ${resp.statusCode} ${resp.message}`));
      continue;
    }

    const actual = Boolean(resp.isCorrect);
    if (actual === c.expectedIsCorrect) {
      passed++;
      console.log(green(`✓ ${c.id}: isCorrect=${actual}`));
    } else {
      failures.push({ id: c.id, reason: `expected ${c.expectedIsCorrect}, got ${actual}; feedback=${resp.feedback || '-'}` });
      console.log(red(`✗ ${c.id}: expected ${c.expectedIsCorrect}, got ${actual}`));
    }
  }

  for (const sid of lessonSessions.values()) {
    await endSession(token, sid);
  }

  return { passed, total: cases.length, failures };
}

async function main() {
  const root = process.cwd();
  const casesPathAbs = path.resolve(root, CASES_PATH);
  const seedPathAbs = path.resolve(root, LESSON_SEED_PATH);

  if (!fs.existsSync(casesPathAbs)) throw new Error(`Cases file not found: ${casesPathAbs}`);
  if (!fs.existsSync(seedPathAbs)) throw new Error(`Seed file not found: ${seedPathAbs}`);

  await healthcheck();
  API_BASE = await detectApiBase();

  let restorePublished = async () => {};
  try {
    restorePublished = await enablePublishedForAcceptance();

    if (!process.env.JWT_TOKEN) {
      await ensureRunnerUser();
    }
    const token = getJwtToken();

    const cases = readJson<CasesFile>(casesPathAbs);
    const taskToLesson = buildTaskToLessonMap(seedPathAbs);

    const pos = await runSuite('positive', cases.positive, token, taskToLesson);
    const neg = await runSuite('negative', cases.negative, token, taskToLesson);

    const totalPassed = pos.passed + neg.passed;
    const total = pos.total + neg.total;

    console.log(`\n${yellow('== SUMMARY ==')}`);
    console.log(`Passed: ${totalPassed}/${total}`);

    const failures = [...pos.failures, ...neg.failures];
    if (failures.length) {
      console.log(red(`Failures: ${failures.length}`));
      for (const f of failures) {
        console.log(red(`- ${f.id}: ${f.reason}`));
      }
      process.exit(1);
    }

    console.log(green('✅ Phase1 v3 acceptance PASSED'));
  } finally {
    await restorePublished();
  }
}

main().catch((e) => {
  console.error(red(`ERROR: ${e?.message || e}`));
  process.exit(1);
});
