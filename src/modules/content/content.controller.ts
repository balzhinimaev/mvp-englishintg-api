import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PublicGuard } from '../common/guards/public.guard';
import { LessonPrerequisiteGuard } from './guards/lesson-prerequisite.guard';
import { CourseModule, CourseModuleDocument } from '../common/schemas/course-module.schema';
import { Lesson, LessonDocument } from '../common/schemas/lesson.schema';
import { UserLessonProgress, UserLessonProgressDocument } from '../common/schemas/user-lesson-progress.schema';
import { getLocalizedText, parseLanguage } from '../common/utils/i18n.util';
import { isValidLessonRef } from '../common/utils/lesson-ref';
import { ModuleMapper, LessonMapper, LessonProgressMapper } from '../common/utils/mappers';
import { GetModulesDto, GetLessonsDto, GetLessonDto } from './dto/get-content.dto';
import { LessonItemDto } from './dto/lesson-item.dto';
import { ContentService } from './content.service';
import { VocabularyService } from './vocabulary.service';

@Controller('content')
@ApiExtraModels(LessonItemDto)
export class ContentController {
  constructor(
    @InjectModel(CourseModule.name) private readonly moduleModel: Model<CourseModuleDocument>,
    @InjectModel(Lesson.name) private readonly lessonModel: Model<LessonDocument>,
    @InjectModel(UserLessonProgress.name) private readonly ulpModel: Model<UserLessonProgressDocument>,
    private readonly contentService: ContentService,
    private readonly vocabularyService: VocabularyService,
  ) {}

  @Get('modules')
  @UseGuards(JwtAuthGuard)
  async getModules(@Query() query: GetModulesDto, @Request() req: any) {
    const { level } = query;
    const userId = req.user?.userId; // Get userId from JWT token
    const filter: any = { published: true };
    if (level) filter.level = level;

    const modules = await this.moduleModel
      .find(filter)
      .sort({ level: 1, order: 1 })
      .lean();

    // Enrich with progress if userId provided.
    // Доступ к урокам решает ContentService.canStartLesson по entitlement.endsAt —
    // здесь права не вычисляем.
    if (userId) {
      const progressMap = new Map();
      const progress = await this.ulpModel
        .find({ userId: String(userId) })
        .lean();
      
      for (const p of progress) {
        // Используем денормализованный moduleRef или вычисляем из lessonRef
        const moduleRef = (p as any).moduleRef || (p as any).lessonRef?.split('.').slice(0, 2).join('.');
        if (!progressMap.has(moduleRef)) {
          progressMap.set(moduleRef, { completed: 0, total: 0, inProgress: 0 });
        }
        const stats = progressMap.get(moduleRef);
        stats.total++;
        if ((p as any).status === 'completed') stats.completed++;
        if ((p as any).status === 'in_progress') stats.inProgress++;
      }

      return {
        modules: modules.map((m: any) => ModuleMapper.toDto(m, progressMap.get(m.moduleRef))),
      };
    }

    // Fallback for anonymous access
    return {
      modules: modules.map((m: any) => ModuleMapper.toDto(m)),
    };
  }

  @Get('lessons')
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({
    description: 'Список уроков',
    schema: {
      type: 'object',
      properties: {
        lessons: { type: 'array', items: { $ref: getSchemaPath(LessonItemDto) } },
      },
    },
  })
  async getLessons(@Query() query: GetLessonsDto, @Request() req: any): Promise<{ lessons: LessonItemDto[] }> {
    const { moduleRef, lang } = query;
    const userId = req.user?.userId; // Get userId from JWT token
    const language = parseLanguage(lang);
    const filter: any = { published: true };
    if (moduleRef) {
      filter.moduleRef = moduleRef;
    }
    
    const lessons = await this.lessonModel
      .find(filter, { tasks: 0 }) // exclude tasks for list view
      .sort({ moduleRef: 1, order: 1 })
      .lean();

    // Enrich with progress if userId provided
    if (userId) {
      const progressMap = new Map();
      const progress = await this.ulpModel
        .find({ userId: String(userId), ...(moduleRef ? { lessonRef: { $regex: `^${moduleRef}\\.` } } : {}) })
        .lean();
      
      for (const p of progress) {
        progressMap.set((p as any).lessonRef, {
          status: (p as any).status,
          score: (p as any).score || 0,
          attempts: (p as any).attempts || 0,
          completedAt: (p as any).completedAt,
          timeSpent: (p as any).timeSpent || 0,
        });
      }

      return {
        lessons: lessons.map((l: any) => {
          const progress = progressMap.get(l.lessonRef);
          return LessonMapper.toDto(l, language, progress ? LessonProgressMapper.toDto(progress) : undefined);
        }),
      };
    }

    return {
      lessons: lessons.map((l: any) => LessonMapper.toDto(l, language)),
    };
  }

  @Get('lessons/:lessonRef')
  @UseGuards(JwtAuthGuard, LessonPrerequisiteGuard)
  @ApiOkResponse({
    description: 'Детали урока',
    schema: {
      type: 'object',
      properties: {
        lesson: { $ref: getSchemaPath(LessonItemDto) },
      },
    },
  })
  async getLesson(@Param('lessonRef') lessonRef: string, @Query() query: GetLessonDto, @Request() req: any): Promise<{ lesson: LessonItemDto }> {
    const { lang } = query;
    const userId = req.user?.userId; // Get userId from JWT token
    const language = parseLanguage(lang);

    // 🔒 БАЗОВАЯ ВАЛИДАЦИЯ lessonRef
    if (!isValidLessonRef(lessonRef)) {
      throw new BadRequestException('Invalid lessonRef format');
    }

    const lesson = await this.lessonModel.findOne({ lessonRef, published: true }).lean();
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    let progress = null;
    if (userId) {
      progress = await this.ulpModel.findOne({ userId: String(userId), lessonRef }).lean();
    }

    return {
      lesson: LessonMapper.toDto(
        lesson as any, 
        language, 
        progress ? LessonProgressMapper.toDto(progress as any) : undefined,
        (lesson as any).tasks?.map((t: any) => t.type)
      ),
    };
  }

  /**
   * Проверяет, может ли пользователь начать урок
   * @param lessonRef - Ссылка на урок
   * @param query - Параметры запроса с userId
   * @returns Результат проверки предварительных условий
   */
  @Get('lessons/:lessonRef/check-prerequisite')
  @UseGuards(JwtAuthGuard)
  async checkLessonPrerequisite(@Param('lessonRef') lessonRef: string, @Request() req: any) {
    const userId = req.user?.userId; // Get userId from JWT token
    
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    const result = await this.contentService.canStartLesson(userId, lessonRef);
    
    return {
      canStart: result.canStart,
      reason: result.reason,
      requiredLesson: result.requiredLesson,
      lessonRef
    };
  }

  @Get('onboarding')
  @UseGuards(PublicGuard)
  onboarding(@Query('lang') lang?: string) {
    const language = parseLanguage(lang);
    const content = {
      title: {
        ru: 'Добро пожаловать в изучение английского!',
        en: 'Welcome to English Learning!'
      },
      description: {
        ru: 'Начните свой 7-дневный курс английского: словарный запас, грамматика, аудирование и разговорная практика.',
        en: 'Start your 7-day English course: vocabulary, grammar, listening, and speaking practice.'
      }
    };

    return { 
      title: getLocalizedText(content.title, language), 
      description: getLocalizedText(content.description, language) 
    };
  }

  /**
   * Get vocabulary for a specific module
   * GET /api/v2/content/modules/{moduleRef}/vocabulary
   */
  @Get('modules/:moduleRef/vocabulary')
  @UseGuards(JwtAuthGuard)
  async getModuleVocabulary(
    @Param('moduleRef') moduleRef: string,
    @Request() req?: any,
    @Query('lang') lang?: string
  ) {
    // Basic validation
    if (!/^[a-z0-9]+\.[a-z0-9_]+$/.test(moduleRef)) {
      return { error: 'Invalid moduleRef format' };
    }

    const userId = req.user?.userId;
    const result = await this.vocabularyService.getModuleVocabulary(moduleRef, userId);
    
    return {
      moduleRef,
      vocabulary: result.words,
      progress: result.progress
    };
  }

  /**
   * Get vocabulary progress statistics for a module
   * GET /api/v2/content/modules/{moduleRef}/vocabulary/progress
   */
  @Get('modules/:moduleRef/vocabulary/progress')
  @UseGuards(JwtAuthGuard)
  async getVocabularyProgress(
    @Param('moduleRef') moduleRef: string,
    @Request() req: any
  ) {
    if (!/^[a-z0-9]+\.[a-z0-9_]+$/.test(moduleRef)) {
      return { error: 'Invalid moduleRef format' };
    }

    const userId = req.user?.userId;
    if (!userId) {
      return { error: 'userId is required' };
    }

    const progress = await this.vocabularyService.getVocabularyProgressStats(moduleRef, userId);
    
    return {
      moduleRef,
      progress
    };
  }
}
