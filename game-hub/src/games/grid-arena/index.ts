// =============================================
// File: src/games/grid-arena/index.ts
// =============================================
import { initGridArena } from './GridArena'
export const gridArenaGame = { id: 'grid-arena', title: 'Grid Arena', description: 'Top-down arena, avoid rotating traps.', init: initGridArena }