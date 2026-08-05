import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // injectManifest (no generateSW): necesitamos nuestro propio src/sw.js con listeners de
      // "push"/"notificationclick" para las notificaciones reales — generateSW arma el service
      // worker automáticamente y no deja agregarle código propio.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      includeAssets: ['manifest-pantalla.webmanifest'],
      // Manifest principal: el panel de control (Canciones, Eventos, En vivo, Ajustes...). La pantalla
      // de proyección (?screen=publico) usa su propio manifest aparte (public/manifest-pantalla.webmanifest,
      // enlazado dinámicamente desde main.jsx) para poder instalarse como app independiente en un
      // dispositivo fijo junto al proyector que abre directo en la vista en vivo, sin pasar por el login.
      manifest: {
        name: 'JBP App',
        short_name: 'JBP App',
        description: 'Presentación y gestión para tu iglesia',
        lang: 'es',
        start_url: '/',
        // 'fullscreen' (no 'standalone'): que se quede fija en pantalla completa siempre al abrirla
        // instalada, sin ninguna barra del sistema — igual en Android y en iPhone (que además necesita
        // sus propias etiquetas <meta apple-mobile-web-app-*> en index.html, ya que ignora este manifest).
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
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
