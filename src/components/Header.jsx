import ShepherdStaffIcon from './ShepherdStaffIcon'

function Header() {
  return (
    <header className="relative overflow-hidden bg-navy text-white px-6 pt-6 pb-8 rounded-b-[32px] shadow-lg">
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
      <div className="absolute top-10 -right-16 w-24 h-24 rounded-full bg-orange/20" />
      <div className="absolute -bottom-10 -left-10 w-28 h-28 rounded-full bg-white/5" />

      <div className="relative flex items-center gap-3">
        <div className="bg-white/10 rounded-2xl p-2">
          <ShepherdStaffIcon className="w-7 h-7" color="#E8821E" />
        </div>
        <div>
          <h1 className="font-display text-xl font-semibold leading-tight">
            WorshipFlow
          </h1>
          <p className="text-sm text-white/70">Jesús El Buen Pastor</p>
        </div>
      </div>
    </header>
  )
}

export default Header
