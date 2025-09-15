// =============================================
// File: src/lib/three/controller.ts
// Simple WASD ground walker with camera follow (no physics)
// =============================================
import * as THREE from 'three'
import { KeyInput } from '../input/keys'


export class WalkerController {
readonly player: THREE.Object3D
readonly camera: THREE.Camera
readonly keys = new KeyInput()
velocity = new THREE.Vector3()
speed = 4
sprint = 2


constructor(player: THREE.Object3D, camera: THREE.Camera) {
this.player = player
this.camera = camera
}


attach() { this.keys.attach() }
detach() { this.keys.detach() }


update(dt: number) {
const forward = (this.keys.pressed('w') || this.keys.pressed('arrowup')) ? 1 : (this.keys.pressed('s') || this.keys.pressed('arrowdown')) ? -1 : 0
const right = (this.keys.pressed('d') || this.keys.pressed('arrowright')) ? 1 : (this.keys.pressed('a') || this.keys.pressed('arrowleft')) ? -1 : 0
const boost = this.keys.pressed('shift') ? this.sprint : 1


const dir = new THREE.Vector3(right, 0, -forward)
if (dir.lengthSq() > 0) dir.normalize()


// move in camera-space (XZ)
const camDir = new THREE.Vector3()
this.camera.getWorldDirection(camDir)
camDir.y = 0
camDir.normalize()
const camRight = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0,1,0)).negate()


const move = new THREE.Vector3()
move.addScaledVector(camDir, dir.z)
move.addScaledVector(camRight, dir.x)
if (move.lengthSq() > 0) move.normalize()


const s = this.speed * boost
this.player.position.addScaledVector(move, s * dt)


// camera follow: offset behind & above player
const target = new THREE.Vector3().copy(this.player.position)
const offset = new THREE.Vector3(-4, 3, 6)
const camPos = new THREE.Vector3().copy(target).add(offset)
;(this.camera as THREE.PerspectiveCamera).position.lerp(camPos, 0.1)
this.camera.lookAt(target)
}
}