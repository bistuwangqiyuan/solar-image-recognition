import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/serverless';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  output: 'hybrid',
  adapter: vercel({
    maxDuration: 60,
  }),
  integrations: [tailwind()],
  site: 'https://solarimagecs.vercel.app',
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'supabase': ['@supabase/supabase-js']
          }
        }
      }
    }
  },
  experimental: {
    contentCollectionCache: true
  },
  typescript: {
    strict: false
  }
});