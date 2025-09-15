// =============================
// File: src/vite-env.d.ts
// =============================
/// <reference types="vite/client" />


// Allow importing shader files if you add them later
declare module '*.glsl' { const src: string; export default src }