import { Star } from 'lucide-react'

const canciones = [
  { titulo: 'Grande y Poderoso', artista: 'Miel San Marcos', tono: 'G', favorito: true },
  { titulo: 'Renuévame', artista: 'Marcos Witt', tono: 'D', favorito: false },
  { titulo: 'Tu Fidelidad', artista: 'Christine D’Clario', tono: 'A', favorito: true },
  { titulo: 'Océanos', artista: 'Hillsong United', tono: 'E', favorito: false },
]

function Canciones() {
  return (
    <div className="p-4 space-y-4">
      <h2 className="font-display text-2xl text-navy font-semibold">Canciones</h2>

      <input
        type="text"
        placeholder="Buscar canción..."
        className="w-full rounded-full bg-white shadow-md px-4 py-2.5 text-sm text-navy placeholder:text-navy/40 outline-none"
      />

      <div className="space-y-3">
        {canciones.map((c) => (
          <div key={c.titulo} className="bg-white rounded-2xl shadow-md p-4 flex items-center justify-between">
            <div>
              <h3 className="text-navy font-semibold text-sm">{c.titulo}</h3>
              <p className="text-xs text-navy/50">{c.artista}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono bg-bg text-teal px-2 py-1 rounded-full">{c.tono}</span>
              <Star
                size={18}
                className={c.favorito ? 'fill-orange text-orange' : 'text-navy/20'}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Canciones
