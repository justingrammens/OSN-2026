import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include:     ['tests/unit/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider:   'v8',
      include:    ['src/**'],
      exclude:    ['src/index.ts'],
      thresholds: { statements: 90 },
    },
  },
});
