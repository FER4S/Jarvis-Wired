/**
 * Generates public/models/ai-core.glb — run: npm run generate:ai-core
 */
import { Blob } from 'buffer'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

globalThis.Blob ??= Blob
globalThis.FileReader = class FileReader {
  result = null
  onload = null
  onloadend = null
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer
      this.onload?.({ target: this })
      this.onloadend?.({ target: this })
    })
  }
}

const THREE = await import('three')
const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/models')
const OUT_FILE = join(OUT_DIR, 'ai-core.glb')

function applyCutout(geometry) {
  const pos = geometry.attributes.position
  const index = geometry.index
  if (!index) return geometry

  const keep = []
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i)
    const b = index.getX(i + 1)
    const c = index.getX(i + 2)
    const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3
    const cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3
    const cy = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3

    const inCutoutZone = cx > 0.2 && cz > -0.2 && cy > -0.5 && cy < 0.5
    if (!inCutoutZone) {
      keep.push(a, b, c)
      continue
    }
    // Single vertical tear — cleaner gash, not random holes
    const tearCenter = 0.38
    const tearHalfWidth = 0.07 + Math.abs(Math.sin(cy * 4.5)) * 0.025
    if (Math.abs(cz - tearCenter) < tearHalfWidth) continue
    keep.push(a, b, c)
  }

  const g = geometry.clone()
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(keep), 1))
  return g
}

function buildScene() {
  const scene = new THREE.Scene()
  scene.name = 'AiCore'

  const shellGeo = applyCutout(new THREE.SphereGeometry(1.15, 64, 48))
  const shell = new THREE.Mesh(
    shellGeo,
    new THREE.MeshStandardMaterial({
      name: 'ShellMaterial',
      color: 0x8b2252,
      metalness: 0.92,
      roughness: 0.28
    })
  )
  shell.name = 'Shell'
  scene.add(shell)

  const innerShell = new THREE.Mesh(
    new THREE.SphereGeometry(1.02, 48, 36),
    new THREE.MeshStandardMaterial({
      name: 'InnerShellMaterial',
      color: 0x3d1528,
      metalness: 0.85,
      roughness: 0.35,
      side: THREE.BackSide
    })
  )
  innerShell.name = 'InnerShell'
  scene.add(innerShell)

  const ringMat = new THREE.MeshStandardMaterial({
    name: 'RingMaterial',
    color: 0xc8863a,
    metalness: 0.95,
    roughness: 0.22
  })

  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.045, 16, 64), ringMat)
  ring1.name = 'Ring_01'
  ring1.rotation.x = Math.PI / 2.4
  scene.add(ring1)

  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.035, 16, 64), ringMat)
  ring2.name = 'Ring_02'
  ring2.rotation.x = Math.PI / 3.2
  ring2.rotation.z = Math.PI / 5
  scene.add(ring2)

  const ring3 = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.028, 12, 48), ringMat)
  ring3.name = 'Ring_03'
  ring3.rotation.x = Math.PI / 2
  ring3.rotation.y = Math.PI / 4
  scene.add(ring3)

  const beamMat = new THREE.MeshStandardMaterial({
    name: 'BeamMaterial',
    color: 0xb87333,
    metalness: 0.9,
    roughness: 0.25
  })
  for (let i = 0; i < 4; i++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.7, 0.04), beamMat)
    beam.name = `Beam_0${i + 1}`
    const angle = (i / 4) * Math.PI * 2
    beam.position.set(Math.cos(angle) * 0.22, 0, Math.sin(angle) * 0.22)
    scene.add(beam)
  }

  const coreMat = new THREE.MeshStandardMaterial({
    name: 'CoreMaterial',
    color: 0xff1493,
    emissive: 0xff1493,
    emissiveIntensity: 2.5,
    metalness: 0.2,
    roughness: 0.4
  })
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.12), coreMat)
  core.name = 'Core'
  scene.add(core)

  for (let i = 0; i < 5; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 0.04), coreMat)
    bar.name = `CoreBar_0${i + 1}`
    bar.position.y = -0.2 + i * 0.1
    scene.add(bar)
  }

  return scene
}

const scene = buildScene()
const exporter = new GLTFExporter()
const result = await exporter.parseAsync(scene, { binary: true })
mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT_FILE, Buffer.from(result))
console.log(`Wrote ${OUT_FILE} (${result.byteLength} bytes)`)
