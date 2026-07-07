import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Lead, LeadDocument } from '../common/schemas/lead.schema';
import { PublicGuard } from '../common/guards/public.guard';
import { BotStartLeadDto } from './dto/bot-start.dto';

@Controller('leads')
export class LeadsController {
  constructor(@InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>) {}

  @Post('bot_start')
  @UseGuards(PublicGuard)
  // Публичный эндпоинт без auth — ужесточённый лимит против спама лидами
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async botStart(@Body() body: BotStartLeadDto) {
    const { utm, promoId } = body;
    // В схеме Lead userId хранится строкой — приводим явно
    const userId = String(body.userId);
    const utmPlain: Record<string, string> = {};
    if (utm) {
      for (const [k, v] of Object.entries(utm)) {
        if (typeof v === 'string') utmPlain[k] = v;
      }
    }
    if (Object.keys(utmPlain).length) {
      await this.leadModel.updateOne(
        { userId },
        {
          $setOnInsert: { userId, firstUtm: utmPlain, botStartedAt: new Date() },
          $set: { lastUtm: utmPlain, ...(promoId ? { promoId } : {}) },
        },
        { upsert: true },
      );
    } else {
      await this.leadModel.updateOne(
        { userId },
        { $setOnInsert: { userId, botStartedAt: new Date() }, ...(promoId ? { $set: { promoId } } : {}) },
        { upsert: true },
      );
    }
    return { ok: true };
  }
}
