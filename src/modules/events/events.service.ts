import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppEvent, EventDocument } from '../common/schemas/event.schema';

@Injectable()
export class EventsService {
  constructor(@InjectModel(AppEvent.name) private readonly eventModel: Model<EventDocument>) {}

  async track(userId: number | string, name: string, properties?: Record<string, any>) {
    // name валидируется DTO контроллера (@Matches/@MaxLength); тип в схеме — исторический union
    await this.eventModel.create({ userId, name: name as AppEvent['name'], properties, ts: new Date() });
  }
}


