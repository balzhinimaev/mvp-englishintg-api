import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards, Request } from '@nestjs/common';
import { ContentService } from './content.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CreateModuleDto, UpdateModuleDto } from './dto/module.dto';
import { CreateLessonDto, UpdateLessonDto } from './dto/lesson.dto';
import { lintLessonTasks } from './utils/task-lint';

@Controller('admin/content')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminContentController {
  constructor(private readonly content: ContentService) {}

  // Modules
  @Post('modules')
  async createModule(@Body() body: CreateModuleDto, @Request() req: any) {
    const user = req.user?.user;
    const userId = req.user?.userId; // Get userId from JWT token
    const nameParts = [user?.firstName, user?.lastName].filter(Boolean);
    const authorName = nameParts.length ? nameParts.join(' ') : user?.username;
    const author = userId ? { userId, name: authorName } : undefined;
    const doc = await this.content.createModule({ ...(body as any), author });
    return { id: (doc as any)._id };
  }

  @Get('modules')
  async listModules(@Query('level') level?: 'A0' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2') {
    const items = await this.content.listModules(level);
    return { items };
  }

  @Patch('modules/:moduleRef')
  async updateModule(@Param('moduleRef') moduleRef: string, @Body() body: UpdateModuleDto, @Request() req: any) {
    const userId = req.user?.userId; // Get userId from JWT token
    return this.content.updateModule(moduleRef, body as any);
  }

  // Lessons
  @Post('lessons')
  async createLesson(@Body() body: CreateLessonDto) {
    const errors = lintLessonTasks(body.lessonRef, body.tasks, body.moduleRef);
    if (errors.length) {
      throw new BadRequestException({ message: 'Lesson tasks validation failed', errors });
    }
    const doc = await this.content.createLesson(body);
    return { id: (doc as any)._id };
  }

  @Get('lessons')
  async listLessons(@Query('moduleRef') moduleRef?: string) {
    const items = await this.content.listLessons(moduleRef);
    return { items };
  }

  @Patch('lessons/:lessonRef')
  async updateLesson(@Param('lessonRef') lessonRef: string, @Body() body: UpdateLessonDto) {
    const errors = lintLessonTasks(lessonRef, body.tasks, body.moduleRef);
    if (errors.length) {
      throw new BadRequestException({ message: 'Lesson tasks validation failed', errors });
    }
    return this.content.updateLesson(lessonRef, body);
  }
}
