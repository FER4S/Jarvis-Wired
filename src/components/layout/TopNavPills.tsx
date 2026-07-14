interface TopNavPillsProps<T extends string> {
  tabs: readonly T[]
  active: T
  onChange: (tab: T) => void
}

export function TopNavPills<T extends string>({ tabs, active, onChange }: TopNavPillsProps<T>) {
  return (
    <nav className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-[var(--border)] bg-[rgba(7,11,18,0.3)]">
      <p className="text-[11px] text-[var(--text-meta)] hidden sm:block">
        Voice assistant dashboard
      </p>
      <div className="segmented-control no-drag mx-auto sm:mx-0">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            data-active={active === tab}
            onClick={() => onChange(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="hidden sm:block w-32" aria-hidden />
    </nav>
  )
}
