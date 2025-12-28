import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AnswerValidatorService } from '../answer-validator.service';
import { Lesson, LessonDocument } from '../../common/schemas/lesson.schema';

describe('AnswerValidatorService', () => {
  let service: AnswerValidatorService;
  let lessonModel: Model<LessonDocument>;

  const mockLessonModel = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnswerValidatorService,
        {
          provide: getModelToken(Lesson.name),
          useValue: mockLessonModel,
        },
      ],
    }).compile();

    service = module.get<AnswerValidatorService>(AnswerValidatorService);
    lessonModel = module.get<Model<LessonDocument>>(getModelToken(Lesson.name));

    jest.clearAllMocks();
  });

  it('validates choice and multiple_choice answers', async () => {
    mockLessonModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        lessonRef: 'a0.basics.001',
        tasks: [
          { ref: 't1', type: 'choice', data: { options: ['a', 'b'] }, validationData: { options: ['a', 'b'], correctIndex: 1 } },
          { ref: 't2', type: 'multiple_choice', data: { options: ['x', 'y'] }, validationData: { options: ['x', 'y'], correctIndex: 0 } },
        ],
      }),
    });

    const choiceResult = await service.validateAnswer('a0.basics.001', 't1', '1');
    const multiResult = await service.validateAnswer('a0.basics.001', 't2', '0');

    expect(choiceResult.isCorrect).toBe(true);
    expect(choiceResult.score).toBe(1);
    expect(multiResult.isCorrect).toBe(true);
  });

  it('validates gap answers with alternatives', async () => {
    mockLessonModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        lessonRef: 'a0.basics.001',
        tasks: [
          { ref: 't1', type: 'gap', data: { text: 'Hello ____', answer: 'Hello', accept: ['Hi'] } },
        ],
      }),
    });

    const result = await service.validateAnswer('a0.basics.001', 't1', 'hi');

    expect(result.isCorrect).toBe(true);
    expect(result.score).toBe(1);
  });

  it('validates order answers with partial score', async () => {
    mockLessonModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        lessonRef: 'a0.basics.001',
        tasks: [
          { ref: 't1', type: 'order', data: { tokens: ['What', 'time', 'is', 'it'] }, validationData: { tokens: ['What', 'time', 'is', 'it'] } },
        ],
      }),
    });

    const result = await service.validateAnswer('a0.basics.001', 't1', JSON.stringify(['What', 'is', 'time', 'it']));

    expect(result.isCorrect).toBe(false);
    expect(result.score).toBeGreaterThan(0);
  });

  it('returns a detailed error for invalid order format', async () => {
    mockLessonModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        lessonRef: 'a0.basics.001',
        tasks: [
          { ref: 't1', type: 'order', data: { tokens: ['What', 'time', 'is', 'it'] }, validationData: { tokens: ['What', 'time', 'is', 'it'] } },
        ],
      }),
    });

    await expect(service.validateAnswer('a0.basics.001', 't1', 'not-json')).rejects.toThrow(
      'Неверный формат ответа для order: ожидается JSON-массив строк, например ["What","time","is","it","?"]',
    );
  });

  it('validates translate answers by similarity', async () => {
    mockLessonModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        lessonRef: 'a0.basics.001',
        tasks: [
          { ref: 't1', type: 'translate', data: { question: 'Translate' }, validationData: { expected: ['Hello there'] } },
        ],
      }),
    });

    const result = await service.validateAnswer('a0.basics.001', 't1', 'Hello there');

    expect(result.isCorrect).toBe(true);
    expect(result.score).toBe(1);
  });

  it('throws when translate expected answers are missing', async () => {
    mockLessonModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        lessonRef: 'a0.basics.001',
        tasks: [
          { ref: 't1', type: 'translate', data: { question: 'Translate' } },
        ],
      }),
    });

    await expect(service.validateAnswer('a0.basics.001', 't1', 'Hello')).rejects.toThrow(
      'Отсутствуют ожидаемые ответы для translate-задачи',
    );
  });

  it('validates listen/speak answers with audio similarity', async () => {
    mockLessonModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        lessonRef: 'a0.basics.001',
        tasks: [
          { ref: 't1', type: 'listen', data: { audioKey: 'audio' }, validationData: { target: 'hello' } },
          { ref: 't2', type: 'speak', data: { prompt: 'Say hello' }, validationData: { target: 'hello' } },
        ],
      }),
    });

    const listenResult = await service.validateAnswer('a0.basics.001', 't1', 'hello');
    const speakResult = await service.validateAnswer('a0.basics.001', 't2', 'hello');

    expect(listenResult.isCorrect).toBe(true);
    expect(speakResult.isCorrect).toBe(true);
  });

  it('returns a detailed error for invalid matching format', async () => {
    mockLessonModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        lessonRef: 'a0.basics.001',
        tasks: [
          {
            ref: 't1',
            type: 'matching',
            data: { pairs: [{ left: 'cat', right: 'кот' }] },
            validationData: { pairs: [{ left: 'cat', right: 'кот' }] },
          },
        ],
      }),
    });

    await expect(service.validateAnswer('a0.basics.001', 't1', '"not-an-array"')).rejects.toThrow(
      'Неверный формат ответа для matching: ожидается JSON-массив пар или объектов с left/right.',
    );
  });
});
