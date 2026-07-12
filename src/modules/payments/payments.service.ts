import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { Payment, PaymentDocument } from '../common/schemas/payment.schema';
import { Entitlement, EntitlementDocument } from '../common/schemas/entitlement.schema';
import { AppEvent, EventDocument } from '../common/schemas/event.schema';
import { User, UserDocument } from '../common/schemas/user.schema';
import { UserLessonProgress, UserLessonProgressDocument } from '../common/schemas/user-lesson-progress.schema';
import { PricingService } from '../paywall/pricing.service';

interface WebhookPayload {
  provider: string;
  providerId: string;
  idempotencyKey: string;
  userId: string;
  product: 'monthly' | 'quarterly' | 'yearly';
  amount: number; // RUB cents
  currency: string; // RUB
  status: 'succeeded' | 'pending' | 'failed';
}

interface CreatePaymentRequest {
  userId: string;
  product: 'monthly' | 'quarterly' | 'yearly';
  returnUrl: string;
  description?: string;
}

interface YooKassaPaymentResponse {
  id: string;
  status: string;
  paid: boolean;
  amount: {
    value: string;
    currency: string;
  };
  confirmation: {
    type: string;
    confirmation_url: string;
  };
  created_at: string;
  description: string;
  metadata: Record<string, any>;
}

interface BotPaymentCreationLog {
  userId: number;
  username?: string;
  firstName: string;
  lastName: string;
  paymentId: string;
  amount: number;
  currency: string;
  tariffName: string;
  utm: Record<string, string>;
  userRegistrationDate?: string;
  paymentCreationDate: string;
  product: 'monthly' | 'quarterly' | 'yearly';
}

interface BotPaymentSuccessLog {
  userId: number;
  username?: string;
  firstName: string;
  lastName: string;
  paymentId: string;
  amount: number;
  currency: string;
  registrationTime: string;
  paymentTime: string;
  product: 'monthly' | 'quarterly' | 'yearly';
  tariffName?: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  // YooKassa API configuration
  private readonly yookassaApiUrl: string;
  private readonly shopId: string | undefined;
  private readonly secretKey: string | undefined;
  private readonly yookassaMode: 'test' | 'production';

  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Entitlement.name) private readonly entitlementModel: Model<EntitlementDocument>,
    @InjectModel(AppEvent.name) private readonly eventModel: Model<EventDocument>,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(UserLessonProgress.name) private readonly progressModel: Model<UserLessonProgressDocument>,
    private readonly pricingService: PricingService,
    private readonly configService: ConfigService,
  ) {
    // Get YooKassa mode (test or production)
    this.yookassaMode = this.configService.get<'test' | 'production'>('app.payment.yookassaMode', 'production');
    
    // Select credentials based on mode
    if (this.yookassaMode === 'test') {
      this.shopId = this.configService.get<string>('app.payment.yookassaTestShopId');
      this.secretKey = this.configService.get<string>('app.payment.yookassaTestSecretKey');
      this.logger.log(`🔧 YooKassa mode: TEST (using test shop credentials)`);
    } else {
      this.shopId = this.configService.get<string>('app.payment.yookassaShopId');
      this.secretKey = this.configService.get<string>('app.payment.yookassaSecretKey');
      this.logger.log(`🔧 YooKassa mode: PRODUCTION (using production shop credentials)`);
    }
    
    this.yookassaApiUrl = this.configService.get<string>('app.payment.yookassaApiUrl', 'https://api.yookassa.ru/v3');
  }

  // Bot API configuration for logging
  private readonly botApiUrl = process.env.BOT_API_URL;
  private readonly botApiKey = process.env.BOT_API_KEY;

  /**
   * Generate informative payment description with subscription details
   */
  private generatePaymentDescription(product: 'monthly' | 'quarterly' | 'yearly', amount: number, cohort: string): string {
    const productNames = {
      monthly: 'месячная',
      quarterly: 'квартальная', 
      yearly: 'годовая'
    };

    const durations = {
      monthly: '30 дней',
      quarterly: '90 дней',
      yearly: '365 дней'
    };

    const price = (amount / 100).toFixed(0);
    const productName = productNames[product];
    const duration = durations[product];
    
    // Special description for test payments
    if (amount === 1000) { // 10₽ test payment
      return `[ТЕСТ] Инглиш в ТГ - ${productName} подписка (${duration}) • ${price} ₽`;
    }
    
    return `Инглиш в ТГ - ${productName} подписка (${duration}) • ${price} ₽`;
  }

  /**
   * Запрашивает АВТОРИТЕТНЫЕ данные платежа напрямую из YooKassa API.
   * Никогда не доверяем деньгам/статусу из тела вебхука — только этому источнику.
   */
  private async fetchYooKassaPayment(
    providerId: string,
  ): Promise<{ status: string; paid: boolean; amount: number | null; metadata: Record<string, any> } | null> {
    if (!this.shopId || !this.secretKey) {
      this.logger.error('YooKassa credentials not configured — cannot verify webhook');
      return null;
    }
    try {
      const resp = await fetch(`${this.yookassaApiUrl}/payments/${encodeURIComponent(providerId)}`, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.shopId}:${this.secretKey}`).toString('base64')}`,
        },
      });
      if (!resp.ok) {
        this.logger.error(`YooKassa verify failed for ${providerId}: HTTP ${resp.status}`);
        return null;
      }
      const p = (await resp.json()) as YooKassaPaymentResponse;
      const amount = p?.amount?.value ? Math.round(parseFloat(p.amount.value) * 100) : null;
      return { status: p.status, paid: (p as any).paid === true, amount, metadata: p.metadata || {} };
    } catch (e: any) {
      this.logger.error(`YooKassa verify error for ${providerId}: ${e.message}`);
      return null;
    }
  }

  /**
   * Подтверждает оплату и идемпотентно выдаёт доступ. Доверяет ТОЛЬКО:
   *  - наличию платежа с таким providerId в нашей БД,
   *  - авторитетному статусу/сумме из YooKassa API (не из тела вебхука).
   * Доступ выдаётся по СОХРАНЁННОМУ product/amount, переход статуса атомарен.
   */
  private async confirmPaymentAndGrant(providerId: string): Promise<{ ok: boolean }> {
    // 1) Наш ли это платёж?
    const payment = await this.paymentModel.findOne({ providerId }).lean();
    if (!payment) {
      this.logger.warn(`Webhook: платёж ${providerId} не найден в БД — игнорируем`);
      return { ok: true };
    }
    if (payment.status === 'succeeded') {
      this.logger.log(`Webhook: платёж ${providerId} уже succeeded — идемпотентно ок`);
      return { ok: true };
    }

    // 2) Сверяемся с YooKassa (авторитетный источник)
    const verified = await this.fetchYooKassaPayment(providerId);
    if (!verified) {
      return { ok: false };
    }
    if (!(verified.status === 'succeeded' && verified.paid === true)) {
      this.logger.warn(`Webhook: платёж ${providerId} в YooKassa не оплачен (status=${verified.status}, paid=${verified.paid})`);
      return { ok: true };
    }
    // 3) Сумма из YooKassa должна совпадать с сохранённой у нас
    if (typeof verified.amount === 'number' && verified.amount !== payment.amount) {
      this.logger.error(`Webhook: сумма ${providerId} расходится (YooKassa=${verified.amount}, БД=${payment.amount}) — отказ`);
      return { ok: false };
    }

    const product = payment.product as 'monthly' | 'quarterly' | 'yearly';
    const userId = payment.userId;
    const durationDays = product === 'yearly' ? 365 : product === 'quarterly' ? 90 : 30;

    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        // 4) Атомарный переход pending→succeeded; 0 изменений = уже обработан (идемпотентность)
        const transition = await this.paymentModel.updateOne(
          { providerId, status: { $ne: 'succeeded' } },
          { $set: { status: 'succeeded', updatedAt: new Date() } },
          { session },
        );
        if (transition.modifiedCount === 0) {
          this.logger.warn(`Webhook: платёж ${providerId} обработан параллельно — пропуск выдачи`);
          return;
        }

        const now = new Date();
        const existing = await this.entitlementModel.findOne({ userId, product }).session(session);
        // Оплаченное время не должно теряться при смене тарифа: новый период
        // стартует после САМОГО ПОЗДНЕГО endsAt среди всех entitlements юзера
        const latestAny = await this.entitlementModel
          .findOne({ userId })
          .sort({ endsAt: -1 })
          .session(session);
        const maxEndsAt = latestAny?.endsAt && latestAny.endsAt > now ? latestAny.endsAt : now;
        const newEndsAt = new Date(maxEndsAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
        const startsAt = existing?.startsAt || now;

        await this.entitlementModel.updateOne(
          { userId, product },
          { $setOnInsert: { startsAt }, $set: { endsAt: newEndsAt } },
          { upsert: true, session },
        );

        // pro.* — денормализованный кэш; авторитетный источник доступа — entitlement.endsAt
        await this.userModel.updateOne(
          { userId },
          { $set: { 'pro.active': true, 'pro.since': startsAt, 'pro.plan': product } },
          { session },
        );

        const user = await this.userModel.findOne({ userId }).lean();
        await this.eventModel.create(
          [
            {
              userId,
              name: 'purchase_success',
              ts: new Date(),
              properties: {
                provider: 'yookassa',
                providerId,
                product,
                amount: payment.amount,
                currency: payment.currency,
                ...(user?.firstUtm ? { utm: user.firstUtm } : {}),
              },
            },
          ],
          { session },
        );

        const registrationTime = user?.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString();
        await this.logPaymentSuccess(userId, providerId, payment.amount, registrationTime, new Date().toISOString(), product, user);
      });
      return { ok: true };
    } catch (err: any) {
      this.logger.error(`Webhook: ошибка обработки ${providerId}: ${err.message}`);
      throw err;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Process YooKassa webhook payload (payment.* events)
   * See: https://yookassa.ru/developers/payment-acceptance/getting-started/quick-start
   */
  async processYooKassaWebhook(
    payload: any, // Accept ANY payload structure
    _idempotenceKeyHeader?: string,
  ): Promise<{ ok: boolean }> {
    // Извлекаем ТОЛЬКО идентификатор платежа и тип события.
    // Денежные поля (сумма/статус/product) НЕ берём из тела — только из YooKassa API.
    let providerId: string | undefined;
    let eventType: string | undefined;

    if (payload?.event && payload?.object) {
      eventType = payload.event;
      providerId = payload.object?.id;
    } else {
      // «direct»-формат (наши тесты/совместимость): providerId обязателен
      providerId = payload?.providerId;
      eventType = payload?.event || (payload?.status === 'succeeded' ? 'payment.succeeded' : undefined);
    }

    if (!providerId) {
      this.logger.warn('Webhook без providerId — игнорируем');
      return { ok: true };
    }

    // Действуем только на успешную оплату; сумму/статус подтвердит confirmPaymentAndGrant через YooKassa API
    if (eventType === 'payment.succeeded') {
      return this.confirmPaymentAndGrant(providerId);
    }

    this.logger.log(`Webhook event ${eventType || 'unknown'} для ${providerId} — без действия`);
    return { ok: true };
  }

  /**
   * Create payment via YooKassa API
   * Based on: https://yookassa.ru/developers/payment-acceptance/getting-started/quick-start
   */
  async createPayment(request: CreatePaymentRequest): Promise<{
    paymentUrl: string;
    paymentId: string;
    amount: number;
    createdAt: Date;
    paymentMethod: string;
    user: {
      userId: string;
      username?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
    };
    cohort: string;
  }> {
    if (!this.shopId || !this.secretKey) {
      throw new BadRequestException('YooKassa credentials not configured');
    }

    // Get user data for pricing calculation
    const user = await this.userModel.findOne({ userId: request.userId }).lean();
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Email-аккаунт должен подтвердить почту перед оплатой — иначе чек 54-ФЗ уйдёт
    // на непроверенный адрес. Telegram-пользователей (authProvider !== 'email') не касается.
    if (user.authProvider === 'email' && user.emailVerified !== true) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Подтвердите email перед оплатой — мы отправили письмо на вашу почту.',
      });
    }

    // 🔒 Rate limiting: Check for too many pending payments
    const pendingPayments = await this.paymentModel.countDocuments({
      userId: request.userId,
      status: 'pending',
      createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
    });

    if (pendingPayments >= 10) {
      this.logger.warn(`Rate limit exceeded for user ${request.userId}: ${pendingPayments} pending payments`);
      throw new BadRequestException('Too many pending payments. Please wait before creating a new one.');
    }

    // Calculate pricing based on user cohort
    const lessonCount = await this.progressModel.countDocuments({ 
      userId: request.userId, 
      status: 'completed' 
    });

    const activeEntitlement = await this.entitlementModel.findOne({
      userId: request.userId,
      endsAt: { $gt: new Date() }
    }).lean();

    const hasSubscription = !!activeEntitlement;
    const subscriptionExpired = !hasSubscription && await this.entitlementModel.findOne({
      userId: request.userId,
      endsAt: { $lt: new Date() }
    }).lean();

    const cohort = this.pricingService.determineCohort({
      isFirstOpen: !user.onboardingCompletedAt,
      lastActiveDate: user.updatedAt,
      lessonCount,
      hasSubscription,
      subscriptionExpired: !!subscriptionExpired,
      userId: request.userId // Pass userId for test detection
    });

    const pricing = await this.pricingService.getPricing(cohort);
    
    // Get price for selected product
    let amount: number;
    switch (request.product) {
      case 'monthly':
        amount = pricing.monthlyPrice;
        break;
      case 'quarterly':
        amount = pricing.quarterlyPrice;
        break;
      case 'yearly':
        amount = pricing.yearlyPrice;
        break;
      default:
        throw new BadRequestException('Invalid product type');
    }

    // Idempotence-Key для YooKassa — ограничение 64 символа. С длинным строковым
    // userId (em_<uuid> у веб-аккаунтов) старый формат payment_<userId>_<ts>_<rand>
    // превышал лимит и ломал оплату. UUID (36 символов) уникален и всегда влезает.
    const idempotencyKey = randomUUID();

    // Prepare payment data for YooKassa
    const paymentData = {
      amount: {
        value: (amount / 100).toFixed(2), // Convert from cents to rubles
        currency: 'RUB'
      },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: request.returnUrl
      },
      description: request.description || this.generatePaymentDescription(request.product, amount, cohort),
      receipt: {
        customer: {
          email: user.email || `user_${request.userId}@burlive.ru` // Use email or fallback to userId-based email
        },
        // ИНН самозанятого для автоматической регистрации чеков в "Мой налог"
        // ВАЖНО: Убедитесь, что в личном кабинете YooKassa настроено разрешение
        // на регистрацию чеков для самозанятого с данным ИНН
        // inn: process.env.SELF_EMPLOYED_INN || '123456789012', // Замените на ваш ИНН
        items: [
          {
            description: this.generatePaymentDescription(request.product, amount, cohort),
            quantity: '1.00',
            amount: {
              value: (amount / 100).toFixed(2),
              currency: 'RUB'
            },
            vat_code: 1 // Без НДС (для самозанятого)
          }
        ]
      },
      metadata: {
        userId: request.userId,
        product: request.product,
        cohort: cohort
      },
      // Use YooKassa test flag from env mode (YOOKASSA_MODE)
      test: this.yookassaMode === 'test'
    };

    try {
      // Log payment details for debugging
      this.logger.log(`Creating payment with YooKassa API: ${this.yookassaApiUrl}`);
      this.logger.log(`Payment description: ${paymentData.description}`);
      this.logger.log(`Shop ID: ${this.shopId?.substring(0, 8)}...`);
      this.logger.log(`User cohort: ${cohort}, Amount: ${amount} kopecks (${(amount/100).toFixed(2)} ₽)`);
      
      if (cohort === 'test_payment') {
        this.logger.warn(`🧪 TEST PAYMENT: User ${request.userId} - ${amount} kopecks (${(amount/100).toFixed(2)} ₽)`);
      }

      // PII-минимизация: полное тело paymentData НЕ логируем (receipt.customer содержит email)

      // Make request to YooKassa API
      const response = await fetch(`${this.yookassaApiUrl}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotence-Key': idempotencyKey,
          'Authorization': `Basic ${Buffer.from(`${this.shopId}:${this.secretKey}`).toString('base64')}`
        },
        body: JSON.stringify(paymentData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`YooKassa API error: ${response.status} - ${errorText}`);
        throw new BadRequestException(`Payment creation failed: ${response.status}`);
      }

      const paymentResponse = await response.json() as YooKassaPaymentResponse;
      
      // Log payment response for debugging
      this.logger.log(`YooKassa payment created: ${paymentResponse.id}`);
      this.logger.log(`Payment status: ${paymentResponse.status}`);
      this.logger.log(`Payment description in response: ${paymentResponse.description}`);

      // Save payment to database immediately
      const createdAt = new Date();
      const savedPayment = await this.paymentModel.create([{
        userId: request.userId,
        provider: 'yookassa',
        providerId: paymentResponse.id,
        idempotencyKey: idempotencyKey,
        product: request.product,
        amount: amount,
        currency: 'RUB',
        status: 'pending'
      }]);

      // Log payment creation event
      await this.eventModel.create([{
        userId: request.userId,
        name: 'payment_created',
        ts: new Date(),
        properties: {
          paymentId: paymentResponse.id,
          product: request.product,
          amount: amount,
          currency: 'RUB',
          cohort: cohort,
          pricing: pricing
        }
      }]);

      // Log payment creation to bot API
      await this.logPaymentCreation(user, paymentResponse.id, amount, request.product, createdAt);

      return {
        paymentUrl: paymentResponse.confirmation.confirmation_url,
        paymentId: paymentResponse.id,
        amount: amount,
        createdAt: createdAt,
        paymentMethod: 'yookassa',
        user: {
          userId: user.userId,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email
        },
        cohort: cohort
      };

    } catch (error: any) {
      this.logger.error(`Failed to create payment: ${error.message}`);
      throw new BadRequestException('Failed to create payment');
    }
  }

  /**
   * Get payment status from YooKassa
   */
  /**
   * Сверяет платёж с YooKassa и, если он оплачен, идемпотентно выдаёт доступ.
   * Клиентский поллинг вызывает это после оплаты — так доступ выдаётся даже без
   * настроенного вебхука. Только владелец платежа.
   */
  async reconcilePayment(userId: string, providerId: string): Promise<{ granted: boolean; entitlement: any }> {
    if (!providerId) throw new BadRequestException('paymentId is required');
    const payment = await this.paymentModel.findOne({ providerId }).lean();
    if (!payment || String(payment.userId) !== String(userId)) {
      throw new ForbiddenException('Payment not found');
    }

    await this.confirmPaymentAndGrant(providerId);

    const now = new Date();
    const ent = await this.entitlementModel
      .findOne({ userId: String(userId), endsAt: { $gt: now } })
      .sort({ endsAt: -1 })
      .lean();
    const productIdMap: Record<string, string> = {
      monthly: 'monthly_subscription',
      quarterly: 'quarterly_subscription',
      yearly: 'yearly_subscription',
    };
    return {
      granted: !!ent,
      entitlement: ent
        ? {
            userId: Number(userId),
            endsAt: new Date(ent.endsAt).toISOString(),
            productId: productIdMap[ent.product] || ent.product,
            status: 'active' as const,
          }
        : null,
    };
  }

  async getPaymentStatus(paymentId: string, userId?: string): Promise<{ status: string; paid: boolean }> {
    if (!this.shopId || !this.secretKey) {
      throw new BadRequestException('YooKassa credentials not configured');
    }

    // Проверка владельца: нельзя смотреть статус чужого платежа
    if (userId) {
      const owned = await this.paymentModel.findOne({ providerId: paymentId }).select('userId').lean();
      if (!owned || String(owned.userId) !== String(userId)) {
        throw new ForbiddenException('Payment not found');
      }
    }

    try {
      const response = await fetch(`${this.yookassaApiUrl}/payments/${paymentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.shopId}:${this.secretKey}`).toString('base64')}`
        }
      });

      if (!response.ok) {
        throw new BadRequestException(`Failed to get payment status: ${response.status}`);
      }

      const payment = await response.json() as YooKassaPaymentResponse;
      
      return {
        status: payment.status,
        paid: payment.paid
      };

    } catch (error: any) {
      this.logger.error(`Failed to get payment status: ${error.message}`);
      throw new BadRequestException('Failed to get payment status');
    }
  }

  /**
   * Log payment creation to bot API
   */
  private async logPaymentCreation(user: any, paymentId: string, amount: number, product: 'monthly' | 'quarterly' | 'yearly', paymentCreationDate: Date): Promise<void> {
    if (!this.botApiUrl || !this.botApiKey) {
      this.logger.warn('Bot API credentials not configured, skipping payment creation log');
      return;
    }

    try {
      const tariffNames = {
        monthly: 'Премиум на месяц',
        quarterly: 'Премиум на квартал', 
        yearly: 'Премиум на год'
      };

      // Get UTM from user (prefer firstUtm, fallback to lastUtm, or empty object)
      const utm = user.firstUtm || user.lastUtm || {};

      const logData: BotPaymentCreationLog = {
        userId: parseInt(user.userId),
        username: user.username,
        firstName: user.firstName || 'Unknown',
        lastName: user.lastName || 'User',
        paymentId: paymentId,
        amount: amount / 100, // Convert from cents to rubles
        currency: 'RUB',
        tariffName: tariffNames[product] || product,
        utm: utm,
        userRegistrationDate: user.createdAt ? new Date(user.createdAt).toISOString() : undefined,
        paymentCreationDate: paymentCreationDate.toISOString(),
        product: product
      };

      const response = await fetch(`${this.botApiUrl}/payment-creation-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.botApiKey}`
        },
        body: JSON.stringify(logData)
      });

      if (!response.ok) {
        this.logger.error(`Failed to log payment creation: ${response.status} - ${await response.text()}`);
      } else {
        this.logger.log(`Payment creation logged successfully for user ${user.userId}`);
      }
    } catch (error: any) {
      this.logger.error(`Error logging payment creation: ${error.message}`);
    }
  }

  /**
   * Log successful payment to bot API
   */
  private async logPaymentSuccess(userId: string, paymentId: string, amount: number, registrationTime: string, paymentTime: string, product: 'monthly' | 'quarterly' | 'yearly', user: any): Promise<void> {
    if (!this.botApiUrl || !this.botApiKey) {
      this.logger.warn('Bot API credentials not configured, skipping payment success log');
      return;
    }

    try {
      const tariffNames = {
        monthly: 'Премиум на месяц',
        quarterly: 'Премиум на квартал',
        yearly: 'Премиум на год'
      };

      const logData: BotPaymentSuccessLog = {
        userId: parseInt(userId),
        username: user?.username,
        firstName: user?.firstName || 'Unknown',
        lastName: user?.lastName || 'User',
        paymentId: paymentId,
        amount: amount / 100, // Convert from cents to rubles
        currency: 'RUB',
        registrationTime: registrationTime,
        paymentTime: paymentTime,
        product: product,
        tariffName: tariffNames[product]
      };

      const url = `${this.botApiUrl}/payment-log`;
      // PII-минимизация: тело logData (имя/фамилия/username) НЕ выводим в логи —
      // оно уходит только в Bot API (это функционал уведомлений)
      this.logger.log(`📤 Sending payment success notification to Bot API:`);
      this.logger.log(`   URL: ${url}`);
      this.logger.log(`   UserId: ${userId}`);
      this.logger.log(`   PaymentId: ${paymentId}`);
      this.logger.log(`   Product: ${product} (${tariffNames[product]})`);
      this.logger.log(`   Amount: ${logData.amount} ${logData.currency}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.botApiKey}`
        },
        body: JSON.stringify(logData)
      });

      this.logger.log(`📥 Bot API response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`❌ Failed to log payment success to Bot API:`);
        this.logger.error(`   Status: ${response.status} ${response.statusText}`);
        this.logger.error(`   Response body: ${errorText}`);
        this.logger.error(`   URL: ${url}`);
        this.logger.error(`   UserId: ${userId}, PaymentId: ${paymentId}`);
      } else {
        const responseText = await response.text();
        this.logger.log(`✅ Payment success logged successfully to Bot API for user ${userId}`);
        if (responseText) {
          this.logger.log(`   Response: ${responseText}`);
        }
      }
    } catch (error: any) {
      this.logger.error(`❌ Error logging payment success to Bot API:`);
      this.logger.error(`   Error message: ${error.message}`);
      this.logger.error(`   Error type: ${error.constructor.name}`);
      if (error.stack) {
        this.logger.error(`   Stack trace: ${error.stack}`);
      }
      if (error.cause) {
        this.logger.error(`   Cause: ${JSON.stringify(error.cause, null, 2)}`);
      }
      this.logger.error(`   UserId: ${userId}, PaymentId: ${paymentId}`);
      this.logger.error(`   Bot API URL: ${this.botApiUrl}`);
      this.logger.error(`   Bot API Key configured: ${!!this.botApiKey}`);
    }
  }
}


