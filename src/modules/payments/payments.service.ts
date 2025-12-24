import { Injectable, Logger, BadRequestException } from '@nestjs/common';
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
  username: string;
  firstName: string;
  lastName: string;
  paymentId: string;
  amount: number;
  currency: string;
  tariffName: string;
  utm: {
    utm_source: string;
    utm_medium: string;
  };
}

interface BotPaymentSuccessLog {
  userId: number;
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

  async processWebhook(payload: WebhookPayload): Promise<{ ok: boolean }> {
    // Update existing payment record instead of creating new one
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        // Find existing payment by providerId and update its status
        const existingPayment = await this.paymentModel.findOne({ 
          providerId: payload.providerId 
        }).session(session);

        if (!existingPayment) {
          this.logger.warn(`Payment not found for providerId: ${payload.providerId}`);
          return;
        }

        // Update payment status
        await this.paymentModel.updateOne(
          { providerId: payload.providerId },
          { 
            $set: { 
              status: payload.status,
              updatedAt: new Date()
            }
          },
          { session }
        );

        if (payload.status === 'succeeded') {
          const durationDays = payload.product === 'yearly' ? 365 : payload.product === 'monthly' ? 30 : 90;
          const now = new Date();

          // Fetch existing entitlement to extend from current endsAt if in the future
          const existing = await this.entitlementModel.findOne({ userId: payload.userId, product: payload.product }).session(session);
          const base = existing?.endsAt && existing.endsAt > now ? existing.endsAt : now;
          const newEndsAt = new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000);

          const startsAt = existing?.startsAt || now;
          await this.entitlementModel.updateOne(
            { userId: payload.userId, product: payload.product },
            {
              $setOnInsert: { startsAt },
              $set: { endsAt: newEndsAt },
            },
            { upsert: true, session },
          );

          // Update user.pro to reflect active premium subscription
          await this.userModel.updateOne(
            { userId: payload.userId },
            {
              $set: {
                'pro.active': true,
                'pro.since': startsAt,
                'pro.plan': payload.product,
              },
            },
            { session },
          );

          const user = await this.userModel.findOne({ userId: payload.userId }).lean();
          await this.eventModel.create([
            {
              userId: payload.userId,
              name: 'purchase_success',
              ts: new Date(),
              properties: {
                provider: payload.provider,
                providerId: payload.providerId,
                product: payload.product,
                amount: payload.amount,
                currency: payload.currency,
                ...(user?.firstUtm ? { utm: user.firstUtm } : {}),
              },
            },
          ], { session });

          // Log successful payment to bot API
          const registrationTime = new Date().toISOString();
          const paymentTime = new Date().toISOString();
          await this.logPaymentSuccess(payload.userId, payload.providerId, payload.amount, registrationTime, paymentTime, payload.product);
        }
      });

      return { ok: true };
    } catch (err: any) {
      this.logger.error(`Error processing webhook: ${err.message}`);
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
    idempotenceKeyHeader?: string,
  ): Promise<{ ok: boolean }> {
    // Log full webhook payload from YooKassa
    this.logger.log(`🔔 YooKassa Webhook Received:`);
    this.logger.log(`Full Payload: ${JSON.stringify(payload, null, 2)}`);
    this.logger.log(`Idempotence Key Header: ${idempotenceKeyHeader || 'not provided'}`);
    this.logger.log(`Payload Type: ${typeof payload}`);
    this.logger.log(`Payload Keys: ${Object.keys(payload || {}).join(', ')}`);

    // Determine payload format and extract data accordingly
    let provider: string;
    let providerId: string;
    let amountValue: number;
    let currency: string;
    let userId: string;
    let product: 'monthly' | 'quarterly' | 'yearly';
    let status: 'succeeded' | 'pending' | 'failed';

    // Check if it's YooKassa format (has event and object)
    if (payload?.event && payload?.object) {
      this.logger.log(`📋 Detected YooKassa format`);
      const eventType = payload.event;
      const paymentObj = payload.object;

      provider = 'yookassa';
      providerId = paymentObj?.id || 'unknown';
      amountValue = Math.round(parseFloat(paymentObj?.amount?.value || '0') * 100);
      currency = paymentObj?.amount?.currency || 'RUB';
      const metadata = paymentObj?.metadata || {};

      const userIdRaw = metadata.userId;
      const productRaw = metadata.product;
      userId = typeof userIdRaw === 'string' ? userIdRaw : String(userIdRaw || '');

      const statusMap: Record<string, 'succeeded' | 'pending' | 'failed'> = {
        'payment.succeeded': 'succeeded',
        'payment.waiting_for_capture': 'pending',
        'payment.canceled': 'failed',
        'refund.succeeded': 'succeeded',
      };
      status = statusMap[eventType] || 'pending';
      product = (productRaw as any) || 'monthly';

    } else {
      // Check if it's test format (direct fields)
      this.logger.log(`📋 Detected test/direct format`);
      
      provider = payload?.provider || 'yookassa';
      providerId = payload?.providerId || 'unknown';
      amountValue = payload?.amount || 0;
      currency = payload?.currency || 'RUB';
      userId = String(payload?.userId || '');
      product = (payload?.product as any) || 'monthly';
      status = (payload?.status as any) || 'pending';
    }

    this.logger.log(`📊 Parsed Webhook Data:`);
    this.logger.log(`Provider: ${provider}`);
    this.logger.log(`Provider ID: ${providerId}`);
    this.logger.log(`Amount: ${amountValue} kopecks (${(amountValue/100).toFixed(2)} ₽)`);
    this.logger.log(`Currency: ${currency}`);
    this.logger.log(`User ID: ${userId}`);
    this.logger.log(`Product: ${product}`);
    this.logger.log(`Status: ${status}`);

    this.logger.log(`🔄 Processing Webhook:`);

    // Verify payment status according to YooKassa documentation
    // Check if payment exists in our database and verify status
    if (status === 'succeeded') {
      const existingPayment = await this.paymentModel.findOne({ providerId }).lean();
      if (existingPayment) {
        this.logger.log(`✅ Payment found in database: ${existingPayment.status}`);
        if (existingPayment.status === 'succeeded') {
          this.logger.warn(`⚠️  Payment already processed as succeeded - skipping duplicate`);
          return { ok: true };
        }
      } else {
        this.logger.warn(`⚠️  Payment not found in database - may be invalid webhook`);
      }
    }

    // Reuse existing logic with normalized payload
    const result = await this.processWebhook({
      provider,
      providerId,
      idempotencyKey: idempotenceKeyHeader || providerId,
      userId,
      product: product === 'yearly' ? 'yearly' : product,
      amount: amountValue,
      currency,
      status,
    });

    this.logger.log(`✅ Webhook Processing Result: ${JSON.stringify(result, null, 2)}`);
    return result;
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

    // Generate idempotency key
    const idempotencyKey = `payment_${request.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
      // Explicitly set test: false to ensure production mode
      test: false
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
      
      this.logger.log(`Payment data: ${JSON.stringify(paymentData, null, 2)}`);

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
      await this.logPaymentCreation(user, paymentResponse.id, amount, request.product);

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
  async getPaymentStatus(paymentId: string): Promise<{ status: string; paid: boolean }> {
    if (!this.shopId || !this.secretKey) {
      throw new BadRequestException('YooKassa credentials not configured');
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
  private async logPaymentCreation(user: any, paymentId: string, amount: number, product: string): Promise<void> {
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

      const logData: BotPaymentCreationLog = {
        userId: parseInt(user.userId),
        username: user.username || 'unknown',
        firstName: user.firstName || 'Unknown',
        lastName: user.lastName || 'User',
        paymentId: paymentId,
        amount: amount / 100, // Convert from cents to rubles
        currency: 'RUB',
        tariffName: tariffNames[product as keyof typeof tariffNames] || product,
        utm: {
          utm_source: 'telegram',
          utm_medium: 'bot'
        }
      };

      const response = await fetch(`${this.botApiUrl}/api/payment-creation-log`, {
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
  private async logPaymentSuccess(userId: string, paymentId: string, amount: number, registrationTime: string, paymentTime: string, product: 'monthly' | 'quarterly' | 'yearly'): Promise<void> {
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
        paymentId: paymentId,
        amount: amount / 100, // Convert from cents to rubles
        currency: 'RUB',
        registrationTime: registrationTime,
        paymentTime: paymentTime,
        product: product,
        tariffName: tariffNames[product]
      };

      const response = await fetch(`${this.botApiUrl}/api/payment-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.botApiKey}`
        },
        body: JSON.stringify(logData)
      });

      if (!response.ok) {
        this.logger.error(`Failed to log payment success: ${response.status} - ${await response.text()}`);
      } else {
        this.logger.log(`Payment success logged successfully for user ${userId}`);
      }
    } catch (error: any) {
      this.logger.error(`Error logging payment success: ${error.message}`);
    }
  }
}


