/**
 * Сидирование справочника (самоучителя).
 * Usage: SEED_FILE=seeds/handbook.json ts-node scripts/seed-handbook.ts [--dry]
 * Файл: { "articles": [ { ref, category, title{ru,en}, summary?, level?, icon?, order?, blocks:[] } ] }
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';
import { HandbookArticle, HandbookArticleSchema } from '../src/modules/common/schemas/handbook-article.schema';

const DRY = process.argv.includes('--dry');
const FILE = process.env.SEED_FILE || 'seeds/handbook.json';

const VALID_CATEGORIES = new Set(['grammar', 'cheatsheet', 'phrases', 'pronunciation']);
const VALID_BLOCK_TYPES = new Set(['heading', 'text', 'rule', 'example', 'examples', 'table', 'tip', 'note']);

function validate(articles: any[]): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const a of articles) {
    if (!a.ref) { issues.push('article missing ref'); continue; }
    if (seen.has(a.ref)) issues.push(`duplicate ref: ${a.ref}`);
    seen.add(a.ref);
    if (!VALID_CATEGORIES.has(a.category)) issues.push(`${a.ref}: bad category ${a.category}`);
    if (!a.title?.ru || !a.title?.en) issues.push(`${a.ref}: title needs ru+en`);
    if (!Array.isArray(a.blocks) || a.blocks.length === 0) issues.push(`${a.ref}: no blocks`);
    for (const [i, b] of (a.blocks || []).entries()) {
      if (!VALID_BLOCK_TYPES.has(b?.type)) { issues.push(`${a.ref}: block[${i}] bad type ${b?.type}`); continue; }
      if (['heading', 'text', 'rule', 'tip', 'note'].includes(b.type) && !String(b.text || '').trim())
        issues.push(`${a.ref}: block[${i}] ${b.type} empty text`);
      if (b.type === 'example' && (!b.en || !b.ru)) issues.push(`${a.ref}: block[${i}] example needs en+ru`);
      if (b.type === 'examples' && (!Array.isArray(b.items) || !b.items.length)) issues.push(`${a.ref}: block[${i}] examples empty`);
      if (b.type === 'table' && (!Array.isArray(b.headers) || !Array.isArray(b.rows) || !b.rows.length))
        issues.push(`${a.ref}: block[${i}] table needs headers+rows`);
    }
  }
  return issues;
}

async function main() {
  const p = path.resolve(process.cwd(), FILE);
  const raw = fs.readFileSync(p, 'utf8');
  const data = JSON.parse(raw);
  const articles: any[] = data.articles || [];
  console.log(`Loaded ${articles.length} articles from ${FILE}`);

  const issues = validate(articles);
  if (issues.length) {
    console.error(`❌ Validation failed (${issues.length}):`);
    issues.slice(0, 50).forEach((x) => console.error('  - ' + x));
    process.exit(1);
  }
  console.log('✅ Validation OK');

  if (DRY) {
    console.log('DRY-RUN — no writes.');
    articles.forEach((a) => console.log(`  would upsert ${a.ref} (${a.category}, ${a.blocks.length} blocks)`));
    return;
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB_NAME || 'englishintg' });
  const Model = mongoose.model(HandbookArticle.name, HandbookArticleSchema);

  let up = 0;
  for (const a of articles) {
    await Model.updateOne({ ref: a.ref }, { $set: a }, { upsert: true });
    up++;
    console.log(`+ upsert ${a.ref}`);
  }
  console.log(`\nDone. Upserted ${up} articles.`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });
