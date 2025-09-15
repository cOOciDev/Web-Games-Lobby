// =============================================
// File: src/lib/fullscreen.ts
// =============================================
export function enterFullscreen(el: HTMLElement) {
const anyEl = el as any
;(el.requestFullscreen || anyEl.webkitRequestFullscreen || anyEl.msRequestFullscreen || anyEl.mozRequestFullScreen)?.call(el)
}


export function exitFullscreen() {
const anyDoc = document as any
;(document.exitFullscreen || anyDoc.webkitExitFullscreen || anyDoc.msExitFullscreen || anyDoc.mozCancelFullScreen)?.call(document)
}


export function isFullscreen() {
return !!(document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement || (document as any).msFullscreenElement)
}