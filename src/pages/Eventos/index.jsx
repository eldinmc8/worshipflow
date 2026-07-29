const eventos = [
  { nombre: 'Servicio Dominical', fecha: '14 jul · 10:00 am', confirmados: 8, total: 12 },
  { nombre: 'Ensayo General', fecha: '12 jul · 7:00 pm', confirmados: 5, total: 6 },
  { nombre: 'Noche de Jóvenes', fecha: '18 jul · 6:30 pm', confirmados: 3, total: 10 },
]

function Eventos() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl text-navy font-semibold">Eventos</h2>
        <button
          type="button"
          className="bg-orange text-white text-sm font-medium px-4 py-2 rounded-full shadow-md"
        >
          + Nuevo
        </button>
      </div>

      <div className="space-y-3">
        {eventos.map((e) => (
          <div key={e.nombre} className="bg-white rounded-2xl shadow-md p-4">
            <h3 className="text-navy font-semibold text-sm">{e.nombre}</h3>
            <p className="text-xs text-navy/50 mb-2">{e.fecha}</p>
            <div className="h-2 rounded-full bg-bg overflow-hidden">
              <div
                className="h-full bg-blue rounded-full"
                style={{ width: `${(e.confirmados / e.total) * 100}%` }}
              />
            </div>
            <p className="text-xs text-navy/50 mt-1">{e.confirmados} de {e.total} confirmados</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Eventos
