import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// Swagger is optional in local dev; load dynamically to avoid hard dependency during lint

async function bootstrap(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';

  // CORS: в проде разрешаем только домен Mini App (при необходимости расширить через CORS_ORIGINS)
  const corsOrigins = (process.env.CORS_ORIGINS || 'https://englishintg.ru')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const app = await NestFactory.create(AppModule, {
    cors: isProduction
      ? { origin: corsOrigins, credentials: true }
      : true,
  });
  // За nginx (единственный доверенный прокси) — доверяем первому хопу,
  // чтобы req.ip = реальный IP клиента (нужно для rate limiting и логов).
  const httpAdapter = app.getHttpAdapter();
  const expressInstance = httpAdapter.getInstance();
  if (expressInstance && typeof expressInstance.set === 'function') {
    expressInstance.set('trust proxy', 1);
  }

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 7777);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger документация — только вне production (в проде карту API наружу не светим)
  if (!isProduction) {
    try {
      const { DocumentBuilder, SwaggerModule } = await import('@nestjs/swagger');
      const swaggerConfig = new DocumentBuilder()
        .setTitle('English API')
        .setVersion('2.0')
        .addBearerAuth()
        .build();
      const document = SwaggerModule.createDocument(app, swaggerConfig);
      SwaggerModule.setup('docs', app, document);
      console.log(`📚 Swagger документация доступна по адресу: http://localhost:${port}/docs`);
    } catch (e) {
      console.warn('⚠️  Swagger не установлен или произошла ошибка при инициализации:', e);
    }
  }

  await app.listen(port);
  console.log(`🚀 Сервер запущен на порту ${port}`);
}

bootstrap();


