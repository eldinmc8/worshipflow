import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['manifest-pantalla.webmanifest'],
      // Manifest principal: el panel de control (Canciones, Eventos, En vivo, Ajustes...). La pantalla
      // de proyección (?screen=publico) usa su propio manifest aparte (public/manifest-pantalla.webmanifest,
      // enlazado dinámicamente desde main.jsx) para poder instalarse como app independiente en un
      // dispositivo fijo junto al proyector que abre directo en la vista en vivo, sin pasar por el login.
      manifest: {
        name: 'WorshipFlow',
        short_name: 'WorshipFlow',
        description: 'Presentación y gestión para tu iglesia',
        lang: 'es',
        start_url: '/',
        display: 'standalone',
        background_color: '#F4F6FA',
        theme_color: '#16324F',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
      },
    }),
  ],
})
