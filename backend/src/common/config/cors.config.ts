import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { Logger } from '@nestjs/common';

const logger = new Logger('CORS_CONFIG');

export const getCorsConfig = (env: string = process.env.NODE_ENV || 'development'): CorsOptions => {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:4173',
    'https://ernad.vercel.app',
    'https://ernad-mes.vercel.app',
    // Add regex for Vercel preview deployments
    /\.vercel\.app$/,
  ];

  // Load additional origins from ENV
  const extraOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  allowedOrigins.push(...extraOrigins.filter(o => o.trim().length > 0));

  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) {
        return callback(null, true);
      }

      const isAllowed = allowedOrigins.some(pattern => {
        if (pattern instanceof RegExp) {
          return pattern.test(origin);
        }
        return pattern === origin;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        logger.error(`[CORS_REJECTED] Origin not allowed: ${origin}`);
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
      'X-HTTP-Method-Override',
      'x-mes-request-id',
      'x-vercel-protection-skip',
      'x-api-key',
      'Cache-Control',
      'Pragma',
      'onesignal-id',
      'onesignal-token',
      'onesignal-external-user-id',
      'x-onesignal-app-id',
      'x-onesignal-user-id',
      'x-onesignal-agent',
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range', 'x-mes-request-id', 'Content-Disposition'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  };
};
