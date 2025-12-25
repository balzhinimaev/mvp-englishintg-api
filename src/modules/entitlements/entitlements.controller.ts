import { Controller, Get, UseGuards, Request, Param } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';
import { OnboardingGuard } from '../auth/onboarding.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface EntitlementResponse {
  userId: number;
  endsAt: string;
  productId: string;
  status: 'active' | 'expired' | 'cancelled';
}

@Controller('entitlements')
export class EntitlementsController {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, OnboardingGuard)
  async get(@Request() req: any) {
    const userId = req.user?.userId; // Get userId from JWT token
    const ent = await this.entitlementsService.getActiveEntitlement(String(userId));
    return { entitlement: ent };
  }

  @Get(':userId')
  async getByUserId(@Param('userId') userId: string): Promise<EntitlementResponse | null> {
    const entitlement = await this.entitlementsService.getEntitlementByUserId(userId);
    
    if (!entitlement) {
      return null;
    }

    const now = new Date();
    const endsAt = new Date(entitlement.endsAt);
    const isActive = endsAt > now;

    // Map product to productId
    const productIdMap: Record<string, string> = {
      'monthly': 'monthly_subscription',
      'quarterly': 'quarterly_subscription',
      'yearly': 'yearly_subscription',
    };

    const productId = productIdMap[entitlement.product] || 'monthly_subscription';

    // Determine status
    const status: 'active' | 'expired' | 'cancelled' = isActive ? 'active' : 'expired';

    return {
      userId: Number(userId),
      endsAt: endsAt.toISOString(),
      productId,
      status,
    };
  }
}