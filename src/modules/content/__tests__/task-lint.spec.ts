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
});
