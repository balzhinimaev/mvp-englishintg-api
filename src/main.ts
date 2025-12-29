import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// Swagger is optional in local dev; load dynamically to avoid hard dependency during lint

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: true });
  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 7777);
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger документация
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

  await app.listen(port);
  console.log(`🚀 Сервер запущен на порту ${port}`);
}

bootstrap();


