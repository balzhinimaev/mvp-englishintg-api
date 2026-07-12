import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../common/schemas/user.schema';
import { Lead, LeadDocument } from '../common/schemas/lead.schema';
import {
  UserLessonProgress,
  UserLessonProgressDocument,
} from '../common/schemas/user-lesson-progress.schema';
import {
  NotificationLog,
  NotificationLogDocument,
  NotificationType,
} from '../common/schemas/notification-log.schema';
import { Entitlement, EntitlementDocument } from '../common/schemas/entitlement.schema';

const TZ = 'Europe/Moscow';
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000; // МСК = UTC+3, без переходов
const BATCH_SIZE = 20; // rate limiter бота — 60/мин; шлём батчами по 20 с паузой 1с
const BATCH_PAUSE_MS = 1000;

interface PushPayload {
  userId: string;
  text: string;
  buttonText?: string;
  deepLink?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly botApiUrl = process.env.BOT_API_URL;
  private readonly botApiKey = process.env.BOT_API_KEY;
  private readonly enabled: boolean;

  constructor(
    config: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
    @InjectModel(UserLessonProgress.name)
    private readonly ulpModel: Model<UserLessonProgressDocument>,
    @InjectModel(NotificationLog.name)
    private readonly logModel: Model<NotificationLogDocument>,
    @InjectModel(Entitlement.name)
    private readonly entitlementModel: Model<EntitlementDocument>,
  ) {
    const flag = process.env.NOTIFICATIONS_ENABLED;
    const isProd = (config.get<string>('app.nodeEnv') || 'development') === 'production';
    // Явный флаг побеждает; иначе — включено только в проде
    this.enabled = flag === 'true' ? true : flag === 'false' ? false : isProd;
    this.logger.log(`Notifications ${this.enabled ? 'ENABLED' : 'disabled'}`);
  }

  // ---------- Cron-джобы ----------

  @Cron('0 9 * * *', { timeZone: TZ })
  async dailyReminderMorning() {
    await this.runDailyReminder('morning');
  }

  @Cron('0 14 * * *', { timeZone: TZ })
  async dailyReminderAfternoon() {
    await this.runDailyReminder('afternoon');
  }

  @Cron('0 19 * * *', { timeZone: TZ })
  async dailyReminderEvening() {
    await this.runDailyReminder('evening');
  }

  @Cron('0 * * * *', { timeZone: TZ })
  async hourlyJobs() {
    await this.runLeadFollowups();
    await this.runOnboardingNudges();
  }

  @Cron('0 12 * * *', { timeZone: TZ })
  async subscriptionLifecycle() {
    await this.runSubscriptionExpiring().catch((e) => this.logger.error('subscription_expiring failed', e));
    await this.runSubscriptionExpired().catch((e) => this.logger.error('subscription_expired failed', e));
  }

  @Cron('0 20 * * *', { timeZone: TZ })
  async streakAtRisk() {
    await this.runStreakAtRisk();
  }

  // ---------- Логика джоб ----------

  /** Ежедневное напоминание тем, кто выбрал этот слот и сегодня ещё не занимался. */
  private async runDailyReminder(bucket: 'morning' | 'afternoon' | 'evening') {
    if (!this.enabled) return;
    const dayKey = this.mskDayKey(new Date());
    const dayStart = this.mskDayStart(new Date());

    const users = await this.userModel
      .find({
        'reminderSettings.enabled': true,
        'reminderSettings.time': bucket,
        userId: { $not: /^em_/ }, // email-аккаунтам пуш в Telegram не отправить
      })
      .select('userId')
      .lean();
    if (!users.length) return;

    const userIds = users.map((u) => u.userId);

    // Кто уже занимался сегодня (МСК) — исключаем
    const activeToday = await this.ulpModel
      .find({ userId: { $in: userIds }, updatedAt: { $gte: dayStart } })
      .distinct('userId');
    const activeSet = new Set(activeToday.map(String));

    // Последний урок «в процессе» → deep link на продолжение
    const inProgress = await this.ulpModel
      .find({ userId: { $in: userIds }, status: 'in_progress' })
      .select('userId lessonRef updatedAt')
      .sort({ updatedAt: -1 })
      .lean();
    const resumeByUser = new Map<string, string>();
    for (const p of inProgress) {
      if (!resumeByUser.has(p.userId)) resumeByUser.set(p.userId, (p as any).lessonRef);
    }

    const targets: PushPayload[] = [];
    for (const u of users) {
      if (activeSet.has(String(u.userId))) continue;
      const resumeRef = resumeByUser.get(u.userId);
      targets.push({
        userId: u.userId,
        text: resumeRef
          ? '📚 <b>Пора на английский!</b>\nВы не закончили урок — продолжим с того места, где остановились?'
          : '📚 <b>Пора на английский!</b>\nВсего 5 минут в день — и прогресс не остановится. Откроем следующий урок?',
        buttonText: resumeRef ? '▶️ Продолжить урок' : '▶️ Начать урок',
        deepLink: resumeRef ? this.lessonDeepLink(resumeRef) : undefined,
      });
    }

    await this.dispatch('daily_reminder', dayKey, targets);
  }

  /** Лиды 24–48ч назад, которые сделали /start, но не открыли Mini App. */
  private async runLeadFollowups() {
    if (!this.enabled) return;
    const dayKey = this.mskDayKey(new Date());
    const now = Date.now();
    const from = new Date(now - 48 * 3600 * 1000);
    const to = new Date(now - 24 * 3600 * 1000);

    const leads = await this.leadModel
      .find({ createdAt: { $gte: from, $lte: to }, userId: { $not: /^em_/ } })
      .select('userId')
      .lean();
    if (!leads.length) return;

    const leadIds = leads.map((l) => l.userId);
    // Кто уже завёл аккаунт (открыл аппку) — исключаем
    const existingUsers = await this.userModel
      .find({ userId: { $in: leadIds } })
      .distinct('userId');
    const hasAccount = new Set(existingUsers.map(String));

    const targets: PushPayload[] = leads
      .filter((l) => !hasAccount.has(String(l.userId)))
      .map((l) => ({
        userId: l.userId,
        text: '👋 <b>Первый урок ждёт вас!</b>\nЭто всего 5 минут — простые слова и фразы, которые пригодятся сразу. Попробуем?',
        buttonText: '🚀 Открыть приложение',
      }));

    await this.dispatch('lead_followup', dayKey, targets);
  }

  /** Юзеры 24–48ч назад с незавершённым онбордингом. */
  private async runOnboardingNudges() {
    if (!this.enabled) return;
    const dayKey = this.mskDayKey(new Date());
    const now = Date.now();
    const from = new Date(now - 48 * 3600 * 1000);
    const to = new Date(now - 24 * 3600 * 1000);

    const users = await this.userModel
      .find({
        createdAt: { $gte: from, $lte: to },
        onboardingCompletedAt: { $in: [null, undefined] },
        userId: { $not: /^em_/ },
      })
      .select('userId')
      .lean();
    if (!users.length) return;

    const targets: PushPayload[] = users.map((u) => ({
      userId: u.userId,
      text: '⚙️ <b>Остался один шаг</b>\nЗакончите настройку — и мы подберём уроки под ваш уровень и цели.',
      buttonText: '✅ Завершить настройку',
    }));

    await this.dispatch('onboarding_nudge', dayKey, targets);
  }

  /** В 20:00 МСК: у кого был стрик вчера, но сегодня ещё не занимался. */
  private async runStreakAtRisk() {
    if (!this.enabled) return;
    const now = new Date();
    const dayKey = this.mskDayKey(now);
    const yKey = this.mskDayKey(new Date(now.getTime() - 24 * 3600 * 1000));

    const users = await this.userModel
      .find({
        'streak.current': { $gt: 0 },
        'streak.lastActiveDayKey': yKey, // активны вчера, сегодня ещё нет
        userId: { $not: /^em_/ },
      })
      .select('userId streak')
      .lean();
    if (!users.length) return;

    const targets: PushPayload[] = users.map((u) => {
      const days = (u as any).streak?.current || 0;
      return {
        userId: u.userId,
        text: `🔥 <b>Ваша серия — ${days} ${this.plural(days, ['день', 'дня', 'дней'])}!</b>\nНе прерывайте её: короткий урок сегодня сохранит прогресс.`,
        buttonText: '🔥 Сохранить серию',
      };
    });

    await this.dispatch('streak_at_risk', dayKey, targets);
  }

  // ---------- Отправка ----------

  /**
   * Дедуп + батчированная отправка. Запись в лог вставляется ПЕРЕД отправкой
   * (at-most-once): дубликат по unique-индексу = уже слали, пропускаем.
   */
  private async dispatch(type: NotificationType, dayKey: string, targets: PushPayload[]) {
    if (!targets.length) return;
    if (!this.botApiUrl || !this.botApiKey) {
      this.logger.warn(`Skip ${type}: BOT_API_URL/KEY not configured`);
      return;
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (t) => {
          // Резервируем слот дедупа до отправки
          try {
            await this.logModel.create({ userId: t.userId, type, dateKey: dayKey });
          } catch (e: any) {
            if (e?.code === 11000) {
              skipped++;
              return;
            }
            failed++;
            return;
          }

          const delivered = await this.sendPush(t);
          if (delivered) sent++;
          else failed++;
          await this.logModel
            .updateOne({ userId: t.userId, type, dateKey: dayKey }, { delivered })
            .catch(() => {});
        }),
      );
      if (i + BATCH_SIZE < targets.length) {
        await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
      }
    }

    this.logger.log(`[${type}] sent=${sent} skipped=${skipped} failed=${failed} total=${targets.length}`);
  }

  private async sendPush(payload: PushPayload): Promise<boolean> {
    try {
      const resp = await fetch(`${this.botApiUrl}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.botApiKey}`,
        },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) return false;
      const data = (await resp.json()) as { delivered?: boolean };
      return Boolean(data?.delivered);
    } catch (e: any) {
      this.logger.warn(`Push HTTP failed for ${payload.userId}: ${e?.message}`);
      return false;
    }
  }

  /** Подписка истекает в ближайшие 3 дня → напомнить продлить (once per endsAt-день). */
  private async runSubscriptionExpiring() {
    if (!this.enabled) return;
    const now = new Date();
    // окно ровно одного дня (2–3 дня до конца) → одно напоминание на одно истечение
    const in2d = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const in3d = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const expiring = await this.entitlementModel
      .find({ endsAt: { $gt: in2d, $lte: in3d }, userId: { $not: /^em_/ } })
      .lean();
    if (!expiring.length) return;

    const targets: PushPayload[] = [];
    const seen = new Set<string>();
    for (const e of expiring) {
      if (seen.has(e.userId)) continue;
      seen.add(e.userId);
      targets.push({
        userId: e.userId,
        text: '⏳ <b>Подписка заканчивается через 3 дня.</b>\nПродли сейчас — и уроки, словарь и повторение останутся с тобой без перерыва.',
        buttonText: '🔓 Продлить подписку',
        deepLink: 'paywall',
      });
    }
    // dayKey от endsAt-дня: одно напоминание на одно истечение
    await this.dispatch('subscription_expiring', this.mskDayKey(now), targets);
  }

  /** Подписка истекла за последние 2 дня и активной нет → winback со скидкой. */
  private async runSubscriptionExpired() {
    if (!this.enabled) return;
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const lapsed = await this.entitlementModel
      .find({ endsAt: { $gt: twoDaysAgo, $lte: now }, userId: { $not: /^em_/ } })
      .lean();
    if (!lapsed.length) return;

    // исключаем тех, у кого есть другая активная подписка
    const userIds = Array.from(new Set(lapsed.map((e) => e.userId)));
    const stillActive = await this.entitlementModel
      .find({ userId: { $in: userIds }, endsAt: { $gt: now } })
      .distinct('userId');
    const activeSet = new Set(stillActive.map(String));

    const targets: PushPayload[] = userIds
      .filter((u) => !activeSet.has(String(u)))
      .map((u) => ({
        userId: u,
        text: '💤 <b>Подписка закончилась.</b>\nПрогресс и серия на месте. Вернись сейчас — для тебя действует персональная скидка на продление.',
        buttonText: '🎁 Вернуться со скидкой',
        deepLink: 'paywall',
      }));

    await this.dispatch('subscription_expired', this.mskDayKey(now), targets);
  }

  // ---------- Утилиты ----------

  /** deep link на урок в формате фронта (buildStartParam): lesson__<ref с точками→'_'>. */
  private lessonDeepLink(lessonRef: string): string {
    return `lesson__${lessonRef.replace(/\./g, '_')}`;
  }

  /** YYYY-MM-DD в МСК. */
  private mskDayKey(date: Date): string {
    return new Date(date.getTime() + MSK_OFFSET_MS).toISOString().slice(0, 10);
  }

  /** UTC-момент начала текущих МСК-суток. */
  private mskDayStart(date: Date): Date {
    const shifted = date.getTime() + MSK_OFFSET_MS;
    const midnight = Math.floor(shifted / 86400000) * 86400000;
    return new Date(midnight - MSK_OFFSET_MS);
  }

  private plural(n: number, forms: [string, string, string]): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
    return forms[2];
  }
}
