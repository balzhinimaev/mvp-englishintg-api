import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsService } from './notifications.service';
import { User, UserSchema } from '../common/schemas/user.schema';
import { Lead, LeadSchema } from '../common/schemas/lead.schema';
import { Entitlement, EntitlementSchema } from '../common/schemas/entitlement.schema';
import {
  UserLessonProgress,
  UserLessonProgressSchema,
} from '../common/schemas/user-lesson-progress.schema';
import {
  NotificationLog,
  NotificationLogSchema,
} from '../common/schemas/notification-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: UserLessonProgress.name, schema: UserLessonProgressSchema },
      { name: NotificationLog.name, schema: NotificationLogSchema },
      { name: Entitlement.name, schema: EntitlementSchema },
    ]),
  ],
  providers: [NotificationsService],
})
export class NotificationsModule {}
