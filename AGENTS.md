# Instrucciones para agentes (Jules / Gemini / otros)

Lee primero **CLAUDE.md**: ahí está todo el contexto del producto, la identidad visual y las reglas. Lo de abajo son reglas de trabajo que aplican a cualquier agente.

## Cómo trabajar
- Responde y escribe todo (textos de la app, commits, PR) en **español**, sin tecnicismos innecesarios.
- Trabaja siempre en una rama nueva y abre un PR. **Nunca** hagas push directo a `main`.
- Cambios pequeños y enfocados: un PR = una cosa.
- Antes de abrir el PR corre: `npm ci`, `npx vitest run` (todas deben pasar) y `npm run build`.
- Si cambias comportamiento, agrega o ajusta pruebas en `src/__tests__` o `src/lib/__tests__`.
- Mobile-first siempre. Respeta la "regla de oro" de colores de CLAUDE.md.
- No quites `@vitejs/plugin-legacy` (la página `/tv` lo necesita).

## Base de datos (Supabase)
- Los cambios de estructura van como archivo nuevo en `supabase/migrations/` con fecha mayor a la última. **No se aplican solos**: indica en el PR el SQL que hay que correr a mano en el editor de Supabase.
- No borres ni edites migraciones viejas.
- Las pruebas de `src/lib/__tests__` levantan una base con todas las migraciones (pglite): si tu migración rompe una prueba, arréglala, no borres la prueba.
- Las funciones de `supabase/functions/` hay que desplegarlas aparte: dilo en el PR.

## Cobros (Paddle) — zona delicada
- No cambies precios, códigos `pri_`, tokens, `PAGOS_SOLO_SUPER_ADMIN`, ni la lógica de `supabase/functions/paddle-*` sin que el dueño lo pida explícitamente.
- Nunca escribas claves secretas en el código (API keys `pdl_`, secretos de webhook, service role de Supabase). Van en los secretos de Supabase.

## Lo que NO se hace
- No saltarse bloqueos de sitios (Cifra Club, Letras.com).
- No activar Captcha en Supabase Auth.
- No agregar librerías grandes sin justificarlo en el PR.
