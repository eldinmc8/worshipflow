import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@supabase/supabase-js': path.resolve('demo/fakeSupabase.js'), 'virtual:pwa-register': path.resolve('demo/pwaStub.js') } },
  define: { 'import.meta.env.VITE_SUPABASE_URL': '"http://demo.local"', 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': '"demo"' },
  server: { port: 5199, strictPort: true, hmr: false },
})
