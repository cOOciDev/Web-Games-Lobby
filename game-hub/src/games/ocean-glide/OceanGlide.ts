// =============================================
// File: src/games/ocean-glide/OceanGlide.ts
// =============================================
import * as THREE from 'three'
import { createRenderer, makeResizeHandler } from '../../lib/three/renderer'
import type { GameInitArgs, GameInstance } from '../../features/GameHub/types'
import { KeyInput } from '../../lib/input/keys'

/** -----------------------
 * Gerstner wave params
 * ----------------------*/
type GW = {
  dir: THREE.Vector2 // must be normalized
  amp: number        // amplitude (meters)
  len: number        // wavelength (meters)
  steep: number      // 0..1 (0.25..0.7 typical)
  speed: number      // phase speed scalar
}

function norm2(v: THREE.Vector2) {
  if (v.lengthSq() === 0) return v.set(1, 0)
  return v.normalize()
}

/** CPU-side sampling to match shader water for buoyancy */
function makeWaveSampler(waves: GW[]) {
  const TWO_PI = Math.PI * 2
  const g = 9.81
  const dirs = waves.map(w => w.dir.clone().normalize())
  const ks = waves.map(w => TWO_PI / w.len)
  const omegas = waves.map((k, i) => Math.sqrt(g * k) * waves[i].speed) // tweakable
  const amps = waves.map(w => w.amp)
  const steeps = waves.map(w => w.steep)

  return {
    heightAndNormal(x: number, z: number, t: number) {
      // Accumulate Gerstner displacement derivatives to build a normal
      let dispX = 0, dispY = 0, dispZ = 0
      let dHdX = 0, dHdZ = 0

      for (let i = 0; i < waves.length; i++) {
        const d = dirs[i]
        const k = ks[i]
        const A = amps[i]
        const Q = steeps[i]
        const w = omegas[i]
        const phase = k * (d.x * x + d.y * z) - w * t
        const sinP = Math.sin(phase)
        const cosP = Math.cos(phase)

        dispX += Q * A * d.x * cosP
        dispY += A * sinP
        dispZ += Q * A * d.y * cosP

        // partial derivatives for a surface normal approximation
        dHdX += A * k * d.x * cosP
        dHdZ += A * k * d.y * cosP
      }

      // world height at (x,z)
      const y = dispY

      // normal from derivatives (∂h/∂x, ∂h/∂z)
      const n = new THREE.Vector3(-dHdX, 1.0, -dHdZ).normalize()

      return { height: y, normal: n, disp: new THREE.Vector3(dispX, dispY, dispZ) }
    }
  }
}

/** Build a simple water shader material (vertex displacement + fresnel, foam) */
// function makeWaterMaterial(waves: GW) {
//   // Not used – we rely on array uniforms below
// }

/** Create a ShaderMaterial for water with 3 gerstner waves */
function createWaterMaterial() {
  const uniforms = {
    uTime: { value: 0 },
    uDir1: { value: new THREE.Vector2(1, 0).normalize() },
    uDir2: { value: new THREE.Vector2(0.2, 0.98).normalize() },
    uDir3: { value: new THREE.Vector2(-0.9, 0.4).normalize() },

    uAmp1: { value: 0.35 },
    uAmp2: { value: 0.18 },
    uAmp3: { value: 0.08 },

    uLen1: { value: 16.0 },
    uLen2: { value: 7.0 },
    uLen3: { value: 3.5 },

    uSteep1: { value: 0.55 },
    uSteep2: { value: 0.42 },
    uSteep3: { value: 0.35 },

    uSpeed1: { value: 1.0 },
    uSpeed2: { value: 1.2 },
    uSpeed3: { value: 1.6 },

    uDeep: { value: new THREE.Color(0x0c426e) },
    uShallow: { value: new THREE.Color(0x1e7bbd) },
    uFoam: { value: new THREE.Color(0xeff7ff) },
    uCamPos: { value: new THREE.Vector3() },
    uLightDir: { value: new THREE.Vector3(0.3, 1.0, 0.4).normalize() },
  }

  const vs = /* glsl */`
    uniform float uTime;
    uniform vec2 uDir1, uDir2, uDir3;
    uniform float uAmp1, uAmp2, uAmp3;
    uniform float uLen1, uLen2, uLen3;
    uniform float uSteep1, uSteep2, uSteep3;
    uniform float uSpeed1, uSpeed2, uSpeed3;

    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    varying float vFoamFactor;

    // one Gerstner contribution
    void wave(in vec2 dir, in float amp, in float len, in float steep, in float speed,
              in vec3 p, in float t,
              inout vec3 disp, inout vec3 dposdx, inout vec3 dposdz)
    {
      float k = 6.28318530718 / len; // 2*pi/len
      float w = sqrt(9.81 * k) * speed;
      vec2 d = normalize(dir);
      float phase = k * (d.x * p.x + d.y * p.z) - w * t;
      float cosP = cos(phase);
      float sinP = sin(phase);

      // displacement
      disp.x += steep * amp * d.x * cosP;
      disp.y += amp * sinP;
      disp.z += steep * amp * d.y * cosP;

      // partial derivatives of displaced position w.r.t x and z
      // d/dx
      dposdx.x += -steep * amp * d.x * d.x * k * sinP;
      dposdx.y += amp * d.x * k * cosP;
      dposdx.z += -steep * amp * d.y * d.x * k * sinP;

      // d/dz
      dposdz.x += -steep * amp * d.x * d.y * k * sinP;
      dposdz.y += amp * d.y * k * cosP;
      dposdz.z += -steep * amp * d.y * d.y * k * sinP;
    }

    void main() {
      vec3 pos = position;
      vec3 disp = vec3(0.0);
      vec3 dposdx = vec3(1.0, 0.0, 0.0); // start with identity derivatives
      vec3 dposdz = vec3(0.0, 0.0, 1.0);

      wave(uDir1, uAmp1, uLen1, uSteep1, uSpeed1, pos, uTime, disp, dposdx, dposdz);
      wave(uDir2, uAmp2, uLen2, uSteep2, uSpeed2, pos, uTime, disp, dposdx, dposdz);
      wave(uDir3, uAmp3, uLen3, uSteep3, uSpeed3, pos, uTime, disp, dposdx, dposdz);

      vec3 newPos = pos + disp;
      // Normal from Jacobian columns via cross
      vec3 N = normalize(cross(dposdz, dposdx));

      vWorldPos = (modelMatrix * vec4(newPos, 1.0)).xyz;
      vWorldNormal = normalize((modelMatrix * vec4(N, 0.0)).xyz);

      // crude foam factor from slope magnitude
      float slope = length(vec2(dposdx.y, dposdz.y));
      vFoamFactor = smoothstep(0.35, 0.85, slope);

      gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos, 1.0);
    }
  `

  const fs = /* glsl */`
    uniform vec3 uCamPos;
    uniform vec3 uDeep, uShallow, uFoam;
    uniform vec3 uLightDir;

    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    varying float vFoamFactor;

    void main() {
      vec3 N = normalize(vWorldNormal);
      vec3 V = normalize(uCamPos - vWorldPos);
      vec3 L = normalize(uLightDir);

      float NdotL = clamp(dot(N, L), 0.0, 1.0);

      // color by depth: y (world) ~ shallow near 0, deep below
      float depth = clamp(exp(-max(0.0, vWorldPos.y) * 0.4), 0.0, 1.0);
      vec3 base = mix(uShallow, uDeep, depth);

      // simple fresnel (schlick)
      float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
      vec3 fresCol = vec3(0.35, 0.55, 0.75);

      // foam overlay
      vec3 color = base * (0.35 + 0.65 * NdotL);
      color = mix(color, uFoam, vFoamFactor * 0.55); // crest foam
      color += fres * fresCol * 0.35;

      gl_FragColor = vec4(color, 0.98);
    }
  `

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vs,
    fragmentShader: fs,
    transparent: true,
  })

  return { mat, uniforms }
}

export function initOceanGlide({ canvas, overlay }: GameInitArgs): GameInstance {
  // Scene & camera
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0b2030)

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 2000)
  camera.position.set(0, 4, 8)

  // Renderer
  const renderer = createRenderer(canvas)

  // Lights
  const sun = new THREE.DirectionalLight(0xffffff, 1.0)
  sun.position.set(5, 12, 6)
  scene.add(sun, new THREE.AmbientLight(0xffffff, 0.45))

  // Water mesh (GPU displaced)
  const waterGeo = new THREE.PlaneGeometry(200, 200, 200, 200)
  waterGeo.rotateX(-Math.PI / 2)
  const { mat: waterMat, uniforms: waterU } = createWaterMaterial()
  const water = new THREE.Mesh(waterGeo, waterMat)
  water.frustumCulled = false
  scene.add(water)

  // Keep CPU sampler in sync with shader params
  const waves: GW[] = [
    { dir: norm2(new THREE.Vector2(1, 0)), amp: 0.35, len: 16, steep: 0.55, speed: 1.0 },
    { dir: norm2(new THREE.Vector2(0.2, 0.98)), amp: 0.18, len: 7, steep: 0.42, speed: 1.2 },
    { dir: norm2(new THREE.Vector2(-0.9, 0.4)), amp: 0.08, len: 3.5, steep: 0.35, speed: 1.6 },
  ]
  const sampler = makeWaveSampler(waves)

  // Boat (player)
  const boat = new THREE.Group()
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.45, 2.2),
    new THREE.MeshStandardMaterial({ color: 0xffcc66, roughness: 0.55, metalness: 0.05 }),
  )
  hull.position.y = 0.225
  boat.add(hull)

  const bow = new THREE.Mesh(
    new THREE.ConeGeometry(0.45, 0.8, 24),
    new THREE.MeshStandardMaterial({ color: 0xf6d08a, roughness: 0.6, metalness: 0.1 }),
  )
  bow.rotation.x = Math.PI / 2
  bow.position.set(0, 0.35, -1.2)
  boat.add(bow)

  // Simple mast for visual
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 1.2, 12),
    new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.9 }),
  )
  mast.position.set(0, 1.0, 0.1)
  boat.add(mast)

  boat.position.set(0, 0, 0)
  scene.add(boat)

  // Wake strips (two planes trailing the hull)
  const wakeMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  })
  const wakeGeo = new THREE.PlaneGeometry(0.7, 3)
  wakeGeo.rotateX(-Math.PI / 2)
  const wakeL = new THREE.Mesh(wakeGeo, wakeMat.clone())
  const wakeR = new THREE.Mesh(wakeGeo, wakeMat.clone())
  wakeL.position.set(-0.35, 0.02, 1.0)
  wakeR.position.set( 0.35, 0.02, 1.0)
  boat.add(wakeL, wakeR)

  // Buoys
  const buoys = new THREE.Group()
  for (let i = 0; i < 18; i++) {
    const b = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 1.0, 16),
      new THREE.MeshStandardMaterial({ color: 0xff4d4d, roughness: 0.7 }),
    )
    b.position.set((Math.random() - 0.5) * 24, 0.5, -Math.random() * 70 - 10)
    buoys.add(b)
  }
  scene.add(buoys)

  // Input
  const keys = new KeyInput()
  keys.attach()

  // HUD
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
  hud.textContent = 'A/D steer • W throttle • S brake/reverse'
  overlay.appendChild(hud)

  // Throttle gauge
  const gauge = document.createElement('div')
  gauge.style.position = 'absolute'
  gauge.style.right = '12px'
  gauge.style.bottom = '12px'
  gauge.style.width = '180px'
  gauge.style.height = '10px'
  gauge.style.border = '1px solid rgba(255,255,255,.15)'
  gauge.style.background = 'rgba(255,255,255,.06)'
  gauge.style.borderRadius = '10px'
  overlay.appendChild(gauge)
  const gaugeFill = document.createElement('div')
  gaugeFill.style.height = '100%'
  gaugeFill.style.width = '0%'
  gaugeFill.style.background = 'linear-gradient(90deg,#4ade80,#22d3ee)'
  gaugeFill.style.borderRadius = '10px'
  gauge.appendChild(gaugeFill)

  // Physics state
  let speed = 0 // forward m/s (boat local -Z axis)
  let heading = 0 // yaw radians (0 faces -Z)
  let targetThrottle = 0 // -1..1
  let targetSteer = 0 // -1..1
  let running = false
  let raf = 0

  const MAX_FWD = 14
  const MAX_REV = 3
  const ACCEL = 7.0
  const DRAG = 0.25 // quadratic-ish
  const STEER_BASE = 0.7 // base yaw rate
  const STEER_SPEED_FACTOR = 0.12 // add yaw rate with speed

  const hullOffset = 0.25 // boat's baseline above wave

  const clock = new THREE.Clock()

  function updateInput(dt: number) {
    // target inputs from keys
    const wantThrottle = (keys.pressed('w') ? 1 : 0) - (keys.pressed('s') ? 1 : 0)
    const wantSteer = (keys.pressed('d') ? 1 : 0) - (keys.pressed('a') ? 1 : 0)

    // smooth
    targetThrottle = THREE.MathUtils.lerp(targetThrottle, wantThrottle, 1 - Math.pow(0.001, dt))
    targetSteer = THREE.MathUtils.lerp(targetSteer, wantSteer, 1 - Math.pow(0.001, dt))
  }

  function updateBoat(dt: number, t: number) {
    // throttle -> speed
    const accel = ACCEL * targetThrottle
    speed += accel * dt
    // drag
    const drag = DRAG * speed * Math.abs(speed)
    speed -= drag * dt

    // clamp speeds
    speed = THREE.MathUtils.clamp(speed, -MAX_REV, MAX_FWD)

    // steering – stronger with speed
    const steerRate = STEER_BASE + STEER_SPEED_FACTOR * Math.abs(speed)
    heading -= targetSteer * steerRate * dt

    // integrate position (local forward is -Z)
    const fwd = new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading))
    boat.position.addScaledVector(fwd, speed * dt)

    // wave height & normal for buoyancy + attitude
    const w = sampler.heightAndNormal(boat.position.x, boat.position.z, t)
    boat.position.y = w.height + hullOffset

    // orient boat: base yaw from heading, plus pitch/roll from wave normal and turn
    const targetUp = w.normal
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), targetUp)
    const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading)
    const finalQ = yawQuat.multiply(quat)
    boat.quaternion.slerp(finalQ, 1 - Math.pow(0.002, dt)) // smooth

    // subtle banking with steering proportional to speed
    const bank = THREE.MathUtils.clamp(-targetSteer * Math.min(1, Math.abs(speed) / MAX_FWD) * 0.25, -0.35, 0.35)
    boat.rotateZ(THREE.MathUtils.lerp(0, bank, 0.35 * dt))

    // wake visuals scale with speed
    const s = THREE.MathUtils.clamp(Math.abs(speed) / MAX_FWD, 0, 1)
    wakeL.scale.set(1, 1 + s * 2.2, 1)
    wakeR.scale.set(1, 1 + s * 2.2, 1)
    ;(wakeL.material as THREE.MeshBasicMaterial).opacity = 0.12 + s * 0.35
    ;(wakeR.material as THREE.MeshBasicMaterial).opacity = 0.12 + s * 0.35

    // HUD
    const kn = speed * 1.94384 // m/s → knots
    hud.textContent = `Speed: ${kn.toFixed(1)} kn • A/D steer • W throttle • S brake/reverse`
    gaugeFill.style.width = `${((targetThrottle + 1) / 2) * 100}%`
  }

  function updateBuoys(t: number) {
    // make buoys ride waves
    buoys.children.forEach((b) => {
      const m = b as THREE.Mesh
      const w = sampler.heightAndNormal(m.position.x, m.position.z, t)
      m.position.y = w.height + 0.5
      // tilt slightly by normal
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), w.normal)
      m.quaternion.slerp(q, 0.2)
    })
  }

  function updateCamera(dt: number) {
    const lookAhead = speed * 0.15
    const lookPos = new THREE.Vector3(
      boat.position.x - Math.sin(heading) * lookAhead,
      boat.position.y + 2.8,
      boat.position.z - Math.cos(heading) * lookAhead - 5.8,
    )
    camera.position.lerp(lookPos, 1 - Math.pow(0.0025, dt))
    camera.lookAt(boat.position.x, boat.position.y + 0.4, boat.position.z - 0.6)
  }

  const tick = () => {
    const dt = clock.getDelta()
    const t = clock.getElapsedTime()
    waterU.uTime.value = t
    waterU.uCamPos.value.copy(camera.position)

    if (running) {
      updateInput(dt)
      updateBoat(dt, t)
      updateBuoys(t)
      updateCamera(dt)
    } else {
      // even while paused keep water time for a nice idle look
      updateCamera(dt * 0.2)
    }

    renderer.render(scene, camera)
    raf = requestAnimationFrame(tick)
  }

  const removeResize = makeResizeHandler(renderer, camera as THREE.PerspectiveCamera, canvas)
  tick()

  // API
  return {
    start() { running = true },
    pause() { running = false },
    isRunning() { return running },
    dispose() {
      cancelAnimationFrame(raf)
      removeResize()
      keys.detach()

      renderer.dispose()
      renderer.domElement?.parentElement?.removeChild(renderer.domElement)
      overlay.innerHTML = ''

      // dispose geometries/materials
      waterGeo.dispose()
      ;(water.material as THREE.Material).dispose()

      ;(hull.geometry as THREE.BufferGeometry).dispose()
      ;(hull.material as THREE.Material).dispose()
      ;(bow.geometry as THREE.BufferGeometry).dispose()
      ;(bow.material as THREE.Material).dispose()
      ;(mast.geometry as THREE.BufferGeometry).dispose()
      ;(mast.material as THREE.Material).dispose()
      ;(wakeL.geometry as THREE.BufferGeometry).dispose()
      ;(wakeL.material as THREE.Material).dispose()
      ;(wakeR.geometry as THREE.BufferGeometry).dispose()
      ;(wakeR.material as THREE.Material).dispose()

      buoys.children.forEach((b) => {
        const m = b as THREE.Mesh
        ;(m.geometry as THREE.BufferGeometry).dispose()
        ;(m.material as THREE.Material).dispose()
      })
      scene.clear()
    },
  }
}
