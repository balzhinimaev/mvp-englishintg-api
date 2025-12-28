import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TaskDto } from '../dto/task-data.dto';

describe('TaskDto', () => {
  it('should validate choice task data', async () => {
    const dto = plainToInstance(TaskDto, {
      ref: 'a0.basics.001.t1',
      type: 'choice',
      data: { question: 'Pick', options: ['a', 'b'], correctIndex: 1 },
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate gap task data', async () => {
    const dto = plainToInstance(TaskDto, {
      ref: 'a0.basics.001.t2',
      type: 'gap',
      data: { text: 'It costs ____ dollars' },
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail for invalid type', async () => {
    const dto = plainToInstance(TaskDto, {
      ref: 'a0.basics.001.t3',
      type: 'invalid',
      data: {},
    });

    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'type')).toBe(true);
  });
});
