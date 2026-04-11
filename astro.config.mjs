import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  output: 'hybrid',
  adapter: netlify(),
  integrations: [tailwind()],
  site: 'https://auhu.asia',
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
