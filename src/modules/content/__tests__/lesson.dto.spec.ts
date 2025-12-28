import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateLessonDto } from '../dto/lesson.dto';

const validLesson = {
  moduleRef: 'a0.basics',
  lessonRef: 'a0.basics.001',
  title: {
    ru: 'Урок 1',
    en: 'Lesson 1',
  },
  estimatedMinutes: 5,
  tasks: [
    {
      ref: 'a0.basics.001.t1',
      type: 'choice',
      data: { question: 'Pick', options: ['a', 'b'], correctIndex: 1 },
    },
  ],
};

describe('CreateLessonDto', () => {
  it('should validate a valid payload', async () => {
    const dto = plainToInstance(CreateLessonDto, validLesson);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should fail when required fields are missing', async () => {
    const dto = plainToInstance(CreateLessonDto, { moduleRef: 'a0.basics' });
    const errors = await validate(dto);

    expect(errors.some(e => e.property === 'lessonRef')).toBe(true);
    expect(errors.some(e => e.property === 'title')).toBe(true);
  });

  it('should fail when multilingual title is missing locales', async () => {
    const dto = plainToInstance(CreateLessonDto, {
      ...validLesson,
      title: { ru: 'Только русский' },
    });
    const errors = await validate(dto);

    const titleError = errors.find(e => e.property === 'title');
    expect(titleError?.children?.some(child => child.property === 'en')).toBe(true);
  });

  it('should validate estimatedMinutes min value', async () => {
    const dto = plainToInstance(CreateLessonDto, { ...validLesson, estimatedMinutes: 0 });
    const errors = await validate(dto);

    expect(errors.some(e => e.property === 'estimatedMinutes')).toBe(true);
  });

  it('should fail when type is invalid', async () => {
    const dto = plainToInstance(CreateLessonDto, { ...validLesson, type: 'speaking' });
    const errors = await validate(dto);

    expect(errors.some(e => e.property === 'type')).toBe(true);
  });

  it('should fail when difficulty is invalid', async () => {
    const dto = plainToInstance(CreateLessonDto, { ...validLesson, difficulty: 'expert' });
    const errors = await validate(dto);

    expect(errors.some(e => e.property === 'difficulty')).toBe(true);
  });
});
