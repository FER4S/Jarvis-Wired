import { Moon, Sun } from 'lucide-react'
import { BrutalPanel } from '@/components/ui/BrutalPanel'
import { useTheme } from '@/context/ThemeContext'
import type { ThemeMode } from '@/services/theme'

const modes: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon }
]

export function ThemeSettings() {
  const { theme, setTheme } = useTheme()

  return (
    <BrutalPanel panelId="THEME" title="Appearance" fillHeight={false}>
      <div className="flex flex-col gap-4">
        <p className="t-text-secondary font-sans text-sm leading-relaxed">
          Choose how Jarvis looks on this device. Your preference is saved locally.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {modes.map(({ id, label, icon: Icon }) => {
            const active = theme === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTheme(id)}
                className={`flex flex-col items-start gap-3 p-4 border-2 text-left transition-all ${
                  active
                    ? 't-theme-option-active'
                    : 't-theme-option'
                }`}
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center border-2 ${
                    active ? 't-theme-icon-active' : 't-theme-icon'
                  }`}
                >
                  <Icon size={18} strokeWidth={2.5} />
                </div>
                <div>
                  <p className="font-sans text-sm font-semibold">{label}</p>
                  <p className="font-mono text-[10px] uppercase mt-0.5 opacity-70">
                    {id === 'light' ? 'Clean workspace' : 'Low-light focus'}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        <div className="t-surface rounded-sm p-3 flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] uppercase t-text-muted">Active theme</span>
          <span className="font-mono text-xs font-bold uppercase t-text">{theme}</span>
        </div>
      </div>
    </BrutalPanel>
  )
}
