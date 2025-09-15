// =============================
// File: src/games/space-runner/index.ts
// =============================
import { initSpaceRunner } from './SpaceRunner'


export const spaceRunnerGame = {
id: 'space-runner',
title: 'Space Runner',
description: 'A neon grid with spinning obstacles',
init: initSpaceRunner,
}