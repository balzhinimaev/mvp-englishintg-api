import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProgressService } from '../progress.service';
import { User, UserDocument } from '../../common/schemas/user.schema';
import { UserLessonProgress, UserLessonProgressDocument } from '../../common/schemas/user-lesson-progress.schema';
import { UserTaskAttempt, UserTaskAttemptDocument } from '../../common/schemas/user-task-attempt.schema';
import { XpTransaction, XpTransactionDocument } from '../../common/schemas/xp-transaction.schema';
import { DailyStat, DailyStatDocument } from '../../common/schemas/daily-stat.schema';
import { LearningSession, LearningSessionDocument } from '../../common/schemas/learning-session.schema';
import { Achievement, AchievementDocument } from '../../common/schemas/achievement.schema';

describe('ProgressService.recordTaskAttempt', () => {
  let service: ProgressService;
  let ulpModel: Model<UserLessonProgressDocument>;
  let attemptModel: Model<UserTaskAttemptDocument>;
  let dailyModel: Model<DailyStatDocument>;
  let userModel: Model<UserDocument>;

  const mockUserModel = {
    findOne: jest.fn(),
    updateOne: jest.fn(),
  };
  const mockUlpModel = {
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  };
  const mockAttemptModel = {
    findOne: jest.fn(),
    create: jest.fn(),
  };
  const mockXpModel = {
    create: jest.fn(),
  };
  const mockDailyModel = {
    updateOne: jest.fn(),
  };
  const mockSessionModel = {
    create: jest.fn(),
    findById: jest.fn(),
  };
  const mockAchModel = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgressService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: getModelToken(UserLessonProgress.name), useValue: mockUlpModel },
        { provide: getModelToken(UserTaskAttempt.name), useValue: mockAttemptModel },
        { provide: getModelToken(XpTransaction.name), useValue: mockXpModel },
        { provide: getModelToken(DailyStat.name), useValue: mockDailyModel },
        { provide: getModelToken(LearningSession.name), useValue: mockSessionModel },
        { provide: getModelToken(Achievement.name), useValue: mockAchModel },
      ],
    }).compile();

    service = module.get<ProgressService>(ProgressService);
    ulpModel = module.get<Model<UserLessonProgressDocument>>(getModelToken(UserLessonProgress.name));
    attemptModel = module.get<Model<UserTaskAttemptDocument>>(getModelToken(UserTaskAttempt.name));
    dailyModel = module.get<Model<DailyStatDocument>>(getModelToken(DailyStat.name));
    userModel = module.get<Model<UserDocument>>(getModelToken(User.name));

    jest.clearAllMocks();

    jest.spyOn(service, 'addXp').mockResolvedValue(undefined);
    jest.spyOn(service, 'updateStreakOnActivity').mockResolvedValue(3);

    mockUserModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ tz: 'UTC' }),
    });
  });

  it('should create ULP with moduleRef denormalization', async () => {
    mockUlpModel.findOneAndUpdate.mockResolvedValue({ _id: 'ulp-id' });
    mockAttemptModel.findOne.mockResolvedValue(null);
    mockAttemptModel.create.mockResolvedValue({ _id: 'attempt-id' });

    await service.recordTaskAttempt({
      userId: 'user-1',
      lessonRef: 'a0.basics.001',
      taskRef: 'a0.basics.001.t1',
      isCorrect: false,
    });

    expect(ulpModel.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'user-1', lessonRef: 'a0.basics.001' },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({ moduleRef: 'a0.basics' }),
      }),
      { new: true, upsert: true }
    );
  });

  it('should be idempotent for clientAttemptId', async () => {
    const existingAttempt = { _id: 'attempt-id', clientAttemptId: 'client-1' };
    mockUlpModel.findOneAndUpdate.mockResolvedValue({ _id: 'ulp-id' });
    mockAttemptModel.findOne.mockResolvedValue(existingAttempt);

    const result = await service.recordTaskAttempt({
      userId: 'user-1',
      lessonRef: 'a0.basics.001',
      taskRef: 'a0.basics.001.t1',
      isCorrect: true,
      clientAttemptId: 'client-1',
    });

    expect(result).toEqual(existingAttempt);
    expect(attemptModel.create).not.toHaveBeenCalled();
    expect(ulpModel.updateOne).not.toHaveBeenCalled();
    expect(dailyModel.updateOne).not.toHaveBeenCalled();
    expect(service.addXp).not.toHaveBeenCalled();
  });

  it('should award XP and complete lesson on last task', async () => {
    mockUlpModel.findOneAndUpdate.mockResolvedValue({ _id: 'ulp-id' });
    mockAttemptModel.findOne.mockResolvedValue(null);
    mockAttemptModel.create.mockResolvedValue({ _id: 'attempt-id' });

    await service.recordTaskAttempt({
      userId: 'user-1',
      lessonRef: 'a0.basics.001',
      taskRef: 'a0.basics.001.t1',
      isCorrect: true,
      isLastTask: true,
      xpPerCorrect: 10,
    });

    expect(service.addXp).toHaveBeenCalledWith('user-1', 10, 'task', 'a0.basics.001.t1', undefined, { lessonRef: 'a0.basics.001' });
    expect(service.addXp).toHaveBeenCalledWith('user-1', 20, 'lesson_complete', 'a0.basics.001', undefined);
    expect(service.addXp).toHaveBeenCalledWith('user-1', 15, 'streak_bonus', 'streak_3', undefined);
    expect(ulpModel.updateOne).toHaveBeenCalledWith(
      { _id: 'ulp-id' },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'completed' }) })
    );
    expect(dailyModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
      expect.objectContaining({ $inc: expect.objectContaining({ lessonsCompleted: 1 }) }),
      { upsert: true }
    );
  });
});
