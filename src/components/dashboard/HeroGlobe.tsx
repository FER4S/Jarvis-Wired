import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useRef } from 'react'
import type { Mesh } from 'three'
import { GlassPanel } from '@/components/ui/GlassPanel'

function WireframeGlobe() {
  const globeRef = useRef<Mesh>(null)
  const innerRef = useRef<Mesh>(null)
  const ringRef = useRef<Mesh>(null)
  const ring2Ref = useRef<Mesh>(null)

  useFrame((_, delta) => {
    if (globeRef.current) globeRef.current.rotation.y += delta * 0.18
    if (innerRef.current) innerRef.current.rotation.y -= delta * 0.08
    if (ringRef.current) ringRef.current.rotation.z += delta * 0.12
    if (ring2Ref.current) ring2Ref.current.rotation.x += delta * 0.09
  })

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[5, 5, 5]} intensity={1.5} color="#00e5ff" />
      <pointLight position={[-5, -3, -5]} intensity={0.8} color="#b388ff" />
      <pointLight position={[0, -5, 2]} intensity={0.4} color="#00ff9d" />

      <mesh ref={innerRef}>
        <icosahedronGeometry args={[1.4, 2]} />
        <meshBasicMaterial color="#00e5ff" wireframe transparent opacity={0.15} />
      </mesh>

      <mesh ref={globeRef}>
        <icosahedronGeometry args={[1.85, 4]} />
        <meshBasicMaterial color="#00e5ff" wireframe transparent opacity={0.55} />
      </mesh>

      <mesh ref={ringRef} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[2.5, 0.015, 16, 120]} />
        <meshBasicMaterial color="#00e5ff" transparent opacity={0.85} />
      </mesh>

      <mesh ref={ring2Ref} rotation={[Math.PI / 2.2, 0.3, Math.PI / 4]}>
        <torusGeometry args={[3, 0.01, 16, 120]} />
        <meshBasicMaterial color="#b388ff" transparent opacity={0.45} />
      </mesh>

      {Array.from({ length: 48 }).map((_, i) => {
        const angle = (i / 48) * Math.PI * 2
        const r = 2.2 + (i % 5) * 0.22
        const y = Math.sin(i * 0.7) * 0.7
        return (
          <mesh key={i} position={[Math.cos(angle) * r, y, Math.sin(angle) * r]}>
            <sphereGeometry args={[0.02 + (i % 4) * 0.008, 6, 6]} />
            <meshBasicMaterial
              color={i % 3 === 0 ? '#b388ff' : '#00e5ff'}
              transparent
              opacity={0.5 + (i % 3) * 0.2}
            />
          </mesh>
        )
      })}

      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.3} />
    </>
  )
}

const orbitLabels = ['SYNC', 'CORE', 'NEURAL', 'LINK', 'DATA', 'AUX']

export function HeroGlobe() {
  return (
    <GlassPanel glow noPadding className="h-full" delay={0.1} panelId="SYS-CORE">
      <div className="absolute inset-0 grid-bg opacity-50" />
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-6 rounded-full border border-[var(--cyan-dim)] hero-pulse-ring opacity-40" />
        <div
          className="absolute inset-12 rounded-full border border-[var(--cyan)] hero-pulse-ring opacity-25"
          style={{ animationDelay: '0.8s' }}
        />
        <div
          className="absolute inset-20 rounded-full border border-[var(--purple)] hero-pulse-ring opacity-15"
          style={{ animationDelay: '1.6s' }}
        />
        <div className="absolute inset-0 scan-overlay opacity-60" />
        {orbitLabels.map((label, i) => (
          <div
            key={label}
            className="absolute font-mono-hud text-[7px] text-[var(--cyan)] opacity-40 tracking-widest"
            style={{
              top: `${20 + Math.sin((i / orbitLabels.length) * Math.PI * 2) * 35 + 35}%`,
              left: `${20 + Math.cos((i / orbitLabels.length) * Math.PI * 2) * 35 + 35}%`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="absolute inset-0">
        <Canvas camera={{ position: [0, 0, 6], fov: 48 }} style={{ width: '100%', height: '100%' }}>
          <WireframeGlobe />
        </Canvas>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
        <div className="relative">
          <h1 className="font-orbitron text-5xl font-black text-[var(--cyan-bright)] glow-text-cyan tracking-[0.35em]">
            JARVIS
          </h1>
          <div className="absolute -inset-4 rounded-full bg-[var(--cyan)] opacity-5 blur-2xl" />
        </div>
        <p className="font-orbitron text-sm tracking-[0.6em] text-[var(--text-secondary)] mt-3 opacity-80">
          AI CORE
        </p>
        <div className="flex items-center gap-3 mt-2">
          <span className="w-8 h-px bg-gradient-to-r from-transparent to-[var(--cyan)]" />
          <p className="font-mono-hud text-[11px] text-[var(--cyan)] opacity-80">v3.0.0</p>
          <span className="w-8 h-px bg-gradient-to-l from-transparent to-[var(--cyan)]" />
        </div>
        <p className="font-mono-hud text-[8px] text-[var(--text-meta)] mt-3 tracking-[0.3em] opacity-60">
          NEURAL INTERFACE ACTIVE
        </p>
      </div>
    </GlassPanel>
  )
}
