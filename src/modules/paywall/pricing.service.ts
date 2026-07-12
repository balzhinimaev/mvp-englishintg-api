// src/paywall/pricing.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserCohort, CohortPricing, PaywallProduct } from '../common/types/content';
import { CohortPricingDocument } from '../common/schemas/cohort-pricing.schema';

// Default pricing discounts (will be moved to database later)
// To change discounts, modify these values:
const DEFAULT_DISCOUNTS = {
  MONTHLY: 10, // 10% скидка для месячной подписки (990₽ → 891₽)
  QUARTERLY: 20, // 20% скидка для квартальной подписки (1490₽ → 1192₽)
  YEARLY: 17, // 17% скидка для годовой подписки (2990₽ → 2482₽)
};

@Injectable()
export class PricingService {
  constructor(
    @InjectModel(CohortPricingDocument.name)
    private cohortPricingModel: Model<CohortPricingDocument>,
  ) {}

  // Кэш для настроек (обновляется каждые 5 минут)
  private settingsCache: Map<string, any> = new Map();
  private cacheTimestamp = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 минут

  async getCohortSettings(cohort: UserCohort) {
    // Проверяем кэш
    const cacheKey = `cohort_${cohort}`;
    if (Date.now() - this.cacheTimestamp < this.CACHE_TTL && this.settingsCache.has(cacheKey)) {
      const cached = this.settingsCache.get(cacheKey);
      if (cached && typeof cached === 'object') {
        return cached;
      }
    }

    let cohortSettings = null;
    try {
      // Загружаем из БД
      cohortSettings = await this.cohortPricingModel.findOne({
        cohortName: cohort,
        isActive: true,
      });
    } catch (error) {
      console.error(`Error loading cohort settings for ${cohort}:`, error);
    }

    // Fallback к дефолтным значениям если нет в БД
    const settings = cohortSettings || {
      cohortName: cohort,
      monthlyDiscount: DEFAULT_DISCOUNTS.MONTHLY,
      quarterlyDiscount: DEFAULT_DISCOUNTS.QUARTERLY,
      yearlyDiscount: DEFAULT_DISCOUNTS.YEARLY,
      promoCode: cohort === 'default' ? 'DEFAULT10' : undefined,
      isActive: true,
    };

    // Обновляем кэш
    this.settingsCache.set(cacheKey, settings);
    this.cacheTimestamp = Date.now();

    return settings;
  }

  determineCohort(user: {
    isFirstOpen?: boolean;
    lastActiveDate?: Date;
    lessonCount?: number;
    hasSubscription?: boolean;
    subscriptionExpired?: boolean;
    userId?: string; // Add userId for test detection
  }): UserCohort {
    // Check for specific test user ID
    if (user.userId === '1272270574') {
      return 'test_payment';
    }

    // Check for test payment users (userId starts with 'test_' or contains 'test')
    if (user.userId && (user.userId.startsWith('test_') || user.userId.includes('test'))) {
      return 'test_payment';
    }

    if (user.isFirstOpen) return 'new_user';
    if (user.subscriptionExpired) return 'premium_trial';

    // Winback-когорты: считаем по последней активности (lastActiveDate = user.updatedAt)
    const idleDays = user.lastActiveDate
      ? (Date.now() - new Date(user.lastActiveDate).getTime()) / (24 * 60 * 60 * 1000)
      : 0;
    if (idleDays > 30 && (user.lessonCount || 0) > 0) return 'churned';
    if (idleDays > 7 && (user.lessonCount || 0) <= 2) return 'low_engagement';

    if ((user.lessonCount || 0) > 20) return 'high_engagement';
    return 'default';
  }

  private calculateDiscountedPrice(originalPrice: number, discountPercentage: number): number {
    const discountedPrice = (originalPrice * (100 - discountPercentage)) / 100;
    return this.roundToSellingPrice(discountedPrice);
  }

  private roundToSellingPrice(price: number): number {
    // Округляем до красивых продающих цен, заканчивающихся на 9₽
    if (price >= 1000) { // >= 10₽
      // Округляем до десятков рублей в меньшую сторону, потом добавляем 9₽
      // 89100 (891₽) → 890₽ → 899₽
      // 119200 (1192₽) → 1190₽ → 1199₽ 
      // 248200 (2482₽) → 2480₽ → 2489₽
      const rubles = Math.floor(price / 100); // переводим в рубли и округляем вниз
      const tensOfRubles = Math.floor(rubles / 10) * 10; // округляем до десятков рублей
      return (tensOfRubles + 9) * 100; // добавляем 9₽ и переводим в копейки
    } else {
      // Для маленьких сумм (меньше 10₽) оставляем как есть
      return price;
    }
  }

  async getPricing(cohort: UserCohort): Promise<CohortPricing> {
    // Базовые цены БЕЗ скидок - для показа "было"
    const base = {
      monthlyOriginalPrice: 99000, // 990₽ - исходная цена месячной
      quarterlyOriginalPrice: 149000, // 1490₽ - исходная цена квартальной
      yearlyOriginalPrice: 299000, // 2990₽ - исходная цена годовой
    };

    // Получаем настройки когорты из БД
    const cohortSettings = await this.getCohortSettings(cohort);

    // Специальная обработка для тестовых пользователей
    if (cohort === 'test_payment') {
      return {
        cohort,
        ...base,
        monthlyPrice: 1000,
        quarterlyPrice: 1000,
        yearlyPrice: 1000,
        discountPercentage: 99,
        quarterlyDiscountPercentage: 99,
        yearlyDiscountPercentage: 99,
        promoCode: 'TEST10',
      } as CohortPricing;
    }

    // Рассчитываем цены со скидками
    const monthlyPrice = this.calculateDiscountedPrice(
      base.monthlyOriginalPrice,
      cohortSettings.monthlyDiscount,
    );
    const quarterlyPrice = this.calculateDiscountedPrice(
      base.quarterlyOriginalPrice,
      cohortSettings.quarterlyDiscount,
    );
    const yearlyPrice = this.calculateDiscountedPrice(
      base.yearlyOriginalPrice,
      cohortSettings.yearlyDiscount,
    );

    return {
      cohort,
      ...base,
      monthlyPrice,
      quarterlyPrice,
      yearlyPrice,
      discountPercentage: cohortSettings.monthlyDiscount,
      quarterlyDiscountPercentage: cohortSettings.quarterlyDiscount,
      yearlyDiscountPercentage: cohortSettings.yearlyDiscount,
      promoCode: cohortSettings.promoCode,
    } as CohortPricing;
  }

  getProducts(pricing: CohortPricing, regular?: CohortPricing): PaywallProduct[] {
    // Calculate monthly equivalent for quarterly and yearly subscriptions
    const quarterlyMonthlyEquivalent = Math.round(pricing.quarterlyPrice / 3);
    const yearlyMonthlyEquivalent = Math.round(pricing.yearlyPrice / 12);

    // ЧЕСТНЫЕ якоря вместо вечной «скидки» от цены, по которой никогда не продавали:
    //  - quarterly/yearly: «было» = столько же месяцев по помесячной цене ЭТОЙ когорты;
    //  - monthly: «было» = обычная (default) цена, только если когорте реально дешевле.
    const monthlyRegular = regular && pricing.monthlyPrice < regular.monthlyPrice ? regular.monthlyPrice : undefined;
    const monthlyRegularDiscount = monthlyRegular
      ? Math.round((1 - pricing.monthlyPrice / monthlyRegular) * 100)
      : undefined;
    const quarterlyIfMonthly =
      pricing.monthlyPrice * 3 > pricing.quarterlyPrice ? pricing.monthlyPrice * 3 : undefined;
    const yearlyIfMonthly =
      pricing.monthlyPrice * 12 > pricing.yearlyPrice ? pricing.monthlyPrice * 12 : undefined;

    // Calculate savings percentage compared to monthly subscription (защита от негативных значений)
    const quarterlySavingsPercentage = Math.max(0, Math.round(
      ((pricing.monthlyPrice - quarterlyMonthlyEquivalent) / pricing.monthlyPrice) * 100,
    ));
    const yearlySavingsPercentage = Math.max(0, Math.round(
      ((pricing.monthlyPrice - yearlyMonthlyEquivalent) / pricing.monthlyPrice) * 100,
    ));

    return [
      {
        id: 'monthly',
        name: 'Месяц',
        description: 'Полный доступ ко всем урокам',
        price: pricing.monthlyPrice,
        originalPrice: monthlyRegular,
        currency: 'RUB',
        duration: 'month',
        discount: monthlyRegularDiscount,
        isPopular: true,
      },
      {
        id: 'quarterly',
        name: '3 месяца',
        description: quarterlySavingsPercentage > 0 
          ? `Экономия ${quarterlySavingsPercentage}% против помесячки • ~${Math.round(quarterlyMonthlyEquivalent / 100)}₽/месяц`
          : `~${Math.round(quarterlyMonthlyEquivalent / 100)}₽/месяц`,
        price: pricing.quarterlyPrice,
        originalPrice: quarterlyIfMonthly,
        currency: 'RUB',
        duration: 'quarter',
        discount: quarterlySavingsPercentage,
        monthlyEquivalent: quarterlyMonthlyEquivalent,
        savingsPercentage: quarterlySavingsPercentage,
      } as PaywallProduct,
      {
        id: 'yearly',
        name: 'Год',
        description: yearlySavingsPercentage > 0
          ? `Экономия ${yearlySavingsPercentage}% против помесячки • ~${Math.round(yearlyMonthlyEquivalent / 100)}₽/месяц`
          : `~${Math.round(yearlyMonthlyEquivalent / 100)}₽/месяц`,
        price: pricing.yearlyPrice,
        originalPrice: yearlyIfMonthly,
        currency: 'RUB',
        duration: 'year',
        discount: yearlySavingsPercentage,
        monthlyEquivalent: yearlyMonthlyEquivalent,
        savingsPercentage: yearlySavingsPercentage,
      } as PaywallProduct,
    ];
  }

  // Методы для управления настройками
  async updateCohortPricing(cohortName: string, updates: Partial<CohortPricingDocument>) {
    // Очищаем кэш при обновлении
    this.settingsCache.clear();
    this.cacheTimestamp = 0;

    return await this.cohortPricingModel.findOneAndUpdate(
      { cohortName },
      { ...updates, updatedAt: new Date() },
      { upsert: true, new: true },
    );
  }

  async getAllCohortSettings() {
    return await this.cohortPricingModel.find({ isActive: true });
  }

  async clearCache() {
    this.settingsCache.clear();
    this.cacheTimestamp = 0;
  }
}
