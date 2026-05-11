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

async function bootstrap() {
  console.log('[Bootstrap] NODE_ENV:', process.env.NODE_ENV);
  console.log('[Bootstrap] REDIS_URL length:', process.env.REDIS_URL?.length || 0);
  console.log('[Bootstrap] REDIS_URL partial:', process.env.REDIS_URL ? process.env.REDIS_URL.substring(0, 15) + '...' : 'NONE');

  const app = await NestFactory.create(AppModule);

  // ── 1. SECURITY HEADERS (HELMET) ──
  const helmet = (await import('helmet')).default;
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // Managed by Vercel/Frontend if needed
  }));

  // ── 2. INDUSTRIAL CORS CONFIGURATION ──
  const { getCorsConfig } = await import('./common/config/cors.config');
  app.enableCors(getCorsConfig());

  // ── 3. COOKIE PARSING ──
  app.use(cookieParser());

  app.setGlobalPrefix('api', { exclude: ['/'] });
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ 
    whitelist: true, 
    transform: true,
    stopAtFirstError: true,
    exceptionFactory: (errors) => {
      const result = errors.map((error) => ({
        property: error.property,
        message: Object.values(error.constraints || {})[0],
      }));
      return new BadRequestException({
        message: result[0].message,
        error: 'VALIDATION_ERROR',
        details: result,
      });
    }
  }));

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
