const ministerios = [
  { nombre: 'Alabanza', color: 'bg-orange', integrantes: 9 },
  { nombre: 'Infantil', color: 'bg-teal', integrantes: 6 },
  { nombre: 'Jóvenes', color: 'bg-indigo', integrantes: 14 },
  { nombre: 'Multimedia', color: 'bg-orchid', integrantes: 4 },
]

function Ministerios() {
  return (
    <div className="p-4 space-y-4">
      <h2 className="font-display text-2xl text-navy font-semibold">Grupos</h2>

      <div className="grid grid-cols-2 gap-3">
        {ministerios.map((m) => (
          <div key={m.nombre} className="bg-white rounded-2xl shadow-md p-4">
            <div className={`w-8 h-8 rounded-full ${m.color} mb-2`} />
            <h3 className="text-navy font-semibold text-sm">{m.nombre}</h3>
            <p className="text-xs text-navy/50">{m.integrantes} integrantes</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Ministerios
