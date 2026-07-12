/**
 * Нормализация свободного текстового ответа перед сравнением.
 * Убирает различия, за которые нельзя штрафовать пользователя:
 * регистр, крайние пробелы, обрамляющие кавычки, финальную пунктуацию
 * (точка/вопрос/воскл./;/:/запятая), двойные пробелы — и СОКРАЩЕНИЯ:
 * "we'll" ≡ "we will", "don't" ≡ "do not" и т.п., чтобы наборы expected
 * не обязаны были перечислять все комбинации сокращений.
 *
 * Сознательные ограничения:
 *  - "'s" раскрывается ТОЛЬКО у однозначных биграмм (there's/it's/that's…),
 *    иначе сломаем притяжательные ("my mother's car");
 *  - "'d" не раскрывается вовсе (would/had неразличимы без контекста);
 *  - "he's got" останется "he is got" и НЕ совпадёт с "he has got" —
 *    это не хуже прежнего поведения, такие пары должны быть в expected.
 */

// Порядок важен: особые формы (won't/can't) раньше общего правила n't
const CONTRACTIONS: Array<[RegExp, string]> = [
  [/\bwon't\b/gi, 'will not'],
  [/\bshan't\b/gi, 'shall not'],
  [/\bcan't\b/gi, 'cannot'],
  [/\bcan not\b/gi, 'cannot'],
  [/\b(\w+)n't\b/gi, '$1 not'], // don't, isn't, hasn't, didn't…
  [/\bi'm\b/gi, 'i am'],
  [/\b(\w+)'re\b/gi, '$1 are'],
  [/\b(\w+)'ll\b/gi, '$1 will'],
  [/\b(\w+)'ve\b/gi, '$1 have'],
  [/\blet's\b/gi, 'let us'],
  [/\b(there|here|that|it|he|she|who|what|where|when|how)'s\b/gi, '$1 is'],
];

export function normalizeAnswer(s: string, opts?: { caseInsensitive?: boolean }): string {
  const caseInsensitive = opts?.caseInsensitive !== false; // по умолчанию true
  let out = String(s ?? '').trim();
  if (caseInsensitive) out = out.toLowerCase();
  out = out
    .replace(/[’‘`´]/g, "'") // типографские апострофы → прямой
    .replace(/[«»"“”]/g, '') // кавычки (кроме апострофа)
    .replace(/[.!?;:,]+$/g, '') // финальная пунктуация
    .replace(/\s+/g, ' ')
    .trim();
  for (const [re, repl] of CONTRACTIONS) {
    out = out.replace(re, repl);
  }
  return out.replace(/\s+/g, ' ').trim();
}
