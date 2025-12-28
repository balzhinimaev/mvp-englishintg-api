import { Injectable, CanActivate, ExecutionContext, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ContentService } from '../content.service';

@Injectable()
export class LessonPrerequisiteGuard implements CanActivate {
  constructor(private readonly contentService: ContentService) {}

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

    const result = await this.contentService.canStartLesson(String(userId), lessonRef);

    if (result.canStart) {
      return true;
    }

    if (result.reason === 'Lesson not found') {
      throw new BadRequestException('Lesson not found');
    }

    if (result.requiredLesson) {
      throw new ForbiddenException({
        error: 'PREREQ_NOT_MET',
        message: result.reason,
        requiredLesson: result.requiredLesson,
        currentLesson: lessonRef
      });
    }

    throw new ForbiddenException({
      error: 'PREREQ_NOT_MET',
      message: result.reason || `Previous lesson must be completed before starting ${lessonRef}`,
      currentLesson: lessonRef
    });
  }
}
