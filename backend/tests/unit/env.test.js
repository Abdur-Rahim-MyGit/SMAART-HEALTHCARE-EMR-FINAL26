'use strict';
const { loadEnv } = require('../../src/config/env');

const base = { NODE_ENV: 'production', DATABASE_URL: 'postgres://x', JWT_SECRET: 'a'.repeat(40), CORS_ORIGINS: 'https://emr.example.com', EMAIL_TRANSPORT: 'smtp', EMAIL_HOST: 'h', EMAIL_PORT: '587', EMAIL_USER: 'u', EMAIL_PASS: 'p', STORAGE_PROVIDER: 'cloudinary', CLOUDINARY_CLOUD_NAME: 'c', CLOUDINARY_API_KEY: 'k', CLOUDINARY_API_SECRET: 's', MONGODB_URI: 'mongodb://m', REDIS_URL: 'redis://r', RABBITMQ_URL: 'amqp://q' };

describe('environment validation', () => {
  it('accepts a complete production configuration', () => {
    const env = loadEnv(base);
    expect(env.isProduction).toBe(true);
    expect(env.AUTH_ALLOW_PASSWORD_ONLY_LOGIN).toBe(false);
    expect(env.COOKIE_SECURE).toBe(true);
  });
  it('refuses insecure production settings', () => {
    expect(() => loadEnv({ ...base, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
    expect(() => loadEnv({ ...base, CORS_ORIGINS: '' })).toThrow(/CORS_ORIGINS/);
    expect(() => loadEnv({ ...base, EMAIL_TRANSPORT: 'console' })).toThrow(/smtp/);
    expect(() => loadEnv({ ...base, STORAGE_PROVIDER: 'local' })).toThrow(/Cloudinary/);
    expect(() => loadEnv({ ...base, AUTH_ALLOW_PASSWORD_ONLY_LOGIN: 'true' })).toThrow(/Password-only/);
    expect(() => loadEnv({ ...base, REDIS_URL: undefined })).toThrow(/REDIS_URL/);
  });
  it('allows a minimal development configuration', () => {
    const env = loadEnv({ NODE_ENV: 'development', DATABASE_URL: 'postgres://x', JWT_SECRET: 'a'.repeat(40) });
    expect(env.AUTH_ALLOW_PASSWORD_ONLY_LOGIN).toBe(true);
    expect(env.SWAGGER_ENABLED).toBe(true);
  });
});
