import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CourseModule, CourseModuleDocument } from '../common/schemas/course-module.schema';
import { Lesson, LessonDocument } from '../common/schemas/lesson.schema';
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
    return this.lessonModel.create({ ...body, tasks });
  }

  async listLessons(moduleRef?: string) {
    const q: any = {};
    if (moduleRef) q.moduleRef = moduleRef;
    return this.lessonModel.find(q).sort({ moduleRef: 1, order: 1 }).lean();
  }

  async updateLesson(lessonRef: string, update: UpdateLessonInput) {
    const nextUpdate = { ...update } as Partial<Lesson>;
    if (update.tasks) {
      nextUpdate.tasks = this.withValidationData(update.tasks as Lesson['tasks']);
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

  /**
   * Проверяет, может ли пользователь начать урок (предварительные условия выполнены)
   */
  async canStartLesson(userId: string, lessonRef: string): Promise<{ canStart: boolean; reason?: string; requiredLesson?: string }> {
    // Получаем текущий урок
    const currentLesson = await this.lessonModel.findOne({ lessonRef, published: true }).lean();
    if (!currentLesson) {
      return { canStart: false, reason: 'Lesson not found' };
    }

    // Если это первый урок в модуле (order = 1), разрешаем доступ
    if ((currentLesson.order || 0) === 1) {
      return { canStart: true };
    }

    // Получаем предыдущий урок
    const previousLesson = await this.lessonModel.findOne({
      moduleRef: currentLesson.moduleRef,
      order: (currentLesson.order || 0) - 1,
      published: true
    }).lean();

    if (!previousLesson) {
      // Если предыдущий урок не найден, разрешаем доступ
      return { canStart: true };
    }

    // Проверяем, завершен ли предыдущий урок
    const previousProgress = await this.progressModel.findOne({
      userId: String(userId),
      lessonRef: previousLesson.lessonRef,
      status: 'completed'
    }).lean();

    if (!previousProgress) {
      return { 
        canStart: false, 
        reason: `Previous lesson ${previousLesson.lessonRef} must be completed before starting ${lessonRef}`,
        requiredLesson: previousLesson.lessonRef
      };
    }

    return { canStart: true };
  }
}
