# WorshipFlow — Contexto del proyecto

App de presentación y gestión para iglesias (competidor de OnStage/ProPresenter), construida por Eldin Mcfarlane.

## Stack
- React + Vite + Supabase + Vercel (mismo stack que Omega App)
- Mobile-first siempre
- PWA instalable
- `@vitejs/plugin-legacy`: se publica además una copia para navegadores viejos de Smart TV (página `/tv`); no quitarlo

## Identidad visual
- **Colores de marca** (tomados del logo real de la iglesia "Jesús El Buen Pastor"):
  - Azul marino: `#16324F` (header, nav, textos oscuros)
  - Naranja: `#E8821E` (acento principal, CTAs, activo)
  - Fondo general claro: `#F4F6FA`, tarjetas blancas `#FFFFFF`
  - Acentos secundarios: teal `#1F8A73` (acordes), azul `#2F5FA8` (versículos), índigo `#5661B3` (bloques), orquídea `#B15EA0` (slides), rojo `#C23B32` (en vivo/peligro)
- **Tipografía** (rediseño de estilo, 2026-11-11): Inter para TODO el chrome — títulos y texto — vía `var(--wf-font-titulo)` / `var(--wf-font-ui)` en `index.css`; JetBrains Mono para acordes/código. Fraunces y Poppins siguen cargadas solo para la proyección, letras animadas, cuenta regresiva, Modo Predicar, pantalla de TV y las fuentes de DISEÑO DE LAS LETRAS — no volver a usarlas en el chrome
- **Tarjetas**: sombra muy suave (`0 1px 3px rgba(22,50,79,0.08)`), sin bordes duros, `border-radius` generoso (12-20px)
- **Navegación**: barra flotante inferior tipo isla redondeada (NO sidebar como OnStage) — pestaña activa se convierte en burbuja naranja
- **Regla de oro**: TODO el chrome de la app es claro/cálido, EXCEPTO la pantalla de Proyección real y sus mini-previews, que se mantienen oscuras (estilo escenario) porque así se ve bien un proyector en una iglesia con luces bajas
- Header con borde inferior curvo (no rectángulo recto), SIN círculos decorativos (quitados en el rediseño de estilo). El logo de la iglesia (AppLogo) y el ícono de WorshipFlow no se cambian
- Ícono de marca: trazo simple de báculo de pastor (no micrófono)

## Módulos principales

**Canciones**: biblioteca con búsqueda y favoritos. Editor con 4 pestañas:
- Detalles (título, tempo, tonalidad, artista, temas)
- Contenido: letra con acordes inline `[Acorde]texto`, barra de acordes diatónicos de la tonalidad elegida (triadas y con séptima) que se insertan en el cursor, campo de "compases" por sección
- Letra: editor de diapositivas independiente del Contenido — cada sección puede dividirse en varias diapositivas con mini-preview oscura; esto es lo que realmente alimenta la proyección, no los acordes
- Estructura: orden de secciones con multiplicador (x1, x2...)
Buscar en internet (botón "Internet" de la biblioteca): busca en LaCuerda.net y trae letra + acordes para revisar y guardar. La página la trae la Edge Function `buscar-cancion-web` (solo ese sitio, solo con sesión) y la lee `src/lib/cancionesWeb.js`. Cifra Club y Letras.com bloquean lecturas automáticas: NO saltarse ese bloqueo — para esos sitios la app abre la búsqueda en otra pestaña y la letra se pega en Nueva canción → Escribir.
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
- **Barra de mando de la consola** (rediseño 2026-11-14, `barraDeMando` en `src/pantallas/envivo.jsx`): Anterior, Siguiente, Negro, Fijar, Inicio y Final SIEMPRE abajo, en cualquier pestaña; deja libre la esquina derecha para el botón redondo del menú. Ya NO existe "Vista sencilla / Más herramientas": las pestañas (Transmisión, Biblia, Estilo, Insertar) se ven siempre, la cinta no repite la navegación y Proyección / Pantallas y TV / Escenario viven en la barra de arriba. En el celular la consola no se muestra: se usa el Control remoto, con Anterior/Siguiente/Negro fijos abajo.
- **Pestaña Estilo de la consola** (rediseño 2026-11-14, `panelEstiloCompleto` en `src/pantallas/envivo.jsx`): un solo panel para computadora y celular con TODO a la vista (fondo, tipografía, tamaño, interlineado, espacio, color, alineación, posición, sombra). Nada de cuadros flotantes ni botones "Más": lo único que se despliega, dentro del mismo panel, son las bibliotecas (imagen, video, en movimiento, letra animada). Arriba, "Estás cambiando: Canciones y textos / Biblia".
- **Transiciones** (`src/lib/transiciones.js`, 2026-11-14): una para todo el culto (`liveStyle.transicion` + `transicionVel`, se elige en Estilo; por defecto "ninguna") y, si se quiere, una distinta por elemento del orden del culto (`liveStyle.transicionesItems[itemId]`, selector "Transición" arriba de sus diapositivas). Son del culto entero, no del estilo de Canciones ni de la Biblia. Es solo una entrada de lo nuevo (opacidad/movimiento, `@keyframes wfTrans*` en `index.css`) dentro de `CapaTransicion` en `ProjectionPanel`; la letra animada no la usa (trae su propio movimiento).
- Proyección es de solo lectura, ancla a una URL fija (no al evento) — siempre muestra lo que esté marcado "en vivo" en ese momento.
- **Control remoto desde el celular** (`src/lib/controlRemoto.js`, tabla `comandos_en_vivo`): el celular manda órdenes (siguiente, anterior, negro, ir a una parte, proyectar un versículo de la Biblia) y la computadora que transmite las ejecuta con su mismo "avanzar". La computadora las recibe por Realtime y, de respaldo, revisando la tabla cada 1.5 s (`suscribirComandos`). Multimedia: pantalla "Controlar diapositivas desde aquí" en Inicio. Predicador: botones "Pantalla" en el Modo Predicar, solo dentro de su bosquejo mientras está al aire (la RLS lo revisa con `wf_puedo_mandar_comando`). Nunca inicia ni termina la transmisión.
- Modo Músico: acordes + letra con auto-avance calculado por tempo (BPM) × compases de cada sección, con botón de "tap tempo" para recalibrar en vivo, y control manual siempre disponible como override.

**Ministerios**: espacios por equipo (Alabanza, Infantil, Jóvenes...) con planificación mensual editable por semana y recursos compartidos (título + enlace). Vinculables a bloques del Setlist (ver arriba).

**Botón atrás (teléfono/navegador)** — `src/lib/atras.js`: 1) si hay una ventana abierta, atrás la cierra (toda ventana nueva usa `useCerrarConAtras`; ModalShell ya lo trae); 2) si no, regresa a la pantalla anterior (cambiar de pestaña se apila, ya no salta a Inicio); 3) en la consola mientras ese equipo transmite, atrás no sale (`useBloquearAtras`). Todo oyente de `popstate` empieza con `if (esPopPropio()) return;` y todo `pushState` va dentro de `cuandoListo()`.

**Ajustes**: perfil, selector de rol del dispositivo (control de acceso), equipo, modo oscuro/notificaciones, cerrar sesión.
**Preparar para usar sin conexión** (Ajustes → Proyección, solo computadora; `src/components/PrepararSinConexion.jsx` + `src/lib/prepararSinConexion.js`, 2026-11-14): con Wi-Fi guarda canciones, eventos próximos, imágenes de fondo (caché `wf-imagenes` del service worker) y la Biblia, y muestra una lista de lo que quedó listo. Los videos de fondo NO se guardan (se avisa) y una pantalla en otro dispositivo sigue necesitando internet; la proyección al TV por HDMI en la misma computadora funciona sin internet.

## Modelo de datos (Supabase) — tablas principales a crear
- `canciones`, `secciones_cancion` (acordes), `diapositivas_letra` (lo que se proyecta), `estructura_cancion`
- `eventos`, `roles_evento`, `miembros_rol` (con estado confirmado/pendiente)
- `items_servicio` (setlist: tipo bloque/cancion/biblia/slide, orden, ministerio_id opcional)
- `ministerios`, `planificacion_ministerio`, `recursos_ministerio`
- `sesiones_en_vivo` (evento_id activo, slide_actual, estilo_en_vivo — la tabla clave para Supabase Realtime)
- Políticas RLS: solo miembros del rol "Multimedia" de un evento pueden escribir en `sesiones_en_vivo`

## Prototipo de referencia
Existe un prototipo funcional completo en React (un solo archivo, sin backend) con todas las pantallas y flujos ya validados visualmente. Úsalo como fuente de verdad para layout, copy en español, y comportamiento — no para arquitectura de producción (ese archivo no tiene backend real).