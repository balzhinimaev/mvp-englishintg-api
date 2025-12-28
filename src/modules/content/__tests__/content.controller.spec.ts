import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import * as request from 'supertest';
import { ContentController } from '../content.controller';
import { ContentService } from '../content.service';
import { VocabularyService } from '../vocabulary.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { OptionalUserGuard } from '../../common/guards/optional-user.guard';
import { LessonPrerequisiteGuard } from '../guards/lesson-prerequisite.guard';
import { CourseModule } from '../../common/schemas/course-module.schema';
import { Lesson } from '../../common/schemas/lesson.schema';
import { UserLessonProgress } from '../../common/schemas/user-lesson-progress.schema';
import { User } from '../../common/schemas/user.schema';

const mockJwtAuthGuard = {
  canActivate: (context: ExecutionContext) => {
    const req = context.switchToHttp().getRequest();
    req.user = { userId: 'user-1' };
    return true;
  },
};

const mockOptionalUserGuard = {
  canActivate: (context: ExecutionContext) => {
    const req = context.switchToHttp().getRequest();
    req.user = { userId: 'user-1' };
    return true;
  },
};

describe('ContentController', () => {
  let app: INestApplication;

  const mockUserModel = {
    findOne: jest.fn(),
  };
  const mockModuleModel = {
    find: jest.fn(),
  };
  const mockLessonModel = {
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const mockProgressModel = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockContentService = {
    canStartLesson: jest.fn(),
  };

  const mockVocabularyService = {
    list: jest.fn(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ContentController],
      providers: [
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: getModelToken(CourseModule.name), useValue: mockModuleModel },
        { provide: getModelToken(Lesson.name), useValue: mockLessonModel },
        { provide: getModelToken(UserLessonProgress.name), useValue: mockProgressModel },
        { provide: ContentService, useValue: mockContentService },
        { provide: VocabularyService, useValue: mockVocabularyService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(OptionalUserGuard)
      .useValue(mockOptionalUserGuard)
      .overrideGuard(LessonPrerequisiteGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /content/lessons', () => {
    it('should return lessons without moduleRef and map progress', async () => {
      const lessons = [
        {
          lessonRef: 'a0.basics.001',
          moduleRef: 'a0.basics',
          title: { ru: 'Урок 1', en: 'Lesson 1' },
          description: { ru: 'Описание', en: 'Description' },
          order: 1,
          tasks: [],
        },
      ];
      const completedAt = new Date('2024-01-02T00:00:00Z');
      const progress = [
        {
          lessonRef: 'a0.basics.001',
          status: 'completed',
          score: 0.9,
          attempts: 2,
          completedAt,
          timeSpent: 135,
        },
      ];

      mockLessonModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(lessons),
        }),
      });
      mockProgressModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue(progress),
      });

      const response = await request(app.getHttpServer())
        .get('/content/lessons')
        .expect(200);

      expect(response.body.lessons).toHaveLength(1);
      expect(response.body.lessons[0]).toEqual(
        expect.objectContaining({
          lessonRef: 'a0.basics.001',
          progress: {
            status: 'completed',
            score: 0.9,
            attempts: 2,
            completedAt: completedAt.toISOString(),
            timeSpent: 135,
          },
        })
      );
    });

    it('should return error when moduleRef format is invalid', async () => {
      const response = await request(app.getHttpServer())
        .get('/content/lessons?moduleRef=invalid-module')
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('moduleRef')])
      );
    });

    it('should filter lessons by moduleRef', async () => {
      const lessons = [
        {
          lessonRef: 'a0.basics.001',
          moduleRef: 'a0.basics',
          title: { ru: 'Урок 1', en: 'Lesson 1' },
          description: { ru: 'Описание', en: 'Description' },
          order: 1,
          tasks: [],
        },
      ];

      mockLessonModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(lessons),
        }),
      });
      mockProgressModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      const response = await request(app.getHttpServer())
        .get('/content/lessons?moduleRef=a0.basics')
        .expect(200);

      expect(response.body.lessons).toHaveLength(1);
      expect(mockLessonModel.find).toHaveBeenCalledWith(
        { published: true, moduleRef: 'a0.basics' },
        { tasks: 0 }
      );
    });
  });

  describe('GET /content/lessons/:lessonRef', () => {
    it('should return error for invalid lessonRef format', async () => {
      const response = await request(app.getHttpServer())
        .get('/content/lessons/invalid')
        .expect(400);

      expect(response.body.message).toBe('Invalid lessonRef format');
    });

    it('should return error when lesson is not found', async () => {
      mockLessonModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const response = await request(app.getHttpServer())
        .get('/content/lessons/a0.basics.001')
        .expect(404);

      expect(response.body.message).toBe('Lesson not found');
    });

    it('should return lesson with task types', async () => {
      mockLessonModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          lessonRef: 'a0.basics.001',
          moduleRef: 'a0.basics',
          title: { ru: 'Урок 1', en: 'Lesson 1' },
          description: { ru: 'Описание', en: 'Description' },
          order: 1,
          tasks: [
            { ref: 'a0.basics.001.t1', type: 'choice', data: { options: ['a', 'b'], correctIndex: 1 } },
          ],
        }),
      });
      mockProgressModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const response = await request(app.getHttpServer())
        .get('/content/lessons/a0.basics.001?lang=ru')
        .expect(200);

      expect(response.body.lesson).toEqual(
        expect.objectContaining({
          lessonRef: 'a0.basics.001',
          taskTypes: ['choice'],
        })
      );
    });
  });

  describe('GET /content/lessons/:lessonRef/check-prerequisite', () => {
    it('should return canStart payload', async () => {
      mockContentService.canStartLesson.mockResolvedValue({ canStart: true });

      const response = await request(app.getHttpServer())
        .get('/content/lessons/a0.basics.001/check-prerequisite')
        .expect(200);

      expect(response.body).toEqual({
        canStart: true,
        reason: undefined,
        requiredLesson: undefined,
        lessonRef: 'a0.basics.001',
      });
      expect(mockContentService.canStartLesson).toHaveBeenCalledWith('user-1', 'a0.basics.001');
    });
  });
});
