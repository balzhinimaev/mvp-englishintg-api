import { TaskDto } from '../dto/task-data.dto';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
  });
  return errors;
}
