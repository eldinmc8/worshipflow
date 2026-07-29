import { Home, Music, CalendarDays, Users, Guitar, Radio, Settings } from 'lucide-react'

const TABS = [
  { id: 'inicio', label: 'Inicio', icon: Home },
  { id: 'canciones', label: 'Canciones', icon: Music },
  { id: 'eventos', label: 'Eventos', icon: CalendarDays },
  { id: 'grupos', label: 'Grupos', icon: Users },
  { id: 'musico', label: 'Músico', icon: Guitar },
  { id: 'envivo', label: 'En vivo', icon: Radio },
  { id: 'ajustes', label: 'Ajustes', icon: Settings },
]

function BottomNav({ active, onChange }) {
  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-navy rounded-full shadow-xl px-2 py-2 flex items-center gap-1 max-w-[95vw] overflow-x-auto">
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              isActive
                ? 'bg-orange text-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Icon size={18} />
            <span className={isActive ? 'inline' : 'hidden sm:inline'}>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export default BottomNav
