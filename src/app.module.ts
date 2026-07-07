import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { EntitlementsModule } from './modules/entitlements/entitlements.module';
import { PromoModule } from './modules/promo/promo.module';
import { EventsModule } from './modules/events/events.module';
import { ContentModule } from './modules/content/content.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ProfileModule } from './modules/profile/profile.module';
import { LeadsModule } from './modules/leads/leads.module';
import { ProgressModule } from './modules/progress/progress.module';
import { PaywallModule } from './modules/paywall/paywall.module';
import { HandbookModule } from './modules/handbook/handbook.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { validationSchema } from './config/validation.schema';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    // Глобальный rate limiting: 300 запросов за 60с на IP (ключ по реальному IP —
    // в main.ts включён trust proxy, чтобы за nginx считать per-user, а не общий 127.0.0.1).
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 300 }]),
    ScheduleModule.forRoot(),
    MongooseModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>('app.database.uri');
        const dbName = configService.get<string>('app.database.dbName');
        
        // Log connection details (without credentials)
        if (uri) {
          const uriForLog = uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
          console.log(`🔌 Connecting to MongoDB: ${uriForLog}`);
          console.log(`📚 Database name: ${dbName}`);
        } else {
          console.error('❌ ERROR: MongoDB URI is empty!');
          console.error('   Please set MONGODB_URI or MONGO_URI environment variable');
        }
        
        const nodeEnv = configService.get<string>('app.nodeEnv') || 'development';
        const isDevelopment = nodeEnv === 'development';
        
        return {
          uri,
          dbName,
          // В development режиме используем прямое подключение без реплики
          ...(isDevelopment ? {
            directConnection: true,
          } : {
            // Options for replica set support (production/test)
            serverSelectionTimeoutMS: 10000, // 10 seconds timeout for server selection
            retryWrites: true, // Enable retryable writes (required for transactions)
            retryReads: true, // Enable retryable reads
          }),
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    PaymentsModule,
    EntitlementsModule,
    PromoModule,
    EventsModule,
    ContentModule,
    AnalyticsModule,
    ProfileModule,
    LeadsModule,
    ProgressModule,
    PaywallModule,
    HandbookModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}


