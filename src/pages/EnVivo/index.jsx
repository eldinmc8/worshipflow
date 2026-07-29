function EnVivo({ onPreviewProyeccion }) {
  return (
    <div className="p-4 space-y-4">
      <h2 className="font-display text-2xl text-navy font-semibold">Multimedia en vivo</h2>

      <div className="bg-white rounded-2xl shadow-md p-5">
        <p className="text-sm text-navy/60 mb-3">Servicio Dominical · Diapositiva 3 de 12</p>
        <button
          type="button"
          className="w-full bg-danger text-white text-sm font-semibold py-3 rounded-full shadow-md mb-2"
        >
          Iniciar transmisión
        </button>
        <button
          type="button"
          onClick={onPreviewProyeccion}
          className="w-full bg-bg text-navy text-sm font-medium py-3 rounded-full"
        >
          Ver proyección
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-md p-5">
        <p className="text-xs uppercase tracking-wide text-navy/50 font-medium mb-2">Estilo en vivo</p>
        <div className="flex gap-2">
          {['bg-navy', 'bg-teal', 'bg-blue', 'bg-indigo', 'bg-orchid'].map((c) => (
            <div key={c} className={`w-8 h-8 rounded-full ${c}`} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default EnVivo
