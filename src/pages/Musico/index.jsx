const linea = [
  { acorde: 'G', texto: 'Grande y poderoso ' },
  { acorde: 'D', texto: 'eres tú Señor' },
]

function Musico() {
  return (
    <div className="p-4 space-y-4">
      <h2 className="font-display text-2xl text-navy font-semibold">Modo Músico</h2>

      <div className="bg-white rounded-2xl shadow-md p-5">
        <p className="text-xs uppercase tracking-wide text-navy/50 font-medium">Grande y Poderoso · Tono G</p>
        <p className="font-mono text-lg text-navy mt-3 leading-loose">
          {linea.map((l, i) => (
            <span key={i} className="mr-1">
              <span className="text-teal font-semibold align-top text-sm mr-0.5">{l.acorde}</span>
              {l.texto}
            </span>
          ))}
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-md p-4 flex items-center justify-between">
        <span className="text-sm text-navy/60">Tempo: 96 BPM</span>
        <button
          type="button"
          className="bg-navy text-white text-sm font-medium px-4 py-2 rounded-full shadow-md"
        >
          Tap tempo
        </button>
      </div>
    </div>
  )
}

export default Musico
