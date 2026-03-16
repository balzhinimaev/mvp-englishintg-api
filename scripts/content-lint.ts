import * as fs from 'fs/promises';
import * as path from 'path';

type AnyTask = { ref?: string; type?: string; data?: any };
type LessonLike = {
  lessonRef?: string;
  moduleRef?: string;
  order?: number;
  published?: boolean;
  tasks?: AnyTask[];
};

type ModuleLike = {
  moduleRef?: string;
  order?: number;
  published?: boolean;
};

const NUMBER_WORD_TO_DIGIT: Record<string, string> = {
  one: '1', two: '2', three: '3', four: '4', five: '5',
  six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
  eleven: '11', twelve: '12', thirteen: '13', fourteen: '14', fifteen: '15',
  sixteen: '16', seventeen: '17', eighteen: '18', nineteen: '19', twenty: '20',
};

export interface LintSummary {
  filesScanned: number;
  lessonsFound: number;
  modulesFound: number;
  gapsFound: number;
  gapsWithHintAndExplanation: number;
  issues: string[];
}

async function readJson(filePath: string): Promise<any | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function* walk(dir: string): AsyncGenerator<string> {
  let dirents: Array<{ name: string; isDirectory: () => boolean } & any> = [];
  try {
    dirents = await fs.readdir(dir, { withFileTypes: true }) as any;
  } catch {
    return;
  }
  for (const dirent of dirents) {
    const res = path.resolve(dir, dirent.name);
    if (dirent.isDirectory()) {
      yield* walk(res);
    } else if (dirent.name.endsWith('.json')) {
      yield res;
    }
  }
}

function pushIssue(summary: LintSummary, file: string, msg: string) {
  summary.issues.push(`${file} :: ${msg}`);
}

function validateTask(summary: LintSummary, file: string, lesson: LessonLike, task: AnyTask, lessonTaskRefs: Set<string>) {
  const taskRef = task?.ref || '<missing-task-ref>';
  const type = String(task?.type || '').trim();
  const data = task?.data || {};

  if (!task?.ref) {
    pushIssue(summary, file, `${lesson.lessonRef} -> task missing ref`);
  }
  if (lessonTaskRefs.has(taskRef)) {
    pushIssue(summary, file, `${lesson.lessonRef} -> duplicate task ref in lesson: ${taskRef}`);
  }
  lessonTaskRefs.add(taskRef);

  if (!type) {
    pushIssue(summary, file, `${lesson.lessonRef} -> ${taskRef} missing type`);
    return;
  }

  if (type === 'gap') {
    summary.gapsFound++;
    const hasHint = typeof data.hint === 'string' && data.hint.trim().length > 0;
    const hasExplanation = typeof data.explanation === 'string' && data.explanation.trim().length > 0;
    if (hasHint && hasExplanation) summary.gapsWithHintAndExplanation++;

    if (!hasHint || !hasExplanation) {
      pushIssue(
        summary,
        file,
        `${lesson.lessonRef} -> ${taskRef} missing ${!hasHint ? 'hint' : ''}${!hasHint && !hasExplanation ? ' & ' : ''}${!hasExplanation ? 'explanation' : ''}`,
      );
    }

    const answer: string | undefined = typeof data.answer === 'string' ? data.answer : undefined;
    if (!answer) {
      pushIssue(summary, file, `${lesson.lessonRef} -> ${taskRef} gap task missing answer`);
    } else {
      const key = answer.toLowerCase().trim();
      const digit = NUMBER_WORD_TO_DIGIT[key];
      if (digit) {
        const accept: string[] = Array.isArray(data.accept) ? data.accept : [];
        const hasDigit = accept.some(a => (a ?? '').toString().trim() === digit);
        if (!hasDigit) {
          pushIssue(summary, file, `${lesson.lessonRef} -> ${taskRef} numeric accept missing for "${answer}" -> ${digit}`);
        }
      }
    }
  }

  if (type === 'multiple_choice' || type === 'choice') {
    const options = Array.isArray(data.options) ? data.options : [];
    if (options.length < 2) {
      pushIssue(summary, file, `${lesson.lessonRef} -> ${taskRef} ${type} requires at least 2 options`);
    }
    if (data.correctIndex !== undefined) {
      if (typeof data.correctIndex !== 'number' || data.correctIndex < 0 || data.correctIndex >= options.length) {
        pushIssue(summary, file, `${lesson.lessonRef} -> ${taskRef} ${type} has invalid correctIndex`);
      }
    }
  }

  if (type === 'matching' || type === 'match') {
    const pairs = Array.isArray(data.pairs) ? data.pairs : [];
    if (pairs.length === 0) {
      pushIssue(summary, file, `${lesson.lessonRef} -> ${taskRef} matching task has empty pairs`);
    }
    for (let i = 0; i < pairs.length; i++) {
      const p = pairs[i] || {};
      const left = p.left ?? p.english;
      const right = p.right ?? p.russian;
      if (!left || !right) {
        pushIssue(summary, file, `${lesson.lessonRef} -> ${taskRef} matching pair[${i}] missing left/right`);
      }
    }
  }
}

export async function runContentLint(rootDirs: string[] = ['seeds', path.join('content', 'seeds')]): Promise<LintSummary> {
  const summary: LintSummary = {
    filesScanned: 0,
    lessonsFound: 0,
    modulesFound: 0,
    gapsFound: 0,
    gapsWithHintAndExplanation: 0,
    issues: [],
  };

  const jsonFiles: string[] = [];
  for (const root of rootDirs) {
    for await (const file of walk(root)) jsonFiles.push(file);
  }

  const globalLessonRefs = new Set<string>();
  const globalModuleRefs = new Set<string>();

  for (const file of jsonFiles) {
    summary.filesScanned++;
    const data = await readJson(file);
    if (!data) continue;

    const modules: ModuleLike[] = Array.isArray(data?.modules) ? data.modules : [];
    for (const mod of modules) {
      summary.modulesFound++;
      if (!mod.moduleRef) {
        pushIssue(summary, file, `module missing moduleRef`);
        continue;
      }
      if (globalModuleRefs.has(mod.moduleRef)) {
        pushIssue(summary, file, `duplicate moduleRef: ${mod.moduleRef}`);
      }
      globalModuleRefs.add(mod.moduleRef);
      if (mod.order !== undefined && typeof mod.order !== 'number') {
        pushIssue(summary, file, `${mod.moduleRef} has non-numeric order`);
      }
    }

    const lessons: LessonLike[] = Array.isArray(data?.lessons) ? data.lessons : [];
    for (const lesson of lessons) {
      summary.lessonsFound++;
      if (!lesson.lessonRef) {
        pushIssue(summary, file, `lesson missing lessonRef`);
        continue;
      }
      if (globalLessonRefs.has(lesson.lessonRef)) {
        pushIssue(summary, file, `duplicate lessonRef: ${lesson.lessonRef}`);
      }
      globalLessonRefs.add(lesson.lessonRef);

      if (!lesson.moduleRef) {
        pushIssue(summary, file, `${lesson.lessonRef} missing moduleRef`);
      }
      if (lesson.order !== undefined && typeof lesson.order !== 'number') {
        pushIssue(summary, file, `${lesson.lessonRef} has non-numeric order`);
      }

      const tasks = Array.isArray(lesson.tasks) ? lesson.tasks : [];
      if (tasks.length === 0) {
        pushIssue(summary, file, `${lesson.lessonRef} has no tasks`);
      }

      const lessonTaskRefs = new Set<string>();
      for (const task of tasks) {
        validateTask(summary, file, lesson, task, lessonTaskRefs);
      }
    }
  }

  return summary;
}

(async () => {
  const summary = await runContentLint();

  if (summary.issues.length) {
    console.error(`content:lint FAILED`);
    console.error(`Files scanned: ${summary.filesScanned}`);
    console.error(`Modules found: ${summary.modulesFound}`);
    console.error(`Lessons found: ${summary.lessonsFound}`);
    console.error(`GAP found: ${summary.gapsFound}`);
    console.error(`GAP with hint+explanation: ${summary.gapsWithHintAndExplanation}`);
    for (const issue of summary.issues) console.error(` - ${issue}`);
    process.exit(1);
  } else {
    console.log(`content:lint OK`);
    console.log(`Files scanned: ${summary.filesScanned}`);
    console.log(`Modules found: ${summary.modulesFound}`);
    console.log(`Lessons found: ${summary.lessonsFound}`);
    console.log(`GAP found: ${summary.gapsFound}`);
    console.log(`GAP with hint+explanation: ${summary.gapsWithHintAndExplanation}`);
  }
})();
