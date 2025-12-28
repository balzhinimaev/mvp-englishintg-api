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
          { ref: 't1', type: 'choice', data: { options: ['a', 'b'], correctIndex: 1 } },
          { ref: 't2', type: 'multiple_choice', data: { options: ['x', 'y'], correctIndex: 0 } },
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
          { ref: 't1', type: 'gap', data: { answer: 'Hello', alternatives: ['Hi'] } },
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
          { ref: 't1', type: 'order', data: { tokens: ['What', 'time', 'is', 'it'] } },
        ],
      }),
    });

    const result = await service.validateAnswer('a0.basics.001', 't1', JSON.stringify(['What', 'is', 'time', 'it']));

    expect(result.isCorrect).toBe(false);
    expect(result.score).toBeGreaterThan(0);
  });

  it('validates translate answers by similarity', async () => {
    mockLessonModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        lessonRef: 'a0.basics.001',
        tasks: [
          { ref: 't1', type: 'translate', data: { expected: ['Hello there'] } },
        ],
      }),
    });

    const result = await service.validateAnswer('a0.basics.001', 't1', 'Hello there');

    expect(result.isCorrect).toBe(true);
    expect(result.score).toBe(1);
  });

  it('validates listen/speak answers with audio similarity', async () => {
    mockLessonModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        lessonRef: 'a0.basics.001',
        tasks: [
          { ref: 't1', type: 'listen', data: { target: 'hello' } },
          { ref: 't2', type: 'speak', data: { target: 'hello' } },
        ],
      }),
    });

    const listenResult = await service.validateAnswer('a0.basics.001', 't1', 'hello');
    const speakResult = await service.validateAnswer('a0.basics.001', 't2', 'hello');

    expect(listenResult.isCorrect).toBe(true);
    expect(speakResult.isCorrect).toBe(true);
  });
});
