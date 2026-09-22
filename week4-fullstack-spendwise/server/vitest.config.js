import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false, // one in-memory MongoDB at a time
    env: { NODE_ENV: 'test', JWT_SECRET: 'test-secret-that-is-long-enough-for-tests', MONGODB_URI: '' },
  },
})
