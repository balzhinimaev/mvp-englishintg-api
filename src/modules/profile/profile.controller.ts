import { Body, Controller, Get, Patch, Post, UseGuards, Request } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../common/schemas/user.schema';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { SaveLearningGoalsDto } from './dto/learning-goals.dto';
import { SaveDailyGoalDto } from './dto/daily-goal.dto';
import { SaveReminderSettingsDto } from './dto/reminder-settings.dto';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  @Get()
  async get(@Request() req: any) {
    const userId = req.user?.userId; // Get userId from JWT token
    const user = await this.userModel.findOne({ userId: String(userId) }).lean();
    return { user };
  }

  @Patch()
  async update(@Body() body: UpdateProfileDto, @Request() req: any) {
    const userId = req.user?.userId; // Get userId from JWT token
    // Whitelist задан DTO (глобальный ValidationPipe с whitelist+forbidNonWhitelisted):
    // mass assignment (isAdmin, pro, xpTotal...) исключён.
    const set: Record<string, any> = {};
    const allowed = ['firstName', 'lastName', 'username', 'languageCode', 'photoUrl'] as const;
    for (const key of allowed) {
      const value = (body as Record<string, unknown>)[key];
      if (typeof value === 'string') set[key] = value;
    }
    if (Object.keys(set).length === 0) {
      return { ok: true, updated: false };
    }
    await this.userModel.updateOne({ userId }, { $set: set }, { upsert: true });
    return { ok: true };
  }

  // Фронт шлёт PATCH (useCompleteOnboarding → apiClient.patch) — метод должен совпадать.
  @Patch('onboarding/complete')
  async completeOnboarding(@Body() body: CompleteOnboardingDto, @Request() req: any) {
    const userId = req.user?.userId; // Get userId from JWT token (body.userId игнорируем)
    const { englishLevel, proficiencyLevel, learningGoals } = body;

    // Prepare $set object idempotently
    const set: Record<string, any> = {
      onboardingCompletedAt: new Date(),
    };
    if (englishLevel) set.englishLevel = englishLevel;
    if (proficiencyLevel) set.proficiencyLevel = proficiencyLevel;
    if (learningGoals) set.learningGoals = learningGoals;
    await this.userModel.updateOne(
      { userId },
      { $set: set },
      { upsert: true },
    );
    return { ok: true };
  }

  @Post('learning-goals')
  async saveLearningGoals(@Body() body: SaveLearningGoalsDto, @Request() req: any) {
    const userId = req.user?.userId; // Get userId from JWT token (body.userId игнорируем)
    await this.userModel.updateOne(
      { userId },
      { $set: { learningGoals: body.goals } },
      { upsert: true },
    );
    return { ok: true };
  }

  @Post('daily-goal')
  async saveDailyGoal(@Body() body: SaveDailyGoalDto, @Request() req: any) {
    const userId = req.user?.userId; // Get userId from JWT token (body.userId игнорируем)
    const set: Record<string, any> = { dailyGoalMinutes: body.dailyGoalMinutes };
    // Принимаем оба имени поля (фронт шлёт notificationsAllowed, старый контракт — allowsNotifications)
    const notifications = body.allowsNotifications ?? body.notificationsAllowed;
    if (typeof notifications === 'boolean') {
      set.notificationsAllowed = notifications;
    }
    await this.userModel.updateOne(
      { userId },
      { $set: set },
      { upsert: true },
    );
    return { ok: true };
  }

  @Post('reminder-settings')
  async saveReminderSettings(@Body() body: SaveReminderSettingsDto, @Request() req: any) {
    const userId = req.user?.userId; // Get userId from JWT token (body.userId игнорируем)
    const { enabled, time, allowsNotifications } = body.reminderSettings;

    const set: Record<string, any> = {
      reminderSettings: { enabled, time },
    };
    // Принимаем оба варианта: вложенный allowsNotifications и top-level notificationsAllowed (фронт)
    const notifications = allowsNotifications ?? body.notificationsAllowed;
    if (typeof notifications === 'boolean') {
      set.notificationsAllowed = notifications;
    }
    await this.userModel.updateOne(
      { userId },
      { $set: set },
      { upsert: true },
    );
    return { ok: true };
  }
}
