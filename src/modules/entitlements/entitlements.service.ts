import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Entitlement, EntitlementDocument } from '../common/schemas/entitlement.schema';

@Injectable()
export class EntitlementsService {
  constructor(
    @InjectModel(Entitlement.name) private readonly entitlementModel: Model<EntitlementDocument>,
  ) {}

  async getActiveEntitlement(userId: string): Promise<Entitlement | null> {
    const now = new Date();
    return this.entitlementModel.findOne({ userId, endsAt: { $gt: now } }).lean();
  }

  async getEntitlementByUserId(userId: string): Promise<Entitlement | null> {
    // Get the latest entitlement (active or expired) sorted by endsAt descending
    return this.entitlementModel
      .findOne({ userId })
      .sort({ endsAt: -1 })
      .lean();
  }
}


