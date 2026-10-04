import { defineConfig } from "vitest/config";

// Config aparte de vite.config.js a propósito: el plugin VitePWA (manifest, service worker) no pinta
// nada para pruebas de lib/ y solo agregaría trabajo de más a cada corrida de `npm test`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.js"],
    // Las pruebas de aislamiento entre iglesias (rls.test.js) levantan Postgres en memoria (PGlite) y
    // repasan TODAS las migraciones del repo -- tardan más que una prueba unitaria normal.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
