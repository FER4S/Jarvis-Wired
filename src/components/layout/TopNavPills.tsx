interface TopNavPillsProps<T extends string> {
  tabs: readonly T[]
  active: T
  onChange: (tab: T) => void
}

export function TopNavPills<T extends string>({ tabs, active, onChange }: TopNavPillsProps<T>) {
  return (
    <nav className="flex items-center gap-2 px-0 py-2 shrink-0 no-drag border-b border-white/5">
      {tabs.map((tab) => {
        const isActive = active === tab
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={
              isActive
                ? 'px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wide bg-amber-400 text-black border-2 border-black shadow-[2px_2px_0px_0px_black]'
                : 'px-3.5 py-1.5 font-mono text-[10px] font-medium uppercase tracking-wide text-slate-500 border-2 border-transparent hover:text-slate-200 hover:border-white/10 transition-colors'
            }
          >
            {tab}
          </button>
        )
      })}
    </nav>
  )
}
