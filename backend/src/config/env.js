'use strict';
/**
 * Environment configuration, validated once at boot with Zod.
 * Nothing else in the application reads process.env directly.
 */
const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

const NODE_ENV = process.env.NODE_ENV || 'development';
// .env.<env> first, then .env (never committed). Tests use .env.test.
dotenv.config({ path: path.resolve(__dirname, `../../.env.${NODE_ENV}`) });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : ['1', 'true', 'yes'].includes(String(v).toLowerCase())));

const csv = z
  .string()
  .default('')
  .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean));

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(5001),
    APP_NAME: z.string().default('smaart-emr-api'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    TRUST_PROXY: bool.default(false),

    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
    MONGODB_DB_NAME: z.string().optional(),
    MONGODB_POOL_MIN: z.coerce.number().int().min(0).default(2),
    MONGODB_POOL_MAX: z.coerce.number().int().min(1).default(20),

    REDIS_URL: z.string().optional(),
    REDIS_REQUIRED: bool.default(false),

    RABBITMQ_URL: z.string().optional(),
    RABBITMQ_REQUIRED: bool.default(false),
    RABBITMQ_EXCHANGE: z.string().default('smaart.events'),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL: z.string().default('15m'),
    JWT_ISSUER: z.string().default('smaart-emr'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
    REFRESH_COOKIE_NAME: z.string().default('smaart_rt'),
    COOKIE_SECURE: bool.optional(),
    COOKIE_DOMAIN: z.string().optional(),

    AUTH_ALLOW_PASSWORD_ONLY_LOGIN: bool.optional(),
    OTP_LOGIN_TTL_MINUTES: z.coerce.number().int().positive().default(5),
    OTP_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(10),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

    CORS_ORIGINS: csv,
    BODY_LIMIT: z.string().default('1mb'),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(600),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
    FHIR_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),

    EMAIL_TRANSPORT: z.enum(['smtp', 'console', 'none']).default('none'),
    EMAIL_HOST: z.string().optional(),
    EMAIL_PORT: z.coerce.number().int().optional(),
    EMAIL_SECURE: bool.default(false),
    EMAIL_USER: z.string().optional(),
    EMAIL_PASS: z.string().optional(),
    EMAIL_FROM: z.string().default('SMAART Healthcare <no-reply@smaart.local>'),

    STORAGE_PROVIDER: z.enum(['cloudinary', 'local']).default('cloudinary'),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    CLOUDINARY_FOLDER: z.string().default('smaart-emr'),
    LOCAL_STORAGE_DIR: z.string().default('./storage'),
    DOCUMENT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(300),
    MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),

    FHIR_BASE_URL: z.string().default('http://localhost:5001/api/fhir/R4'),
    METRICS_ENABLED: bool.default(true),
    SWAGGER_ENABLED: bool.optional(),
  })
  .superRefine((env, ctx) => {
    const prod = env.NODE_ENV === 'production' || env.NODE_ENV === 'staging';
    if (prod) {
      if (env.CORS_ORIGINS.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['CORS_ORIGINS'], message: 'CORS_ORIGINS must be set in production' });
      }
      if (env.EMAIL_TRANSPORT !== 'smtp') {
        ctx.addIssue({ code: 'custom', path: ['EMAIL_TRANSPORT'], message: 'Production must use the smtp email transport' });
      }
      if (env.STORAGE_PROVIDER !== 'cloudinary') {
        ctx.addIssue({ code: 'custom', path: ['STORAGE_PROVIDER'], message: 'Production must use Cloudinary storage' });
      }
      if (!env.REDIS_URL) {
        ctx.addIssue({ code: 'custom', path: ['REDIS_URL'], message: 'REDIS_URL is required in production' });
      }
      if (!env.RABBITMQ_URL) {
        ctx.addIssue({ code: 'custom', path: ['RABBITMQ_URL'], message: 'RABBITMQ_URL is required in production' });
      }
      if (env.AUTH_ALLOW_PASSWORD_ONLY_LOGIN === true) {
        ctx.addIssue({ code: 'custom', path: ['AUTH_ALLOW_PASSWORD_ONLY_LOGIN'], message: 'Password-only login must be disabled in production' });
      }
    }
    if (env.STORAGE_PROVIDER === 'cloudinary' && prod) {
      for (const k of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
        if (!env[k]) ctx.addIssue({ code: 'custom', path: [k], message: `${k} is required for Cloudinary storage` });
      }
    }
    if (env.EMAIL_TRANSPORT === 'smtp') {
      for (const k of ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS']) {
        if (!env[k]) ctx.addIssue({ code: 'custom', path: [k], message: `${k} is required for smtp email transport` });
      }
    }
  });

function loadEnv(source = process.env) {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    const err = new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
    err.code = 'ENV_INVALID';
    throw err;
  }
  const env = parsed.data;
  const isProd = env.NODE_ENV === 'production' || env.NODE_ENV === 'staging';
  return Object.freeze({
    ...env,
    isProduction: isProd,
    isDevelopment: env.NODE_ENV === 'development',
    isTest: env.NODE_ENV === 'test',
    COOKIE_SECURE: env.COOKIE_SECURE ?? isProd,
    SWAGGER_ENABLED: env.SWAGGER_ENABLED ?? !isProd,
    AUTH_ALLOW_PASSWORD_ONLY_LOGIN: env.AUTH_ALLOW_PASSWORD_ONLY_LOGIN ?? !isProd,
  });
}

module.exports = { loadEnv, schema };
