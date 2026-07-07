import { Body, Controller, Post, UseGuards, Request } from '@nestjs/common';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TrackEventDto } from './dto/track-event.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async ingest(@Body() body: TrackEventDto, @Request() req: any) {
    const userId = req.user?.userId; // userId — только из JWT, поле в теле игнорируем
    await this.eventsService.track(userId, body.name, body.properties);
    return { ok: true };
  }
}
