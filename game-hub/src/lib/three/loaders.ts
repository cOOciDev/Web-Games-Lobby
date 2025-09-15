// =============================
// File: src/lib/three/loaders.ts
// =============================
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'


let _manager: THREE.LoadingManager | null = null
export function getLoadingManager() {
if (_manager) return _manager
_manager = new THREE.LoadingManager()
return _manager
}


export async function loadTexture(url: string) {
const loader = new THREE.TextureLoader(getLoadingManager())
return await new Promise<THREE.Texture>((resolve, reject) => {
loader.load(url, (tex) => resolve(tex), undefined, (err) => reject(err))
})
}


export async function loadGLTF(url: string) {
const loader = new GLTFLoader(getLoadingManager())
return await new Promise<import('three/examples/jsm/loaders/GLTFLoader.js').GLTF>((resolve, reject) => {
loader.load(url, (gltf) => resolve(gltf), undefined, (err) => reject(err))
})
}