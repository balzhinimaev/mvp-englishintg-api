import { BadRequestException } from '@nestjs/common';
import { ProgressController } from '../progress.controller';
import { ProgressService } from '../progress.service';
import { AnswerValidatorService } from '../answer-validator.service';
import { SubmitAnswerDto } from '../dto/submit-answer.dto';

describe('ProgressController', () => {
  it('should throw BadRequestException with validator error message', async () => {
    // Мокируем console.error чтобы не загрязнять вывод тестов
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    const mockProgressService = {
      recordTaskAttempt: jest.fn(),
    } as unknown as ProgressService;
    const mockValidatorService = {
      validateAnswer: jest.fn().mockRejectedValue(new Error('Lesson not found')),
    } as unknown as AnswerValidatorService;

    const controller = new ProgressController(
      mockProgressService,
      mockValidatorService,
      {} as any,
      {} as any,
      {} as any,
    );

    const body: SubmitAnswerDto = {
      lessonRef: 'a0.test.lesson',
      taskRef: 'a0.test.lesson.t1',
      userAnswer: 'answer',
    };

    try {
      await controller.submitAnswer('idempotency-key', body, { user: { userId: 'user-1' } });
      fail('Ожидалось исключение BadRequestException');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getStatus()).toBe(400);
      const response = (error as BadRequestException).getResponse();
      if (typeof response === 'string') {
        expect(response).toBe('Lesson not found');
      } else {
        expect(response).toMatchObject({ message: 'Lesson not found' });
      }
    } finally {
      // Восстанавливаем оригинальную реализацию console.error
      consoleErrorSpy.mockRestore();
    }
  });
});
