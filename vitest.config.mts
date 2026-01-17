import path from 'path';
import {fileURLToPath} from 'url';

import {defineConfig} from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/effect/**/*.ts'],
      exclude: [
        'src/lib/effect/client-*.ts',
        'src/lib/effect/admin.service.ts',
        'src/lib/effect/card.service.ts',
        'src/lib/effect/export.service.ts',
        'src/lib/effect/qr.service.ts',
        'src/lib/effect/stats.service.ts',
        'src/lib/effect/errors.ts',
        'src/lib/effect/schemas.ts',
        'src/lib/effect/layers.ts',
        '**/*.d.ts',
      ],
      thresholds: {
        // Core business logic services have strict thresholds
        'src/lib/effect/membership.service.ts': {
          lines: 95,
          functions: 100,
          statements: 95,
        },
        'src/lib/effect/portal.service.ts': {
          lines: 95,
          functions: 100,
          statements: 95,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/src': path.resolve(__dirname, './src'),
    },
  },
});
