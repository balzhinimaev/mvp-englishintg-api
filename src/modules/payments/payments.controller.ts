import { Body, Controller, Headers, HttpCode, Post, Get, Query, UseGuards, Request, Req, Logger } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, IsObject } from 'class-validator';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import * as ipaddr from 'ipaddr.js';

/**
 * Уведомление YooKassa: { type: 'notification', event: 'payment.succeeded', object: {...} }.
 * Также поддерживается «direct»-формат (тесты/совместимость): { providerId, status?, event? }.
 * Намеренно НЕ строже: сервис берёт только providerId+eventType, деньги/статус
 * перепроверяются напрямую в YooKassa API.
 */
class YooKassaWebhookDto {
  @IsOptional()
  @IsString()
  type?: string; // 'notification'

  @IsOptional()
  @IsString()
  event?: string; // e.g., 'payment.succeeded'

  @IsOptional()
  @IsObject()
  object?: Record<string, any>; // full YooKassa payment object

  // «direct»-формат
  @IsOptional()
  @IsString()
  providerId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

class CreatePaymentDto {
  @IsString()
  @IsIn(['monthly', 'quarterly', 'yearly'])
  product!: 'monthly' | 'quarterly' | 'yearly';

  @IsString()
  returnUrl!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Check if IP address is in allowed range using ipaddr.js
   * Supports both IPv4 and IPv6 with proper CIDR notation
   */
  private isIPAllowed(clientIP: string, allowedRanges: string[]): boolean {
    if (clientIP === 'unknown') return false;
    
    // Handle forwarded IP (take first one if multiple)
    const cleanIP = clientIP.split(',')[0].trim();
    
    try {
      // Parse IP address
      const addr = ipaddr.process(cleanIP);
      
      for (const range of allowedRanges) {
        if (range.includes('/')) {
          // CIDR range
          const [network, prefixStr] = range.split('/');
          const prefix = parseInt(prefixStr);
          
          try {
            const networkAddr = ipaddr.process(network);
            
            // Check that IP types match (IPv4 with IPv4, IPv6 with IPv6)
            if (addr.kind() !== networkAddr.kind()) {
              continue;
            }
            
            // Check if IP is in range
            if (addr.match(networkAddr, prefix)) {
              this.logger.log(`✅ IP ${cleanIP} matches range ${range}`);
              return true;
            }
          } catch (error: any) {
            this.logger.warn(`Invalid network range: ${range} - ${error.message}`);
            continue;
          }
        } else {
          // Exact IP match
          try {
            const allowedAddr = ipaddr.process(range);
            if (addr.toString() === allowedAddr.toString()) {
              this.logger.log(`✅ IP ${cleanIP} exactly matches ${range}`);
              return true;
            }
          } catch (error: any) {
            this.logger.warn(`Invalid IP address: ${range} - ${error.message}`);
            continue;
          }
        }
      }
      
      this.logger.warn(`❌ IP ${cleanIP} not in allowed ranges`);
      return false;
      
    } catch (error: any) {
      this.logger.error(`Invalid client IP format: ${cleanIP} - ${error.message}`);
      return false;
    }
  }

  // Create payment endpoint
  @Post('create')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard) // 🔒 Require JWT authentication
  @ApiOperation({ summary: 'Create payment via YooKassa' })
  @ApiBody({ type: CreatePaymentDto })
  async createPayment(@Body() createPaymentDto: CreatePaymentDto, @Request() req: any) {
    const userId = req.user?.userId; // Get userId from JWT token
    return this.paymentsService.createPayment({ ...createPaymentDto, userId });
  }

  // Get payment status (только владелец платежа)
  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get payment status' })
  @ApiQuery({ name: 'paymentId', description: 'YooKassa payment ID' })
  async getPaymentStatus(@Query('paymentId') paymentId: string, @Request() req: any) {
    return this.paymentsService.getPaymentStatus(paymentId, req.user?.userId);
  }

  // Сверка платежа с YooKassa и выдача доступа, если оплачен (клиентский поллинг).
  // Не зависит от вебхука; идемпотентно; только владелец платежа.
  @Post('reconcile')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Verify payment with YooKassa and grant access if paid' })
  async reconcile(@Body() body: { paymentId: string }, @Request() req: any) {
    return this.paymentsService.reconcilePayment(req.user?.userId, body?.paymentId);
  }

  // Generic webhook endpoint; in MVP we trust provider authenticity via shared secret or IP allowlist (to add later)
  @Post('webhook/yookassa')
  @HttpCode(200)
  @ApiOperation({ summary: 'YooKassa webhook endpoint' })
  async yookassaWebhook(
    @Headers('idempotence-key') idempotenceKeyHeader: string | undefined,
    @Body() payload: YooKassaWebhookDto,
    @Req() req: any,
  ): Promise<{ ok: boolean }> {
    // PII-минимизация: НЕ логируем headers/body целиком — только тип события и id платежа
    const eventType = payload?.event || 'unknown';
    const objectId = payload?.object?.id || payload?.providerId || 'unknown';

    // req.ip — реальный IP клиента (в main.ts включён trust proxy за nginx);
    // заголовкам x-real-ip/x-forwarded-for из тела запроса напрямую не доверяем.
    const clientIP: string = req?.ip || 'unknown';

    // Check IP whitelist (YooKassa official IPs)
    const yookassaIPs = [
      '185.71.76.0/27',
      '185.71.77.0/27',
      '77.75.153.0/25',
      '77.75.156.11',
      '77.75.156.35',
      '77.75.154.128/25',
      '2a02:5180::/32'
    ];

    const isIPAllowed = this.isIPAllowed(clientIP, yookassaIPs);
    this.logger.log(
      `YooKassa webhook: event=${eventType}, object.id=${objectId}, ip=${clientIP}, ipAllowed=${isIPAllowed}`,
    );

    if (!isIPAllowed) {
      this.logger.error(`🚨 BLOCKED: Webhook from unauthorized IP: ${clientIP}`);
      return { ok: false };
    }

    return this.paymentsService.processYooKassaWebhook(payload, idempotenceKeyHeader);
  }
}


