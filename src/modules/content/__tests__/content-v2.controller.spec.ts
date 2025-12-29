import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import * as request from 'supertest';
import { ContentV2Controller } from '../content-v2.controller';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ContentService } from '../content.service';
import { LessonPrerequisiteGuard } from '../guards/lesson-prerequisite.guard';
import { CourseModule } from '../../common/schemas/course-module.schema';
import { Lesson } from '../../common/schemas/lesson.schema';
import { UserLessonProgress } from '../../common/schemas/user-lesson-progress.schema';
import { User } from '../../common/schemas/user.schema';

const mockJwtAuthGuard = {
  canActivate: (context: ExecutionContext) => {
    const req = context.switchToHttp().getRequest();
    const headerUserId = req.headers['x-user-id'];
    if (headerUserId === 'none') {
      req.user = undefined;
    } else {
      req.user = { userId: headerUserId ?? 'user-1' };
    }
    return true;
  },
};

describe('ContentV2Controller', () => {
  let app: INestApplication;

  const mockModuleModel = {
    countDocuments: jest.fn(),
    find: jest.fn(),
  };
  const mockLessonModel = {
    aggregate: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const mockProgressModel = {
    aggregate: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const mockUserModel = {
    findOne: jest.fn(),
  };
  const mockContentService = {
    canStartLesson: jest.fn(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ContentV2Controller],
      providers: [
        { provide: getModelToken(CourseModule.name), useValue: mockModuleModel },
        { provide: getModelToken(Lesson.name), useValue: mockLessonModel },
        { provide: getModelToken(UserLessonProgress.name), useValue: mockProgressModel },
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: ContentService, useValue: mockContentService },
        LessonPrerequisiteGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    jest.clearAllMocks();
    mockContentService.canStartLesson.mockResolvedValue({ canStart: true });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /content/v2/modules', () => {
    it('should return 400 when userId is missing', async () => {
      const response = await request(app.getHttpServer())
        .get('/content/v2/modules')
        .set('x-user-id', 'none')
        .expect(400);

      expect(response.body).toEqual(
        expect.objectContaining({
          statusCode: 400,
          message: 'userId is required',
        })
      );
    });

    it('should paginate modules and compute requiresPro/isAvailable', async () => {
      mockModuleModel.countDocuments.mockResolvedValue(2);
      mockModuleModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue([
                { moduleRef: 'a0.basics', level: 'A0', order: 1, published: true },
                { moduleRef: 'a0.plus', level: 'A0', order: 2, published: true },
              ]),
            }),
          }),
        }),
      });
      mockLessonModel.aggregate.mockResolvedValue([
        { _id: 'a0.basics', total: 2 },
        { _id: 'a0.plus', total: 3 },
      ]);
      mockProgressModel.aggregate.mockResolvedValue([
        { _id: 'a0.basics', completed: 1, inProgress: 1 },
      ]);
      mockUserModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ pro: { active: false } }),
      });

      const response = await request(app.getHttpServer())
        .get('/content/v2/modules?page=1&limit=2')
        .expect(200);

      expect(response.body.modules).toEqual([
        expect.objectContaining({ moduleRef: 'a0.basics', requiresPro: false, isAvailable: true }),
        expect.objectContaining({ moduleRef: 'a0.plus', requiresPro: true, isAvailable: false }),
      ]);
      expect(response.body.pagination).toEqual(
        expect.objectContaining({ page: 1, limit: 2, total: 2, totalPages: 1 })
      );
    });
  });

  describe('GET /content/v2/modules/:moduleRef/lessons', () => {
    it('should return 400 when userId is missing', async () => {
      const response = await request(app.getHttpServer())
        .get('/content/v2/modules/a0.basics/lessons')
        .set('x-user-id', 'none')
        .expect(400);

      expect(response.body).toEqual(
        expect.objectContaining({
          statusCode: 400,
          message: 'userId is required',
        })
      );
    });

    it('should return lessons with progress', async () => {
      mockLessonModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              lessonRef: 'a0.basics.001',
              moduleRef: 'a0.basics',
              title: { ru: 'Урок 1', en: 'Lesson 1' },
              description: { ru: 'Описание', en: 'Description' },
              order: 1,
              tasks: [],
            },
          ]),
        }),
      });
      mockProgressModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { lessonRef: 'a0.basics.001', status: 'in_progress', attempts: 1 },
        ]),
      });

      const response = await request(app.getHttpServer())
        .get('/content/v2/modules/a0.basics/lessons?lang=ru')
        .expect(200);

      expect(response.body).toEqual({
        lessons: [
          expect.objectContaining({
            lessonRef: 'a0.basics.001',
            progress: expect.objectContaining({ status: 'in_progress' }),
          }),
        ],
      });
    });

    it('should fallback to lessonRef regex when moduleRef progress is missing', async () => {
      mockLessonModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              lessonRef: 'a0.basics.001',
              moduleRef: 'a0.basics',
              title: { ru: 'Урок 1', en: 'Lesson 1' },
              description: { ru: 'Описание', en: 'Description' },
              order: 1,
              tasks: [],
            },
          ]),
        }),
      });
      mockProgressModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { lessonRef: 'a0.basics.001', status: 'completed', attempts: 2 },
        ]),
      });

      const response = await request(app.getHttpServer())
        .get('/content/v2/modules/a0.basics/lessons?lang=ru')
        .expect(200);

      expect(mockProgressModel.find).toHaveBeenCalledWith({
        userId: 'user-1',
        $or: [
          { moduleRef: 'a0.basics' },
          { lessonRef: { $regex: '^a0.basics\\.' } },
        ],
      });
      expect(response.body).toEqual({
        lessons: [
          expect.objectContaining({
            lessonRef: 'a0.basics.001',
            progress: expect.objectContaining({ status: 'completed' }),
          }),
        ],
      });
    });
  });

  describe('GET /content/v2/lessons/:lessonRef', () => {
    it('should return 400 when userId is missing', async () => {
      const response = await request(app.getHttpServer())
        .get('/content/v2/lessons/a0.basics.001')
        .set('x-user-id', 'none')
        .expect(400);

      expect(response.body).toEqual(
        expect.objectContaining({
          statusCode: 400,
          message: 'userId is required',
        })
      );
    });

    it('should call prerequisite guard with userId and lessonRef', async () => {
      mockLessonModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          lessonRef: 'a0.basics.001',
          moduleRef: 'a0.basics',
          title: { ru: 'Урок 1', en: 'Lesson 1' },
          description: { ru: 'Описание', en: 'Description' },
          order: 0,
          tags: [],
          estimatedMinutes: 10,
          type: 'vocabulary',
          difficulty: 'easy',
          xpReward: 25,
          hasAudio: true,
          hasVideo: false,
          tasks: [{ ref: 'a0.basics.001.t1', type: 'choice', data: { options: ['a', 'b'], correctIndex: 0 } }],
        }),
      });
      mockProgressModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ status: 'completed', attempts: 1 }),
      });

      await request(app.getHttpServer())
        .get('/content/v2/lessons/a0.basics.001?lang=ru')
        .expect(200);

      expect(mockContentService.canStartLesson).toHaveBeenCalledWith('user-1', 'a0.basics.001');
    });

    it('should return 400 when prerequisite guard reports missing lesson', async () => {
      mockContentService.canStartLesson.mockResolvedValue({
        canStart: false,
        reason: 'Lesson not found',
      });

      const response = await request(app.getHttpServer())
        .get('/content/v2/lessons/a0.basics.999')
        .expect(400);

      expect(response.body).toEqual(
        expect.objectContaining({
          statusCode: 400,
          message: 'Lesson not found',
        })
      );
    });

    it('should return 403 with prerequisite payload when previous lesson is required', async () => {
      mockContentService.canStartLesson.mockResolvedValue({
        canStart: false,
        reason: 'Нужно пройти предыдущий урок',
        requiredLesson: 'a0.basics.001',
      });

      const response = await request(app.getHttpServer())
        .get('/content/v2/lessons/a0.basics.002')
        .expect(403);

      expect(response.body).toEqual(
        expect.objectContaining({
          error: 'PREREQ_NOT_MET',
          message: 'Нужно пройти предыдущий урок',
          requiredLesson: 'a0.basics.001',
          currentLesson: 'a0.basics.002',
        })
      );
    });

    it('should return lesson with tasks', async () => {
      mockLessonModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          lessonRef: 'a0.basics.001',
          moduleRef: 'a0.basics',
          title: { ru: 'Урок 1', en: 'Lesson 1' },
          description: { ru: 'Описание', en: 'Description' },
          order: 0,
          tags: [],
          estimatedMinutes: 10,
          type: 'vocabulary',
          difficulty: 'easy',
          xpReward: 25,
          hasAudio: true,
          hasVideo: false,
          tasks: [{ ref: 'a0.basics.001.t1', type: 'choice', data: { options: ['a', 'b'], correctIndex: 0 } }],
        }),
      });
      mockProgressModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ status: 'completed', attempts: 1 }),
      });

      const response = await request(app.getHttpServer())
        .get('/content/v2/lessons/a0.basics.001?lang=ru')
        .expect(200);

      expect(response.body).toEqual({
        lesson: expect.objectContaining({
          lessonRef: 'a0.basics.001',
          moduleRef: 'a0.basics',
          title: 'Урок 1',
          description: 'Описание',
          tasks: [{ ref: 'a0.basics.001.t1', type: 'choice', data: { options: ['a', 'b'] } }],
          progress: expect.objectContaining({
            status: 'completed',
            attempts: 1,
          }),
        }),
      });
    });

    it('should return 404 for missing lesson', async () => {
      mockLessonModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const response = await request(app.getHttpServer())
        .get('/content/v2/lessons/missing.module.001?lang=ru')
        .expect(404);

      expect(response.body).toEqual(
        expect.objectContaining({
          statusCode: 404,
          message: 'Lesson not found',
        })
      );
    });
  });
});
