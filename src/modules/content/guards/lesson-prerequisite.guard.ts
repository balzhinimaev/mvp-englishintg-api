import { Injectable, CanActivate, ExecutionContext, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Lesson, LessonDocument } from '../../common/schemas/lesson.schema';
import { UserLessonProgress, UserLessonProgressDocument } from '../../common/schemas/user-lesson-progress.schema';

@Injectable()
export class LessonPrerequisiteGuard implements CanActivate {
  constructor(
    @InjectModel(Lesson.name) private readonly lessonModel: Model<LessonDocument>,
    @InjectModel(UserLessonProgress.name) private readonly progressModel: Model<UserLessonProgressDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const lessonRef = request.params?.lessonRef;
    const userId =
      request.user?.userId ||
      request.query?.userId ||
      request.body?.userId ||
      request.params?.userId;

    if (!lessonRef) {
      throw new BadRequestException('lessonRef is required');
    }

    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    // Получаем текущий урок
    const currentLesson = await this.lessonModel.findOne({ lessonRef, published: true }).lean();
    if (!currentLesson) {
      throw new BadRequestException('Lesson not found');
    }

    // Если это первый урок в модуле (order = 1), разрешаем доступ
    if ((currentLesson.order || 0) === 1) {
      return true;
    }

    // Получаем предыдущий урок
    const previousLesson = await this.lessonModel.findOne({
      moduleRef: currentLesson.moduleRef,
      order: (currentLesson.order || 0) - 1,
      published: true
    }).lean();

    if (!previousLesson) {
      // Если предыдущий урок не найден, разрешаем доступ (возможно, это первый урок)
      return true;
    }

    // Проверяем, завершен ли предыдущий урок
    const previousProgress = await this.progressModel.findOne({
      userId: String(userId),
      lessonRef: previousLesson.lessonRef,
      status: 'completed'
    }).lean();

    if (!previousProgress) {
      throw new ForbiddenException({
        error: 'PREREQ_NOT_MET',
        message: `Previous lesson ${previousLesson.lessonRef} must be completed before starting ${lessonRef}`,
        requiredLesson: previousLesson.lessonRef,
        currentLesson: lessonRef
      });
    }

    return true;
  }
}
