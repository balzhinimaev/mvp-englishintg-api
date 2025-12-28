import { presentLesson, presentModule } from '../presenter';
import { CourseModule } from '../../common/schemas/course-module.schema';
import { ModuleItem } from '../../common/types/content';
import { validMultilingualTitle, validMultilingualDescription } from './fixtures/module.fixtures';

describe('presentModule', () => {
  const baseModule: CourseModule = {
    moduleRef: 'a0.travel',
    level: 'A0',
    title: validMultilingualTitle,
    description: validMultilingualDescription,
    tags: ['travel', 'beginner'],
    order: 1,
    published: true,
    requiresPro: false,
    isAvailable: true,
    difficultyRating: 2.5,
    author: {
      userId: 'user-123',
      name: 'John Doe',
    },
  };

  describe('basic presentation', () => {
    it('should return correct moduleRef', () => {
      const result = presentModule(baseModule);
      expect(result.moduleRef).toBe('a0.travel');
    });

    it('should return correct level', () => {
      const result = presentModule(baseModule);
      expect(result.level).toBe('A0');
    });

    it('should return multilingual title object', () => {
      const result = presentModule(baseModule);
      expect(result.title).toEqual(validMultilingualTitle);
      expect(result.title.ru).toBe('Путешествия');
      expect(result.title.en).toBe('Travel');
    });

    it('should return multilingual description object', () => {
      const result = presentModule(baseModule);
      expect(result.description).toEqual(validMultilingualDescription);
      expect(result.description?.ru).toBe('Изучайте фразы для путешествий');
      expect(result.description?.en).toBe('Learn travel phrases');
    });

    it('should return tags array', () => {
      const result = presentModule(baseModule);
      expect(result.tags).toEqual(['travel', 'beginner']);
    });

    it('should return order', () => {
      const result = presentModule(baseModule);
      expect(result.order).toBe(1);
    });

    it('should return requiresPro flag', () => {
      const result = presentModule(baseModule);
      expect(result.requiresPro).toBe(false);
    });

    it('should return isAvailable flag', () => {
      const result = presentModule(baseModule);
      expect(result.isAvailable).toBe(true);
    });
  });

  describe('difficultyRating field', () => {
    it('should include difficultyRating in presentation', () => {
      const result = presentModule(baseModule);
      expect(result.difficultyRating).toBe(2.5);
    });

    it('should handle undefined difficultyRating', () => {
      const moduleWithoutRating = { ...baseModule, difficultyRating: undefined };
      const result = presentModule(moduleWithoutRating);
      expect(result.difficultyRating).toBeUndefined();
    });

    it.each([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5])(
      'should correctly present difficultyRating = %s',
      (rating) => {
        const moduleWithRating = { ...baseModule, difficultyRating: rating };
        const result = presentModule(moduleWithRating);
        expect(result.difficultyRating).toBe(rating);
      }
    );
  });

  describe('author field', () => {
    it('should include author in presentation', () => {
      const result = presentModule(baseModule);
      expect(result.author).toEqual({
        userId: 'user-123',
        name: 'John Doe',
      });
    });

    it('should handle undefined author', () => {
      const moduleWithoutAuthor = { ...baseModule, author: undefined };
      const result = presentModule(moduleWithoutAuthor);
      expect(result.author).toBeUndefined();
    });

    it('should handle author with only userId', () => {
      const moduleWithMinimalAuthor = {
        ...baseModule,
        author: { userId: 'author-id' },
      };
      const result = presentModule(moduleWithMinimalAuthor);
      expect(result.author).toEqual({ userId: 'author-id' });
    });

    it('should preserve author name when provided', () => {
      const moduleWithFullAuthor = {
        ...baseModule,
        author: { userId: 'full-author', name: 'Full Name' },
      };
      const result = presentModule(moduleWithFullAuthor);
      expect(result.author?.name).toBe('Full Name');
    });
  });

  describe('with progress', () => {
    it('should include progress when provided', () => {
      const progress = { completed: 5, total: 10, inProgress: 2 };
      const result = presentModule(baseModule, progress);
      expect(result.progress).toEqual(progress);
    });

    it('should have undefined progress when not provided', () => {
      const result = presentModule(baseModule);
      expect(result.progress).toBeUndefined();
    });

    it('should correctly pass zero progress values', () => {
      const progress = { completed: 0, total: 5, inProgress: 0 };
      const result = presentModule(baseModule, progress);
      expect(result.progress).toEqual(progress);
    });
  });

  describe('edge cases', () => {
    it('should handle empty tags array', () => {
      const moduleWithoutTags = { ...baseModule, tags: undefined };
      const result = presentModule(moduleWithoutTags);
      expect(result.tags).toEqual([]);
    });

    it('should handle undefined description', () => {
      const moduleWithoutDesc = { ...baseModule, description: undefined };
      const result = presentModule(moduleWithoutDesc);
      expect(result.description).toBeUndefined();
    });

    it('should handle undefined order (defaults to 0)', () => {
      const moduleWithoutOrder = { ...baseModule, order: undefined };
      const result = presentModule(moduleWithoutOrder);
      expect(result.order).toBe(0);
    });

    it('should handle undefined requiresPro (defaults to false)', () => {
      const moduleWithoutPro = { ...baseModule, requiresPro: undefined };
      const result = presentModule(moduleWithoutPro);
      expect(result.requiresPro).toBe(false);
    });

    it('should handle undefined isAvailable (defaults to true)', () => {
      const moduleWithoutAvailable = { ...baseModule, isAvailable: undefined };
      const result = presentModule(moduleWithoutAvailable);
      expect(result.isAvailable).toBe(true);
    });
  });

  describe('all CEFR levels', () => {
    it.each(['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const)(
      'should correctly present module with level %s',
      (level) => {
        const moduleWithLevel = { ...baseModule, level };
        const result = presentModule(moduleWithLevel);
        expect(result.level).toBe(level);
      }
    );
  });

  describe('return type structure', () => {
    it('should return ModuleItem with all expected fields', () => {
      const result = presentModule(baseModule);
      
      // Проверяем наличие всех полей ModuleItem
      expect(result).toHaveProperty('moduleRef');
      expect(result).toHaveProperty('level');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('tags');
      expect(result).toHaveProperty('difficultyRating');
      expect(result).toHaveProperty('order');
      expect(result).toHaveProperty('requiresPro');
      expect(result).toHaveProperty('isAvailable');
      expect(result).toHaveProperty('author');
    });

    it('should have correct types for all fields', () => {
      const result = presentModule(baseModule);
      
      expect(typeof result.moduleRef).toBe('string');
      expect(typeof result.level).toBe('string');
      expect(typeof result.title).toBe('object');
      expect(Array.isArray(result.tags)).toBe(true);
      expect(typeof result.difficultyRating).toBe('number');
      expect(typeof result.order).toBe('number');
      expect(typeof result.requiresPro).toBe('boolean');
      expect(typeof result.isAvailable).toBe('boolean');
      expect(typeof result.author).toBe('object');
    });

    it('should include title with ru and en fields', () => {
      const result = presentModule(baseModule);
      
      expect(result.title).toHaveProperty('ru');
      expect(result.title).toHaveProperty('en');
      expect(typeof result.title.ru).toBe('string');
      expect(typeof result.title.en).toBe('string');
    });

    it('should include author with userId and optional name', () => {
      const result = presentModule(baseModule);
      
      expect(result.author).toHaveProperty('userId');
      expect(result.author?.name).toBeDefined();
    });
  });
});

describe('presentLesson', () => {
  it('should apply defaults and include progress', () => {
    const lesson = {
      lessonRef: 'a0.basics.001',
      moduleRef: 'a0.basics',
      title: { ru: 'Урок 1', en: 'Lesson 1' },
      description: { ru: 'Описание', en: 'Description' },
      tasks: [{ ref: 'a0.basics.001.t1', type: 'choice', data: {} }],
    } as any;

    const result = presentLesson(lesson, 'ru', {
      status: 'completed',
      score: 1,
      attempts: 2,
      completedAt: new Date('2024-01-02T00:00:00Z'),
    });

    expect(result.estimatedMinutes).toBe(8);
    expect(result.type).toBe('vocabulary');
    expect(result.difficulty).toBe('easy');
    expect(result.hasAudio).toBe(true);
    expect(result.hasVideo).toBe(false);
    expect(result.progress).toEqual({
      status: 'completed',
      score: 1,
      attempts: 2,
      completedAt: '2024-01-02T00:00:00.000Z',
      timeSpent: 0,
    });
  });
});
