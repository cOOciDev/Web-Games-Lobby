// =============================================
// File: src/games/star-field/StarField.ts
// =============================================
import * as THREE from 'three'
import { createRenderer, makeResizeHandler } from '../../lib/three/renderer'
import type { GameInitArgs, GameInstance } from '../../features/GameHub/types'
import { KeyInput } from '../../lib/input/keys'

export function initStarField({ canvas, overlay }: GameInitArgs): GameInstance {
  // Scene & camera
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000010)

  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 2000)
  camera.position.set(0, 0.8, 6)

  // Renderer
  const renderer = createRenderer(canvas)

  // Stars
  const N = 2000
  const positions = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 200
    positions[i * 3 + 1] = (Math.random() - 0.5) * 200
    positions[i * 3 + 2] = -Math.random() * 400
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const starMat = new THREE.PointsMaterial({ size: 0.6, color: 0xffffff })
  const stars = new THREE.Points(starGeo, starMat)
  scene.add(stars)

  // Player ship (simple cone)
  const ship = new THREE.Mesh(
    new THREE.ConeGeometry(0.4, 1.2, 16),
    new THREE.MeshStandardMaterial({ color: 0xffe08a, metalness: 0.2, roughness: 0.6 }),
  )
  ship.rotation.x = Math.PI / 2 // point forward
  ship.position.set(0, 0, 2.5)
  scene.add(ship)

  // Light for ship
  const amb = new THREE.AmbientLight(0xffffff, 0.5)
  const dir = new THREE.DirectionalLight(0xffffff, 0.7)
  dir.position.set(3, 5, 4)
  scene.add(amb, dir)

  // Input
  const keys = new KeyInput()
  keys.attach()

  // Overlay HUD
  overlay.innerHTML = ''
  const hud = document.createElement('div')
  hud.style.position = 'absolute'
  hud.style.left = '12px'
  hud.style.bottom = '12px'
  hud.style.pointerEvents = 'auto'
  hud.style.background = 'rgba(0,0,0,.55)'
  hud.style.border = '1px solid rgba(255,255,255,.1)'
  hud.style.color = '#d4d8e0'
  hud.style.padding = '6px 10px'
  hud.style.borderRadius = '10px'
  hud.style.fontSize = '12px'
  hud.textContent = '←/→/↑/↓ to steer • Space to accelerate'
  overlay.appendChild(hud)

  // Loop state
  let raf = 0
  let running = false
  const clock = new THREE.Clock()
  let speedZ = 18 // base forward speed

  // =============================================
  // Update loop
  // =============================================
  const tick = () => {
    const dt = clock.getDelta()
    const t = clock.getElapsedTime()

    // Controls (only change state while running)
    if (running) {
      const left = keys.pressed('arrowleft') || keys.pressed('a')
      const right = keys.pressed('arrowright') || keys.pressed('d')
      const up = keys.pressed('arrowup') || keys.pressed('w')
      const down = keys.pressed('arrowdown') || keys.pressed('s')
      const boosting = keys.pressed(' ') || keys.pressed('space')

      // steer velocity
      const steerX = (right ? 1 : 0) - (left ? 1 : 0)
      const steerY = (up ? 1 : 0) - (down ? 1 : 0)

      // ship bounds
      ship.position.x = THREE.MathUtils.clamp(ship.position.x + steerX * 6 * dt, -6, 6)
      ship.position.y = THREE.MathUtils.clamp(ship.position.y + steerY * 6 * dt, -4, 4)

      // bank/tilt for flair
      ship.rotation.z = THREE.MathUtils.lerp(ship.rotation.z, -steerX * 0.35, 0.2)

      // speed
      const targetSpeed = boosting ? 45 : 18
      speedZ = THREE.MathUtils.lerp(speedZ, targetSpeed, 0.05)
    }

    // Camera follow (soft)
    const camTarget = new THREE.Vector3(ship.position.x * 0.6, ship.position.y * 0.6 + 0.8, 6)
    camera.position.lerp(camTarget, 0.08)
    camera.lookAt(ship.position.x, ship.position.y, ship.position.z - 3)

    // Move stars towards camera & recycle behind
    const arr = stars.geometry.getAttribute('position').array as Float32Array
    for (let i = 2; i < arr.length; i += 3) {
      arr[i] += speedZ * dt
      if (arr[i] > 2) {
        arr[i] = -400
        // small randomization around current ship position
        arr[i - 2] = ship.position.x + (Math.random() - 0.5) * 40
        arr[i - 1] = ship.position.y + (Math.random() - 0.5) * 40
      }
    }
    stars.geometry.attributes.position.needsUpdate = true

    // Subtle twinkle by scaling size over time
    ;(stars.material as THREE.PointsMaterial).size = 0.6 + Math.sin(t * 2) * 0.08

    renderer.render(scene, camera)
    raf = requestAnimationFrame(tick)
  }

  const removeResize = makeResizeHandler(renderer, camera as THREE.PerspectiveCamera, canvas)
  tick()

  // API
  return {
    start() {
      running = true
      hud.textContent = 'Flying — ←/→/↑/↓ steer • Space boost'
    },
    pause() {
      running = false
      hud.textContent = 'Paused — press Play to continue'
    },
    isRunning() {
      return running
    },
    dispose() {
      cancelAnimationFrame(raf)
      removeResize()
      keys.detach()

      renderer.dispose()
      renderer.domElement?.parentElement?.removeChild(renderer.domElement)

      overlay.innerHTML = ''
      // Deep dispose
      starGeo.dispose()
      starMat.dispose()
      ship.geometry.dispose()
      ;(ship.material as THREE.Material).dispose()
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        mesh.geometry?.dispose?.()
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.())
        else mat?.dispose?.()
      })
    },
  }
}
