import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppEvent, EventDocument } from '../common/schemas/event.schema';
import { Payment, PaymentDocument } from '../common/schemas/payment.schema';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AnalyticsController {
  constructor(
    @InjectModel(AppEvent.name) private readonly eventModel: Model<EventDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
  ) {}

  @Get('funnel')
  async funnel(@Query('utm_source') utmSource?: string) {
    const match: any = {};
    if (utmSource) {
      Object.assign(match, {
        $or: [
          { 'properties.utm.utm_source': utmSource },
          { 'properties.utm_source': utmSource },
        ],
      });
    }

    const [openApp, startLesson, paywallView, purchaseSuccess] = await Promise.all([
      this.eventModel.countDocuments({ name: 'open_app', ...match }),
      this.eventModel.countDocuments({ name: 'start_lesson', ...match }),
      this.eventModel.countDocuments({ name: 'paywall_view', ...match }),
      this.eventModel.countDocuments({ name: 'purchase_success', ...match }),
    ]);
    return { openApp, startLesson, paywallView, purchaseSuccess };
  }

  @Get('revenue')
  async revenue(@Query('utm_source') utmSource?: string) {
    const match: any = { status: 'succeeded' };
    if (utmSource) {
      Object.assign(match, {
        $or: [
          { 'properties.utm.utm_source': utmSource },
          { 'properties.utm_source': utmSource },
        ],
      });
    }
    const payments = await this.paymentModel.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    const total = payments[0]?.total || 0;
    const count = payments[0]?.count || 0;
    return { totalRub: total / 100, count };
  }
}


