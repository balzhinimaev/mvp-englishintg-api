import { CreateModuleDto, MultilingualTextDto, OptionalMultilingualTextDto } from '../../dto/module.dto';
import { CourseModule } from '../../../common/schemas/course-module.schema';
import { ModuleItem } from '../../../common/types/content';

// === Valid Multilingual Text ===
export const validMultilingualTitle: MultilingualTextDto = {
  ru: 'Путешествия',
  en: 'Travel',
};

export const validMultilingualDescription: OptionalMultilingualTextDto = {
  ru: 'Изучайте фразы для путешествий',
  en: 'Learn travel phrases',
};

// === Valid CreateModuleDto ===
export const validCreateModuleDto: CreateModuleDto = {
  moduleRef: 'a0.travel',
  level: 'A0',
  title: validMultilingualTitle,
  description: validMultilingualDescription,
  tags: ['travel', 'beginner'],
  difficultyRating: 2.5,
  order: 1,
  published: true,
  requiresPro: false,
  isAvailable: true,
};

export const minimalValidCreateModuleDto: CreateModuleDto = {
  moduleRef: 'a1.basics',
  level: 'A1',
  title: validMultilingualTitle,
};

// === Valid difficultyRating values ===
export const validDifficultyRatings = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

// === Invalid difficultyRating values ===
export const invalidDifficultyRatings = [
  { value: 0, reason: 'below minimum' },
  { value: 0.5, reason: 'below minimum' },
  { value: 5.5, reason: 'above maximum' },
  { value: 6, reason: 'above maximum' },
  { value: 1.3, reason: 'not a half step' },
  { value: 2.7, reason: 'not a half step' },
  { value: 3.1, reason: 'not a half step' },
  { value: -1, reason: 'negative value' },
];

// === Invalid Multilingual Text objects ===
export const invalidMultilingualTexts = [
  { value: { ru: 'Только русский' }, reason: 'missing en field' },
  { value: { en: 'Only English' }, reason: 'missing ru field' },
  { value: {}, reason: 'empty object' },
  { value: { ru: 123, en: 'Text' }, reason: 'ru is not a string' },
  { value: { ru: 'Text', en: 456 }, reason: 'en is not a string' },
  { value: null, reason: 'null value' },
  { value: 'Just a string', reason: 'string instead of object' },
  { value: ['ru', 'en'], reason: 'array instead of object' },
];

// === Mock User from JWT ===
export const mockJwtUser = {
  userId: 'user-123-abc',
  user: {
    firstName: 'John',
    lastName: 'Doe',
    username: 'johndoe',
  },
};

export const mockJwtUserMinimal = {
  userId: 'user-456-def',
  user: {
    username: 'minimaluser',
  },
};

// === CourseModule document mock ===
export const mockCourseModuleDoc: Partial<CourseModule> & { _id: string } = {
  _id: 'module-id-123',
  moduleRef: 'a0.travel',
  level: 'A0',
  title: validMultilingualTitle,
  description: validMultilingualDescription,
  tags: ['travel', 'beginner'],
  difficultyRating: 2.5,
  order: 1,
  published: true,
  requiresPro: false,
  isAvailable: true,
  author: {
    userId: 'user-123-abc',
    name: 'John Doe',
  },
};

// === Expected ModuleItem after presentation ===
export const expectedModuleItem: ModuleItem = {
  moduleRef: 'a0.travel',
  level: 'A0',
  title: validMultilingualTitle,
  description: validMultilingualDescription,
  tags: ['travel', 'beginner'],
  order: 1,
  requiresPro: false,
  isAvailable: true,
};

// === Factory functions for dynamic test data ===
export function createModuleDto(overrides: Partial<CreateModuleDto> = {}): CreateModuleDto {
  return {
    ...validCreateModuleDto,
    ...overrides,
  };
}

export function createMultilingualText(ru: string, en: string): MultilingualTextDto {
  return { ru, en };
}

export function createMockRequest(user: typeof mockJwtUser | typeof mockJwtUserMinimal = mockJwtUser) {
  return { user };
}

