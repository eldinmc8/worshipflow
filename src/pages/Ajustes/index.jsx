const roles = ['Multimedia', 'Músico', 'Líder de alabanza', 'Miembro']

function Ajustes() {
  return (
    <div className="p-4 space-y-4">
      <h2 className="font-display text-2xl text-navy font-semibold">Ajustes</h2>

      <div className="bg-white rounded-2xl shadow-md p-5 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-orange/20 flex items-center justify-center text-orange font-display font-semibold">
          EM
        </div>
        <div>
          <p className="text-navy font-semibold text-sm">Eldin Mcfarlane</p>
          <p className="text-xs text-navy/50">eldinmc8@gmail.com</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-md p-5">
        <p className="text-xs uppercase tracking-wide text-navy/50 font-medium mb-3">Rol del dispositivo</p>
        <div className="flex flex-wrap gap-2">
          {roles.map((r, i) => (
            <span
              key={r}
              className={`text-xs font-medium px-3 py-1.5 rounded-full ${
                i === 0 ? 'bg-orange text-white' : 'bg-bg text-navy/60'
              }`}
            >
              {r}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Ajustes
