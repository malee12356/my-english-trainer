import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __APP_VERSION__: '"test"', __BUILD_TIME__: '"test"' },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['tests/unit/setup.ts'],
  },
});
