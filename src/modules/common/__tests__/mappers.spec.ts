import { LessonMapper, LessonProgressMapper } from '../utils/mappers';
import { Lesson } from '../schemas/lesson.schema';
import { UserLessonProgress } from '../schemas/user-lesson-progress.schema';

describe('LessonMapper', () => {
  it('should apply defaults and redact sensitive task data', () => {
    const lesson = {
      lessonRef: 'a0.basics.001',
      moduleRef: 'a0.basics',
      title: { ru: 'Урок 1', en: 'Lesson 1' },
      description: { ru: 'Описание', en: 'Description' },
      tasks: [
        {
          ref: 'a0.basics.001.t1',
          type: 'choice',
          data: { options: ['a', 'b'], correctIndex: 1, explanation: 'why' },
        },
        {
          ref: 'a0.basics.001.t2',
          type: 'gap',
          data: { text: 'Hello ____', answer: 'world', alternatives: ['earth'] },
        },
      ],
    } as Lesson;

    const result = LessonMapper.toDto(lesson, 'ru');

    expect(result.estimatedMinutes).toBe(8);
    expect(result.xpReward).toBe(25);
    expect(result.hasAudio).toBe(true);
    expect(result.hasVideo).toBe(false);
    expect(result.order).toBe(0);
    expect(result.tasks?.[0].data).toEqual({ options: ['a', 'b'], explanation: 'why' });
    expect(result.tasks?.[1].data).toEqual({ text: 'Hello ____', alternatives: ['earth'] });
  });
});

describe('LessonProgressMapper', () => {
  it('should map progress with defaults', () => {
    const progress = {
      status: 'completed',
      completedAt: new Date('2024-01-02T00:00:00Z'),
    } as UserLessonProgress;

    const result = LessonProgressMapper.toDto(progress);

    expect(result).toEqual({
      status: 'completed',
      score: 0,
      attempts: 0,
      completedAt: '2024-01-02T00:00:00.000Z',
      timeSpent: 0,
    });
  });
});
