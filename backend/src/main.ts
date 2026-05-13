import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import cookieParser from 'cookie-parser';
import * as dns from 'dns';

// Fix for Node >= 17 IPv6 DNS resolution issues
dns.setDefaultResultOrder('ipv4first');

let cachedApp: any;
let isListening = false;

/**
 * CORE BOOTSTRAP LOGIC
 * Configures the NestJS application instance.
 * Shared between Local Dev (listen) and Vercel (handler).
 */
async function bootstrap() {
  if (cachedApp) return cachedApp;

  const startTime = Date.now();
  const env = process.env.NODE_ENV || 'development';
  const isServerless = !!process.env.VERCEL || !!process.env.NOW_REGION;

  console.log(`\n🚀 [SYSTEM] Eranad MES Backend Initialization (PID: ${process.pid})`);
  console.log(`[SYSTEM] Mode: ${isServerless ? 'SERVERLESS' : 'LOCAL'}`);
  console.log(`[SYSTEM] Env: ${env}`);

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // 1. GLOBAL SETTINGS
  app.use(cookieParser());
  app.setGlobalPrefix('api', { exclude: ['/'] });

  // 2. SECURITY & CORS
  const helmet = (await import('helmet')).default;
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  }));

  const { getCorsConfig } = await import('./common/config/cors.config');
  app.enableCors(getCorsConfig());

  // 3. PIPES & FILTERS
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ 
    whitelist: true, 
    transform: true,
    stopAtFirstError: true,
  }));
  
  // 4. SWAGGER (Non-Prod)
  if (env !== 'production') {
    const { SwaggerModule, DocumentBuilder } = await import('@nestjs/swagger');
    const config = new DocumentBuilder()
      .setTitle('Ernad MES API')
      .setDescription('Industrial Production & Terminal Control')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.init();
  
  const duration = Date.now() - startTime;
  console.log(`✅ [SYSTEM] Application READY (${duration}ms)`);
  
  cachedApp = app;
  return app;
}

/**
 * VERCEL SERVERLESS ENTRY POINT
 */
export default async (req: any, res: any) => {
  const app = await bootstrap();
  const instance = app.getHttpAdapter().getInstance();
  return instance(req, res);
};

/**
 * LOCAL DEVELOPMENT ENTRY POINT
 */
async function startLocal() {
  // CRITICAL: Prevent execution in Serverless or if already listening
  if (process.env.VERCEL || process.env.NOW_REGION) {
    return;
  }

  if (isListening) {
    console.warn('⚠️ [SYSTEM] already listening, skipping startLocal().');
    return;
  }

  try {
    const app = await bootstrap();
    const port = process.env.PORT || 4000;
    
    // Diagnostic: Audit routes
    const server = app.getHttpAdapter().getInstance();
    const registeredPaths = (server?._router?.stack || [])
      .filter((layer: any) => layer.route)
      .map((layer: any) => layer.route?.path);
    
    const hasTerminals = registeredPaths.some((p: string) => p.includes('terminals'));
    console.log(`📡 [DIAGNOSTIC] Routes: ${registeredPaths.length} | Terminals: ${hasTerminals ? 'ACTIVE' : 'MISSING'}`);

    await app.listen(port);
    isListening = true;
    console.log(`\n🔥 [LOCAL] BACKEND LIVE: http://localhost:${port}`);
    console.log(`📖 [LOCAL] SWAGGER: http://localhost:${port}/api/docs\n`);
  } catch (err: any) {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ [PORT_ERROR] Port ${process.env.PORT || 4000} is locked by PID ${process.pid} or another process.`);
      console.error(`💡 Suggestion: Run 'netstat -ano | findstr :${process.env.PORT || 4000}' and kill the PID.\n`);
      process.exit(1);
    }
    console.error('❌ [FATAL_STARTUP_ERROR]', err);
    process.exit(1);
  }
}

// Start local server
startLocal();
