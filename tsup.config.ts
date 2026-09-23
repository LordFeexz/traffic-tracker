import { defineConfig } from 'tsup';
import { copyFileSync, mkdirSync } from 'fs';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/client/index.ts',
    'src/adapters/drizzle/index.ts',
    'src/adapters/drizzle/schema.ts',
    'src/adapters/mongodb/index.ts',
    'src/adapters/prisma-mongo/index.ts',
    'src/adapters/prisma-mongo/schema.ts',
    'src/integrations/sveltekit.ts',
    'src/integrations/hono.ts',
    'src/geo/cloudflare.ts',
    'src/geo/geoip-lite.ts',
    'src/realtime/redis.ts',
    'src/realtime/memory.ts'
  ],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['drizzle-orm', 'mongodb', 'geoip-lite', '@prisma/client'],
  onSuccess: async () => {
    mkdirSync('dist/adapters/prisma-mongo', { recursive: true });
    copyFileSync('src/adapters/prisma-mongo/schema.prisma', 'dist/adapters/prisma-mongo/schema.prisma');
  }
});
