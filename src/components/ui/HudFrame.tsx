import type { ReactNode } from 'react'

export function HudFrame({ children }: { children: ReactNode }) {
  return (
    <div className="hud-frame relative flex h-full w-full flex-1 min-h-0 overflow-hidden">
      <div className="hud-frame-corner hud-frame-tl" />
      <div className="hud-frame-corner hud-frame-tr" />
      <div className="hud-frame-corner hud-frame-bl" />
      <div className="hud-frame-corner hud-frame-br" />
      <div className="hud-frame-edge hud-frame-top" />
      <div className="hud-frame-edge hud-frame-bottom" />
      <div className="hud-frame-edge hud-frame-left" />
      <div className="hud-frame-edge hud-frame-right" />
      {children}
    </div>
  )
}
