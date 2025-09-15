// =============================
// File: src/lib/three/dispose.ts
// =============================
import * as THREE from 'three'


export function disposeScene(scene: THREE.Scene) {
scene.traverse((obj) => {
const mesh = obj as THREE.Mesh
if (mesh.geometry) mesh.geometry.dispose?.()
const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.())
else mat?.dispose?.()
})
}