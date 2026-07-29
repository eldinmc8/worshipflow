import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/pwaInstall.js'
import AuthGate from './AuthGate.jsx'
import PublicScreen from './PublicScreen.jsx'

// La pantalla pública vive en su propia URL (?screen=publico) para poder instalarse
// como PWA independiente del panel de control del operador (útil para un dispositivo fijo junto
// al proyector que arranca directo en la pantalla en vivo). El panel de control (esta misma app,
// sin ese parámetro) usa el manifest principal — cada uno con su propio manifest.webmanifest para
// que "Instalar app" abra la pantalla correcta según desde dónde se instaló.
const isPublicScreen = new URLSearchParams(window.location.search).get('screen') === 'publico'
if (isPublicScreen) {
  const link = document.querySelector('link[rel="manifest"]')
  if (link) link.setAttribute('href', '/manifest-pantalla.webmanifest')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isPublicScreen ? <PublicScreen /> : <AuthGate />}
  </StrictMode>,
)
