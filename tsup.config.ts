import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/client/index.ts',
    'src/adapters/drizzle/index.ts',
    'src/adapters/drizzle/schema.ts',
    'src/adapters/mongodb/index.ts',
    'src/integrations/sveltekit.ts',
    'src/integrations/hono.ts'
  ],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['drizzle-orm', 'mongodb']
});
