import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateModuleDto, MultilingualTextDto, OptionalMultilingualTextDto } from '../dto/module.dto';
import {
  validCreateModuleDto,
  minimalValidCreateModuleDto,
  validDifficultyRatings,
  invalidDifficultyRatings,
  invalidMultilingualTexts,
  validMultilingualTitle,
  createModuleDto,
} from './fixtures/module.fixtures';

describe('CreateModuleDto', () => {
  describe('valid cases', () => {
    it('should validate a fully populated CreateModuleDto', async () => {
      const dto = plainToInstance(CreateModuleDto, validCreateModuleDto);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate a minimal CreateModuleDto with required fields only', async () => {
      const dto = plainToInstance(CreateModuleDto, minimalValidCreateModuleDto);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should allow optional description to be undefined', async () => {
      const dto = plainToInstance(CreateModuleDto, {
        moduleRef: 'a0.test',
        level: 'A0',
        title: validMultilingualTitle,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('title validation (MultilingualTextDto)', () => {
    it('should accept title with both ru and en fields', async () => {
      const dto = plainToInstance(CreateModuleDto, {
        moduleRef: 'a0.test',
        level: 'A0',
        title: { ru: 'Тест', en: 'Test' },
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject title missing ru field', async () => {
      const dto = plainToInstance(CreateModuleDto, {
        moduleRef: 'a0.test',
        level: 'A0',
        title: { en: 'Only English' },
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const titleErrors = errors.find(e => e.property === 'title');
      expect(titleErrors).toBeDefined();
    });

    it('should reject title missing en field', async () => {
      const dto = plainToInstance(CreateModuleDto, {
        moduleRef: 'a0.test',
        level: 'A0',
        title: { ru: 'Только русский' },
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const titleErrors = errors.find(e => e.property === 'title');
      expect(titleErrors).toBeDefined();
    });

    it('should reject title with non-string ru value', async () => {
      const dto = plainToInstance(CreateModuleDto, {
        moduleRef: 'a0.test',
        level: 'A0',
        title: { ru: 123, en: 'Test' },
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject title with non-string en value', async () => {
      const dto = plainToInstance(CreateModuleDto, {
        moduleRef: 'a0.test',
        level: 'A0',
        title: { ru: 'Тест', en: 456 },
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject empty object as title', async () => {
      const dto = plainToInstance(CreateModuleDto, {
        moduleRef: 'a0.test',
        level: 'A0',
        title: {},
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject string as title (must be object)', async () => {
      const dto = plainToInstance(CreateModuleDto, {
        moduleRef: 'a0.test',
        level: 'A0',
        title: 'Just a string',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject null as title', async () => {
      const dto = plainToInstance(CreateModuleDto, {
        moduleRef: 'a0.test',
        level: 'A0',
        title: null,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject array as title', async () => {
      const dto = plainToInstance(CreateModuleDto, {
        moduleRef: 'a0.test',
        level: 'A0',
        title: ['ru', 'en'],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('description validation (OptionalMultilingualTextDto)', () => {
    it('should accept description with both ru and en fields', async () => {
      const dto = plainToInstance(CreateModuleDto, {
        moduleRef: 'a0.test',
        level: 'A0',
        title: validMultilingualTitle,
        description: { ru: 'Описание', en: 'Description' },
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept description with only ru field (optional multilingual)', async () => {
      const dto = plainToInstance(CreateModuleDto, {
        moduleRef: 'a0.test',
        level: 'A0',
        title: validMultilingualTitle,
        description: { ru: 'Только русский' },
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept description with only en field (optional multilingual)', async () => {
      const dto = plainToInstance(CreateModuleDto, {
        moduleRef: 'a0.test',
        level: 'A0',
        title: validMultilingualTitle,
        description: { en: 'English only' },
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept empty description object', async () => {
      const dto = plainToInstance(CreateModuleDto, {
        moduleRef: 'a0.test',
        level: 'A0',
        title: validMultilingualTitle,
        description: {},
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject description with non-string values', async () => {
      const dto = plainToInstance(CreateModuleDto, {
        moduleRef: 'a0.test',
        level: 'A0',
        title: validMultilingualTitle,
        description: { ru: 123, en: 'Test' },
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('difficultyRating validation', () => {
    describe('valid values', () => {
      it.each(validDifficultyRatings)(
        'should accept difficultyRating = %s',
        async (rating) => {
          const dto = plainToInstance(CreateModuleDto, createModuleDto({ difficultyRating: rating }));
          const errors = await validate(dto);
          expect(errors).toHaveLength(0);
        }
      );
    });

    describe('invalid values - out of range', () => {
      it('should reject difficultyRating = 0 (below minimum)', async () => {
        const dto = plainToInstance(CreateModuleDto, createModuleDto({ difficultyRating: 0 }));
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        const ratingError = errors.find(e => e.property === 'difficultyRating');
        expect(ratingError).toBeDefined();
      });

      it('should reject difficultyRating = 0.5 (below minimum)', async () => {
        const dto = plainToInstance(CreateModuleDto, createModuleDto({ difficultyRating: 0.5 }));
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        const ratingError = errors.find(e => e.property === 'difficultyRating');
        expect(ratingError).toBeDefined();
      });

      it('should reject difficultyRating = 5.5 (above maximum)', async () => {
        const dto = plainToInstance(CreateModuleDto, createModuleDto({ difficultyRating: 5.5 }));
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        const ratingError = errors.find(e => e.property === 'difficultyRating');
        expect(ratingError).toBeDefined();
      });

      it('should reject difficultyRating = 6 (above maximum)', async () => {
        const dto = plainToInstance(CreateModuleDto, createModuleDto({ difficultyRating: 6 }));
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        const ratingError = errors.find(e => e.property === 'difficultyRating');
        expect(ratingError).toBeDefined();
      });

      it('should reject negative difficultyRating', async () => {
        const dto = plainToInstance(CreateModuleDto, createModuleDto({ difficultyRating: -1 }));
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
      });
    });

    describe('invalid values - not half step', () => {
      it.each([1.3, 2.7, 3.1, 4.2, 4.9])(
        'should reject difficultyRating = %s (not a half step)',
        async (rating) => {
          const dto = plainToInstance(CreateModuleDto, createModuleDto({ difficultyRating: rating }));
          const errors = await validate(dto);
          expect(errors.length).toBeGreaterThan(0);
          const ratingError = errors.find(e => e.property === 'difficultyRating');
          expect(ratingError).toBeDefined();
        }
      );
    });

    it('should accept undefined difficultyRating (optional field)', async () => {
      const dto = plainToInstance(CreateModuleDto, {
        moduleRef: 'a0.test',
        level: 'A0',
        title: validMultilingualTitle,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject non-number difficultyRating', async () => {
      const dto = plainToInstance(CreateModuleDto, createModuleDto({ difficultyRating: 'hard' as any }));
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('moduleRef validation', () => {
    it('should accept valid moduleRef', async () => {
      const dto = plainToInstance(CreateModuleDto, createModuleDto({ moduleRef: 'a0.travel' }));
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject missing moduleRef', async () => {
      const { moduleRef, ...dtoWithoutModuleRef } = validCreateModuleDto;
      const dto = plainToInstance(CreateModuleDto, dtoWithoutModuleRef);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-string moduleRef', async () => {
      const dto = plainToInstance(CreateModuleDto, createModuleDto({ moduleRef: 123 as any }));
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('level validation', () => {
    it.each(['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const)(
      'should accept level = %s',
      async (level) => {
        const dto = plainToInstance(CreateModuleDto, createModuleDto({ level }));
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    );

    it('should reject missing level', async () => {
      const { level, ...dtoWithoutLevel } = validCreateModuleDto;
      const dto = plainToInstance(CreateModuleDto, dtoWithoutLevel);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('optional fields', () => {
    it('should accept tags as array of strings', async () => {
      const dto = plainToInstance(CreateModuleDto, createModuleDto({ tags: ['tag1', 'tag2'] }));
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept empty tags array', async () => {
      const dto = plainToInstance(CreateModuleDto, createModuleDto({ tags: [] }));
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept boolean published field', async () => {
      const dto = plainToInstance(CreateModuleDto, createModuleDto({ published: false }));
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept boolean requiresPro field', async () => {
      const dto = plainToInstance(CreateModuleDto, createModuleDto({ requiresPro: true }));
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept boolean isAvailable field', async () => {
      const dto = plainToInstance(CreateModuleDto, createModuleDto({ isAvailable: false }));
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept valid order (non-negative integer)', async () => {
      const dto = plainToInstance(CreateModuleDto, createModuleDto({ order: 5 }));
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject negative order', async () => {
      const dto = plainToInstance(CreateModuleDto, createModuleDto({ order: -1 }));
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});

describe('MultilingualTextDto', () => {
  it('should validate complete multilingual text', async () => {
    const dto = plainToInstance(MultilingualTextDto, { ru: 'Привет', en: 'Hello' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject missing ru field', async () => {
    const dto = plainToInstance(MultilingualTextDto, { en: 'Hello' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.property === 'ru')).toBe(true);
  });

  it('should reject missing en field', async () => {
    const dto = plainToInstance(MultilingualTextDto, { ru: 'Привет' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.property === 'en')).toBe(true);
  });

  it('should reject empty object', async () => {
    const dto = plainToInstance(MultilingualTextDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(2); // Both ru and en missing
  });
});

describe('OptionalMultilingualTextDto', () => {
  it('should accept both ru and en fields', async () => {
    const dto = plainToInstance(OptionalMultilingualTextDto, { ru: 'Описание', en: 'Description' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should accept only ru field', async () => {
    const dto = plainToInstance(OptionalMultilingualTextDto, { ru: 'Только русский' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should accept only en field', async () => {
    const dto = plainToInstance(OptionalMultilingualTextDto, { en: 'English only' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should accept empty object', async () => {
    const dto = plainToInstance(OptionalMultilingualTextDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject non-string ru', async () => {
    const dto = plainToInstance(OptionalMultilingualTextDto, { ru: 123 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject non-string en', async () => {
    const dto = plainToInstance(OptionalMultilingualTextDto, { en: true });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

