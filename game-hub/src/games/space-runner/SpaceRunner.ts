// =============================================
// File: src/games/space-runner/SpaceRunner.ts
// RTS-style top-down game with ground selection plane + events
// =============================================
import * as THREE from 'three'
import { createRenderer, makeResizeHandler } from '../../lib/three/renderer'
import type { GameInitArgs, GameInstance } from '../../features/GameHub/types'
import { KeyInput } from '../../lib/input/keys'

type Unit = {
  id: number
  mesh: THREE.Mesh
  selRing: THREE.Mesh
  target: THREE.Vector3 | null
  speed: number
  selected: boolean
  hadTarget: boolean
}

type OrderMarker = { mesh: THREE.Mesh; ttl: number }

export function initSpaceRunner({ canvas, overlay, onEvent }: GameInitArgs): GameInstance {
  // --- Scene & camera (tilted top-down) ---
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0d0f13)

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000)
  const camTarget = new THREE.Vector3(0, 0, 0)
  let camDist = 26
  const camTilt = THREE.MathUtils.degToRad(58)

  function placeCamera() {
    const dir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(1, 0, 0), -camTilt)
    const pos = camTarget.clone().addScaledVector(dir, camDist)
    camera.position.copy(pos)
    camera.lookAt(camTarget)
  }
  placeCamera()

  // --- Renderer ---
  const renderer = createRenderer(canvas)

  // --- Ground & grid ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: 0x1a2a1f, roughness: 1 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  const grid = new THREE.GridHelper(120, 60, 0x224422, 0x2f4f2f)
  ;(grid.material as THREE.Material).transparent = true
  ;(grid.material as THREE.Material).opacity = 0.6
  scene.add(grid)

  // --- Lighting ---
  const amb = new THREE.AmbientLight(0xffffff, 0.6)
  const sun = new THREE.DirectionalLight(0xffffff, 0.9)
  sun.position.set(12, 25, 10)
  scene.add(amb, sun)

  // --- Shared geometries/materials ---
  const unitGeo = new THREE.CylinderGeometry(0.4, 0.4, 1, 16)
  const friendlyMat = new THREE.MeshStandardMaterial({ color: 0x4cc9f0 })
  const selectedMat = new THREE.MeshStandardMaterial({
    color: 0xf0b54c,
    emissive: 0x503000,
    emissiveIntensity: 0.35,
  })

  const ringGeo = new THREE.RingGeometry(0.5, 0.62, 32)
  ringGeo.rotateX(-Math.PI / 2)
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.85 })

  // --- Units ---
  const units: Unit[] = []
  let uid = 1
  function spawnUnit(x: number, z: number) {
    const mesh = new THREE.Mesh(unitGeo, friendlyMat.clone())
    mesh.position.set(x, 0.5, z)
    const ring = new THREE.Mesh(ringGeo, ringMat.clone())
    ring.position.set(0, 0.01, 0)
    ring.visible = false
    mesh.add(ring)
    scene.add(mesh)
    units.push({ id: uid++, mesh, selRing: ring, target: null, speed: 6, selected: false, hadTarget: false })
  }
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) spawnUnit(-8 + c * 2, -6 + r * 2)

  // --- Overlay / HUD ---
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
  hud.textContent = 'Click/drag select • Right-click move • WASD pan • Wheel zoom • Ctrl+A select all'
  overlay.appendChild(hud)

  // Screen-space selection box (DOM)
  const selBox = document.createElement('div')
  Object.assign(selBox.style, {
    position: 'absolute',
    border: '1px solid rgba(52,211,153,.9)',
    background: 'rgba(52,211,153,.15)',
    pointerEvents: 'none',
    display: 'none',
  } as CSSStyleDeclaration)
  overlay.appendChild(selBox)

  // Cursor reticle (DOM)
  const cursorUI = document.createElement('div')
  Object.assign(cursorUI.style, {
    position: 'absolute',
    width: '18px',
    height: '18px',
    border: '2px solid rgba(255,255,255,.6)',
    borderRadius: '50%',
    pointerEvents: 'none',
    transform: 'translate(-50%, -50%)',
    boxShadow: '0 0 10px rgba(255,255,255,.25)',
  } as CSSStyleDeclaration)
  overlay.appendChild(cursorUI)

  // 3D ground cursor ring
  const cursorRing = new THREE.Mesh(
    new THREE.RingGeometry(0.6, 0.8, 48),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }),
  )
  cursorRing.geometry.rotateX(-Math.PI / 2)
  cursorRing.position.y = 0.02
  cursorRing.visible = false
  scene.add(cursorRing)

  // >>> Ground selection plane (the “arena” under mouse drag)
  const selGroup = new THREE.Group()
  selGroup.rotation.x = -Math.PI / 2
  selGroup.position.y = 0.018
  selGroup.visible = false
  scene.add(selGroup)

  const selFill = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
  )
  const selEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)),
    new THREE.LineBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.9 }),
  )
  selGroup.add(selFill)
  selGroup.add(selEdges)

  function showGroundSelection(p1: THREE.Vector3, p2: THREE.Vector3) {
    const minX = Math.min(p1.x, p2.x)
    const maxX = Math.max(p1.x, p2.x)
    const minZ = Math.min(p1.z, p2.z)
    const maxZ = Math.max(p1.z, p2.z)
    const w = Math.max(0.001, maxX - minX)
    const h = Math.max(0.001, maxZ - minZ)
    selGroup.position.set((minX + maxX) * 0.5, 0.018, (minZ + maxZ) * 0.5)
    selGroup.scale.set(w, h, 1) // (local X,Y) map to world X,Z due to rotation
    selGroup.visible = true
  }
  function hideGroundSelection() {
    selGroup.visible = false
  }

  // --- Order markers (animated, fade) ---
  const markers: OrderMarker[] = []
  const markerGeo = new THREE.RingGeometry(0.1, 0.9, 32)
  markerGeo.rotateX(-Math.PI / 2)
  const markerMat = new THREE.MeshBasicMaterial({ color: 0x00d1ff, transparent: true, opacity: 0.85 })
  function spawnOrderMarker(p: THREE.Vector3) {
    const m = new THREE.Mesh(markerGeo, markerMat.clone())
    m.position.copy(p).setY(0.03)
    scene.add(m)
    markers.push({ mesh: m, ttl: 1.0 })
  }

  // --- Input & picking ---
  const keys = new KeyInput()
  keys.attach()
  const raycaster = new THREE.Raycaster()
  const mouseNDC = new THREE.Vector2()

  function screenToNDC(x: number, y: number) {
    const rect = renderer.domElement.getBoundingClientRect()
    mouseNDC.x = ((x - rect.left) / rect.width) * 2 - 1
    mouseNDC.y = -((y - rect.top) / rect.height) * 2 + 1
  }
  function pickGround(clientX: number, clientY: number) {
    screenToNDC(clientX, clientY)
    raycaster.setFromCamera(mouseNDC, camera)
    const hit = raycaster.intersectObject(ground, false)[0]
    return hit?.point?.clone() ?? null
  }
  function pickUnit(clientX: number, clientY: number) {
    screenToNDC(clientX, clientY)
    raycaster.setFromCamera(mouseNDC, camera)
    const list = units.map(u => u.mesh)
    const hit = raycaster.intersectObjects(list, false)[0]
    return hit?.object ?? null
  }
  function projectToScreen(v: THREE.Vector3) {
    const p = v.clone().project(camera)
    const rect = renderer.domElement.getBoundingClientRect()
    return { x: ((p.x + 1) / 2) * rect.width + rect.left, y: ((-p.y + 1) / 2) * rect.height + rect.top }
  }

  // Selection helpers
  function clearSelection() {
    for (const u of units) {
      u.selected = false
      ;(u.mesh.material as THREE.MeshStandardMaterial).copy(friendlyMat)
      u.selRing.visible = false
    }
    onEvent?.({ type: 'selection:changed', payload: { count: 0 } })
  }
  function applySelectionFilter(filter: (u: Unit) => boolean, additive: boolean) {
    if (!additive) clearSelection()
    let count = 0
    for (const u of units) {
      if (filter(u)) {
        u.selected = true
        ;(u.mesh.material as THREE.MeshStandardMaterial).copy(selectedMat)
        u.selRing.visible = true
        count++
      }
    }
    onEvent?.({ type: 'selection:changed', payload: { count } })
  }

  // Formation
  function formationOffsets(n: number) {
    const out: THREE.Vector3[] = []
    const side = Math.ceil(Math.sqrt(n))
    const spacing = 1.4
    const half = (side - 1) * 0.5
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / side)
      const c = i % side
      out.push(new THREE.Vector3((c - half) * spacing, 0, (r - half) * spacing))
    }
    return out
  }

  // Mouse interactions
  const dom = renderer.domElement
  let dragging = false
  let dragStart = { x: 0, y: 0 }
  let dragStartGround: THREE.Vector3 | null = null
  let lastMouse = { x: 0, y: 0 }

  function onMouseDown(e: MouseEvent) {
    if (e.button === 0) {
      dragging = true
      dragStart = { x: e.clientX, y: e.clientY }
      dragStartGround = pickGround(e.clientX, e.clientY)
      lastMouse = { x: e.clientX, y: e.clientY }

      // Screen box init
      selBox.style.left = `${dragStart.x}px`
      selBox.style.top = `${dragStart.y}px`
      selBox.style.width = '0px'
      selBox.style.height = '0px'
      selBox.style.display = 'block'

      // Ground selection init (if started on ground)
      if (dragStartGround) {
        showGroundSelection(dragStartGround, dragStartGround)
      } else {
        hideGroundSelection()
      }
    }
  }

  function onMouseMove(e: MouseEvent) {
    lastMouse = { x: e.clientX, y: e.clientY }

    // Cursor DOM
    cursorUI.style.left = `${e.clientX}px`
    cursorUI.style.top = `${e.clientY}px`

    // 3D ground cursor
    const p = pickGround(e.clientX, e.clientY)
    if (p) {
      cursorRing.visible = true
      cursorRing.position.set(p.x, 0.02, p.z)
      const s = 0.8 + (Math.sin(performance.now() * 0.006) + 1) * 0.15
      cursorRing.scale.setScalar(s)
    } else {
      cursorRing.visible = false
    }

    if (dragging) {
      // Screen box update
      const x = Math.min(dragStart.x, e.clientX)
      const y = Math.min(dragStart.y, e.clientY)
      const w = Math.abs(e.clientX - dragStart.x)
      const h = Math.abs(e.clientY - dragStart.y)
      selBox.style.left = `${x}px`
      selBox.style.top = `${y}px`
      selBox.style.width = `${w}px`
      selBox.style.height = `${h}px`

      // Ground selection update
      const curGround = pickGround(e.clientX, e.clientY)
      if (dragStartGround && curGround) {
        showGroundSelection(dragStartGround, curGround)
      } else {
        hideGroundSelection()
      }
    }
  }

  function onMouseUp(e: MouseEvent) {
    if (e.button === 0) {
      const moved = Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y) > 5
      selBox.style.display = 'none'
      hideGroundSelection()

      if (!moved) {
        // Single click selection
        const hitUnit = pickUnit(e.clientX, e.clientY)
        if (hitUnit) {
          const additive = e.shiftKey
          applySelectionFilter(u => u.mesh === hitUnit, additive)
        } else if (!e.shiftKey) {
          clearSelection()
        }
      } else {
        // Prefer ground-rect selection if both picks exist, else screen box
        const endGround = pickGround(e.clientX, e.clientY)
        if (dragStartGround && endGround) {
          const minX = Math.min(dragStartGround.x, endGround.x)
          const maxX = Math.max(dragStartGround.x, endGround.x)
          const minZ = Math.min(dragStartGround.z, endGround.z)
          const maxZ = Math.max(dragStartGround.z, endGround.z)
          applySelectionFilter(u => {
            const p = u.mesh.position
            return p.x >= minX && p.x <= maxX && p.z >= minZ && p.z <= maxZ
          }, e.shiftKey)
        } else {
          // Fallback to screen box test
          const x1 = Math.min(dragStart.x, e.clientX)
          const y1 = Math.min(dragStart.y, e.clientY)
          const x2 = Math.max(dragStart.x, e.clientX)
          const y2 = Math.max(dragStart.y, e.clientY)
          applySelectionFilter(u => {
            const s = projectToScreen(u.mesh.position)
            return s.x >= x1 && s.x <= x2 && s.y >= y1 && s.y <= y2
          }, e.shiftKey)
        }
      }
      dragging = false
      dragStartGround = null
    }
  }

  function onDblClick(e: MouseEvent) {
    const hitUnit = pickUnit(e.clientX, e.clientY)
    if (hitUnit) {
      const pos = (hitUnit as THREE.Mesh).position
      applySelectionFilter(u => u.mesh.position.distanceTo(pos) < 4, e.shiftKey)
    }
  }

  function onContextMenu(e: MouseEvent) {
    e.preventDefault()
    const p = pickGround(e.clientX, e.clientY)
    if (!p) return
    const selected = units.filter(u => u.selected)
    if (selected.length === 0) return
    const offs = formationOffsets(selected.length)
    selected.forEach((u, i) => {
      u.target = p.clone().add(offs[i]); u.hadTarget = true
    })
    spawnOrderMarker(p)
    onEvent?.({ type: 'command:move', payload: { to: { x: p.x, z: p.z }, count: selected.length } })
  }

  function onWheel(e: WheelEvent) {
    camDist = THREE.MathUtils.clamp(camDist + Math.sign(e.deltaY) * 2.5, 14, 60)
    placeCamera()
  }
  function onKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault()
      applySelectionFilter(() => true, false)
    }
  }

  dom.addEventListener('mousedown', onMouseDown)
  dom.addEventListener('mousemove', onMouseMove)
  dom.addEventListener('mouseup', onMouseUp)
  dom.addEventListener('dblclick', onDblClick)
  dom.addEventListener('contextmenu', onContextMenu)
  dom.addEventListener('wheel', onWheel, { passive: true })
  window.addEventListener('keydown', onKeyDown)

  // Camera pan with WASD
  function cameraPan(dt: number) {
    const panSpeed = 14
    const dx = (keys.pressed('d') || keys.pressed('arrowright') ? 1 : 0) - (keys.pressed('a') || keys.pressed('arrowleft') ? 1 : 0)
    const dz = (keys.pressed('s') || keys.pressed('arrowdown') ? 1 : 0) - (keys.pressed('w') || keys.pressed('arrowup') ? 1 : 0)
    if (dx || dz) {
      const fwd = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(-camTilt, 0, 0)); fwd.y = 0; fwd.normalize()
      const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).negate()
      camTarget.addScaledVector(right, dx * panSpeed * dt)
      camTarget.addScaledVector(fwd, dz * panSpeed * dt)
      placeCamera()
    }
  }

  // Movement & separation + arrival events
  function updateUnits(dt: number) {
    const sepRadius = 1.2
    for (const u of units) {
      // separation
      const sep = new THREE.Vector3()
      for (const v of units) {
        if (u === v) continue
        const d = u.mesh.position.distanceTo(v.mesh.position)
        if (d > 0 && d < sepRadius) {
          const push = u.mesh.position.clone().sub(v.mesh.position).setY(0).normalize().multiplyScalar((sepRadius - d) * 2)
          sep.add(push)
        }
      }
      u.mesh.position.addScaledVector(sep, dt)

      // seek
      if (u.target) {
        const to = u.target.clone().sub(u.mesh.position).setY(0)
        const dist = to.length()
        if (dist < 0.12) {
          u.target = null
          if (u.hadTarget) {
            onEvent?.({ type: 'unit:arrived', payload: { id: u.id, x: u.mesh.position.x, z: u.mesh.position.z } })
            u.hadTarget = false
          }
        } else {
          to.normalize()
          u.mesh.position.addScaledVector(to, u.speed * dt)
        }
      }
    }
  }

  // Order marker animation
  function updateMarkers(dt: number) {
    for (let i = markers.length - 1; i >= 0; i--) {
      const m = markers[i]
      m.ttl -= dt
      const s = THREE.MathUtils.smoothstep(m.ttl, 0, 1)
      m.mesh.scale.setScalar(1 + (1 - s) * 2)
      ;(m.mesh.material as THREE.Material).opacity = Math.max(0, m.ttl)
      if (m.ttl <= 0) {
        m.mesh.parent?.remove(m.mesh)
        ;(m.mesh.geometry as THREE.BufferGeometry).dispose()
        ;(m.mesh.material as THREE.Material).dispose()
        markers.splice(i, 1)
      }
    }
  }

  // Loop
  let raf = 0
  let running = false
  const clock = new THREE.Clock()

  const tick = () => {
    const dt = clock.getDelta()
    if (running) {
      cameraPan(dt)
      updateUnits(dt)
      updateMarkers(dt)
    } else if (cursorRing.visible) {
      const s = 0.8 + (Math.sin(performance.now() * 0.006) + 1) * 0.15
      cursorRing.scale.setScalar(s)
    }
    renderer.render(scene, camera)
    raf = requestAnimationFrame(tick)
  }

  const removeResize = makeResizeHandler(renderer, camera as THREE.PerspectiveCamera, canvas)
  placeCamera()
  tick()

  return {
    start() {
      running = true
      hud.textContent = 'RTS: Click/drag select • Right-click move • WASD pan • Wheel zoom • Ctrl+A select all'
      onEvent?.({ type: 'game:started' })
    },
    pause() {
      running = false
      hud.textContent = 'Paused — press Play to continue'
      onEvent?.({ type: 'game:paused' })
    },
    isRunning() { return running },
    dispose() {
      cancelAnimationFrame(raf)
      removeResize()
      keys.detach()
      window.removeEventListener('keydown', onKeyDown)
      dom.removeEventListener('mousedown', onMouseDown)
      dom.removeEventListener('mousemove', onMouseMove)
      dom.removeEventListener('mouseup', onMouseUp)
      dom.removeEventListener('dblclick', onDblClick)
      dom.removeEventListener('contextmenu', onContextMenu)
      dom.removeEventListener('wheel', onWheel)

      renderer.dispose()
      renderer.domElement?.parentElement?.removeChild(renderer.domElement)
      overlay.innerHTML = ''

      // dispose selection group
      selGroup.remove(selFill); selGroup.remove(selEdges)
      selFill.geometry.dispose(); (selFill.material as THREE.Material).dispose()
      ;(selEdges.geometry as THREE.BufferGeometry).dispose(); (selEdges.material as THREE.Material).dispose()

      // dispose units
      for (const u of units) {
        u.mesh.remove(u.selRing)
        u.selRing.geometry.dispose(); (u.selRing.material as THREE.Material).dispose()
        u.mesh.geometry.dispose(); (u.mesh.material as THREE.Material).dispose()
      }
      // dispose markers
      for (const m of markers) {
        m.mesh.parent?.remove(m.mesh)
        m.mesh.geometry.dispose(); (m.mesh.material as THREE.Material).dispose()
      }
      scene.clear()
    },
  }
}
