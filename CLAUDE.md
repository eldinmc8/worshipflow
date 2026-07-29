# WorshipFlow — Contexto del proyecto

App de presentación y gestión para iglesias (competidor de OnStage/ProPresenter), construida por Eldin Mcfarlane.

## Stack
- React + Vite + Supabase + Vercel (mismo stack que Omega App)
- Mobile-first siempre
- PWA instalable

## Identidad visual
- **Colores de marca** (tomados del logo real de la iglesia "Jesús El Buen Pastor"):
  - Azul marino: `#16324F` (header, nav, textos oscuros)
  - Naranja: `#E8821E` (acento principal, CTAs, activo)
  - Fondo general claro: `#F4F6FA`, tarjetas blancas `#FFFFFF`
  - Acentos secundarios: teal `#1F8A73` (acordes), azul `#2F5FA8` (versículos), índigo `#5661B3` (bloques), orquídea `#B15EA0` (slides), rojo `#C23B32` (en vivo/peligro)
- **Tipografía**: Fraunces (serif, solo títulos grandes), Poppins (sans, todo el resto), JetBrains Mono (acordes/código)
- **Tarjetas**: sombra suave, sin bordes duros (`boxShadow`, no `border: 1px solid`), `border-radius` generoso (12-20px)
- **Navegación**: barra flotante inferior tipo isla redondeada (NO sidebar como OnStage) — pestaña activa se convierte en burbuja naranja
- **Regla de oro**: TODO el chrome de la app es claro/cálido, EXCEPTO la pantalla de Proyección real y sus mini-previews, que se mantienen oscuras (estilo escenario) porque así se ve bien un proyector en una iglesia con luces bajas
- Header con borde inferior curvo (no rectángulo recto), círculos decorativos translúcidos de fondo
- Ícono de marca: trazo simple de báculo de pastor (no micrófono)

## Módulos principales

**Canciones**: biblioteca con búsqueda y favoritos. Editor con 4 pestañas:
- Detalles (título, tempo, tonalidad, artista, temas)
- Contenido: letra con acordes inline `[Acorde]texto`, barra de acordes diatónicos de la tonalidad elegida (triadas y con séptima) que se insertan en el cursor, campo de "compases" por sección
- Letra: editor de diapositivas independiente del Contenido — cada sección puede dividirse en varias diapositivas con mini-preview oscura; esto es lo que realmente alimenta la proyección, no los acordes
- Estructura: orden de secciones con multiplicador (x1, x2...)
Vista de solo lectura separada del editor (pestañas V1/C/V2/V3 tipo pill, acordes arriba de la letra en fuente monoespaciada alineados por carácter).

**Eventos**: creación desde plantilla (clona roles y setlist de otro evento, reseteando confirmaciones) o en blanco. Cada evento tiene:
- Roles/Participantes con barra de progreso de confirmados, ícono y color por tipo de ministerio, subgrupos (ej. Limpieza tiene "Supervisión" y "Encargados")
- Setlist: mezcla de bloques organizativos (secciones del culto sin proyección), canciones, versículos bíblicos (con selector de versión: RVR1960, NVI, TLA, DHH, NTV) y slides personalizadas (color o video de fondo por URL)
- Los bloques del Setlist pueden vincularse a un Ministerio — al vincularse, la descripción se reemplaza automáticamente por el líder y la planificación de esa semana desde Ministerios

**Multimedia en vivo / Proyección / Modo Músico — separación crítica de roles**:
- Un dispositivo = un rol: "Multimedia" (controla), "Músico", "Líder de alabanza", "Miembro". Rol se elige en Ajustes.
- **Solo el rol Multimedia puede iniciar/finalizar la transmisión y cambiar estilo en vivo** — así ningún músico detiene la transmisión por accidente. Esto en producción es RLS de Supabase basado en membresía del rol "Multimedia" en `roles_evento`.
- Solo un evento puede estar "en vivo" a la vez (sesión en vivo única por iglesia).
- Multimedia ve letra plana (sin acordes) + riel de todas las diapositivas + botón "pantalla en negro" + panel de Estilo (temas de fondo + tipografía, aplicado en vivo sin interrumpir).
- Proyección es de solo lectura, ancla a una URL fija (no al evento) — siempre muestra lo que esté marcado "en vivo" en ese momento.
- Modo Músico: acordes + letra con auto-avance calculado por tempo (BPM) × compases de cada sección, con botón de "tap tempo" para recalibrar en vivo, y control manual siempre disponible como override.

**Ministerios**: espacios por equipo (Alabanza, Infantil, Jóvenes...) con planificación mensual editable por semana y recursos compartidos (título + enlace). Vinculables a bloques del Setlist (ver arriba).

**Ajustes**: perfil, selector de rol del dispositivo (control de acceso), equipo, modo oscuro/notificaciones, cerrar sesión.

## Modelo de datos (Supabase) — tablas principales a crear
- `canciones`, `secciones_cancion` (acordes), `diapositivas_letra` (lo que se proyecta), `estructura_cancion`
- `eventos`, `roles_evento`, `miembros_rol` (con estado confirmado/pendiente)
- `items_servicio` (setlist: tipo bloque/cancion/biblia/slide, orden, ministerio_id opcional)
- `ministerios`, `planificacion_ministerio`, `recursos_ministerio`
- `sesiones_en_vivo` (evento_id activo, slide_actual, estilo_en_vivo — la tabla clave para Supabase Realtime)
- Políticas RLS: solo miembros del rol "Multimedia" de un evento pueden escribir en `sesiones_en_vivo`

## Prototipo de referencia
Existe un prototipo funcional completo en React (un solo archivo, sin backend) con todas las pantallas y flujos ya validados visualmente. Úsalo como fuente de verdad para layout, copy en español, y comportamiento — no para arquitectura de producción (ese archivo no tiene backend real).