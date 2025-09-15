// =============================
// File: src/hooks/useRaf.ts
// =============================
import { useEffect, useRef } from 'react'


export default function useRaf(cb: (t: number) => void) {
const rafRef = useRef(0)
const loop = (t: number) => {
cb(t)
rafRef.current = requestAnimationFrame(loop)
}
useEffect(() => {
rafRef.current = requestAnimationFrame(loop)
return () => cancelAnimationFrame(rafRef.current)
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
}