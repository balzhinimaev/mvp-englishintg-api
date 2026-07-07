'use strict';
/**
 * Генерация TTS-озвучки через OpenAI:
 *  - listen-задания уроков → media/audio/<audioKey>.mp3 (из transcript)
 *  - примеры справочника (example/examples.en) → media/audio/hb/<sha1>.mp3,
 *    и проставляет block.audioUrl в handbook_articles (БД).
 * Идемпотентно: существующие файлы не перегенерируются.
 * Usage: OPENAI_API_KEY=... node scripts/generate-audio.js [--dry]
 */
require('dotenv/config');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const VOICE = process.env.TTS_VOICE || 'alloy';
const MODEL = process.env.TTS_MODEL || 'tts-1';
const MEDIA = '/home/alex/englishintg/media/audio';
const HB_DIR = path.join(MEDIA, 'hb');
const SPEAK_DIR = path.join(MEDIA, 'speak');
const CONCURRENCY = 5;
const DRY = process.argv.includes('--dry');

if (!OPENAI_KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1); }
fs.mkdirSync(HB_DIR, { recursive: true });
fs.mkdirSync(SPEAK_DIR, { recursive: true });

const sanitize = (k) => String(k).replace(/[^a-zA-Z0-9._-]/g, '_');
const sha = (t) => crypto.createHash('sha1').update(t, 'utf8').digest('hex').slice(0, 16);

async function tts(text) {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, voice: VOICE, input: text, response_format: 'mp3' }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB_NAME || 'englishintg' });
  const db = mongoose.connection.db;

  const jobs = []; // {file, text}

  // 1) listen-задания
  const lessons = await db.collection('lessons').find({ 'tasks.type': 'listen' }).toArray();
  for (const l of lessons) {
    for (const t of l.tasks || []) {
      if (t.type === 'listen' && t.data && t.data.audioKey && t.data.transcript) {
        jobs.push({ file: path.join(MEDIA, sanitize(t.data.audioKey) + '.mp3'), text: String(t.data.transcript) });
      }
    }
  }
  const listenCount = jobs.length;

  // 1b) speak-задания → озвучка из target (модель произношения); ключ по sha1(target)
  const speakLessons = await db.collection('lessons').find({ 'tasks.type': 'speak' }).toArray();
  let speakCount = 0;
  for (const l of speakLessons) {
    for (const t of l.tasks || []) {
      if (t.type === 'speak' && t.data && t.data.target) {
        const h = sha(String(t.data.target));
        jobs.push({ file: path.join(SPEAK_DIR, h + '.mp3'), text: String(t.data.target) });
        speakCount++;
      }
    }
  }

  // 2) примеры справочника — проставляем audioUrl в БД + собираем джобы
  const articles = await db.collection('handbook_articles').find({}).toArray();
  let hbRows = 0, articlesTouched = 0;
  for (const a of articles) {
    let changed = false;
    for (const b of a.blocks || []) {
      if (b.type === 'example' && b.en) {
        const h = sha(b.en); b.audioUrl = `/audio/hb/${h}.mp3`;
        jobs.push({ file: path.join(HB_DIR, h + '.mp3'), text: String(b.en) }); hbRows++; changed = true;
      }
      if (b.type === 'examples' && Array.isArray(b.items)) {
        for (const it of b.items) if (it.en) {
          const h = sha(it.en); it.audioUrl = `/audio/hb/${h}.mp3`;
          jobs.push({ file: path.join(HB_DIR, h + '.mp3'), text: String(it.en) }); hbRows++; changed = true;
        }
      }
    }
    if (changed && !DRY) { await db.collection('handbook_articles').updateOne({ _id: a._id }, { $set: { blocks: a.blocks } }); articlesTouched++; }
  }

  // dedup по файлу
  const map = new Map();
  for (const j of jobs) if (!map.has(j.file)) map.set(j.file, j.text);
  const uniq = [...map.entries()].map(([file, text]) => ({ file, text }));
  const todo = uniq.filter((j) => !fs.existsSync(j.file));
  console.log(`listen jobs: ${listenCount} | speak jobs: ${speakCount} | handbook rows: ${hbRows} (articles updated: ${articlesTouched})`);
  console.log(`unique clips: ${uniq.length} | present: ${uniq.length - todo.length} | to generate: ${todo.length}`);
  if (DRY) { console.log('DRY — no generation'); await mongoose.disconnect(); return; }

  let done = 0, failed = 0, idx = 0;
  async function worker() {
    while (idx < todo.length) {
      const j = todo[idx++];
      try { fs.writeFileSync(j.file, await tts(j.text)); done++; }
      catch (e) { failed++; console.error('FAIL', path.basename(j.file), e.message); }
      if ((done + failed) % 25 === 0) console.log(`  ${done + failed}/${todo.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\nGenerated ${done}, failed ${failed}.`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
