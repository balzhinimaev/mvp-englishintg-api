// src/content/content-v2.controller.ts
import { Controller, Get, Param, Query, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CourseModule, CourseModuleDocument } from '../common/schemas/course-module.schema';
import { Lesson, LessonDocument } from '../common/schemas/lesson.schema';
import { UserLessonProgress, UserLessonProgressDocument } from '../common/schemas/user-lesson-progress.schema';
import { User, UserDocument } from '../common/schemas/user.schema';
import { TaskType } from '../common/types/content';
import { redact } from '../common/utils/mappers';
import { presentLesson, presentModule } from './presenter';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetModulesDto } from './dto/get-content.dto';

@Controller('content/v2')
@UseGuards(JwtAuthGuard)
export class ContentV2Controller {
  constructor(
    @InjectModel(CourseModule.name) private moduleModel: Model<CourseModuleDocument>,
    @InjectModel(Lesson.name) private lessonModel: Model<LessonDocument>,
    @InjectModel(UserLessonProgress.name) private progressModel: Model<UserLessonProgressDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  @Get('modules')
  async getModules(@Query() query: GetModulesDto, @Request() req: any) {
    const userId = req.user?.userId; // Get userId from JWT token
    if (!userId) {
      return { error: 'userId is required' };
    }

    const { level, page = 1, limit = 20 } = query;
    
    // Валидация level
    if (level && !['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(level)) {
      return { error: 'Invalid level' };
    }

    // Построение фильтра
    const filter: any = { published: true };
    if (level) {
      filter.level = level;
    }

    // Подсчет общего количества для пагинации
    const total = await this.moduleModel.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    // Получение модулей с пагинацией
    const modules = await this.moduleModel
      .find(filter)
      .sort({ level: 1, order: 1 })
      .skip(skip)
      .limit(limit)
      .lean();
    // для каждого модуля посчитаем прогресс пользователя
    const lessonCounts = await this.lessonModel.aggregate([
      { $match: { published: true } },
      { $group: { _id: '$moduleRef', total: { $sum: 1 } } },
    ]);

    const countsMap = new Map(lessonCounts.map((x: any) => [x._id, x.total]));
    
    // Получаем информацию о пользователе для проверки PRO подписки
    const user = await this.userModel.findOne({ userId: String(userId) }).lean();
    const hasProAccess = user?.pro?.active === true;

    // Получаем прогресс пользователя по модулям
    const byModule = await this.progressModel.aggregate([
      { $match: { userId: String(userId) } },
      { $group: {
        _id: '$moduleRef',
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
      } },
    ]);
    const progresses = new Map(byModule.map((x: any) => [x._id, { completed: x.completed, inProgress: x.inProgress }]));

    const presentedModules = modules.map(m => {
      const total = countsMap.get(m.moduleRef) || 0;
      const pr = progresses.get(m.moduleRef) || { completed: 0, inProgress: 0 };
      
      // Вычисляем requiresPro: первый модуль каждого уровня бесплатный, остальные требуют PRO
      const order = m.order || 0;
      const requiresPro = m.requiresPro ?? (order > 1);
      
      // Вычисляем isAvailable на основе requiresPro и прав доступа
      const isAvailable = m.isAvailable ?? (!requiresPro || hasProAccess);
      
      // Создаем объект модуля с правильными значениями
      const moduleData = {
        ...m,
        requiresPro,
        isAvailable,
      };
      
      return presentModule(moduleData as any, { completed: pr.completed, inProgress: pr.inProgress, total });
    });

    return {
      modules: presentedModules,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  @Get('modules/:moduleRef/lessons')
  async getLessons(@Param('moduleRef') moduleRef: string, @Query('lang') lang = 'ru', @Request() req: any) {
    const userId = req.user?.userId; // Get userId from JWT token
    if (!userId) {
      return { error: 'userId is required' };
    }

    const lessons = await this.lessonModel.find({ moduleRef, published: true }).sort({ order: 1 }).lean();
    const progresses = await this.progressModel.find({ userId: String(userId), moduleRef }).lean();

    const progressMap = new Map(progresses.map((p: any) => [p.lessonRef, p]));
    return lessons.map(l => presentLesson(l as any, lang, progressMap.get(l.lessonRef)));
  }

  @Get('lessons/:lessonRef')
  async getLesson(@Param('lessonRef') lessonRef: string, @Query('lang') lang = 'ru', @Request() req: any) {
    const userId = req.user?.userId; // Get userId from JWT token
    if (!userId) {
      return { error: 'userId is required' };
    }

    const l = await this.lessonModel.findOne({ lessonRef, published: true }).lean();
    if (!l) {
      throw new NotFoundException('Lesson not found');
    }
    const p = await this.progressModel.findOne({ userId: String(userId), lessonRef }).lean();
    // detailed: вернём ещё tasks
    const presented = presentLesson(l as any, lang, p as any);
    (presented as any).tasks = (l.tasks || []).map(({ ref, type, data }) => ({
      ref,
      type: type as TaskType,
      data: redact(data),
    }));
    return presented;
  }
}
