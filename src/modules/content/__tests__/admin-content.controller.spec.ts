import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
import * as request from 'supertest';
import { AdminContentController } from '../admin-content.controller';
import { ContentService } from '../content.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AdminGuard } from '../../auth/admin.guard';
import {
  validCreateModuleDto,
  validMultilingualTitle,
  validMultilingualDescription,
  validDifficultyRatings,
  mockJwtUser,
  mockJwtUserMinimal,
  createModuleDto,
} from './fixtures/module.fixtures';

describe('AdminContentController', () => {
  let app: INestApplication;
  let contentService: ContentService;
  let currentMockUser: typeof mockJwtUser | typeof mockJwtUserMinimal;

  const mockContentService = {
    createModule: jest.fn(),
    listModules: jest.fn(),
    updateModule: jest.fn(),
    createLesson: jest.fn(),
    listLessons: jest.fn(),
    updateLesson: jest.fn(),
  };

  // Mock guard that injects user into request
  const mockJwtAuthGuard = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      req.user = currentMockUser;
      return true;
    },
  };

  beforeEach(async () => {
    currentMockUser = mockJwtUser; // Default user for tests

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
      .useValue(mockJwtAuthGuard)
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    contentService = moduleFixture.get<ContentService>(ContentService);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /admin/content/modules', () => {
    describe('successful creation', () => {
      it('should create module with valid multilingual title and description', async () => {
        const moduleId = 'new-module-id';
        mockContentService.createModule.mockResolvedValue({ _id: moduleId });

        const response = await request(app.getHttpServer())
          .post('/admin/content/modules')
          .send(validCreateModuleDto)
          .expect(201);

        expect(response.body).toEqual({ id: moduleId });
        expect(mockContentService.createModule).toHaveBeenCalledWith(
          expect.objectContaining({
            moduleRef: validCreateModuleDto.moduleRef,
            level: validCreateModuleDto.level,
            title: validMultilingualTitle,
            description: validMultilingualDescription,
          })
        );
      });

      it('should save author from request user with full name', async () => {
        currentMockUser = mockJwtUser; // user with firstName and lastName
        mockContentService.createModule.mockResolvedValue({ _id: 'id' });

        await request(app.getHttpServer())
          .post('/admin/content/modules')
          .send(validCreateModuleDto)
          .expect(201);

        expect(mockContentService.createModule).toHaveBeenCalledWith(
          expect.objectContaining({
            author: {
              userId: mockJwtUser.userId,
              name: 'John Doe', // firstName + lastName
            },
          })
        );
      });

      it('should save author with username when firstName/lastName missing', async () => {
        currentMockUser = mockJwtUserMinimal; // user with only username
        mockContentService.createModule.mockResolvedValue({ _id: 'id' });

        await request(app.getHttpServer())
          .post('/admin/content/modules')
          .send(validCreateModuleDto)
          .expect(201);

        expect(mockContentService.createModule).toHaveBeenCalledWith(
          expect.objectContaining({
            author: {
              userId: mockJwtUserMinimal.userId,
              name: 'minimaluser', // username fallback
            },
          })
        );
      });

      it('should not save author when userId is missing from token', async () => {
        currentMockUser = { user: { username: 'nouser' } } as any; // no userId
        mockContentService.createModule.mockResolvedValue({ _id: 'id' });

        await request(app.getHttpServer())
          .post('/admin/content/modules')
          .send(validCreateModuleDto)
          .expect(201);

        expect(mockContentService.createModule).toHaveBeenCalledWith(
          expect.objectContaining({
            author: undefined,
          })
        );
      });

      it.each(validDifficultyRatings)(
        'should accept difficultyRating = %s',
        async (rating) => {
          mockContentService.createModule.mockResolvedValue({ _id: 'id' });

          await request(app.getHttpServer())
            .post('/admin/content/modules')
            .send(createModuleDto({ difficultyRating: rating }))
            .expect(201);
        }
      );

      it('should create module with minimal required fields', async () => {
        mockContentService.createModule.mockResolvedValue({ _id: 'minimal-id' });

        const minimalDto = {
          moduleRef: 'a0.minimal',
          level: 'A0',
          title: validMultilingualTitle,
        };

        const response = await request(app.getHttpServer())
          .post('/admin/content/modules')
          .send(minimalDto)
          .expect(201);

        expect(response.body).toEqual({ id: 'minimal-id' });
      });
    });

    describe('validation errors - 400 Bad Request', () => {
      describe('invalid title', () => {
        it('should return 400 when title is missing ru field', async () => {
          await request(app.getHttpServer())
            .post('/admin/content/modules')
            .send({
              moduleRef: 'a0.test',
              level: 'A0',
              title: { en: 'Only English' },
            })
            .expect(400);
        });

        it('should return 400 when title is missing en field', async () => {
          await request(app.getHttpServer())
            .post('/admin/content/modules')
            .send({
              moduleRef: 'a0.test',
              level: 'A0',
              title: { ru: 'Только русский' },
            })
            .expect(400);
        });

        it('should return 400 when title is empty object', async () => {
          await request(app.getHttpServer())
            .post('/admin/content/modules')
            .send({
              moduleRef: 'a0.test',
              level: 'A0',
              title: {},
            })
            .expect(400);
        });

        it('should return 400 when title is string instead of object', async () => {
          await request(app.getHttpServer())
            .post('/admin/content/modules')
            .send({
              moduleRef: 'a0.test',
              level: 'A0',
              title: 'Just a string',
            })
            .expect(400);
        });

        it('should return 400 when title.ru is not a string', async () => {
          await request(app.getHttpServer())
            .post('/admin/content/modules')
            .send({
              moduleRef: 'a0.test',
              level: 'A0',
              title: { ru: 123, en: 'Test' },
            })
            .expect(400);
        });

        it('should return 400 when title.en is not a string', async () => {
          await request(app.getHttpServer())
            .post('/admin/content/modules')
            .send({
              moduleRef: 'a0.test',
              level: 'A0',
              title: { ru: 'Тест', en: 456 },
            })
            .expect(400);
        });
      });

      describe('invalid description', () => {
        it('should return 400 when description.ru is not a string', async () => {
          await request(app.getHttpServer())
            .post('/admin/content/modules')
            .send({
              moduleRef: 'a0.test',
              level: 'A0',
              title: validMultilingualTitle,
              description: { ru: 123, en: 'Test' },
            })
            .expect(400);
        });
      });

      describe('invalid difficultyRating', () => {
        it('should return 400 when difficultyRating = 0', async () => {
          await request(app.getHttpServer())
            .post('/admin/content/modules')
            .send(createModuleDto({ difficultyRating: 0 }))
            .expect(400);
        });

        it('should return 400 when difficultyRating = 0.5 (below minimum)', async () => {
          await request(app.getHttpServer())
            .post('/admin/content/modules')
            .send(createModuleDto({ difficultyRating: 0.5 }))
            .expect(400);
        });

        it('should return 400 when difficultyRating = 5.5 (above maximum)', async () => {
          await request(app.getHttpServer())
            .post('/admin/content/modules')
            .send(createModuleDto({ difficultyRating: 5.5 }))
            .expect(400);
        });

        it('should return 400 when difficultyRating = 6 (above maximum)', async () => {
          await request(app.getHttpServer())
            .post('/admin/content/modules')
            .send(createModuleDto({ difficultyRating: 6 }))
            .expect(400);
        });

        it('should return 400 when difficultyRating = 1.3 (not half step)', async () => {
          await request(app.getHttpServer())
            .post('/admin/content/modules')
            .send(createModuleDto({ difficultyRating: 1.3 }))
            .expect(400);
        });

        it('should return 400 when difficultyRating = 2.7 (not half step)', async () => {
          await request(app.getHttpServer())
            .post('/admin/content/modules')
            .send(createModuleDto({ difficultyRating: 2.7 }))
            .expect(400);
        });

        it('should return 400 when difficultyRating is negative', async () => {
          await request(app.getHttpServer())
            .post('/admin/content/modules')
            .send(createModuleDto({ difficultyRating: -1 }))
            .expect(400);
        });

        it('should return 400 when difficultyRating is string', async () => {
          await request(app.getHttpServer())
            .post('/admin/content/modules')
            .send(createModuleDto({ difficultyRating: 'hard' as any }))
            .expect(400);
        });
      });

      describe('missing required fields', () => {
        it('should return 400 when moduleRef is missing', async () => {
          const { moduleRef, ...dtoWithoutModuleRef } = validCreateModuleDto;
          await request(app.getHttpServer())
            .post('/admin/content/modules')
            .send(dtoWithoutModuleRef)
            .expect(400);
        });

        it('should return 400 when level is missing', async () => {
          const { level, ...dtoWithoutLevel } = validCreateModuleDto;
          await request(app.getHttpServer())
            .post('/admin/content/modules')
            .send(dtoWithoutLevel)
            .expect(400);
        });

        it('should return 400 when title is missing', async () => {
          const { title, ...dtoWithoutTitle } = validCreateModuleDto;
          await request(app.getHttpServer())
            .post('/admin/content/modules')
            .send(dtoWithoutTitle)
            .expect(400);
        });
      });
    });
  });

  describe('PATCH /admin/content/modules/:moduleRef', () => {
    it('should update module multilingual fields', async () => {
      mockContentService.updateModule.mockResolvedValue({ ok: true });

      const updateData = {
        title: { ru: 'Обновленный заголовок', en: 'Updated Title' },
        description: { ru: 'Новое описание', en: 'New Description' },
      };

      const response = await request(app.getHttpServer())
        .patch('/admin/content/modules/a0.travel')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({ ok: true });
      expect(mockContentService.updateModule).toHaveBeenCalledWith(
        'a0.travel',
        expect.objectContaining(updateData)
      );
    });

    it('should update difficultyRating', async () => {
      mockContentService.updateModule.mockResolvedValue({ ok: true });

      await request(app.getHttpServer())
        .patch('/admin/content/modules/a0.travel')
        .send({ difficultyRating: 4 })
        .expect(200);

      expect(mockContentService.updateModule).toHaveBeenCalledWith(
        'a0.travel',
        expect.objectContaining({ difficultyRating: 4 })
      );
    });

    it('should return 400 for invalid difficultyRating update', async () => {
      await request(app.getHttpServer())
        .patch('/admin/content/modules/a0.travel')
        .send({ difficultyRating: 5.5 })
        .expect(400);
    });

    it('should return 400 for difficultyRating not in half steps', async () => {
      await request(app.getHttpServer())
        .patch('/admin/content/modules/a0.travel')
        .send({ difficultyRating: 2.3 })
        .expect(400);
    });

    it('should allow partial update (only title)', async () => {
      mockContentService.updateModule.mockResolvedValue({ ok: true });

      await request(app.getHttpServer())
        .patch('/admin/content/modules/a0.travel')
        .send({ title: { ru: 'Новый', en: 'New' } })
        .expect(200);

      expect(mockContentService.updateModule).toHaveBeenCalledWith(
        'a0.travel',
        { title: { ru: 'Новый', en: 'New' } }
      );
    });

    it('should allow partial update (only difficultyRating)', async () => {
      mockContentService.updateModule.mockResolvedValue({ ok: true });

      await request(app.getHttpServer())
        .patch('/admin/content/modules/a0.travel')
        .send({ difficultyRating: 3.5 })
        .expect(200);

      expect(mockContentService.updateModule).toHaveBeenCalledWith(
        'a0.travel',
        { difficultyRating: 3.5 }
      );
    });

    it('should return 400 when updating title with missing en field', async () => {
      await request(app.getHttpServer())
        .patch('/admin/content/modules/a0.travel')
        .send({ title: { ru: 'Только русский' } })
        .expect(400);
    });

    it('should return 400 when updating title with missing ru field', async () => {
      await request(app.getHttpServer())
        .patch('/admin/content/modules/a0.travel')
        .send({ title: { en: 'Only English' } })
        .expect(400);
    });
  });

  describe('GET /admin/content/modules', () => {
    it('should return list of modules', async () => {
      const mockModules = [
        { moduleRef: 'a0.travel', level: 'A0', title: validMultilingualTitle },
        { moduleRef: 'a0.food', level: 'A0', title: { ru: 'Еда', en: 'Food' } },
      ];
      mockContentService.listModules.mockResolvedValue(mockModules);

      const response = await request(app.getHttpServer())
        .get('/admin/content/modules')
        .expect(200);

      expect(response.body).toEqual({ items: mockModules });
    });

    it('should filter modules by level', async () => {
      const mockModules = [{ moduleRef: 'a1.basics', level: 'A1', title: validMultilingualTitle }];
      mockContentService.listModules.mockResolvedValue(mockModules);

      await request(app.getHttpServer())
        .get('/admin/content/modules?level=A1')
        .expect(200);

      expect(mockContentService.listModules).toHaveBeenCalledWith('A1');
    });
  });

  describe('POST /admin/content/lessons', () => {
    const validLesson = {
      moduleRef: 'a0.basics',
      lessonRef: 'a0.basics.001',
      title: 'Lesson 1',
      tasks: [
        {
          ref: 'a0.basics.001.t1',
          type: 'choice',
          data: { question: 'Pick', options: ['a', 'b'], correctIndex: 1 },
        },
      ],
    };

    it('should return lint errors for invalid tasks', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/content/lessons')
        .send({
          ...validLesson,
          tasks: [
            {
              ref: 'wrong-prefix.t1',
              type: 'choice',
              data: { question: 'Pick one', options: ['a'] },
            },
            {
              ref: 'wrong-prefix.t1',
              type: 'gap',
              data: { text: 'Missing' },
            },
          ],
        })
        .expect(400);

      expect(response.body.message).toBe('Lesson tasks validation failed');
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          'duplicate task.ref: wrong-prefix.t1',
          'task[0].ref must start with a0.basics.001.',
          'choice[0] requires >=2 options',
          'choice[0] missing correctIndex',
          'gap[1].text must contain ____',
          'gap[1].answer is required',
        ])
      );
      expect(mockContentService.createLesson).not.toHaveBeenCalled();
    });

    it('should create lesson when lint passes', async () => {
      mockContentService.createLesson.mockResolvedValue({ _id: 'lesson-id' });

      const response = await request(app.getHttpServer())
        .post('/admin/content/lessons')
        .send(validLesson)
        .expect(201);

      expect(response.body).toEqual({ id: 'lesson-id' });
      expect(mockContentService.createLesson).toHaveBeenCalledWith(expect.objectContaining(validLesson));
    });
  });

  describe('PATCH /admin/content/lessons/:lessonRef', () => {
    it('should return lint errors for invalid tasks', async () => {
      const response = await request(app.getHttpServer())
        .patch('/admin/content/lessons/a0.basics.001')
        .send({
          tasks: [
            {
              ref: 'a0.basics.999.t1',
              type: 'gap',
              data: { text: 'No blank' },
            },
          ],
        })
        .expect(400);

      expect(response.body.message).toBe('Lesson tasks validation failed');
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          'task[0].ref must start with a0.basics.001.',
          'gap[0].text must contain ____',
          'gap[0].answer is required',
        ])
      );
      expect(mockContentService.updateLesson).not.toHaveBeenCalled();
    });

    it('should update lesson when lint passes', async () => {
      mockContentService.updateLesson.mockResolvedValue({ ok: true });

      const response = await request(app.getHttpServer())
        .patch('/admin/content/lessons/a0.basics.001')
        .send({
          tasks: [
            {
              ref: 'a0.basics.001.t1',
              type: 'gap',
              data: { text: 'It costs ____ dollars', answer: '10' },
            },
          ],
        })
        .expect(200);

      expect(response.body).toEqual({ ok: true });
      expect(mockContentService.updateLesson).toHaveBeenCalledWith(
        'a0.basics.001',
        expect.objectContaining({ tasks: expect.any(Array) })
      );
    });
  });
});
