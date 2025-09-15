// =============================================
// File: src/features/gamehub/registry.ts (now 5 games)
// =============================================
import type { GameDefinition } from './types'
import { forestBeachGame } from '../../games/forest-beach'
import { spaceRunnerGame } from '../../games/space-runner'
import { starFieldGame } from '../../games/star-field'
import { gridArenaGame } from '../../games/grid-arena'
import { oceanGlideGame } from '../../games/ocean-glide'


export const GAMES: GameDefinition[] = [
forestBeachGame,
spaceRunnerGame,
starFieldGame,
gridArenaGame,
oceanGlideGame,
]