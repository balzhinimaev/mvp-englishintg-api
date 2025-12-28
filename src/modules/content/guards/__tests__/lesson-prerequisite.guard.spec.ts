import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LessonPrerequisiteGuard } from '../lesson-prerequisite.guard';
import { Lesson, LessonDocument } from '../../../common/schemas/lesson.schema';
import { UserLessonProgress, UserLessonProgressDocument } from '../../../common/schemas/user-lesson-progress.schema';

const buildContext = (params: Record<string, any>, query: Record<string, any> = {}, body: Record<string, any> = {}) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ params, query, body }),
    }),
  }) as any;

describe('LessonPrerequisiteGuard', () => {
  let guard: LessonPrerequisiteGuard;
  let lessonModel: Model<LessonDocument>;
  let progressModel: Model<UserLessonProgressDocument>;

  const mockLessonModel = {
    findOne: jest.fn(),
  };

  const mockProgressModel = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonPrerequisiteGuard,
        {
          provide: getModelToken(Lesson.name),
          useValue: mockLessonModel,
        },
        {
          provide: getModelToken(UserLessonProgress.name),
          useValue: mockProgressModel,
        },
      ],
    }).compile();

    guard = module.get<LessonPrerequisiteGuard>(LessonPrerequisiteGuard);
    lessonModel = module.get<Model<LessonDocument>>(getModelToken(Lesson.name));
    progressModel = module.get<Model<UserLessonProgressDocument>>(getModelToken(UserLessonProgress.name));

    jest.clearAllMocks();
  });

  it('should throw when lessonRef is missing', async () => {
    await expect(guard.canActivate(buildContext({}, { userId: 'user-1' }))).rejects.toThrow(
      new BadRequestException('lessonRef is required')
    );
  });

  it('should throw when userId is missing', async () => {
    await expect(guard.canActivate(buildContext({ lessonRef: 'a0.basics.001' }))).rejects.toThrow(
      new BadRequestException('userId is required')
    );
  });

  it('should forbid when previous lesson is not completed', async () => {
    mockLessonModel.findOne
      .mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({ lessonRef: 'a0.basics.002', moduleRef: 'a0.basics', order: 2 }),
      })
      .mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({ lessonRef: 'a0.basics.001' }),
      });
    mockProgressModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    await expect(
      guard.canActivate(buildContext({ lessonRef: 'a0.basics.002' }, { userId: 'user-1' }))
    ).rejects.toThrow(ForbiddenException);
  });

  it('should allow access for first lesson', async () => {
    mockLessonModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ lessonRef: 'a0.basics.001', moduleRef: 'a0.basics', order: 1 }),
    });

    await expect(
      guard.canActivate(buildContext({ lessonRef: 'a0.basics.001' }, { userId: 'user-1' }))
    ).resolves.toBe(true);
    expect(progressModel.findOne).not.toHaveBeenCalled();
  });

  it('should allow access when previous lesson is missing', async () => {
    mockLessonModel.findOne
      .mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({ lessonRef: 'a0.basics.002', moduleRef: 'a0.basics', order: 2 }),
      })
      .mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue(null),
      });

    await expect(
      guard.canActivate(buildContext({ lessonRef: 'a0.basics.002' }, { userId: 'user-1' }))
    ).resolves.toBe(true);
    expect(progressModel.findOne).not.toHaveBeenCalled();
  });
});
