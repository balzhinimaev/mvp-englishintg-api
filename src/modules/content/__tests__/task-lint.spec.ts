import { lintLessonTasks } from '../utils/task-lint';

describe('lintLessonTasks', () => {
  it('should detect duplicate task refs and invalid prefix', () => {
    const errors = lintLessonTasks('a0.basics.001', [
      { ref: 'a0.basics.001.t1', type: 'choice', data: { options: ['a', 'b'], correctIndex: 1 } },
      { ref: 'a0.basics.001.t1', type: 'gap', data: { text: 'It costs ____', answer: '10' } },
      { ref: 'wrong.t2', type: 'gap', data: { text: 'It costs ____', answer: '10' } },
    ] as any);

    expect(errors).toEqual(
      expect.arrayContaining([
        'duplicate task.ref: a0.basics.001.t1',
        'task[2].ref must start with a0.basics.001.',
      ])
    );
  });

  it('should validate choice and gap task fields', () => {
    const errors = lintLessonTasks('a0.basics.001', [
      { ref: 'a0.basics.001.t1', type: 'choice', data: { options: ['a'] } },
      { ref: 'a0.basics.001.t2', type: 'gap', data: { text: 'Missing', answer: '' } },
    ] as any);

    expect(errors).toEqual(
      expect.arrayContaining([
        'choice[0] requires >=2 options',
        'choice[0] missing correctIndex',
        'gap[1].text must contain ____',
        'gap[1].answer is required',
      ])
    );
  });

  it('should validate multiple_choice task fields', () => {
    const errors = lintLessonTasks('a0.basics.001', [
      { ref: 'a0.basics.001.t1', type: 'multiple_choice', data: { options: ['a'] } },
    ] as any);

    expect(errors).toEqual(
      expect.arrayContaining([
        'multiple_choice[0] requires >=2 options',
        'multiple_choice[0] missing correctIndex',
      ])
    );
  });

  it('should report mismatched moduleRef and lessonRef', () => {
    const errors = lintLessonTasks('a0.basics.001', undefined, 'a0.travel');

    expect(errors).toEqual(expect.arrayContaining(['lessonRef must match a0.travel.NNN']));
  });

  it('should require tasks when published', () => {
    const errors = lintLessonTasks('a0.basics.001', undefined, 'a0.basics', true);

    expect(errors).toEqual(expect.arrayContaining(['published lesson requires tasks']));
  });

  it('should validate speak prompt and listen audioKey trimming', () => {
    const errors = lintLessonTasks('a0.basics.001', [
      { ref: 'a0.basics.001.t1', type: 'speak', data: { prompt: '   ' } },
      { ref: 'a0.basics.001.t2', type: 'listen', data: { audioKey: ' audio.key ' } },
    ] as any);

    expect(errors).toEqual(
      expect.arrayContaining(['speak[0].prompt is required', 'listen[1].audioKey is required'])
    );
  });

  it('should validate flashcard front/back as non-empty strings', () => {
    const errors = lintLessonTasks('a0.basics.001', [
      { ref: 'a0.basics.001.t1', type: 'flashcard', data: { front: '', back: '   ' } },
    ] as any);

    expect(errors).toEqual(expect.arrayContaining(['flashcard[0].front/back are required']));
  });

  it('should accept valid speak, listen, and flashcard tasks', () => {
    const errors = lintLessonTasks('a0.basics.001', [
      { ref: 'a0.basics.001.t1', type: 'speak', data: { prompt: 'Say hello' } },
      { ref: 'a0.basics.001.t2', type: 'listening', data: { audioKey: 'a0.basics.001.t2' } },
      { ref: 'a0.basics.001.t3', type: 'flashcard', data: { front: 'Hello', back: 'Привет' } },
    ] as any);

    expect(errors).toEqual([]);
  });
});
