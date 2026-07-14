import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useRef, useMemo, useEffect } from 'react'
import type { Points, ShaderMaterial } from 'three'
import * as THREE from 'three'
import type { VoiceState } from '@/services/types'
import { useVoiceAmplitude } from '@/hooks/useVoiceAmplitude'
import { useVoiceState } from '@/hooks/useVoiceState'
import { useBackend } from '@/context/BackendContext'
import { useTheme } from '@/context/ThemeContext'

const SHELL_RADIUS = 1.18
const GRID_W = 112
const GRID_H = 80

function stateToUniform(state: VoiceState): number {
  switch (state) {
    case 'listening':
      return 1
    case 'processing':
      return 2
    case 'speaking':
      return 3
    default:
      return 0
  }
}

const shellVertexShader = /* glsl */ `
  attribute float aScatter;

  uniform float uTime;
  uniform float uAmplitude;
  uniform float uState;
  uniform float uContract;
  uniform float uWakePulse;
  uniform float uConnected;
  uniform float uPointSize;
  uniform float uPixelRatio;

  varying vec3 vColor;
  varying float vAlpha;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm4 = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm4.x; p1 *= norm4.y; p2 *= norm4.z; p3 *= norm4.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  vec3 gradientColor(float t) {
    vec3 bottom = vec3(1.0, 0.45, 0.05);
    vec3 midLow = vec3(0.95, 0.15, 0.55);
    vec3 mid = vec3(0.65, 0.08, 0.72);
    vec3 top = vec3(0.42, 0.05, 0.88);
    if (t < 0.30) return mix(bottom, midLow, t / 0.30);
    if (t < 0.58) return mix(midLow, mid, (t - 0.30) / 0.28);
    return mix(mid, top, (t - 0.58) / 0.42);
  }

  void main() {
    vec3 norm = normalize(normal);
    float speed = 0.10 + uAmplitude * 0.55 + uState * 0.04 + uWakePulse * 0.3;
    float t = uTime * speed;

    float wave = snoise(norm * 2.8 + vec3(t * 0.5, t, t * 0.35)) * 0.48
               + snoise(norm * 5.4 - vec3(t * 0.25, t * 0.45, 0.0)) * 0.26
               + snoise(norm * 10.5 + vec3(0.0, t * 0.18, t * 0.3)) * 0.11;

    float disp = 0.16 + uAmplitude * 0.14;
    if (uState > 0.5 && uState < 1.5) disp += 0.06 + uAmplitude * 0.1;
    if (uState > 1.5 && uState < 2.5) disp *= 0.65;
    if (uState > 2.5) disp += uAmplitude * 0.22;

    float shell = uContract + uWakePulse * 0.1;
    if (uState > 2.5) shell += uAmplitude * 0.08 * sin(uTime * 9.0 + aScatter * 12.0);

    vec3 core = position * shell;
    vec3 pos = core + norm * wave * disp;
    pos += norm * aScatter * 0.09 * (1.0 + uWakePulse);

    float heightT = clamp(normalize(pos).y * 0.5 + 0.5, 0.0, 1.0);
    vec3 baseColor = gradientColor(heightT);

    vec3 listenTint = vec3(0.15, 0.85, 0.35);
    vec3 processTint = vec3(0.05, 0.75, 0.85);
    vec3 speakTint = vec3(0.92, 0.15, 0.58);
    if (uState > 0.5 && uState < 1.5) baseColor = mix(baseColor, listenTint, 0.35 + uAmplitude * 0.25);
    if (uState > 1.5 && uState < 2.5) baseColor = mix(baseColor, processTint, 0.4 + sin(uTime * 6.0) * 0.15);
    if (uState > 2.5) baseColor = mix(baseColor, speakTint, 0.3 + uAmplitude * 0.35);

    baseColor *= mix(0.35, 1.0, uConnected);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    vec3 viewDir = normalize(-mvPosition.xyz);
    vec3 viewNorm = normalize(normalMatrix * norm);
    float rim = pow(1.0 - abs(dot(viewNorm, viewDir)), 2.2);

    float rimBoost = 1.0 + uWakePulse * 0.5 + uAmplitude * 0.35;
    vColor = baseColor * mix(0.22, 1.2 * rimBoost, rim);
    vAlpha = mix(0.1, 0.94, rim) * (0.72 + aScatter * 0.2 + uWakePulse * 0.2);
    vAlpha *= mix(0.4, 1.0, uConnected);

    float sizeBoost = 1.0 + uAmplitude * 0.35 + uWakePulse * 0.25;
    if (uState > 2.5) sizeBoost += uAmplitude * 0.4;

    float dist = length(mvPosition.xyz);
    gl_PointSize = max(0.5, uPointSize * sizeBoost * (160.0 / dist) / uPixelRatio);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const shellFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;

    float edge = step(d, 0.46) + smoothstep(0.46, 0.5, d) * 0.35;
    gl_FragColor = vec4(vColor, vAlpha * edge);
  }
`

function buildShellGeometry() {
  const source = new THREE.SphereGeometry(SHELL_RADIUS, GRID_W, GRID_H)
  source.computeVertexNormals()

  const count = source.attributes.position.count
  const positions = source.attributes.position.array as Float32Array
  const normals = source.attributes.normal!.array as Float32Array
  const scatter = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    scatter[i] = Math.random() < 0.03 ? Math.random() * 0.5 + 0.3 : 0
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals.slice(), 3))
  geometry.setAttribute('aScatter', new THREE.BufferAttribute(scatter, 1))
  source.dispose()
  return geometry
}

const CONTRACT_BY_STATE: Record<VoiceState, number> = {
  idle: 0.78,
  listening: 0.84,
  processing: 0.72,
  speaking: 0.8
}

const SPIN_BY_STATE: Record<VoiceState, number> = {
  idle: 0.018,
  listening: 0.055,
  processing: 0.09,
  speaking: 0.04
}

function DustSphere({
  amplitude,
  voiceState,
  connected
}: {
  amplitude: number
  voiceState: VoiceState
  connected: boolean
}) {
  const pointsRef = useRef<Points>(null)
  const matRef = useRef<ShaderMaterial>(null)
  const wakePulseRef = useRef(0)
  const prevStateRef = useRef<VoiceState>('idle')
  const { gl } = useThree()
  const geometry = useMemo(() => buildShellGeometry(), [])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmplitude: { value: 0 },
      uState: { value: 0 },
      uContract: { value: CONTRACT_BY_STATE.idle },
      uWakePulse: { value: 0 },
      uConnected: { value: 1 },
      uPointSize: { value: 0.09 },
      uPixelRatio: { value: 1 }
    }),
    []
  )

  useEffect(() => {
    if (prevStateRef.current === 'idle' && voiceState === 'listening') {
      wakePulseRef.current = 1
    }
    prevStateRef.current = voiceState
  }, [voiceState])

  useFrame((_, delta) => {
    wakePulseRef.current = THREE.MathUtils.lerp(wakePulseRef.current, 0, 0.06)

    if (matRef.current) {
      const mat = matRef.current
      mat.uniforms.uTime.value += delta
      mat.uniforms.uPixelRatio.value = gl.getPixelRatio()
      mat.uniforms.uAmplitude.value = THREE.MathUtils.lerp(
        mat.uniforms.uAmplitude.value,
        amplitude,
        0.18
      )
      mat.uniforms.uState.value = THREE.MathUtils.lerp(
        mat.uniforms.uState.value,
        stateToUniform(voiceState),
        0.14
      )
      mat.uniforms.uContract.value = THREE.MathUtils.lerp(
        mat.uniforms.uContract.value,
        CONTRACT_BY_STATE[voiceState],
        0.1
      )
      mat.uniforms.uWakePulse.value = wakePulseRef.current
      mat.uniforms.uConnected.value = THREE.MathUtils.lerp(
        mat.uniforms.uConnected.value,
        connected ? 1 : 0.25,
        0.08
      )
    }

    if (pointsRef.current) {
      const spin =
        SPIN_BY_STATE[voiceState] + amplitude * (voiceState === 'speaking' ? 0.18 : 0.1)
      pointsRef.current.rotation.y += delta * spin

      const breathe =
        voiceState === 'speaking'
          ? 1 + amplitude * 0.1 + Math.sin(Date.now() * 0.012) * 0.025
          : voiceState === 'processing'
            ? 0.94 + Math.sin(Date.now() * 0.02) * 0.03
            : voiceState === 'listening'
              ? 0.98 + amplitude * 0.06
              : 0.92 + Math.sin(Date.now() * 0.0015) * 0.015

      pointsRef.current.scale.setScalar(breathe + wakePulseRef.current * 0.08)
    }
  })

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={shellVertexShader}
        fragmentShader={shellFragmentShader}
        transparent
        depthWrite={true}
        depthTest={true}
        blending={THREE.NormalBlending}
      />
    </points>
  )
}

function Scene({
  amplitude,
  voiceState,
  connected,
  canvasBg
}: {
  amplitude: number
  voiceState: VoiceState
  connected: boolean
  canvasBg: string
}) {
  const autoRotateSpeed =
    voiceState === 'processing' ? 0.22 : voiceState === 'listening' ? 0.16 : 0.08 + amplitude * 0.12

  return (
    <>
      <color attach="background" args={[canvasBg]} />
      <DustSphere amplitude={amplitude} voiceState={voiceState} connected={connected} />
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={autoRotateSpeed} />
    </>
  )
}

const STATE_LABEL: Record<VoiceState, string> = {
  idle: 'Standby',
  listening: 'Listening',
  processing: 'Thinking',
  speaking: 'Speaking'
}

export function VoiceReactiveSphere() {
  const amplitude = useVoiceAmplitude()
  const voiceState = useVoiceState()
  const { connected } = useBackend()
  const { isLight } = useTheme()
  const canvasBg = isLight ? '#f3f4f8' : '#000000'

  return (
    <div
      className="relative flex-1 min-h-0 w-full"
      style={{ backgroundColor: 'var(--theme-canvas-bg)' }}
    >
      <div className="absolute inset-x-0 top-3 z-10 flex justify-center pointer-events-none">
        <span
          className={`font-mono text-[10px] font-bold tracking-widest uppercase px-3 py-1 border-2 border-black shadow-[3px_3px_0px_0px_black] ${
            !connected
              ? 'bg-rose-500 text-black'
              : voiceState === 'listening'
                ? 'bg-green-500 text-black'
                : voiceState === 'processing'
                  ? 'bg-cyan-500 text-black'
                  : voiceState === 'speaking'
                    ? 'bg-pink-500 text-white'
                    : 'bg-yellow-400 text-black'
          }`}
        >
          {connected ? STATE_LABEL[voiceState] : 'Offline'}
        </span>
      </div>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0.1, 5.4], fov: 38 }}
        className="absolute inset-0"
        style={{ width: '100%', height: '100%', display: 'block' }}
        gl={{ alpha: false, antialias: true }}
      >
        <Scene amplitude={amplitude} voiceState={voiceState} connected={connected} canvasBg={canvasBg} />
      </Canvas>
    </div>
  )
}
