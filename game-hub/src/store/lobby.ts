// =============================
// File: src/store/lobby.ts
// =============================
import { create } from 'zustand'


interface LobbyState {
activeId: string | null
join: (id: string) => void
leave: () => void
}


export const useLobby = create<LobbyState>((set) => ({
activeId: null,
join: (id) => set({ activeId: id }),
leave: () => set({ activeId: null }),
}))