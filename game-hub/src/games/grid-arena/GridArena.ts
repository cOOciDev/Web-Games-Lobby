// =============================================
// File: src/games/grid-arena/GridArena.ts
// =============================================
import * as THREE from 'three'
import { createRenderer, makeResizeHandler } from '../../lib/three/renderer'
import type { GameInitArgs, GameInstance } from '../../features/GameHub/types'
import { KeyInput } from '../../lib/input/keys'


export function initGridArena({ canvas, overlay }: GameInitArgs): GameInstance {
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0a0a0a)
const camera = new THREE.PerspectiveCamera(70,1,0.1,1000); camera.position.set(0,12,0); camera.lookAt(0,0,0)
const renderer = createRenderer(canvas)


const grid = new THREE.GridHelper(40, 40, 0x666, 0x333); scene.add(grid)
const amb = new THREE.AmbientLight(0xffffff, .8); scene.add(amb)


const player = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshStandardMaterial({ color: 0x66e3ff }))
player.position.y = 0.5; scene.add(player)


const traps = new THREE.Group()
for (let i=0;i<16;i++){ const m=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.3,6), new THREE.MeshStandardMaterial({ color: 0xff7b7b })); m.position.set((Math.random()-0.5)*14, 0.15, (Math.random()-0.5)*14); m.rotation.y = Math.random()*Math.PI; traps.add(m) }
scene.add(traps)


const keys = new KeyInput(); keys.attach()
let raf=0, running=false; const clock = new THREE.Clock(); let lives=3


overlay.innerHTML=''
const ui = document.createElement('div'); ui.style.position='absolute'; ui.style.right='12px'; ui.style.bottom='12px'; ui.style.pointerEvents='auto'; ui.style.background='rgba(0,0,0,.55)'; ui.style.border='1px solid rgba(255,255,255,.1)'; ui.style.color='#d4d8e0'; ui.style.padding='6px 10px'; ui.style.borderRadius='10px'; ui.style.fontSize='12px'; ui.textContent='WASD / Arrows to move • Lives: 3'; overlay.appendChild(ui)


const tick=()=>{
const t=clock.getElapsedTime(), dt=clock.getDelta()


// rotate traps
traps.children.forEach((c,idx)=>{ c.rotation.y = t*.6 + idx*.2 })


if (running) {
const s=6
const dx=((keys.pressed('d')||keys.pressed('arrowright'))?1:0) - ((keys.pressed('a')||keys.pressed('arrowleft'))?1:0)
const dz=((keys.pressed('s')||keys.pressed('arrowdown'))?1:0) - ((keys.pressed('w')||keys.pressed('arrowup'))?1:0)
player.position.x = THREE.MathUtils.clamp(player.position.x + dx*s*dt, -9, 9)
player.position.z = THREE.MathUtils.clamp(player.position.z + dz*s*dt, -9, 9)


// collisions
for (const c of traps.children as THREE.Mesh[]) {
const dist = player.position.distanceTo(c.position)
if (dist < 1.1) {
lives = Math.max(0, lives-1)
ui.textContent = `WASD / Arrows to move • Lives: ${lives}`
player.position.set(0,0.5,0)
if (lives===0) { running=false; ui.textContent+=' • Game Over' }
break
}
}
}


renderer.render(scene, camera)
raf=requestAnimationFrame(tick)
}
const removeResize = makeResizeHandler(renderer, camera as THREE.PerspectiveCamera, canvas)
tick()


return {
start(){ running=true },
pause(){ running=false },
isRunning(){ return running },
dispose(){ cancelAnimationFrame(raf); removeResize(); keys.detach(); renderer.dispose(); renderer.domElement?.parentElement?.removeChild(renderer.domElement); overlay.innerHTML=''; },
}
}

