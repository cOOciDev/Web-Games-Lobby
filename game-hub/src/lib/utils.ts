// =============================
// File: src/lib/utils.ts
// =============================
export function cn(...parts: Array<string | false | null | undefined>) {
return parts.filter(Boolean).join(' ')
}
export const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t