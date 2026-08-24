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
      // El script que este plugin inyecta solo cuando injectRegister queda en su valor por defecto
      // ('auto') es un registro "pelado" -- ni chequea updates activamente ni recarga la página cuando
      // encuentra una versión nueva, solo `navigator.serviceWorker.register(...)` y ya. Por eso, sesión
      // tras sesión, un cambio publicado no se veía hasta cerrar la app del todo y reabrirla: el service
      // worker viejo se quedaba corriendo indefinidamente porque nada le pedía revisar si había uno
      // nuevo. registerType:'autoUpdate' (abajo) solo define QUÉ HACER si se encuentra una versión
      // nueva -- no sirve de nada si nadie pregunta. injectRegister:false apaga ese script pelado; el
      // registro de verdad ahora vive en src/main.jsx, importando virtual:pwa-register a mano, con
      // chequeos activos periódicos (ver ahí el porqué).
      injectRegister: false,
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
        // 'standalone' (no 'fullscreen'): en iOS 16.4+ Safari SÍ respeta "fullscreen" del manifest, y ahí
        // esconde la barra de estado por completo pintando esa franja él mismo, fuera del viewport de la
        // página — un negro sólido que ningún CSS nuestro (ni env(safe-area-inset-top)) puede alcanzar,
        // porque no es parte del contenido, es chrome del sistema. "standalone" + el meta
        // apple-mobile-web-app-status-bar-style=black-translucent de abajo es el combo real y bien
        // soportado: la barra de estado queda transparente, nuestro propio header pinta detrás de ella
        // (ver el padding con env(safe-area-inset-top) en PrototipoWorshipFlow.jsx), y así si se puede
        // controlar de verdad. display_override manda primero que "display" en los navegadores que lo
        // soportan (Safari incluido), por eso también hay que reordenarlo aquí y no solo arriba.
        display: 'standalone',
        display_override: ['standalone', 'fullscreen'],
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
