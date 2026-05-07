import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import cookieParser from 'cookie-parser';

import * as dns from 'dns';

// Fix for Node >= 17 IPv6 DNS resolution issues with Supabase Pooler
dns.setDefaultResultOrder('ipv4first');

process.on('unhandledRejection', (reason, promise) => {
  console.warn('[Process] Unhandled Rejection at:', promise, 'reason:', reason);
  // Do not exit, just log it. This prevents Redis connection failures from killing the app.
});
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    exposedHeaders: ['Content-Range', 'X-Content-Range', 'Authorization'],
    allowedHeaders: '*',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

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
