import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import cookieParser from 'cookie-parser';
import * as dns from 'dns';

// Fix for Node >= 17 IPv6 DNS resolution issues with Supabase Pooler
dns.setDefaultResultOrder('ipv4first');

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  if (reason?.message?.includes('ECONNREFUSED') && reason?.message?.includes('6379')) {
    return; // Silence stray Redis noise
  }
  console.warn('[Process] Unhandled Rejection at:', promise, 'reason:', reason);
});

let cachedApp: any;

async function bootstrap() {
  if (cachedApp) return cachedApp;

  const startTime = Date.now();
  console.log('🚀 [STARTUP] NestJS Application Bootstrap Initiated...');
  console.log('[Bootstrap] NODE_ENV:', process.env.NODE_ENV);
  console.log('[Bootstrap] NODE_VERSION:', process.version);

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // ── 1. SECURITY & INFRASTRUCTURE ──
  console.log('🛡️ [STARTUP] Configuring Security (Helmet) & Infrastructure...');
  const helmet = (await import('helmet')).default;
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  }));

  // ── 2. CORS CONFIGURATION ──
  console.log('🌐 [STARTUP] Configuring Industrial CORS Fail-Safe...');
  const { getCorsConfig } = await import('./common/config/cors.config');
  app.enableCors(getCorsConfig());

  // ── 3. MIDDLEWARE & FILTERS ──
  console.log('🔌 [STARTUP] Registering Global Middleware, Filters & Pipes...');
  app.use(cookieParser());
  app.setGlobalPrefix('api', { exclude: ['/'] });
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ 
    whitelist: true, 
    transform: true,
    stopAtFirstError: true,
  }));

  const { AuditInterceptor } = await import('./common/interceptors/audit.interceptor');
  app.useGlobalInterceptors(new AuditInterceptor());

  // ── 4. DATABASE & MODULES INIT ──
  console.log('🗄️ [STARTUP] Initializing Internal Modules & Database Pools...');
  // Note: Drizzle and Redis initialize on demand or via their own onModuleInit
  
  // Swagger (only in non-prod or explicitly enabled)
  if (process.env.NODE_ENV !== 'production') {
    const { SwaggerModule, DocumentBuilder } = await import('@nestjs/swagger');
    const config = new DocumentBuilder()
      .setTitle('Ernad MES API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    console.log('📚 [STARTUP] Swagger Documentation enabled.');
  }

  console.log('⚡ [STARTUP] Executing app.init()...');
  await app.init();
  
  const duration = Date.now() - startTime;
  console.log(`✅ [STARTUP] NestJS Application READY in ${duration}ms`);
  
  cachedApp = app;
  return app;
}

// ── VERCEL SERVERLESS HANDLER ──
export default async (req: any, res: any) => {
  const app = await bootstrap();
  const instance = app.getHttpAdapter().getInstance();
  return instance(req, res);
};

// ── LOCAL DEVELOPMENT ──
if (process.env.NODE_ENV !== 'production') {
  bootstrap().then(async (app) => {
    const port = process.env.PORT || 4000;
    await app.listen(port);
    console.log(`Backend is running on: http://localhost:${port}`);
  }).catch(err => {
    console.error('❌ [CRITICAL_BOOTSTRAP_FAILURE]:', err);
    process.exit(1);
  });
}
