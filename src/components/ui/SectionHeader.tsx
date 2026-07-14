interface SectionHeaderProps {
  title: string
  className?: string
}

export function SectionHeader({ title, className = '' }: SectionHeaderProps) {
  return (
    <div className={`mb-3 ${className}`}>
      <h3 className="font-orbitron hud-label text-[var(--cyan)] mb-2">{title}</h3>
      <div className="hud-divider" />
    </div>
  )
}
