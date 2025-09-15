// =============================================
// File: src/lib/three/renderer.ts (updated with ResizeObserver; same as last patch)
// =============================================
import * as THREE from 'three'


function sizeOf(el: HTMLElement) {
const r = el.getBoundingClientRect()
const w = Math.max(1, Math.floor(r.width))
const h = Math.max(1, Math.floor(r.height))
return { w, h }
}


export function createRenderer(container: HTMLDivElement) {
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
const { w, h } = sizeOf(container)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(w, h, false)
renderer.outputColorSpace = THREE.SRGBColorSpace
const gl = renderer.getContext()
if (!gl) { renderer.dispose(); throw new Error('WebGL context not available (renderer.getContext() returned null)') }
container.appendChild(renderer.domElement)
console.log('[Renderer] mounted size:', w, 'x', h)
return renderer
}


export function makeResizeHandler(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, container: HTMLDivElement) {
const apply = () => {
const { w, h } = sizeOf(container)
camera.aspect = w / h
camera.updateProjectionMatrix()
renderer.setSize(w, h, false)
}
let ro: ResizeObserver | null = null
if ('ResizeObserver' in window) { ro = new ResizeObserver(apply); ro.observe(container) }
else { window.addEventListener('resize', apply) }
apply()
return () => { ro ? ro.disconnect() : window.removeEventListener('resize', apply) }
}

