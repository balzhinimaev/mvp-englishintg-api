/**
 * SRS-планировщик (SM-2-lite) для атомов знания (слов/фраз).
 * Чистая функция: по текущему состоянию памяти и оценке ответа
 * возвращает новый интервал, ease, дату следующего повторения и статус.
 */
export type Grade = 'again' | 'good' | 'easy';

export interface SrsState {
  repetitions: number; // подряд успешных повторений
  intervalDays: number; // текущий интервал
  ease: number; // фактор лёгкости
  lapses: number; // сколько раз забывал
}

export interface SrsResult extends SrsState {
  dueAt: Date;
  status: 'learning' | 'learned';
}

const DAY_MS = 24 * 60 * 60 * 1000;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Порог, после которого атом считаем «в долгой памяти»
export const LEARNED_INTERVAL_DAYS = 21;

export function schedule(prev: Partial<SrsState> | null | undefined, grade: Grade, now: Date): SrsResult {
  let repetitions = prev?.repetitions ?? 0;
  let intervalDays = prev?.intervalDays ?? 0;
  let ease = prev?.ease ?? 2.5;
  let lapses = prev?.lapses ?? 0;
  let dueMs: number;

  if (grade === 'again') {
    // забыл — сбрасываем прогресс, атом вернётся в этой же сессии (~10 минут)
    repetitions = 0;
    lapses += 1;
    ease = clamp(ease - 0.2, 1.3, 3.0);
    intervalDays = 0;
    dueMs = now.getTime() + 10 * 60 * 1000;
  } else {
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = grade === 'easy' ? 6 : 3;
    } else {
      intervalDays = Math.round(intervalDays * ease * (grade === 'easy' ? 1.3 : 1));
    }
    intervalDays = clamp(intervalDays, 1, 365);
    repetitions += 1;
    if (grade === 'easy') ease = clamp(ease + 0.15, 1.3, 3.0);
    dueMs = now.getTime() + intervalDays * DAY_MS;
  }

  const status: 'learning' | 'learned' = intervalDays >= LEARNED_INTERVAL_DAYS ? 'learned' : 'learning';
  return { repetitions, intervalDays, ease, lapses, dueAt: new Date(dueMs), status };
}
