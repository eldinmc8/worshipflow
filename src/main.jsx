import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/pwaInstall.js'
import { iniciarActualizacionAutomatica, aplicarActualizacion } from './lib/swUpdate.js'
import { iniciarTema } from './lib/theme.js'
import AuthGate from './AuthGate.jsx'
import PublicScreen from './PublicScreen.jsx'
import ToastHost from './ToastHost.jsx'

// La pantalla pública vive en su propia URL (?screen=publico) para poder instalarse
// como PWA independiente del panel de control del operador (útil para un dispositivo fijo junto
// al proyector que arranca directo en la pantalla en vivo). El panel de control (esta misma app,
// sin ese parámetro) usa el manifest principal — cada uno con su propio manifest.webmanifest para
// que "Instalar app" abra la pantalla correcta según desde dónde se instaló.
const isPublicScreen = new URLSearchParams(window.location.search).get('screen') === 'publico'
if (isPublicScreen) {
  const link = document.querySelector('link[rel="manifest"]')
  if (link) link.setAttribute('href', '/manifest-pantalla.webmanifest')
} else {
  // Antes de que React monte nada — así no hay parpadeo de claro-y-luego-oscuro si ya se había
  // elegido oscuro antes. La pantalla de Proyección real nunca aplica esto: siempre se ve oscura.
  iniciarTema()
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
        <div style={{ position: 'fixed', left: 0, right: 0, top: 0, zIndex: 10000, background: '#16324F', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 10, padding: '10px 16px', fontFamily: "'Poppins', sans-serif", fontSize: 13, fontWeight: 600, boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}>
          <span>Hay una nueva actualización disponible</span>
          <button
            onClick={() => aplicarActualizacion()}
            style={{ background: '#E8821E', color: '#16233A', border: 'none', borderRadius: 20, padding: '6px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Actualizar
          </button>
        </div>
      )}
      {isPublicScreen ? <PublicScreen /> : <AuthGate />}
      <ToastHost />
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
