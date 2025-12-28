import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LessonPrerequisiteGuard } from '../lesson-prerequisite.guard';
import { ContentService } from '../../content.service';

const buildContext = (params: Record<string, any>, query: Record<string, any> = {}, body: Record<string, any> = {}) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ params, query, body }),
    }),
  }) as any;

describe('LessonPrerequisiteGuard', () => {
  let guard: LessonPrerequisiteGuard;
  let contentService: ContentService;

  const mockContentService = {
    canStartLesson: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonPrerequisiteGuard,
        {
          provide: ContentService,
          useValue: mockContentService,
        },
      ],
    }).compile();

    guard = module.get<LessonPrerequisiteGuard>(LessonPrerequisiteGuard);
    contentService = module.get<ContentService>(ContentService);

    jest.clearAllMocks();
  });

  it('should throw when lessonRef is missing', async () => {
    await expect(guard.canActivate(buildContext({}, { userId: 'user-1' }))).rejects.toThrow(
      new BadRequestException('lessonRef is required')
    );
  });

  it('should throw when userId is missing', async () => {
    await expect(guard.canActivate(buildContext({ lessonRef: 'a0.basics.001' }))).rejects.toThrow(
      new BadRequestException('userId is required')
    );
  });

  it('should throw when lesson is not found', async () => {
    mockContentService.canStartLesson.mockResolvedValue({ canStart: false, reason: 'Lesson not found' });

    await expect(
      guard.canActivate(buildContext({ lessonRef: 'a0.basics.999' }, { userId: 'user-1' }))
    ).rejects.toThrow(new BadRequestException('Lesson not found'));
    expect(contentService.canStartLesson).toHaveBeenCalledWith('user-1', 'a0.basics.999');
  });

  it('should forbid when previous lesson is not completed', async () => {
    mockContentService.canStartLesson.mockResolvedValue({
      canStart: false,
      reason: 'Previous lesson a0.basics.001 must be completed before starting a0.basics.002',
      requiredLesson: 'a0.basics.001',
    });

    try {
      await guard.canActivate(buildContext({ lessonRef: 'a0.basics.002' }, { userId: 'user-1' }));
      throw new Error('should have thrown');
    } catch (error: any) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error.getResponse()).toEqual({
        error: 'PREREQ_NOT_MET',
        message: 'Previous lesson a0.basics.001 must be completed before starting a0.basics.002',
        requiredLesson: 'a0.basics.001',
        currentLesson: 'a0.basics.002',
      });
    }
  });

  it('should allow access when prerequisites are met', async () => {
    mockContentService.canStartLesson.mockResolvedValue({ canStart: true });

    await expect(
      guard.canActivate(buildContext({ lessonRef: 'a0.basics.001' }, { userId: 'user-1' }))
    ).resolves.toBe(true);
    expect(contentService.canStartLesson).toHaveBeenCalledWith('user-1', 'a0.basics.001');
  });
});
