import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { OnboardingGuard } from './onboarding.guard';
import { AdminGuard } from './admin.guard';
import { JwtStrategy } from './jwt.strategy';
import { PublicGuard } from '../common/guards/public.guard';
import { User, UserSchema } from '../common/schemas/user.schema';
import { AppEvent, EventSchema } from '../common/schemas/event.schema';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MailModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: AppEvent.name, schema: EventSchema },
    ]),
    PassportModule,
    // registerAsync: секрет читаем на этапе инициализации модуля (после загрузки .env),
    // а не при импорте файла — иначе process.env.JWT_SECRET ещё пуст.
    JwtModule.registerAsync({
      useFactory: () => {
        const s = process.env.JWT_SECRET;
        if (!s || s.length < 32) {
          throw new Error('JWT_SECRET is not set or too short (min 32 chars)');
        }
        return {
          secret: s,
          signOptions: { expiresIn: '24h' },
        };
      },
    }),
  ],
  providers: [AuthService, OnboardingGuard, AdminGuard, JwtStrategy, PublicGuard],
  controllers: [AuthController],
  exports: [AuthService, OnboardingGuard, AdminGuard, PublicGuard, JwtModule],
})
export class AuthModule {}


