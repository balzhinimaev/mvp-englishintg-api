import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiOkResponse, ApiTags } from '@nestjs/swagger';

@Controller('health')
@ApiTags('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Проверка работоспособности API' })
  @ApiOkResponse({ description: 'API работает', schema: { type: 'object', properties: { ok: { type: 'boolean', example: true } } } })
  ping(): { ok: boolean } {
    return { ok: true };
  }
}


