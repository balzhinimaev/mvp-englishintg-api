import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AdminContentController } from '../src/modules/content/admin-content.controller';
import { ContentService } from '../src/modules/content/content.service';
import { JwtAuthGuard } from '../src/modules/auth/jwt-auth.guard';
import { AdminGuard } from '../src/modules/auth/admin.guard';

/**
 * E2E тесты для модулей контента
 * 
 * Покрывает:
 * - Создание модуля с двуязычными полями (title/description)
 * - Валидацию difficultyRating (1-5, шаг 0.5)
 * - Сохранение автора из req.user
 * - Негативные сценарии (400 ошибки)
 */
describe('Modules E2E', () => {
  let app: INestApplication;
  let mockUser: any;

  const mockContentService = {
    createModule: jest.fn(),
    listModules: jest.fn(),
    updateModule: jest.fn(),
    createLesson: jest.fn(),
    listLessons: jest.fn(),
    updateLesson: jest.fn(),
  };

  // Мок для подстановки пользователя
  const mockJwtGuard = {
    canActivate: (context: any) => {
      const req = context.switchToHttp().getRequest();
      req.user = mockUser;
      return true;
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdminContentController],
      providers: [
        {
          provide: ContentService,
          useValue: mockContentService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtGuard)
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ 
      transform: true, 
      whitelist: true,
      forbidNonWhitelisted: true,
    }));
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = {
      userId: 'user-123-test',
      user: {
        firstName: 'Test',
        lastName: 'Author',
        username: 'testauthor',
      },
    };
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Author Assignment', () => {
    it('should assign author from req.user when creating module', async () => {
      mockContentService.createModule.mockResolvedValue({ _id: 'new-id' });

      await request(app.getHttpServer())
        .post('/admin/content/modules')
        .send({
          moduleRef: 'a0.travel',
          level: 'A0',
          title: { ru: 'Путешествия', en: 'Travel' },
        })
        .expect(201);

      expect(mockContentService.createModule).toHaveBeenCalledWith(
        expect.objectContaining({
          author: {
            userId: 'user-123-test',
            name: 'Test Author',
          },
        })
      );
    });

    it('should use username when firstName/lastName not available', async () => {
      mockUser = {
        userId: 'user-456',
        user: {
          username: 'onlyusername',
        },
      };
      mockContentService.createModule.mockResolvedValue({ _id: 'id' });

      await request(app.getHttpServer())
        .post('/admin/content/modules')
        .send({
          moduleRef: 'a0.test',
          level: 'A0',
          title: { ru: 'Тест', en: 'Test' },
        })
        .expect(201);

      expect(mockContentService.createModule).toHaveBeenCalledWith(
        expect.objectContaining({
          author: {
            userId: 'user-456',
            name: 'onlyusername',
          },
        })
      );
    });
  });

  describe('Multilingual Fields Storage', () => {
    it('should save title with both ru and en locales', async () => {
      mockContentService.createModule.mockResolvedValue({ _id: 'id' });

      await request(app.getHttpServer())
        .post('/admin/content/modules')
        .send({
          moduleRef: 'a0.travel',
          level: 'A0',
          title: { ru: 'Путешествия', en: 'Travel' },
        })
        .expect(201);

      expect(mockContentService.createModule).toHaveBeenCalledWith(
        expect.objectContaining({
          title: { ru: 'Путешествия', en: 'Travel' },
        })
      );
    });

    it('should save description with both ru and en locales', async () => {
      mockContentService.createModule.mockResolvedValue({ _id: 'id' });

      await request(app.getHttpServer())
        .post('/admin/content/modules')
        .send({
          moduleRef: 'a0.travel',
          level: 'A0',
          title: { ru: 'Путешествия', en: 'Travel' },
          description: { ru: 'Изучение фраз', en: 'Learning phrases' },
        })
        .expect(201);

      expect(mockContentService.createModule).toHaveBeenCalledWith(
        expect.objectContaining({
          description: { ru: 'Изучение фраз', en: 'Learning phrases' },
        })
      );
    });
  });

  describe('DifficultyRating Validation', () => {
    describe('Valid values', () => {
      const validRatings = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

      it.each(validRatings)('should accept difficultyRating = %s', async (rating) => {
        mockContentService.createModule.mockResolvedValue({ _id: 'id' });

        await request(app.getHttpServer())
          .post('/admin/content/modules')
          .send({
            moduleRef: 'a0.test',
            level: 'A0',
            title: { ru: 'Тест', en: 'Test' },
            difficultyRating: rating,
          })
          .expect(201);

        expect(mockContentService.createModule).toHaveBeenCalledWith(
          expect.objectContaining({ difficultyRating: rating })
        );
      });
    });

    describe('Invalid values - Below minimum', () => {
      it('should reject difficultyRating = 0', async () => {
        const response = await request(app.getHttpServer())
          .post('/admin/content/modules')
          .send({
            moduleRef: 'a0.test',
            level: 'A0',
            title: { ru: 'Тест', en: 'Test' },
            difficultyRating: 0,
          })
          .expect(400);

        expect(response.body.message).toContain('difficultyRating');
      });

      it('should reject difficultyRating = 0.5', async () => {
        await request(app.getHttpServer())
          .post('/admin/content/modules')
          .send({
            moduleRef: 'a0.test',
            level: 'A0',
            title: { ru: 'Тест', en: 'Test' },
            difficultyRating: 0.5,
          })
          .expect(400);
      });
    });

    describe('Invalid values - Above maximum', () => {
      it('should reject difficultyRating = 5.5', async () => {
        await request(app.getHttpServer())
          .post('/admin/content/modules')
          .send({
            moduleRef: 'a0.test',
            level: 'A0',
            title: { ru: 'Тест', en: 'Test' },
            difficultyRating: 5.5,
          })
          .expect(400);
      });

      it('should reject difficultyRating = 6', async () => {
        await request(app.getHttpServer())
          .post('/admin/content/modules')
          .send({
            moduleRef: 'a0.test',
            level: 'A0',
            title: { ru: 'Тест', en: 'Test' },
            difficultyRating: 6,
          })
          .expect(400);
      });
    });

    describe('Invalid values - Not half step', () => {
      const invalidSteps = [1.3, 2.7, 3.1, 4.2, 4.9];

      it.each(invalidSteps)('should reject difficultyRating = %s (not 0.5 increment)', async (rating) => {
        const response = await request(app.getHttpServer())
          .post('/admin/content/modules')
          .send({
            moduleRef: 'a0.test',
            level: 'A0',
            title: { ru: 'Тест', en: 'Test' },
            difficultyRating: rating,
          })
          .expect(400);

        expect(response.body.message).toBeDefined();
      });
    });
  });

  describe('Title/Description Validation Errors', () => {
    it('should return 400 when title missing ru', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/content/modules')
        .send({
          moduleRef: 'a0.test',
          level: 'A0',
          title: { en: 'Only English' },
        })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('should return 400 when title missing en', async () => {
      await request(app.getHttpServer())
        .post('/admin/content/modules')
        .send({
          moduleRef: 'a0.test',
          level: 'A0',
          title: { ru: 'Только русский' },
        })
        .expect(400);
    });

    it('should return 400 when title is not an object', async () => {
      await request(app.getHttpServer())
        .post('/admin/content/modules')
        .send({
          moduleRef: 'a0.test',
          level: 'A0',
          title: 'Just a string',
        })
        .expect(400);
    });

    it('should return 400 when title has wrong types', async () => {
      await request(app.getHttpServer())
        .post('/admin/content/modules')
        .send({
          moduleRef: 'a0.test',
          level: 'A0',
          title: { ru: 123, en: 'Test' },
        })
        .expect(400);
    });
  });

  describe('API Response Format', () => {
    it('should return id of created module', async () => {
      mockContentService.createModule.mockResolvedValue({ _id: 'created-module-id' });

      const response = await request(app.getHttpServer())
        .post('/admin/content/modules')
        .send({
          moduleRef: 'a0.travel',
          level: 'A0',
          title: { ru: 'Путешествия', en: 'Travel' },
        })
        .expect(201);

      expect(response.body).toEqual({ id: 'created-module-id' });
    });

    it('should return items array for list modules', async () => {
      const modules = [
        { 
          moduleRef: 'a0.travel', 
          level: 'A0', 
          title: { ru: 'Путешествия', en: 'Travel' },
          difficultyRating: 2.5,
          author: { userId: 'user-1', name: 'Author' },
        },
      ];
      mockContentService.listModules.mockResolvedValue(modules);

      const response = await request(app.getHttpServer())
        .get('/admin/content/modules')
        .expect(200);

      expect(response.body).toEqual({ items: modules });
      expect(response.body.items[0].title).toEqual({ ru: 'Путешествия', en: 'Travel' });
      expect(response.body.items[0].difficultyRating).toBe(2.5);
      expect(response.body.items[0].author).toEqual({ userId: 'user-1', name: 'Author' });
    });

    it('should return ok: true for successful update', async () => {
      mockContentService.updateModule.mockResolvedValue({ ok: true });

      const response = await request(app.getHttpServer())
        .patch('/admin/content/modules/a0.travel')
        .send({
          title: { ru: 'Обновлено', en: 'Updated' },
        })
        .expect(200);

      expect(response.body).toEqual({ ok: true });
    });
  });
});

