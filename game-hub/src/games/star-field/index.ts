// =============================================
// File: src/games/star-field/index.ts
// =============================================
import type { GameDefinition } from '../../features/GameHub/types'
import { initStarField } from './StarField'

export const starFieldGame: GameDefinition = {
  id: 'star-field',
  title: 'Star Field',
  description: 'Fly through a dense starfield.',
  init: initStarField,
}
