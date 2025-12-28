import { TaskDto } from '../dto/task-data.dto';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export function lintLessonTasks(lessonRef: string, tasks?: TaskDto[], moduleRef?: string): string[] {
  const errors: string[] = [];
  if (moduleRef) {
    const pattern = new RegExp(`^${escapeRegExp(moduleRef)}\\.\\d{3}$`);
    if (!pattern.test(lessonRef)) {
      errors.push(`lessonRef must match ${moduleRef}.NNN`);
    }
  }
  if (!tasks || tasks.length === 0) return errors;
  const seen = new Set<string>();
  tasks.forEach((t, i) => {
    if (seen.has(t.ref)) errors.push(`duplicate task.ref: ${t.ref}`);
    seen.add(t.ref);
    if (!t.ref.startsWith(`${lessonRef}.`)) errors.push(`task[${i}].ref must start with ${lessonRef}.`);
    if (t.type === 'choice' || t.type === 'multiple_choice') {
      const label = t.type;
      const d = t.data as any;
      if (!Array.isArray(d.options) || d.options.length < 2) errors.push(`${label}[${i}] requires >=2 options`);
      if (typeof d.correctIndex !== 'number') errors.push(`${label}[${i}] missing correctIndex`);
    }
    if (t.type === 'gap') {
      const d = t.data as any;
      if (typeof d.text !== 'string' || !d.text.includes('____')) errors.push(`gap[${i}].text must contain ____`);
      if (typeof d.answer !== 'string' || !d.answer) errors.push(`gap[${i}].answer is required`);
    }
    if (t.type === 'translate') {
      const d = t.data as any;
      if (!Array.isArray(d.expected) || d.expected.length === 0 || !d.expected.every(isNonEmptyString)) {
        errors.push(`translate[${i}].expected must be non-empty string array`);
      }
    }
    if (t.type === 'order') {
      const d = t.data as any;
      if (!Array.isArray(d.tokens) || d.tokens.length === 0 || !d.tokens.every(isNonEmptyString)) {
        errors.push(`order[${i}].tokens must be non-empty string array`);
      }
    }
    if (t.type === 'matching' || t.type === 'match') {
      const d = t.data as any;
      const pairsValid =
        Array.isArray(d.pairs) &&
        d.pairs.length > 0 &&
        d.pairs.every((pair: any) => isNonEmptyString(pair?.left) && isNonEmptyString(pair?.right));
      if (!pairsValid) errors.push(`${t.type}[${i}].pairs must include left/right`);
    }
    if (t.type === 'listen' || t.type === 'listening') {
      const d = t.data as any;
      if (!isNonEmptyString(d.audioKey)) errors.push(`${t.type}[${i}].audioKey is required`);
    }
    if (t.type === 'flashcard') {
      const d = t.data as any;
      if (!isNonEmptyString(d.front) || !isNonEmptyString(d.back)) {
        errors.push(`flashcard[${i}].front/back are required`);
      }
    }
  });
  return errors;
}
