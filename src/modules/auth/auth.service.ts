import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { User, UserDocument } from '../common/schemas/user.schema';
import { AppEvent, EventDocument } from '../common/schemas/event.schema';
import { MailService } from '../mail/mail.service';

export interface TelegramInitData {
  query_id?: string;
  user?: string;
  auth_date?: string;
  hash: string;
  start_param?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(AppEvent.name) private readonly eventModel: Model<EventDocument>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}
  async verifyTelegramInitData(
    initData: URLSearchParams,
  ): Promise<{
    userId: string;
    isFirstOpen: boolean;
    utm?: Record<string, string>;
    onboardingCompleted: boolean;
    englishLevel?: 'A0' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
    learningGoals?: string[];
    accessToken: string;
  }> {
    const hash = initData.get('hash') || '';
    const dataCheckString = Array.from(initData.entries())
      .filter(([key]) => key !== 'hash')
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const token = process.env.TELEGRAM_BOT_TOKEN || '';
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
    const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    // Timing-safe сравнение хэшей (буферы одинаковой длины, иначе сразу отказ)
    const hashBuf = Buffer.from(hash, 'hex');
    const computedBuf = Buffer.from(computedHash, 'hex');
    if (
      hashBuf.length !== computedBuf.length ||
      !crypto.timingSafeEqual(hashBuf, computedBuf)
    ) {
      throw new UnauthorizedException('Invalid Telegram init data signature');
    }

    // Проверка свежести initData: отклоняем перехваченные/устаревшие данные.
    // auth_date — unix-время (секунды) выдачи initData Telegram-клиентом.
    const authDateRaw = initData.get('auth_date');
    const authDate = authDateRaw ? parseInt(authDateRaw, 10) : NaN;
    const MAX_AGE_SECONDS = 24 * 60 * 60; // 24 часа
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(authDate) || nowSeconds - authDate > MAX_AGE_SECONDS) {
      throw new UnauthorizedException('Telegram init data expired');
    }

    const userParam = initData.get('user');
    if (!userParam) {
      throw new UnauthorizedException('Missing user');
    }
    const user = JSON.parse(userParam) as {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      photo_url?: string;
    };

    const utm: Record<string, string> = {};
    const startParam = initData.get('start_param');
    if (startParam) {
      // Expected format: utm_source=vk&utm_campaign=xyz
      for (const kv of startParam.split('&')) {
        const [k, v] = kv.split('=');
        if (k && v) utm[k] = v;
      }
    }

    const userId = String(user.id);
    const profile: Record<string, any> = {};
    if (user.first_name) profile.firstName = user.first_name;
    if (user.last_name) profile.lastName = user.last_name;
    if (user.username) profile.username = user.username;
    if (user.language_code) profile.languageCode = user.language_code;
    if (user.photo_url) profile.photoUrl = user.photo_url;

    let isFirstOpen = false;
    if (Object.keys(utm).length) {
      const res = await this.userModel.updateOne(
        { userId },
        {
          $setOnInsert: { firstUtm: utm, userId },
          $set: { lastUtm: utm, ...profile },
        },
        { upsert: true },
      );
      isFirstOpen = Boolean((res as any).upsertedCount && (res as any).upsertedCount > 0);
    } else {
      const res = await this.userModel.updateOne(
        { userId },
        { $setOnInsert: { firstUtm: {}, userId }, $set: { ...profile } },
        { upsert: true },
      );
      isFirstOpen = Boolean((res as any).upsertedCount && (res as any).upsertedCount > 0);
    }

    // Получаем информацию о статусе онбординга
    const userDoc = await this.userModel.findOne({ userId }).lean();
    const onboardingCompleted = Boolean(userDoc?.onboardingCompletedAt);
    const englishLevel = userDoc?.englishLevel;
    const learningGoals = userDoc?.learningGoals;

    await this.eventModel.create({ userId, name: 'open_app', ts: new Date(), properties: { ...utm } });
    
    // Generate JWT token
    const payload = { userId };
    const accessToken = this.jwtService.sign(payload, { 
      expiresIn: '24h' // Token valid for 24 hours
    });
    
    return {
      userId,
      isFirstOpen,
      utm: Object.keys(utm).length ? utm : undefined,
      onboardingCompleted,
      englishLevel,
      learningGoals,
      accessToken,
    };
  }

  private issueToken(userId: string): string {
    return this.jwtService.sign({ userId }, { expiresIn: '24h' });
  }

  /** Регистрация по email/паролю (веб-версия). */
  async registerEmail(email: string, password: string, firstName?: string) {
    const normEmail = String(email).trim().toLowerCase();
    const existing = await this.userModel.findOne({ email: normEmail, authProvider: 'email' }).lean();
    if (existing) {
      throw new ConflictException('Пользователь с таким email уже существует');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = 'em_' + crypto.randomUUID();
    try {
      await this.userModel.create({
        userId,
        email: normEmail,
        passwordHash,
        authProvider: 'email',
        firstName: firstName?.trim() || undefined,
        firstUtm: {},
      });
    } catch (e: any) {
      if (e?.code === 11000) throw new ConflictException('Пользователь с таким email уже существует');
      throw e;
    }
    await this.eventModel.create({ userId, name: 'open_app', ts: new Date(), properties: { source: 'email_register' } });

    // Письмо с подтверждением — best-effort, регистрацию не блокирует
    this.issueEmailVerification(userId, normEmail).catch(() => {});

    return {
      userId,
      email: normEmail,
      firstName: firstName?.trim(),
      isFirstOpen: true,
      onboardingCompleted: false,
      englishLevel: undefined as string | undefined,
      learningGoals: [] as string[],
      accessToken: this.issueToken(userId),
    };
  }

  /** Вход по email/паролю. */
  async loginEmail(email: string, password: string) {
    const normEmail = String(email).trim().toLowerCase();
    const user = await this.userModel
      .findOne({ email: normEmail, authProvider: 'email' })
      .select('+passwordHash')
      .lean();
    // bcrypt.compare даже при отсутствии юзера — чтобы не палить существование email по времени
    const hash = user?.passwordHash || '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
    const ok = await bcrypt.compare(password, hash);
    if (!user || !user.passwordHash || !ok) {
      throw new UnauthorizedException('Неверный email или пароль');
    }
    return {
      userId: user.userId,
      email: user.email,
      firstName: user.firstName,
      isFirstOpen: false,
      onboardingCompleted: Boolean(user.onboardingCompletedAt),
      englishLevel: user.englishLevel,
      learningGoals: user.learningGoals || [],
      accessToken: this.issueToken(user.userId),
    };
  }

  // ---------- Email-верификация и сброс пароля ----------

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /** Генерирует токен, сохраняет sha256-хэш и шлёт письмо. Возвращает false, если письмо не ушло. */
  async issueEmailVerification(userId: string, email: string): Promise<boolean> {
    const raw = crypto.randomBytes(32).toString('hex');
    await this.userModel.updateOne(
      { userId },
      {
        emailVerificationToken: this.hashToken(raw),
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    );
    return this.mailService.sendEmailVerification(email, raw);
  }

  /** Повторная отправка письма подтверждения (по JWT). */
  async resendVerification(userId: string): Promise<{ sent: boolean }> {
    const user = await this.userModel.findOne({ userId, authProvider: 'email' }).lean();
    if (!user || !user.email) throw new UnauthorizedException('Аккаунт не найден');
    if (user.emailVerified) return { sent: false };
    const sent = await this.issueEmailVerification(userId, user.email);
    return { sent };
  }

  async verifyEmail(rawToken: string): Promise<{ verified: boolean }> {
    const user = await this.userModel
      .findOne({
        emailVerificationToken: this.hashToken(rawToken),
        emailVerificationExpires: { $gt: new Date() },
      })
      .lean();
    if (!user) throw new BadRequestException('Ссылка недействительна или устарела');
    await this.userModel.updateOne(
      { userId: user.userId },
      {
        emailVerified: true,
        $unset: { emailVerificationToken: 1, emailVerificationExpires: 1 },
      },
    );
    return { verified: true };
  }

  /** Всегда отвечает ok — не палим существование email (анти-enumeration). */
  async forgotPassword(email: string): Promise<{ ok: true }> {
    const normEmail = String(email).trim().toLowerCase();
    const user = await this.userModel.findOne({ email: normEmail, authProvider: 'email' }).lean();
    if (user) {
      const raw = crypto.randomBytes(32).toString('hex');
      await this.userModel.updateOne(
        { userId: user.userId },
        {
          passwordResetToken: this.hashToken(raw),
          passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000),
        },
      );
      this.mailService.sendPasswordReset(normEmail, raw).catch(() => {});
    }
    return { ok: true };
  }

  async resetPassword(rawToken: string, password: string): Promise<{ ok: true }> {
    const user = await this.userModel
      .findOne({
        passwordResetToken: this.hashToken(rawToken),
        passwordResetExpires: { $gt: new Date() },
      })
      .lean();
    if (!user) throw new BadRequestException('Ссылка недействительна или устарела');
    const passwordHash = await bcrypt.hash(password, 10);
    await this.userModel.updateOne(
      { userId: user.userId },
      {
        passwordHash,
        // Успешный сброс по письму = доказательство владения адресом
        emailVerified: true,
        $unset: {
          passwordResetToken: 1,
          passwordResetExpires: 1,
          emailVerificationToken: 1,
          emailVerificationExpires: 1,
        },
      },
    );
    return { ok: true };
  }
}


