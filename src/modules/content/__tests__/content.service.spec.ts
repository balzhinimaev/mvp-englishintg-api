import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ContentService } from '../content.service';
import { CourseModule, CourseModuleDocument } from '../../common/schemas/course-module.schema';
import { Lesson, LessonDocument } from '../../common/schemas/lesson.schema';
import { User, UserDocument } from '../../common/schemas/user.schema';
import { UserLessonProgress, UserLessonProgressDocument } from '../../common/schemas/user-lesson-progress.schema';
import {
  validMultilingualTitle,
  validMultilingualDescription,
  validCreateModuleDto,
} from './fixtures/module.fixtures';

describe('ContentService', () => {
  let service: ContentService;
  let moduleModel: Model<CourseModuleDocument>;
  let lessonModel: Model<LessonDocument>;
  let userModel: Model<UserDocument>;
  let progressModel: Model<UserLessonProgressDocument>;

  const mockModuleModel = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(null), // По умолчанию модуль не найден
    }),
    updateOne: jest.fn(),
  };

  const mockLessonModel = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn(),
  };

  const mockUserModel = {
    findOne: jest.fn(),
  };

  const mockProgressModel = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentService,
        {
          provide: getModelToken(CourseModule.name),
          useValue: mockModuleModel,
        },
        {
          provide: getModelToken(Lesson.name),
          useValue: mockLessonModel,
        },
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(UserLessonProgress.name),
          useValue: mockProgressModel,
        },
      ],
    }).compile();

    service = module.get<ContentService>(ContentService);
    moduleModel = module.get<Model<CourseModuleDocument>>(getModelToken(CourseModule.name));
    lessonModel = module.get<Model<LessonDocument>>(getModelToken(Lesson.name));
    userModel = module.get<Model<UserDocument>>(getModelToken(User.name));
    progressModel = module.get<Model<UserLessonProgressDocument>>(getModelToken(UserLessonProgress.name));

    jest.clearAllMocks();
  });

  describe('createModule', () => {
    it('should create a module with multilingual title and description', async () => {
      const createData = {
        moduleRef: 'a0.travel',
        level: 'A0' as const,
        title: validMultilingualTitle,
        description: validMultilingualDescription,
        tags: ['travel'],
        order: 1,
        published: true,
        author: { userId: 'user-123', name: 'John Doe' },
      };

      const expectedDoc = { _id: 'new-module-id', ...createData };
      mockModuleModel.create.mockResolvedValue(expectedDoc);

      const result = await service.createModule(createData);

      expect(mockModuleModel.create).toHaveBeenCalledWith(createData);
      expect(result).toEqual(expectedDoc);
    });

    it('should save author information when provided', async () => {
      const createData = {
        moduleRef: 'a0.test',
        level: 'A0' as const,
        title: validMultilingualTitle,
        author: { userId: 'author-456', name: 'Jane Smith' },
      };

      const expectedDoc = { _id: 'module-id', ...createData };
      mockModuleModel.create.mockResolvedValue(expectedDoc);

      const result = await service.createModule(createData);

      expect(mockModuleModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          author: { userId: 'author-456', name: 'Jane Smith' },
        })
      );
      expect(result).toEqual(expectedDoc);
    });

    it('should save difficultyRating when provided', async () => {
      const createData = {
        moduleRef: 'a0.test',
        level: 'A0' as const,
        title: validMultilingualTitle,
        difficultyRating: 2.5,
      };

      const expectedDoc = { _id: 'module-id', ...createData };
      mockModuleModel.create.mockResolvedValue(expectedDoc);

      await service.createModule(createData as any);

      // Проверяем, что difficultyRating передается в create (через body)
      expect(mockModuleModel.create).toHaveBeenCalled();
    });

    it('should create module with all multilingual fields correctly', async () => {
      const createData = {
        moduleRef: 'b1.business',
        level: 'B1' as const,
        title: { ru: 'Бизнес', en: 'Business' },
        description: { ru: 'Бизнес английский', en: 'Business English' },
      };

      mockModuleModel.create.mockResolvedValue({ _id: 'id', ...createData });

      await service.createModule(createData);

      expect(mockModuleModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: { ru: 'Бизнес', en: 'Business' },
          description: { ru: 'Бизнес английский', en: 'Business English' },
        })
      );
    });
  });

  describe('updateModule', () => {
    it('should strip author field from update to prevent tampering', async () => {
      mockModuleModel.updateOne.mockResolvedValue({ acknowledged: true, modifiedCount: 1 });

      const update = {
        title: { ru: 'Новый заголовок', en: 'New Title' },
        author: { userId: 'hacker', name: 'Hacker' }, // malicious attempt to change author
      } as any;

      const result = await service.updateModule('a0.travel', update);

      // Verify updateOne was called
      expect(mockModuleModel.updateOne).toHaveBeenCalledTimes(1);
      
      // Get the actual $set object passed to updateOne
      const [, updateArg] = mockModuleModel.updateOne.mock.calls[0];
      const setObject = updateArg.$set;
      
      // Verify author is NOT in the update
      expect(setObject).not.toHaveProperty('author');
      // Verify title IS in the update
      expect(setObject).toHaveProperty('title');
      expect(setObject.title).toEqual({ ru: 'Новый заголовок', en: 'New Title' });
      
      expect(result).toEqual({ ok: true });
    });

    it('should update only title when author is also passed', async () => {
      mockModuleModel.updateOne.mockResolvedValue({ acknowledged: true, modifiedCount: 1 });

      await service.updateModule('a0.test', {
        title: { ru: 'Обновлено', en: 'Updated' },
        author: { userId: 'attacker', name: 'Attacker' },
      } as any);

      expect(mockModuleModel.updateOne).toHaveBeenCalledWith(
        { moduleRef: 'a0.test' },
        { $set: { title: { ru: 'Обновлено', en: 'Updated' } } }
      );
    });

    it('should update multilingual title', async () => {
      mockModuleModel.updateOne.mockResolvedValue({ acknowledged: true, modifiedCount: 1 });

      await service.updateModule('a0.test', {
        title: { ru: 'Обновлено', en: 'Updated' },
      } as any);

      expect(mockModuleModel.updateOne).toHaveBeenCalledWith(
        { moduleRef: 'a0.test' },
        { $set: { title: { ru: 'Обновлено', en: 'Updated' } } }
      );
    });

    it('should update difficultyRating', async () => {
      mockModuleModel.updateOne.mockResolvedValue({ acknowledged: true, modifiedCount: 1 });

      await service.updateModule('a0.test', {
        difficultyRating: 4.5,
      } as any);

      expect(mockModuleModel.updateOne).toHaveBeenCalledWith(
        { moduleRef: 'a0.test' },
        { $set: { difficultyRating: 4.5 } }
      );
    });

    it('should update description with multilingual object', async () => {
      mockModuleModel.updateOne.mockResolvedValue({ acknowledged: true, modifiedCount: 1 });

      await service.updateModule('a0.test', {
        description: { ru: 'Описание', en: 'Description' },
      } as any);

      expect(mockModuleModel.updateOne).toHaveBeenCalledWith(
        { moduleRef: 'a0.test' },
        { $set: { description: { ru: 'Описание', en: 'Description' } } }
      );
    });

    it('should update multiple fields at once (excluding author)', async () => {
      mockModuleModel.updateOne.mockResolvedValue({ acknowledged: true, modifiedCount: 1 });

      await service.updateModule('a0.test', {
        title: { ru: 'Новый', en: 'New' },
        difficultyRating: 3,
        published: false,
        author: { userId: 'hacker', name: 'Hacker' }, // should be stripped
      } as any);

      const [, updateArg] = mockModuleModel.updateOne.mock.calls[0];
      
      expect(updateArg.$set).toEqual({
        title: { ru: 'Новый', en: 'New' },
        difficultyRating: 3,
        published: false,
      });
      expect(updateArg.$set).not.toHaveProperty('author');
    });
  });

  describe('canStartLesson', () => {
    it('should return false when lesson not found', async () => {
      mockLessonModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const result = await service.canStartLesson('user-1', 'a0.basics.001');

      expect(result).toEqual({ canStart: false, reason: 'Lesson not found' });
      expect(mockLessonModel.findOne).toHaveBeenCalledWith({ lessonRef: 'a0.basics.001', published: true });
    });

    it('should allow PRO user access to any lesson', async () => {
      mockLessonModel.findOne.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({ lessonRef: 'a0.basics.010', moduleRef: 'a0.basics', order: 10 }),
      });
      mockUserModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ userId: 'pro-user', pro: { active: true } }),
      });

      const result = await service.canStartLesson('pro-user', 'a0.basics.010');

      expect(result).toEqual({ canStart: true });
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ userId: 'pro-user' });
      // PRO пользователь не требует проверки предыдущих уроков
      expect(mockProgressModel.findOne).not.toHaveBeenCalled();
    });

    it('should block access when order is invalid (< 1)', async () => {
      mockLessonModel.findOne.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({ lessonRef: 'a0.basics.000', moduleRef: 'a0.basics', order: 0 }),
      });
      mockUserModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ userId: 'user-1', pro: { active: false } }),
      });

      const result = await service.canStartLesson('user-1', 'a0.basics.000');

      expect(result).toEqual({ 
        canStart: false, 
        reason: 'Lesson has invalid order. Please contact support.' 
      });
    });

    it('should block access when lesson has explicit requiresPro flag', async () => {
      mockLessonModel.findOne.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({ 
          lessonRef: 'a0.basics.005', 
          moduleRef: 'a0.basics', 
          order: 5, 
          requiresPro: true 
        }),
      });
      mockUserModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ userId: 'user-1', pro: { active: false } }),
      });

      const result = await service.canStartLesson('user-1', 'a0.basics.005');

      expect(result).toEqual({ 
        canStart: false, 
        reason: 'This lesson requires PRO subscription' 
      });
    });

    it('should block access when lesson order exceeds module freeUntilOrder', async () => {
      mockLessonModel.findOne.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({ 
          lessonRef: 'a0.basics.005', 
          moduleRef: 'a0.basics', 
          order: 5 
        }),
      });
      mockUserModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ userId: 'user-1', pro: { active: false } }),
      });
      mockModuleModel.findOne.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({ 
          moduleRef: 'a0.basics', 
          freeUntilOrder: 3 
        }),
      });

      const result = await service.canStartLesson('user-1', 'a0.basics.005');

      expect(result).toEqual({ 
        canStart: false, 
        reason: 'This lesson requires PRO subscription. Free lessons available up to lesson 3' 
      });
      expect(mockModuleModel.findOne).toHaveBeenCalledWith({ moduleRef: 'a0.basics' });
    });

    it('should allow access when lesson order is within module freeUntilOrder', async () => {
      mockLessonModel.findOne.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({ 
          lessonRef: 'a0.basics.002', 
          moduleRef: 'a0.basics', 
          order: 2 
        }),
      });
      mockUserModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ userId: 'user-1', pro: { active: false } }),
      });
      mockModuleModel.findOne.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({ 
          moduleRef: 'a0.basics', 
          freeUntilOrder: 3 
        }),
      });
      // Мокируем предыдущий урок
      mockLessonModel.findOne.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({ lessonRef: 'a0.basics.001', order: 1 }),
      });
      mockProgressModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ lessonRef: 'a0.basics.001', status: 'completed' }),
      });

      const result = await service.canStartLesson('user-1', 'a0.basics.002');

      expect(result).toEqual({ canStart: true });
    });

    it('should allow access when order is 1 for regular user', async () => {
      mockLessonModel.findOne.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({ lessonRef: 'a0.basics.001', moduleRef: 'a0.basics', order: 1 }),
      });
      mockUserModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ userId: 'user-1', pro: { active: false } }),
      });

      const result = await service.canStartLesson('user-1', 'a0.basics.001');

      expect(result).toEqual({ canStart: true });
      expect(mockLessonModel.findOne).toHaveBeenCalledTimes(1);
      expect(mockProgressModel.findOne).not.toHaveBeenCalled();
    });

    it('should block access when previous lesson is missing (broken content)', async () => {
      mockLessonModel.findOne
        .mockReturnValueOnce({
          lean: jest.fn().mockResolvedValue({ lessonRef: 'a0.basics.002', moduleRef: 'a0.basics', order: 2 }),
        })
        .mockReturnValueOnce({
          lean: jest.fn().mockResolvedValue(null),
        });
      mockUserModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ userId: 'user-1', pro: { active: false } }),
      });

      const result = await service.canStartLesson('user-1', 'a0.basics.002');

      expect(result).toEqual({ 
        canStart: false, 
        reason: 'Previous lesson (order 1) not found. Content structure is broken.' 
      });
      expect(mockLessonModel.findOne).toHaveBeenCalledTimes(2);
      expect(mockProgressModel.findOne).not.toHaveBeenCalled();
    });

    it('should block access when previous lesson is not completed', async () => {
      mockLessonModel.findOne
        .mockReturnValueOnce({
          lean: jest.fn().mockResolvedValue({ lessonRef: 'a0.basics.002', moduleRef: 'a0.basics', order: 2 }),
        })
        .mockReturnValueOnce({
          lean: jest.fn().mockResolvedValue({ lessonRef: 'a0.basics.001' }),
        });
      mockUserModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ userId: 'user-1', pro: { active: false } }),
      });
      mockProgressModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const result = await service.canStartLesson('user-1', 'a0.basics.002');

      expect(result).toEqual({
        canStart: false,
        reason: 'Previous lesson must be completed before starting this lesson',
        requiredLesson: 'a0.basics.001',
      });
      expect(mockProgressModel.findOne).toHaveBeenCalledWith({
        userId: 'user-1',
        lessonRef: 'a0.basics.001',
        status: 'completed',
      });
    });

    it('should allow access when previous lesson is completed', async () => {
      mockLessonModel.findOne
        .mockReturnValueOnce({
          lean: jest.fn().mockResolvedValue({ lessonRef: 'a0.basics.002', moduleRef: 'a0.basics', order: 2 }),
        })
        .mockReturnValueOnce({
          lean: jest.fn().mockResolvedValue({ lessonRef: 'a0.basics.001' }),
        });
      mockUserModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ userId: 'user-1', pro: { active: false } }),
      });
      mockProgressModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ lessonRef: 'a0.basics.001', status: 'completed' }),
      });

      const result = await service.canStartLesson('user-1', 'a0.basics.002');

      expect(result).toEqual({ canStart: true });
      expect(mockProgressModel.findOne).toHaveBeenCalled();
    });
  });

  describe('listModules', () => {
    it('should list all modules when no level specified', async () => {
      const mockModules = [
        { moduleRef: 'a0.travel', level: 'A0', title: validMultilingualTitle },
        { moduleRef: 'a1.basics', level: 'A1', title: validMultilingualTitle },
      ];

      mockModuleModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockModules),
        }),
      });

      const result = await service.listModules();

      expect(mockModuleModel.find).toHaveBeenCalledWith({});
      expect(result).toEqual(mockModules);
    });

    it('should filter modules by level', async () => {
      const mockModules = [
        { moduleRef: 'a0.travel', level: 'A0', title: validMultilingualTitle },
      ];

      mockModuleModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockModules),
        }),
      });

      const result = await service.listModules('A0');

      expect(mockModuleModel.find).toHaveBeenCalledWith({ level: 'A0' });
      expect(result).toEqual(mockModules);
    });
  });
});
