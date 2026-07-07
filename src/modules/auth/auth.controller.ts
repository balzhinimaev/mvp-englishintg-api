import { Controller, Get, Query, Param, Post, Body, Headers, UseGuards } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../common/schemas/user.schema';
import { PublicGuard } from '../common/guards/public.guard';
import { VerifyInitDataDto } from './dto/verify-init-data.dto';

class RegisterDto {
  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;

  @IsString()
  @MinLength(6, { message: 'Пароль минимум 6 символов' })
  @MaxLength(100)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  firstName?: string;
}

class LoginDto {
  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

class TokenDto {
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  token!: string;
}

class ForgotPasswordDto {
  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;
}

class ResetPasswordDto {
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  token!: string;

  @IsString()
  @MinLength(6, { message: 'Пароль минимум 6 символов' })
  @MaxLength(100)
  password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /** Верификация Telegram initData (тело POST — initData одной строкой). */
  @Post('verify')
  @UseGuards(PublicGuard)
  async verifyPost(
    @Body() dto: VerifyInitDataDto,
  ): Promise<{
    userId: string;
    isFirstOpen: boolean;
    utm?: Record<string, string>;
    onboardingCompleted: boolean;
    englishLevel?: 'A0' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
    learningGoals?: string[];
    accessToken: string;
  }> {
    const params = new URLSearchParams(dto.initData);
    return this.authService.verifyTelegramInitData(params);
  }

  /**
   * @deprecated initData в query-строке светится в логах/прокси.
   * Используйте POST /auth/verify с телом { initData }. Будет удалён в следующей фазе.
   */
  @Get('verify')
  @UseGuards(PublicGuard)
  @ApiOperation({
    summary: 'DEPRECATED: используйте POST /auth/verify (initData в теле запроса)',
    deprecated: true,
  })
  async verify(
    @Query() query: Record<string, string>,
  ): Promise<{
    userId: string;
    isFirstOpen: boolean;
    utm?: Record<string, string>;
    onboardingCompleted: boolean;
    englishLevel?: 'A0' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
    learningGoals?: string[];
    accessToken: string;
  }> {
    const params = new URLSearchParams(query as any);
    return this.authService.verifyTelegramInitData(params);
  }

  /** Достаёт userId из необязательного Bearer-токена; невалидный/отсутствующий токен — null. */
  private async userIdFromBearer(authHeader?: string): Promise<string | null> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    try {
      const payload = await this.jwtService.verifyAsync<{ userId?: string }>(authHeader.slice(7));
      return payload?.userId ? String(payload.userId) : null;
    } catch {
      return null;
    }
  }

  /**
   * Публичный статус онбординга. Фронт зовёт его БЕЗ токена (interceptor помечает
   * /auth/onboarding/status как public), поэтому эндпоинт нельзя закрыть JwtAuthGuard.
   * Минимизация утечки: без валидного JWT отдаём только булевы флаги;
   * уровень/цели — только владельцу (JWT с тем же userId).
   */
  @Get('onboarding/status/:userId')
  @UseGuards(PublicGuard)
  async getOnboardingStatus(
    @Param('userId') userId: string,
    @Headers('authorization') authorization?: string,
  ) {
    const user = await this.userModel.findOne({ userId: String(userId) }).lean();
    const onboardingCompleted = Boolean(user?.onboardingCompletedAt);
    const base = {
      onboardingCompleted,
      onboardingRequired: !onboardingCompleted,
    };

    const tokenUserId = await this.userIdFromBearer(authorization);
    if (tokenUserId !== null && tokenUserId === String(userId)) {
      return {
        ...base,
        englishLevel: user?.englishLevel || null,
        learningGoals: user?.learningGoals || [],
      };
    }
    return base;
  }

  /** Регистрация по email/паролю (веб-версия). */
  @Post('register')
  @UseGuards(PublicGuard)
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  async register(@Body() dto: RegisterDto) {
    return this.authService.registerEmail(dto.email, dto.password, dto.firstName);
  }

  /** Вход по email/паролю. */
  @Post('login')
  @UseGuards(PublicGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(@Body() dto: LoginDto) {
    return this.authService.loginEmail(dto.email, dto.password);
  }

  /** Подтверждение email по ссылке из письма. */
  @Post('verify-email')
  @UseGuards(PublicGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async verifyEmail(@Body() dto: TokenDto) {
    return this.authService.verifyEmail(dto.token);
  }

  /** Повторная отправка письма подтверждения (нужен Bearer-токен). */
  @Post('resend-verification')
  @UseGuards(PublicGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async resendVerification(@Headers('authorization') authHeader?: string) {
    const userId = await this.userIdFromBearer(authHeader);
    if (!userId) return { sent: false };
    return this.authService.resendVerification(userId);
  }

  /** Запрос сброса пароля: всегда 200 (анти-enumeration). */
  @Post('forgot-password')
  @UseGuards(PublicGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  /** Установка нового пароля по токену из письма. */
  @Post('reset-password')
  @UseGuards(PublicGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }
}


