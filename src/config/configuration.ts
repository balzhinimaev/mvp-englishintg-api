import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  uri: string;
  dbName: string;
}

export interface AuthConfig {
  jwtSecret: string;
  telegramBotToken: string;
}

export interface PaymentConfig {
  yookassaMode?: 'test' | 'production';
  yookassaShopId?: string;
  yookassaSecretKey?: string;
  yookassaTestShopId?: string;
  yookassaTestSecretKey?: string;
  yookassaApiUrl: string;
  selfEmployedInn?: string;
}

export interface BotApiConfig {
  url?: string;
  key?: string;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  database: DatabaseConfig;
  auth: AuthConfig;
  payment: PaymentConfig;
  botApi: BotApiConfig;
}

export default registerAs('app', (): AppConfig => ({
  port: parseInt(process.env.PORT || '7777', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    uri: process.env.MONGODB_URI || '',
    dbName: process.env.MONGODB_DB_NAME || 'burlang-db',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || '',
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  },
  payment: {
    yookassaMode: (process.env.YOOKASSA_MODE as 'test' | 'production') || 'production',
    yookassaShopId: process.env.YOOKASSA_SHOP_ID || '',
    yookassaSecretKey: process.env.YOOKASSA_SECRET_KEY || '',
    yookassaTestShopId: process.env.YOOKASSA_TEST_SHOP_ID || '',
    yookassaTestSecretKey: process.env.YOOKASSA_TEST_SECRET_KEY || '',
    yookassaApiUrl: process.env.YOOKASSA_API_URL || 'https://api.yookassa.ru/v3',
    selfEmployedInn: process.env.SELF_EMPLOYED_INN,
  },
  botApi: {
    url: process.env.BOT_API_URL,
    key: process.env.BOT_API_KEY,
  },
}));

