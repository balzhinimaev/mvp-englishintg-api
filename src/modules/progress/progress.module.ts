import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProgressService } from './progress.service';
import { ProgressController } from './progress.controller';
import { AnswerValidatorService } from './answer-validator.service';
import { User, UserSchema } from '../common/schemas/user.schema';
import { UserLessonProgress, UserLessonProgressSchema } from '../common/schemas/user-lesson-progress.schema';
import { UserTaskAttempt, UserTaskAttemptSchema } from '../common/schemas/user-task-attempt.schema';
import { XpTransaction, XpTransactionSchema } from '../common/schemas/xp-transaction.schema';
import { DailyStat, DailyStatSchema } from '../common/schemas/daily-stat.schema';
import { LearningSession, LearningSessionSchema } from '../common/schemas/learning-session.schema';
import { Achievement, AchievementSchema } from '../common/schemas/achievement.schema';
import { Lesson, LessonSchema } from '../common/schemas/lesson.schema';
import { AuthModule } from '../auth/auth.module';
import { SessionCleanupService } from './session-cleanup.service';
import { ContentModule } from '../content/content.module';

@Module({
  imports: [
    AuthModule,
    ContentModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserLessonProgress.name, schema: UserLessonProgressSchema },
      { name: UserTaskAttempt.name, schema: UserTaskAttemptSchema },
      { name: XpTransaction.name, schema: XpTransactionSchema },
      { name: DailyStat.name, schema: DailyStatSchema },
      { name: LearningSession.name, schema: LearningSessionSchema },
      { name: Achievement.name, schema: AchievementSchema },
      { name: Lesson.name, schema: LessonSchema },
    ]),
  ],
  controllers: [ProgressController],
  providers: [ProgressService, AnswerValidatorService, SessionCleanupService],
  exports: [ProgressService],
})
export class ProgressModule {}

