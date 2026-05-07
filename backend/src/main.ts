import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
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

async function bootstrap() {
  console.log('[Bootstrap] NODE_ENV:', process.env.NODE_ENV);
  console.log('[Bootstrap] REDIS_URL length:', process.env.REDIS_URL?.length || 0);
  console.log('[Bootstrap] REDIS_URL partial:', process.env.REDIS_URL ? process.env.REDIS_URL.substring(0, 15) + '...' : 'NONE');
  
  const app = await NestFactory.create(AppModule);

  // ── 1. GLOBAL CORS & DEBUG LOGGING (Absolute Priority) ──
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      console.log(`[CORS_MONITOR] Request from Origin: ${origin} | Method: ${req.method} | Path: ${req.url}`);
    }
    
    // Explicit OPTIONS preflight handling for production resilience
    if (req.method === 'OPTIONS') {
      res.header('Access-Control-Allow-Origin', origin || '*');
      res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With, x-mes-request-id');
      res.header('Access-Control-Allow-Credentials', 'true');
      return res.status(200).send();
    }
    next();
  });

  app.enableCors({
    origin: [
      'https://ernad.vercel.app',
      'https://www.ernad.vercel.app',
      'http://localhost:5173'
    ],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
      'x-mes-request-id',
    ],
  });

  app.use(cookieParser());

  app.setGlobalPrefix('api', { exclude: ['/'] });
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // AuthGuard will be registered as a global guard in app.module.ts for better DI support

  const { AuditInterceptor } = await import('./common/interceptors/audit.interceptor');
  app.useGlobalInterceptors(new AuditInterceptor());


  // Swagger Configuration
  const { SwaggerModule, DocumentBuilder } = await import('@nestjs/swagger');
  const config = new DocumentBuilder()
    .setTitle('Ernad MES API')
    .setDescription('Manufacturing Execution System API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customCssUrl: 'https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css',
    customJs: [
      'https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js',
      'https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-standalone-preset.js',
    ],
    customfavIcon: 'https://ernad-mes.vercel.app/favicon-32x32.png',
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`Backend is running on: http://localhost:${port}`);
  console.log(`Swagger documentation: http://localhost:${port}/api/docs`);
}
bootstrap();
// Reload trigger
