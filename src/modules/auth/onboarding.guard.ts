import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../common/schemas/user.schema';

/**
 * Помечает запрос флагами onboardingRequired/onboardingCompleted.
 * userId берётся ТОЛЬКО из req.user (JWT) — query/body/params не являются
 * доверенным источником идентичности. Guard должен стоять ПОСЛЕ JwtAuthGuard.
 */
@Injectable()
export class OnboardingGuard implements CanActivate {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;

    if (!userId) {
      // Guard применён без JwtAuthGuard — это ошибка конфигурации, не пропускаем
      throw new UnauthorizedException('Authentication required');
    }

    const user = await this.userModel.findOne({ userId: String(userId) }).lean();

    if (!user) {
      // Если пользователь не найден, пропускаем (авторизация обработает это)
      return true;
    }

    // Проверяем, заполнил ли пользователь анкету
    const hasCompletedOnboarding = Boolean(user.onboardingCompletedAt);

    if (!hasCompletedOnboarding) {
      // Вместо блокировки доступа, добавляем информацию в запрос
      // чтобы контроллер мог обработать это соответствующим образом
      request.onboardingRequired = true;
      request.onboardingCompleted = false;
      return true;
    }

    request.onboardingRequired = false;
    request.onboardingCompleted = true;
    return true;
  }
}
