import { useState } from 'react'
import Header from './components/Header'
import BottomNav from './components/BottomNav'
import Inicio from './pages/Inicio'
import Canciones from './pages/Canciones'
import Eventos from './pages/Eventos'
import Ministerios from './pages/Ministerios'
import Musico from './pages/Musico'
import EnVivo from './pages/EnVivo'
import Proyeccion from './pages/Proyeccion'
import Ajustes from './pages/Ajustes'

const PAGES = {
  inicio: Inicio,
  canciones: Canciones,
  eventos: Eventos,
  grupos: Ministerios,
  musico: Musico,
  envivo: EnVivo,
  ajustes: Ajustes,
}

function App() {
  const [tab, setTab] = useState('inicio')
  const [showProyeccion, setShowProyeccion] = useState(false)

  if (showProyeccion) {
    return <Proyeccion onClose={() => setShowProyeccion(false)} />
  }

  const Page = PAGES[tab]

  return (
    <div className="min-h-screen bg-bg font-sans">
      <Header />
      <main className="max-w-md mx-auto pb-28">
        <Page onPreviewProyeccion={() => setShowProyeccion(true)} />
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}

export default App
