// =============================================
// File: src/features/gamehub/GameHub.tsx (no Tailwind; fullscreen + Play/Pause)
// =============================================
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react'
import type { GameDefinition, GameInstance } from './types'
import { GAMES } from './registry'
import Button from '../../components/ui/Button'
import { enterFullscreen, exitFullscreen, isFullscreen } from '../../lib/fullscreen'

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

const STORAGE_KEY = 'gamehub.activeId'

export default function GameHub() {
  const [games] = useState<GameDefinition[]>(GAMES)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [running, setRunning] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [fps, setFps] = useState<number>(0)

  const viewportRef = useRef<HTMLDivElement | null>(null) // fullscreen target
  const canvasRef = useRef<HTMLDivElement | null>(null)   // three.js canvas mount
  const overlayRef = useRef<HTMLDivElement | null>(null)  // per-game UI mount
  const instanceRef = useRef<GameInstance | null>(null)

  const activeGame = useMemo(
    () => games.find((g) => g.id === activeId) || null,
    [games, activeId],
  )

  // Host-level FPS meter
  useEffect(() => {
    let raf = 0,
      frames = 0,
      last = performance.now(),
      acc = 0
    const loop = (t: number) => {
      frames++
      const dt = t - last
      last = t
      acc += dt
      if (acc >= 500) {
        setFps(Math.round((frames * 1000) / acc))
        frames = 0
        acc = 0
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const leaveGame = useCallback(() => {
    try {
      instanceRef.current?.pause?.()
      instanceRef.current?.dispose?.()
    } catch {}
    instanceRef.current = null
    setRunning(false)
    setActiveId(null)
    setJoiningId(null)
    setError(null)
    localStorage.removeItem(STORAGE_KEY)
    if (canvasRef.current) canvasRef.current.innerHTML = ''
    if (overlayRef.current) overlayRef.current.innerHTML = ''
    if (isFullscreen()) exitFullscreen()
  }, [])

  const joinGame = useCallback(
    (id: string) => {
      if (!canvasRef.current || !overlayRef.current) return
      setJoiningId(id)
      try {
        if (instanceRef.current) {
          instanceRef.current.pause()
          instanceRef.current.dispose()
          instanceRef.current = null
        }
        const def = games.find((g) => g.id === id)
        if (!def) throw new Error(`Game not found: ${id}`)
        const instance = def.init({
          canvas: canvasRef.current,
          overlay: overlayRef.current,
        } as any) // if your types use GameInitArgs
        instanceRef.current = instance
        setActiveId(id)
        setRunning(false)
        setError(null)
        localStorage.setItem(STORAGE_KEY, id)
      } catch (e: any) {
        console.error('Failed to join game', e)
        setError(e?.message ?? 'Failed to start game')
      } finally {
        setJoiningId(null)
      }
    },
    [games],
  )

  const startGame = useCallback(() => {
    try {
      instanceRef.current?.start?.()
      setRunning(true)
      if (viewportRef.current && !isFullscreen()) {
        enterFullscreen(viewportRef.current)
      }
    } catch (e: any) {
      console.error('start failed', e)
      setError(e?.message ?? 'Failed to run game')
    }
  }, [])

  const pauseGame = useCallback(() => {
    try {
      instanceRef.current?.pause?.()
      setRunning(false)
    } catch {}
  }, [])

  // Cleanup on unmount
  useEffect(() => () => leaveGame(), [leaveGame])

  // Restore last loaded game
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && games.some((g) => g.id === saved)) {
      setTimeout(() => joinGame(saved), 0)
    }
  }, [games, joinGame])

  // ESC to leave
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') leaveGame()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [leaveGame])

  return (
    <div className="app-grid bg-grid">
      {/* Sidebar */}
      <aside className="sidebar card">
        <h2>
          <span className="dot" /> Game Lobby
        </h2>

        {/* Games list */}
        <ul className="list">
          {games.map((g) => {
            const isActive = activeId === g.id
            const isLoading = joiningId === g.id
            return (
              <li
                key={g.id}
                className={classNames(
                  'list__item',
                  isActive && 'list__item--active',
                )}
              >
                <div className="list__row">
                  <div>
                    <div className="item-title">{g.title}</div>
                    {g.description && (
                      <div className="item-desc">{g.description}</div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    {!isActive ? (
                      <Button
                        onClick={() => joinGame(g.id)}
                        disabled={isLoading}
                      >
                        {isLoading ? 'Loading…' : 'Load'}
                      </Button>
                    ) : (
                      <>
                        {!running ? (
                          <Button onClick={startGame}>Play (Fullscreen)</Button>
                        ) : (
                          <Button variant="danger" onClick={pauseGame}>
                            Pause
                          </Button>
                        )}
                        <Button variant="ghost" onClick={leaveGame}>
                          Close
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        <div
          className="tip"
          style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}
        >
          <p>
            Load a game, then press <b>Play</b> to enter fullscreen.
          </p>
          <p>
            Press <kbd>Esc</kbd> to leave.
          </p>
        </div>
      </aside>

      {/* Canvas Area */}
      <main className="main">
        <div
          ref={viewportRef}
          className="viewport card"
          role="application"
          aria-label="Three.js game viewport"
          tabIndex={0}
        >
          {/* HUD */}
          <div className="hud">
            <div className="hud__panel">
              {activeGame ? (
                <>
                  Loaded: <b>{activeGame.title}</b> —{' '}
                  {running ? 'Running' : 'Paused'}
                </>
              ) : (
                <>No game loaded</>
              )}
            </div>
            <div className="hud__panel">FPS: {fps}</div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="error" role="alert" aria-live="polite">
              {error}
            </div>
          )}

          {/* Game overlay mount (per-game DOM UI) */}
          <div
            ref={overlayRef}
            className="canvas-mount"
            style={{ pointerEvents: 'none' }}
          />
          {/* Three.js canvas mount */}
          <div ref={canvasRef} className="canvas-mount" />

          {/* Empty state */}
          {!activeGame && (
            <div className="empty">
              <div>
                <h3>Welcome to GameHub</h3>
                <div style={{ color: 'var(--muted)', fontSize: 14 }}>
                  Load a game from the left, then press Play.
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
