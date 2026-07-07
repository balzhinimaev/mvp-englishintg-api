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

export interface MailConfig {
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from?: string;
  webappUrl: string;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  database: DatabaseConfig;
  auth: AuthConfig;
  payment: PaymentConfig;
  botApi: BotApiConfig;
  mail: MailConfig;
}

export default registerAs('app', (): AppConfig => {
  // Support both MONGODB_URI and MONGO_URI for compatibility
  let mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
  
  // Validate that at least one MongoDB URI is set
  if (!mongoUri) {
    const error = new Error(
      'MongoDB connection URI is required. Please set MONGODB_URI or MONGO_URI environment variable.'
    );
    console.error('❌ Configuration Error:', error.message);
    throw error;
  }
  
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isDevelopment = nodeEnv === 'development';
  
  // В development режиме подключаемся без реплики
  if (isDevelopment) {
    // Удаляем параметр replicaSet, если он есть
    mongoUri = mongoUri.replace(/[?&]replicaSet=[^&]*/g, '');
    // Удаляем лишние ? или & в конце, если они остались
    mongoUri = mongoUri.replace(/[?&]$/, '');
    console.log(`🔧 Development mode: подключение к MongoDB без реплики`);
  } else {
    // directConnection=true (single-node RS) несовместим с параметром replicaSet —
    // при directConnection драйвер и так поддерживает транзакции, реплику не добавляем.
    const hasDirectConnection = /[?&]directConnection=true/i.test(mongoUri);
    if (hasDirectConnection) {
      console.log('🔧 directConnection=true: single-node replica set, параметр replicaSet не добавляем');
    } else {
      // В production/test режиме добавляем replicaSet, если его нет
      const replicaSetName = process.env.MONGODB_REPLICA_SET || 'rs0';
      const hasReplicaSet = mongoUri.includes('replicaSet=');

      if (!hasReplicaSet) {
        // Add replicaSet parameter if not present
        const separator = mongoUri.includes('?') ? '&' : '?';
        mongoUri = `${mongoUri}${separator}replicaSet=${replicaSetName}`;
        console.log(`🔧 Added replicaSet=${replicaSetName} parameter to MongoDB URI (required for replica set mode)`);
      }
    }
  }
  
  // Log connection info (without credentials)
  const uriForLog = mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  console.log(`📦 MongoDB URI configured: ${uriForLog}`);
  
  return {
    port: parseInt(process.env.PORT || '7777', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    database: {
      uri: mongoUri,
      dbName: process.env.MONGODB_DB_NAME || 'englishintg',
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
    mail: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465', 10),
      secure: process.env.SMTP_SECURE !== 'false',
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.MAIL_FROM,
      webappUrl: process.env.WEBAPP_URL || 'https://englishintg.ru/webapp/',
    },
  };
});

