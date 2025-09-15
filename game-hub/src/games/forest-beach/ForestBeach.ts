import * as THREE from 'three'
import { createRenderer, makeResizeHandler } from '../../lib/three/renderer'
import { WalkerController } from '../../lib/three/controller'
import type { GameInitArgs, GameInstance } from '../../features/GameHub/types'

export function initForestBeach({ canvas, overlay }: GameInitArgs): GameInstance {
  // --- Scene & camera ---
  const scene = new THREE.Scene()
  scene.background = null

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000)
  camera.position.set(8, 6, 10)

  // --- Renderer ---
  const renderer = createRenderer(canvas)

  // --- Lights ---
  const hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 1.0)
  scene.add(hemi)
  const dir = new THREE.DirectionalLight(0xffffff, 1.0)
  dir.position.set(5, 10, 4)
  scene.add(dir)

  // --- Ground halves (forest + sand) ---
  const ground = new THREE.Group()
  scene.add(ground)

  const forest = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: 0x2f5d3b }),
  )
  forest.rotation.x = -Math.PI / 2
  forest.position.set(-5, 0, 0)
  forest.scale.set(0.5, 1, 1)
  ground.add(forest)

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: 0xcab084 }),
  )
  sand.rotation.x = -Math.PI / 2
  sand.position.set(5, 0.001, 0)
  sand.scale.set(0.5, 1, 1)
  ground.add(sand)

  // --- Water strip ---
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 8, 32, 32),
    new THREE.MeshPhongMaterial({
      color: 0x3aa7e1,
      transparent: true,
      opacity: 0.9,
      shininess: 100,
    }),
  )
  water.rotation.x = -Math.PI / 2
  water.position.set(8.5, 0.002, 0)
  water.scale.set(0.25, 1, 1)
  ground.add(water)

  // --- Trees ---
  const trees = new THREE.Group()
  for (let i = 0; i < 80; i++) {
    const h = 0.8 + Math.random() * 1.6
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, h, 8),
      new THREE.MeshStandardMaterial({ color: 0x7a5230 }),
    )
    const foliage = new THREE.Mesh(
      new THREE.SphereGeometry(0.5 + Math.random() * 0.4, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x2e7d32 }),
    )
    const tx = -10 + Math.random() * 9.0
    const tz = -9 + Math.random() * 18
    trunk.position.set(tx, h / 2, tz)
    foliage.position.set(tx, h + 0.4, tz)
    trees.add(trunk, foliage)
  }
  scene.add(trees)

  // --- Player ---
  const player = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.3, 0.6, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xff6f61 }),
  )
  player.position.set(-2, 0.6, 0)
  scene.add(player)

  const controller = new WalkerController(player, camera)
  controller.attach()

  // --- Overlay UI (DOM) ---
  overlay.innerHTML = ''
  const panel = document.createElement('div')
  panel.style.position = 'absolute'
  panel.style.right = '12px'
  panel.style.bottom = '12px'
  panel.style.pointerEvents = 'auto'
  panel.style.background = 'rgba(0,0,0,.55)'
  panel.style.border = '1px solid rgba(255,255,255,.1)'
  panel.style.color = '#d4d8e0'
  panel.style.padding = '6px 10px'
  panel.style.borderRadius = '10px'
  panel.style.fontSize = '12px'
  panel.textContent = 'WASD / Arrow keys to move • Shift to sprint'
  overlay.appendChild(panel)

  // --- Loop state ---
  let raf = 0
  let running = false
  const clock = new THREE.Clock()
  const pos = (water.geometry as THREE.PlaneGeometry)
    .attributes.position as THREE.BufferAttribute

  // --- Update loop ---
  const tick = () => {
    const dt = clock.getDelta()
    const t = clock.getElapsedTime()

    // Water ripple
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const wave =
        Math.sin((x + t * 2.0) * 0.7) * Math.cos((y - t * 1.5) * 0.6) * 0.05
      pos.setZ(i, wave)
    }
    pos.needsUpdate = true

    if (running) controller.update(dt)

    renderer.render(scene, camera)
    raf = requestAnimationFrame(tick)
  }

  const removeResize = makeResizeHandler(
    renderer,
    camera as THREE.PerspectiveCamera,
    canvas,
  )
  tick()

  // --- API ---
  return {
    start() {
      running = true
    },
    pause() {
      running = false
    },
    isRunning() {
      return running
    },
    dispose() {
      cancelAnimationFrame(raf)
      removeResize()
      controller.detach()
      renderer.dispose()
      renderer.domElement?.parentElement?.removeChild(renderer.domElement)
      overlay.innerHTML = ''
      // Deep dispose
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        mesh.geometry?.dispose?.()
        const mat =
          mesh.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.())
        else mat?.dispose?.()
      })
    },
  }
}
