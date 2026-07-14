export function DashboardBackdrop() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 opacity-60"
      aria-hidden
      style={{
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
        `,
        backgroundSize: '32px 32px'
      }}
    />
  )
}
