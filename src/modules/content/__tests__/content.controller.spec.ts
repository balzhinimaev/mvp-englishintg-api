import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import * as request from 'supertest';
import { ContentController } from '../content.controller';
import { ContentService } from '../content.service';
import { VocabularyService } from '../vocabulary.service';
import { OptionalUserGuard } from '../../common/guards/optional-user.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { LessonPrerequisiteGuard } from '../guards/lesson-prerequisite.guard';
import { CourseModule } from '../../common/schemas/course-module.schema';
import { Lesson } from '../../common/schemas/lesson.schema';
import { User } from '../../common/schemas/user.schema';
import { UserLessonProgress } from '../../common/schemas/user-lesson-progress.schema';

describe('ContentController', () => {
  let app: INestApplication;
  let currentMockUser: Record<string, any> | undefined;

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

  const mockUlpModel = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockContentService = {
    canStartLesson: jest.fn(),
  };

  const mockVocabularyService = {
    getModuleVocabulary: jest.fn(),
    getVocabularyProgressStats: jest.fn(),
  };

  const mockJwtAuthGuard = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      req.user = currentMockUser;
      return true;
    },
  };

  beforeEach(async () => {
    currentMockUser = { userId: 'user-123' };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ContentController],
      providers: [
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(CourseModule.name),
          useValue: mockModuleModel,
        },
        {
          provide: getModelToken(Lesson.name),
          useValue: mockLessonModel,
        },
        {
          provide: getModelToken(UserLessonProgress.name),
          useValue: mockUlpModel,
        },
        {
          provide: ContentService,
          useValue: mockContentService,
        },
        {
          provide: VocabularyService,
          useValue: mockVocabularyService,
        },
      ],
    })
      .overrideGuard(OptionalUserGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(LessonPrerequisiteGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /content/lessons', () => {
    it('should return 400 with Nest error body for invalid moduleRef', async () => {
      const response = await request(app.getHttpServer())
        .get('/content/lessons')
        .query({ moduleRef: 'invalid-module-ref' })
        .expect(400);

      expect(response.body).toEqual({
        statusCode: 400,
        message: 'Invalid moduleRef format',
        error: 'Bad Request',
      });
    });
  });

  describe('GET /content/lessons/:lessonRef', () => {
    it('should return 400 with Nest error body for invalid lessonRef', async () => {
      const response = await request(app.getHttpServer())
        .get('/content/lessons/invalid-lesson-ref')
        .expect(400);

      expect(response.body).toEqual({
        statusCode: 400,
        message: 'Invalid lessonRef format',
        error: 'Bad Request',
      });
    });

    it('should return 404 with Nest error body when lesson is not found', async () => {
      mockLessonModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const response = await request(app.getHttpServer())
        .get('/content/lessons/a1.module_1.001')
        .expect(404);

      expect(response.body).toEqual({
        statusCode: 404,
        message: 'Lesson not found',
        error: 'Not Found',
      });
    });
  });

  describe('GET /content/lessons/:lessonRef/check-prerequisite', () => {
    it('should return 400 with Nest error body when userId is missing', async () => {
      currentMockUser = {};

      const response = await request(app.getHttpServer())
        .get('/content/lessons/a1.module_1.001/check-prerequisite')
        .expect(400);

      expect(response.body).toEqual({
        statusCode: 400,
        message: 'userId is required',
        error: 'Bad Request',
      });
      expect(mockContentService.canStartLesson).not.toHaveBeenCalled();
    });
  });
});
