const proximoEvento = {
  nombre: 'Servicio Dominical',
  fecha: 'Domingo 14 de julio · 10:00 am',
  confirmados: 8,
  total: 12,
}

const cancionesRecientes = [
  { titulo: 'Grande y Poderoso', tono: 'G' },
  { titulo: 'Renuévame', tono: 'D' },
  { titulo: 'Tu Fidelidad', tono: 'A' },
]

function Inicio() {
  return (
    <div className="p-4 space-y-4">
      <h2 className="font-display text-2xl text-navy font-semibold">Hola de nuevo 👋</h2>

      <div className="bg-white rounded-2xl shadow-md p-5 h-48 flex flex-col justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-navy/50 font-medium">Próximo evento</p>
          <h3 className="font-display text-lg text-navy font-semibold mt-1">{proximoEvento.nombre}</h3>
          <p className="text-sm text-navy/60">{proximoEvento.fecha}</p>
        </div>
        <div>
          <div className="h-2 rounded-full bg-bg overflow-hidden">
            <div
              className="h-full bg-orange rounded-full"
              style={{ width: `${(proximoEvento.confirmados / proximoEvento.total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-navy/50 mt-1">
            {proximoEvento.confirmados} de {proximoEvento.total} confirmados
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-md p-5 h-48 flex flex-col">
        <p className="text-xs uppercase tracking-wide text-navy/50 font-medium mb-3">Canciones recientes</p>
        <ul className="space-y-2 overflow-y-auto">
          {cancionesRecientes.map((c) => (
            <li key={c.titulo} className="flex items-center justify-between">
              <span className="text-navy font-medium text-sm">{c.titulo}</span>
              <span className="text-xs font-mono bg-bg text-teal px-2 py-1 rounded-full">{c.tono}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default Inicio
