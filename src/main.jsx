import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/pwaInstall.js'
import { iniciarActualizacionAutomatica, aplicarActualizacion, pausarActualizacion } from './lib/swUpdate.js'
import { iniciarTema } from './lib/theme.js'
import { iniciarPreferencias } from './lib/preferencias.js'
import AuthGate from './AuthGate.jsx'
import PublicScreen from './PublicScreen.jsx'
import PantallaEscenario from './PantallaEscenario.jsx'
import ConectarTv from './ConectarTv.jsx'
import { leerPantallaDeUrl, leerEscenarioDeUrl } from './lib/enlacePantalla.js'
import CrearIglesia from './CrearIglesia.jsx'
import { manifestDePantalla } from './lib/manifestPantalla.js'
import ToastHost from './ToastHost.jsx'
import ConfirmDialogHost from './ConfirmDialogHost.jsx'
import PlanesHost from './components/PlanesModal.jsx'
import ErrorPantalla from './ErrorPantalla.jsx'
import { iniciarMonitoreo } from './lib/monitoreo.js'

iniciarMonitoreo()

// La pantalla pública vive en su propia URL (?screen=publico) para poder instalarse
// como PWA independiente del panel de control del operador (útil para un dispositivo fijo junto
// al proyector que arranca directo en la pantalla en vivo). El panel de control (esta misma app,
// sin ese parámetro) usa el manifest principal — cada uno con su propio manifest.webmanifest para
// que "Instalar app" abra la pantalla correcta según desde dónde se instaló.
// También el enlace corto /p/<iglesia> (ver lib/enlacePantalla.js) para abrirla en otro equipo.
const isPublicScreen = !!leerPantallaDeUrl(window.location.pathname, window.location.search)
// Pantalla de escenario (stage display) para quienes están en la plataforma: /e/<iglesia>.
const isEscenario = !isPublicScreen && !!leerEscenarioDeUrl(window.location.pathname, window.location.search)
// Conectar TV con un número de 6 dígitos (Smart TV): /tv
const isConectarTv = /^\/tv\/?$/.test(window.location.pathname)
// Alta de una iglesia nueva (Fase 4) — su propia URL (?crear-iglesia), sin ningún enlace visible
// hacia ella desde el resto de la app (ver CrearIglesia.jsx para el porqué).
const isCrearIglesia = new URLSearchParams(window.location.search).has('crear-iglesia')
if (isPublicScreen || isEscenario || isConectarTv) {
  // Una pantalla de proyección/escenario nunca se recarga sola por una versión nueva (perdería la
  // pantalla completa en pleno culto): la toma la próxima vez que se abra. Ver pausarActualizacion.
  pausarActualizacion(true)
  const link = document.querySelector('link[rel="manifest"]')
  // Manifest armado aquí mismo (2026-11-02) para que "Agregar a inicio" / "Instalar" abra EXACTAMENTE
  // esta pantalla de esta iglesia (/p/<iglesia> o /e/<iglesia>). Con el archivo fijo, el ícono siempre
  // abría la proyección de la iglesia por defecto, aunque se hubiera agregado desde la de escenario.
  if (link) link.setAttribute('href', manifestDePantalla(isEscenario ? 'escenario' : 'proyeccion'))
} else {
  // Antes de que React monte nada — así no hay parpadeo de claro-y-luego-oscuro si ya se había
  // elegido oscuro antes. La pantalla de Proyección real nunca aplica esto: siempre se ve oscura.
  iniciarTema()
  // Tamaño de letra de este dispositivo (Ajustes → Apariencia). Nunca en la Proyección.
  iniciarPreferencias()
}

// Aviso de actualización VISIBLE apenas se detecta una versión nueva — antes esto solo vivía como un
// botón dentro de Ajustes ("Buscar actualizaciones"), que sirve para quien ya sabe que existe, pero no
// para quien nunca entra ahí o casi no abre la app: a esa gente había que plantarle el aviso enfrente,
// sin que tenga que ir a buscarlo. Este componente envuelve TODO (login incluido, no solo la app ya
// adentro) para que se vea sin importar en qué pantalla esté la persona cuando se detecta la
// actualización.
function App() {
  const [updateReady, setUpdateReady] = useState(false)
  useEffect(() => {
    iniciarActualizacionAutomatica(() => setUpdateReady(true))
  }, [])

  return (
    <>
      {updateReady && (
        <div style={{ position: 'fixed', left: 0, right: 0, top: 0, zIndex: 10000, background: 'var(--wf-brand-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 10, padding: '10px 16px', fontFamily: "'Poppins', sans-serif", fontSize: 13, fontWeight: 600, boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}>
          <span>Hay una nueva actualización disponible</span>
          <button
            onClick={() => aplicarActualizacion()}
            style={{ background: 'var(--wf-brand-accent)', color: '#16233A', border: 'none', borderRadius: 20, padding: '6px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Actualizar
          </button>
        </div>
      )}
      <ErrorPantalla>{isPublicScreen ? <PublicScreen /> : isEscenario ? <PantallaEscenario /> : isConectarTv ? <ConectarTv /> : isCrearIglesia ? <CrearIglesia /> : <AuthGate />}</ErrorPantalla>
      <ToastHost />
      <ConfirmDialogHost />
      {!isPublicScreen && !isEscenario && !isConectarTv && !isCrearIglesia && <PlanesHost />}
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
