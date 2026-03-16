import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AnswerValidatorService } from '../answer-validator.service';
import { Lesson, LessonDocument } from '../../common/schemas/lesson.schema';
import { ChoiceValidationStrategy } from '../strategies/choice-validation.strategy';
import { GapValidationStrategy } from '../strategies/gap-validation.strategy';
import { OrderValidationStrategy } from '../strategies/order-validation.strategy';
import { TranslateValidationStrategy } from '../strategies/translate-validation.strategy';
import { AudioValidationStrategy } from '../strategies/audio-validation.strategy';
import { MatchingValidationStrategy } from '../strategies/matching-validation.strategy';
import { FlashcardValidationStrategy } from '../strategies/flashcard-validation.strategy';

describe('SubmitAnswer contract compatibility', () => {
  let service: AnswerValidatorService;

  const mockLessonModel = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnswerValidatorService,
        ChoiceValidationStrategy,
        GapValidationStrategy,
        OrderValidationStrategy,
        TranslateValidationStrategy,
        AudioValidationStrategy,
        MatchingValidationStrategy,
        FlashcardValidationStrategy,
        {
          provide: getModelToken(Lesson.name),
          useValue: mockLessonModel,
        },
      ],
    }).compile();

    service = module.get<AnswerValidatorService>(AnswerValidatorService);
    service.onModuleInit();

    mockLessonModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        lessonRef: 'contract.lesson.001',
        tasks: [
          { ref: 'choice', type: 'choice', validationData: { options: ['A', 'B'], correctIndex: 1 }, data: {} },
          { ref: 'gap', type: 'gap', validationData: { answer: 'hello' }, data: {} },
          { ref: 'order', type: 'order', validationData: { tokens: ['What', 'time'] }, data: {} },
          { ref: 'translate', type: 'translate', validationData: { expected: ['hello'] }, data: {} },
          { ref: 'listen-index', type: 'listening', validationData: { options: ['A', 'B'], correctIndex: 1 }, data: {} },
          { ref: 'listen-text', type: 'listening', validationData: { options: ['A', 'B'], correctIndex: 1 }, data: {} },
          { ref: 'speak', type: 'speak', validationData: { target: 'hello' }, data: {} },
          { ref: 'match-array', type: 'matching', validationData: { pairs: [{ left: 'cat', right: 'кот' }] }, data: {} },
          { ref: 'match-map', type: 'matching', validationData: { pairs: [{ left: 'cat', right: 'кот' }] }, data: {} },
        ],
      }),
    });
  });

  it('accepts canonical payload encodings used by frontend', async () => {
    await expect(service.validateAnswer('contract.lesson.001', 'choice', '1')).resolves.toMatchObject({ isCorrect: true });
    await expect(service.validateAnswer('contract.lesson.001', 'gap', 'hello')).resolves.toMatchObject({ isCorrect: true });
    await expect(service.validateAnswer('contract.lesson.001', 'order', '["What","time"]')).resolves.toMatchObject({ isCorrect: true });
    await expect(service.validateAnswer('contract.lesson.001', 'translate', 'hello')).resolves.toMatchObject({ isCorrect: true });
    await expect(service.validateAnswer('contract.lesson.001', 'listen-index', '1')).resolves.toMatchObject({ isCorrect: true });
    await expect(service.validateAnswer('contract.lesson.001', 'listen-text', '"B"')).resolves.toMatchObject({ isCorrect: true });
    await expect(service.validateAnswer('contract.lesson.001', 'speak', 'hello')).resolves.toMatchObject({ isCorrect: true });
    await expect(service.validateAnswer('contract.lesson.001', 'match-array', '[{"left":"cat","right":"кот"}]')).resolves.toMatchObject({ isCorrect: true });
    await expect(service.validateAnswer('contract.lesson.001', 'match-map', '{"cat":"кот"}')).resolves.toMatchObject({ isCorrect: true });
  });
});
