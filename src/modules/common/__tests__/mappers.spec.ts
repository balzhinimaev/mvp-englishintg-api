import { LessonMapper, LessonProgressMapper } from '../utils/mappers';
import { Lesson } from '../schemas/lesson.schema';
import { UserLessonProgress } from '../schemas/user-lesson-progress.schema';

describe('LessonMapper', () => {
  it('should apply defaults and use Response DTO with white list', () => {
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
          data: { text: 'Hello ____', answer: 'world', alternatives: ['earth'], hint: 'a planet' },
        },
      ],
    } as Lesson;

    const result = LessonMapper.toDto(lesson, 'ru');

    expect(result.estimatedMinutes).toBe(10);
    expect(result.xpReward).toBe(25);
    expect(result.type).toBe('vocabulary');
    expect(result.difficulty).toBe('easy');
    expect(result.hasAudio).toBe(true);
    expect(result.hasVideo).toBe(false);
    expect(result.order).toBe(0);

    // Response DTO использует белый список (@Expose) - только безопасные поля
    // choice task: options и explanation видны, correctIndex - НЕТ
    expect(result.tasks?.[0].data).toMatchObject({ 
      options: ['a', 'b'], 
      explanation: 'why' 
    });
    expect(result.tasks?.[0].data).not.toHaveProperty('correctIndex');

    // gap task: text и hint видны, answer и alternatives - НЕТ
    expect(result.tasks?.[1].data).toMatchObject({ 
      text: 'Hello ____',
      hint: 'a planet'
    });
    expect(result.tasks?.[1].data).not.toHaveProperty('answer');
    expect(result.tasks?.[1].data).not.toHaveProperty('alternatives');
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
