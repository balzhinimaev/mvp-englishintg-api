import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContentController } from './content.controller';
import { ContentV2Controller } from './content-v2.controller';
import { VocabularyController } from './vocabulary.controller';
import { AuthModule } from '../auth/auth.module';
import { User, UserSchema } from '../common/schemas/user.schema';
import { CourseModule, CourseModuleSchema } from '../common/schemas/course-module.schema';
import { Lesson, LessonSchema } from '../common/schemas/lesson.schema';
import { UserLessonProgress, UserLessonProgressSchema } from '../common/schemas/user-lesson-progress.schema';
import { VocabularyItem, VocabularySchema } from '../common/schemas/vocabulary.schema';
import { UserVocabularyProgress, UserVocabularyProgressSchema } from '../common/schemas/user-vocabulary-progress.schema';
import { ContentService } from './content.service';
import { VocabularyService } from './vocabulary.service';
import { AdminContentController } from './admin-content.controller';
import { OptionalUserGuard } from '../common/guards/optional-user.guard';
import { PublicGuard } from '../common/guards/public.guard';
import { LessonPrerequisiteGuard } from './guards/lesson-prerequisite.guard';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: CourseModule.name, schema: CourseModuleSchema },
      { name: Lesson.name, schema: LessonSchema },
      { name: UserLessonProgress.name, schema: UserLessonProgressSchema },
      { name: VocabularyItem.name, schema: VocabularySchema },
      { name: UserVocabularyProgress.name, schema: UserVocabularyProgressSchema },
    ]),
  ],
  controllers: [ContentController, ContentV2Controller, AdminContentController, VocabularyController],
  providers: [ContentService, VocabularyService, OptionalUserGuard, PublicGuard, LessonPrerequisiteGuard],
  exports: [ContentService, VocabularyService],
})
export class ContentModule {}

