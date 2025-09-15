// File: src/features/gamehub/types.ts
// =============================================
export type GameInitArgs = {
canvas: HTMLDivElement; // where WebGLRenderer mounts
overlay: HTMLDivElement; // where game-specific UI DOM goes
onEvent?: (evt: { type: string; payload?: any }) => void; // optional event bridge
};


export type GameInstance = {
start: () => void; // begin gameplay loop
pause: () => void; // pause gameplay loop
dispose: () => void; // free all resources
isRunning: () => boolean;
};


export type GameDefinition = {
id: string;
title: string;
description?: string;
init: (args: GameInitArgs) => GameInstance;
};

