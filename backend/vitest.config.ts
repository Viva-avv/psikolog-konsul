import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Deterministic test env; dotenv does not override variables that are already set.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      JWT_ACCESS_SECRET: 'test-secret-that-is-at-least-32-characters-long',
      DATA_ENCRYPTION_KEYS: `1:${Buffer.alloc(32, 7).toString('base64')},2:${Buffer.alloc(32, 9).toString('base64')}`,
      DATA_ENCRYPTION_KEY_CURRENT: '2',
      IP_HASH_SALT: 'test-salt-123',
      POLICY_VERSION: 'test',
      MIDTRANS_SERVER_KEY: 'SB-Mid-server-TEST',
      // AI disabled so tests never reach a real model (even if Ollama runs locally).
      AI_PROVIDER: 'ollama',
      OLLAMA_BASE_URL: '',
      ANTHROPIC_API_KEY: '',
      DAILY_API_KEY: '',
    },
  },
});
