import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SubmitAnswerDto } from '../dto/submit-answer.dto';

describe('SubmitAnswerDto', () => {
  it('should validate a valid payload', async () => {
    const dto = plainToInstance(SubmitAnswerDto, {
      lessonRef: 'a0.basics.001',
      taskRef: 'a0.basics.001.t1',
      userAnswer: '1',
      durationMs: 1200,
      isLastTask: true,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail when required fields are missing', async () => {
    const dto = plainToInstance(SubmitAnswerDto, { lessonRef: 'a0.basics.001' });
    const errors = await validate(dto);

    expect(errors.some(e => e.property === 'taskRef')).toBe(true);
    expect(errors.some(e => e.property === 'userAnswer')).toBe(true);
  });
});
