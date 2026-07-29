function Proyeccion({ onClose }) {
  return (
    <div className="min-h-screen bg-[#0a0e14] text-white flex items-center justify-center p-8 relative">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 left-4 text-white/40 text-xs"
      >
        ← Volver
      </button>
      <p className="font-display text-4xl text-center leading-relaxed">
        Grande y poderoso<br />eres tú Señor
      </p>
    </div>
  )
}

export default Proyeccion
