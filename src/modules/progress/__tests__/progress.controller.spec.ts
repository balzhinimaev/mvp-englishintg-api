import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProgressController } from '../progress.controller';
import { ProgressService } from '../progress.service';
import { AnswerValidatorService, LessonNotFoundError } from '../answer-validator.service';
import { SubmitAnswerDto } from '../dto/submit-answer.dto';

describe('ProgressController', () => {
  it('should execute runtime lifecycle: start -> submit-answer -> end', async () => {
    const mockProgressService = {
      startSession: jest.fn().mockResolvedValue({ _id: 'session-1' }),
      recordTaskAttempt: jest.fn().mockResolvedValue({ _id: 'attempt-1' }),
      endSession: jest.fn().mockResolvedValue({ _id: 'session-1', endedAt: new Date() }),
    } as unknown as ProgressService;

    const mockValidatorService = {
      validateAnswer: jest.fn().mockResolvedValue({
        isCorrect: true,
        score: 1,
        feedback: 'ok',
        correctAnswer: 'What time is it ?',
        explanation: 'word order',
      }),
    } as unknown as AnswerValidatorService;

    const controller = new ProgressController(
      mockProgressService,
      mockValidatorService,
      {} as any,
      {} as any,
      {} as any,
    );

    const req = { user: { userId: 'user-1' } };

    const start = await controller.startSession({ moduleRef: 'a0.basics', lessonRef: 'a0.basics.001', source: 'home' }, req);
    expect(start).toEqual({ sessionId: 'session-1' });

    const body: SubmitAnswerDto = {
      lessonRef: 'a0.basics.001',
      taskRef: 'a0.basics.001.t1',
      userAnswer: JSON.stringify(['What', 'time', 'is', 'it', '?']),
      durationMs: 1200,
      sessionId: 'session-1',
      lastTaskIndex: 0,
      isLastTask: true,
    };

    const submit = await controller.submitAnswer('idem-1', body, req);
    expect(submit).toEqual({
      attemptId: 'attempt-1',
      isCorrect: true,
      score: 1,
      feedback: 'ok',
      correctAnswer: 'What time is it ?',
      explanation: 'word order',
    });

    expect((mockProgressService.recordTaskAttempt as any)).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        lessonRef: 'a0.basics.001',
        taskRef: 'a0.basics.001.t1',
        clientAttemptId: 'idem-1',
      }),
    );

    const end = await controller.endSession('session-1', { extraXp: 0 });
    expect(end).toEqual({ ok: true });
  });

  it('should require Idempotency-Key for submit-answer', async () => {
    const controller = new ProgressController(
      { recordTaskAttempt: jest.fn() } as unknown as ProgressService,
      { validateAnswer: jest.fn() } as unknown as AnswerValidatorService,
      {} as any,
      {} as any,
      {} as any,
    );

    const body: SubmitAnswerDto = {
      lessonRef: 'a0.test.lesson',
      taskRef: 'a0.test.lesson.t1',
      userAnswer: 'answer',
    };

    await expect(controller.submitAnswer('', body, { user: { userId: 'user-1' } })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should throw NotFoundException for missing lesson/task in validator', async () => {
    const mockProgressService = {
      recordTaskAttempt: jest.fn(),
    } as unknown as ProgressService;
    const mockValidatorService = {
      validateAnswer: jest.fn().mockRejectedValue(new LessonNotFoundError('Lesson not found')),
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

    await expect(controller.submitAnswer('idem-2', body, { user: { userId: 'user-1' } })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should preserve ForbiddenException from business guards', async () => {
    const mockProgressService = {
      recordTaskAttempt: jest.fn(),
    } as unknown as ProgressService;
    const mockValidatorService = {
      validateAnswer: jest.fn().mockRejectedValue(new ForbiddenException('PREREQ_NOT_MET')),
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

    await expect(controller.submitAnswer('idem-3', body, { user: { userId: 'user-1' } })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
