const LESSON_REF_REGEX = /^[a-z0-9]+\.[a-z0-9_]+\.\d{3}$/;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const isValidLessonRef = (lessonRef: unknown): lessonRef is string =>
  typeof lessonRef === 'string' && LESSON_REF_REGEX.test(lessonRef);

export const matchesModuleRef = (lessonRef: string, moduleRef: string): boolean => {
  if (!isValidLessonRef(lessonRef) || typeof moduleRef !== 'string') return false;
  const pattern = new RegExp(`^${escapeRegExp(moduleRef)}\\.\\d{3}$`);
  return pattern.test(lessonRef);
};
