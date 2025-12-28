import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CourseModule, CourseModuleDocument } from '../common/schemas/course-module.schema';
import { Lesson, LessonDocument } from '../common/schemas/lesson.schema';
import { User, UserDocument } from '../common/schemas/user.schema';
import { UserLessonProgress, UserLessonProgressDocument } from '../common/schemas/user-lesson-progress.schema';
import { MultilingualText, OptionalMultilingualText } from '../common/utils/i18n.util';
import { mapTaskDataToValidationData } from '../common/utils/task-validation-data';
import { TaskValidationData } from '../common/types/validation-data';
import { CreateLessonDto, UpdateLessonDto } from './dto/lesson.dto';

type CreateLessonInput = Omit<CreateLessonDto, 'title' | 'description'> & {
  title: MultilingualText;
  description?: OptionalMultilingualText;
};

type UpdateLessonInput = Omit<UpdateLessonDto, 'title' | 'description'> & {
  title?: MultilingualText;
  description?: OptionalMultilingualText;
};

@Injectable()
export class ContentService {
  constructor(
    @InjectModel(CourseModule.name) private readonly moduleModel: Model<CourseModuleDocument>,
    @InjectModel(Lesson.name) private readonly lessonModel: Model<LessonDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(UserLessonProgress.name) private readonly progressModel: Model<UserLessonProgressDocument>,
  ) {}

  // Modules
  async createModule(body: { moduleRef: string; level: CourseModule['level']; title: MultilingualText; description?: OptionalMultilingualText; tags?: string[]; order?: number; published?: boolean; author?: CourseModule['author'] }) {
    return this.moduleModel.create(body);
  }

  async listModules(level?: CourseModule['level']) {
    const q: any = {};
    if (level) q.level = level;
    return this.moduleModel.find(q).sort({ level: 1, order: 1 }).lean();
  }

  async updateModule(moduleRef: string, update: Partial<CourseModule>) {
    const { author, ...safeUpdate } = update;
    await this.moduleModel.updateOne({ moduleRef }, { $set: safeUpdate });
    return { ok: true };
  }

  // Lessons
  async createLesson(body: CreateLessonInput) {
    const tasks = this.withValidationData(body.tasks);
    const taskTypes = this.extractTaskTypes(tasks) ?? body.taskTypes;
    return this.lessonModel.create({ ...body, tasks, taskTypes });
  }

  async listLessons(moduleRef?: string) {
    const q: any = {};
    if (moduleRef) q.moduleRef = moduleRef;
    return this.lessonModel.find(q).sort({ moduleRef: 1, order: 1 }).lean();
  }

  async getLessonByRef(lessonRef: string) {
    return this.lessonModel.findOne({ lessonRef }).lean();
  }

  async updateLesson(lessonRef: string, update: UpdateLessonInput) {
    const nextUpdate = { ...update } as Partial<Lesson>;
    if (update.tasks) {
      nextUpdate.tasks = this.withValidationData(update.tasks as Lesson['tasks']);
      nextUpdate.taskTypes = this.extractTaskTypes(nextUpdate.tasks);
    } else if (update.taskTypes) {
      nextUpdate.taskTypes = update.taskTypes;
    }
    await this.lessonModel.updateOne({ lessonRef }, { $set: nextUpdate });
    return { ok: true };
  }

  private withValidationData(tasks?: Array<{ ref: string; type: string; data: Record<string, any>; validationData?: TaskValidationData }>) {
    if (!tasks) return tasks;
    return tasks.map(task => ({
      ...task,
      validationData: mapTaskDataToValidationData({ type: task.type as any, data: task.data }) ?? task.validationData,
    }));
  }

  private extractTaskTypes(tasks?: Lesson['tasks']) {
    if (!tasks?.length) return undefined;
    const types = tasks.map(task => task.type).filter(Boolean);
    return Array.from(new Set(types));
  }

  /**
   * Проверяет, может ли пользователь начать урок (предварительные условия выполнены)
   * 
   * Логика доступа:
   * - PRO пользователи имеют доступ ко всем опубликованным урокам
   * - Обычные пользователи:
   *   - Доступ ограничен по freeUntilOrder модуля
   *   - Урок может явно требовать PRO (requiresPro)
   *   - Должны проходить уроки строго по порядку
   * - Урок с order < 1 считается некорректным и недоступен для обычных пользователей
   * - Если предыдущий урок отсутствует (разрыв в последовательности), доступ запрещен
   */
  async canStartLesson(userId: string, lessonRef: string): Promise<{ canStart: boolean; reason?: string; requiredLesson?: string }> {
    // 1) Получаем текущий урок
    const currentLesson = await this.lessonModel.findOne({ lessonRef, published: true }).lean();
    if (!currentLesson) {
      return { canStart: false, reason: 'Lesson not found' };
    }

    // 2) Проверяем PRO-статус пользователя
    const user = await this.userModel.findOne({ userId: String(userId) }).lean();
    const hasProAccess = user?.pro?.active === true;
    
    if (hasProAccess) {
      // PRO пользователи имеют доступ ко всем опубликованным урокам
      return { canStart: true };
    }

    // 3) Для обычных пользователей - проверка доступности
    const order = currentLesson.order || 0;
    
    // Если order некорректен (< 1), запрещаем доступ
    if (order < 1) {
      return { 
        canStart: false, 
        reason: 'Lesson has invalid order. Please contact support.' 
      };
    }

    // 4) Проверяем требования PRO подписки
    // 4.1) Явное требование PRO на уровне урока
    if (currentLesson.requiresPro === true) {
      return {
        canStart: false,
        reason: 'This lesson requires PRO subscription'
      };
    }

    // 4.2) Проверяем лимит бесплатных уроков модуля
    const module = await this.moduleModel.findOne({ moduleRef: currentLesson.moduleRef }).lean();
    if (module?.freeUntilOrder !== undefined && module.freeUntilOrder !== null) {
      if (order > module.freeUntilOrder) {
        return {
          canStart: false,
          reason: `This lesson requires PRO subscription. Free lessons available up to lesson ${module.freeUntilOrder}`
        };
      }
    }

    // 5) Проверяем последовательность уроков
    // Если это первый урок в модуле, разрешаем доступ
    if (order === 1) {
      return { canStart: true };
    }

    // 6) Проверяем предыдущий урок
    const previousLesson = await this.lessonModel.findOne({
      moduleRef: currentLesson.moduleRef,
      order: order - 1,
      published: true
    }).lean();

    // Если предыдущий урок не найден, это ошибка контента - запрещаем доступ
    if (!previousLesson) {
      return { 
        canStart: false, 
        reason: `Previous lesson (order ${order - 1}) not found. Content structure is broken.`
      };
    }

    // 7) Проверяем завершение предыдущего урока
    const previousProgress = await this.progressModel.findOne({
      userId: String(userId),
      lessonRef: previousLesson.lessonRef,
      status: 'completed'
    }).lean();

    if (!previousProgress) {
      return { 
        canStart: false, 
        reason: `Previous lesson must be completed before starting this lesson`,
        requiredLesson: previousLesson.lessonRef
      };
    }

    return { canStart: true };
  }
}
