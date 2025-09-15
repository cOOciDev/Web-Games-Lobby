// =============================================
// File: src/lib/input/keys.ts
// =============================================
export class KeyInput {
private down: Record<string, boolean> = {}
private onKeyDown = (e: KeyboardEvent) => { this.down[e.key.toLowerCase()] = true }
private onKeyUp = (e: KeyboardEvent) => { this.down[e.key.toLowerCase()] = false }


attach() {
window.addEventListener('keydown', this.onKeyDown)
window.addEventListener('keyup', this.onKeyUp)
}
detach() {
window.removeEventListener('keydown', this.onKeyDown)
window.removeEventListener('keyup', this.onKeyUp)
this.down = {}
}
pressed(k: string) { return !!this.down[k.toLowerCase()] }
}