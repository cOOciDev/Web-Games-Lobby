import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as THREE from "three";

/**
 * GameHub — a drop‑in React component to host multiple Three.js mini‑games.
 * - Left menu lists games with Join / Leave controls
 * - The canvas area mounts the active game's renderer
 * - Each game exposes init(container) => { dispose } to cleanup resources
 * - Fully self‑contained demo with two sample games
 *
 * Usage:
 *   <GameHub />
 *
 * Integration tips:
 * - Replace SAMPLE_GAMES with your real game registry
 * - Each game should manage its own scene, renderer, loop, and listeners
 * - Game dispose() MUST stop raf, remove listeners, and dispose WebGL resources
 */

// -----------------------------
// Types
// -----------------------------
export type GameInstance = {
  dispose: () => void;
};

export type GameDefinition = {
  id: string;
  title: string;
  description?: string;
  init: (container: HTMLDivElement) => GameInstance;
};

// -----------------------------
// Utility: handle common renderer + resize plumbing
// -----------------------------
function createRenderer(container: HTMLDivElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  return renderer;
}

function makeResizeHandler(
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
  container: HTMLDivElement
) {
  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener("resize", onResize);
  onResize();
  return () => window.removeEventListener("resize", onResize);
}

// -----------------------------
// Sample Game 1: Forest & Beach (with random trees)
// -----------------------------
const ForestBeachGame: GameDefinition = {
  id: "forest-beach",
  title: "Forest & Beach",
  description: "Left: forest with random trees. Right: beach with water plane.",
  init(container) {
    const scene = new THREE.Scene();
    scene.background = null; // transparent so parent bg shows through

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
    camera.position.set(12, 10, 16);
    camera.lookAt(0, 0, 0);

    const renderer = createRenderer(container);

    // Lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 1.0);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(5, 10, 4);
    scene.add(dir);

    // Ground split: forest (x < 0), beach/water (x > 0)
    const ground = new THREE.Group();
    scene.add(ground);

    // Forest ground
    const forestGeom = new THREE.PlaneGeometry(20, 20, 1, 1);
    const forestMat = new THREE.MeshStandardMaterial({ color: 0x2f5d3b });
    const forest = new THREE.Mesh(forestGeom, forestMat);
    forest.rotation.x = -Math.PI / 2;
    forest.position.set(-5, 0, 0);
    forest.scale.set(0.5, 1, 1);
    ground.add(forest);

    // Beach sand
    const sandGeom = new THREE.PlaneGeometry(20, 20, 1, 1);
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xcab084 });
    const sand = new THREE.Mesh(sandGeom, sandMat);
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(5, 0.001, 0);
    sand.scale.set(0.5, 1, 1);
    ground.add(sand);

    // Water plane (a bit lower so it "meets" the sand)
    const waterGeom = new THREE.PlaneGeometry(20, 8, 32, 32);
    const waterMat = new THREE.MeshPhongMaterial({
      color: 0x3aa7e1,
      transparent: true,
      opacity: 0.9,
      shininess: 100,
    });
    const water = new THREE.Mesh(waterGeom, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(8.5, 0.002, 0);
    water.scale.set(0.25, 1, 1);
    ground.add(water);

    // Random cylinders as tree trunks + foliage
    const trees = new THREE.Group();
    for (let i = 0; i < 80; i++) {
      const trunkH = 0.8 + Math.random() * 1.6;
      const trunkGeom = new THREE.CylinderGeometry(0.08, 0.12, trunkH, 8);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5230 });
      const trunk = new THREE.Mesh(trunkGeom, trunkMat);

      const foliageGeom = new THREE.SphereGeometry(0.5 + Math.random() * 0.4, 16, 12);
      const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32 });
      const foliage = new THREE.Mesh(foliageGeom, foliageMat);

      const x = -10 + Math.random() * 9.0; // forest half
      const z = -9 + Math.random() * 18;
      trunk.position.set(x, trunkH / 2, z);
      foliage.position.set(x, trunkH + 0.4, z);

      trees.add(trunk);
      trees.add(foliage);
    }
    scene.add(trees);

    // A simple reference player marker
    const playerGeom = new THREE.BoxGeometry(0.6, 1.2, 0.6);
    const playerMat = new THREE.MeshStandardMaterial({ color: 0xff6f61 });
    const player = new THREE.Mesh(playerGeom, playerMat);
    player.position.set(-2, 0.6, 0);
    scene.add(player);

    // Orbit-like slow camera drift
    let elapsed = 0;
    let raf = 0;
    const clock = new THREE.Clock();

    // Subtle water wobble
    const waterPos = (water.geometry as THREE.PlaneGeometry).attributes.position as THREE.BufferAttribute;

    const render = () => {
      const dt = clock.getDelta();
      elapsed += dt;

      // animate water
      for (let i = 0; i < waterPos.count; i++) {
        const ix = i * 3 + 2; // z component for slight ripple (since plane is rotated, visual is okay)
        const x = waterPos.getX(i);
        const y = waterPos.getY(i);
        const wave = Math.sin((x + elapsed * 2.0) * 0.7) * Math.cos((y - elapsed * 1.5) * 0.6) * 0.05;
        waterPos.setZ(i, wave);
      }
      waterPos.needsUpdate = true;

      // gentle cam orbit
      const r = 16;
      const cx = Math.cos(elapsed * 0.2) * r;
      const cz = Math.sin(elapsed * 0.2) * r;
      camera.position.set(cx, 10, cz);
      camera.lookAt(0, 0.5, 0);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };

    const removeResize = makeResizeHandler(renderer, camera, container);
    render();

    return {
      dispose() {
        cancelAnimationFrame(raf);
        removeResize();
        // remove and dispose renderer
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentElement) {
          renderer.domElement.parentElement.removeChild(renderer.domElement);
        }
        // basic scene cleanup
        scene.traverse((obj) => {
          if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose?.();
          if ((obj as THREE.Mesh).material) {
            const m = (obj as THREE.Mesh).material as THREE.Material | THREE.Material[];
            if (Array.isArray(m)) m.forEach((mm) => mm.dispose?.());
            else m.dispose?.();
          }
        });
      },
    };
  },
};

// -----------------------------
// Sample Game 2: Space Runner (minimal, spinning cubes)
// -----------------------------
const SpaceRunnerGame: GameDefinition = {
  id: "space-runner",
  title: "Space Runner",
  description: "A neon grid with spinning obstacles.",
  init(container) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e0f12);

    const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 1000);
    camera.position.set(0, 3.5, 7);

    const renderer = createRenderer(container);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const spot = new THREE.SpotLight(0xffffff, 1.2, 50, Math.PI / 4, 0.5, 1);
    spot.position.set(5, 8, 4);
    scene.add(ambient, spot);

    // Grid floor
    const grid = new THREE.GridHelper(40, 40, 0x93c5fd, 0x3b82f6);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.4;
    scene.add(grid);

    // Obstacles
    const group = new THREE.Group();
    for (let i = 0; i < 24; i++) {
      const geo = new THREE.BoxGeometry(0.7 + Math.random(), 0.7 + Math.random(), 0.7 + Math.random());
      const mat = new THREE.MeshStandardMaterial({ metalness: 0.6, roughness: 0.2, color: new THREE.Color().setHSL(Math.random(), 0.6, 0.5) });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((Math.random() - 0.5) * 12, Math.random() * 3 + 0.5, -Math.random() * 18);
      group.add(mesh);
    }
    scene.add(group);

    let raf = 0;
    const clock = new THREE.Clock();

    const render = () => {
      const t = clock.getElapsedTime();
      group.children.forEach((c, idx) => {
        c.rotation.x = t * 0.3 + idx * 0.1;
        c.rotation.y = t * 0.2 + idx * 0.05;
      });
      camera.position.x = Math.sin(t * 0.3) * 2.0;
      camera.lookAt(0, 1.2, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };

    const removeResize = makeResizeHandler(renderer, camera, container);
    render();

    return {
      dispose() {
        cancelAnimationFrame(raf);
        removeResize();
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentElement) {
          renderer.domElement.parentElement.removeChild(renderer.domElement);
        }
        scene.traverse((obj) => {
          if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose?.();
          if ((obj as THREE.Mesh).material) {
            const m = (obj as THREE.Mesh).material as THREE.Material | THREE.Material[];
            if (Array.isArray(m)) m.forEach((mm) => mm.dispose?.());
            else m.dispose?.();
          }
        });
      },
    };
  },
};

// -----------------------------
// Registry
// -----------------------------
const SAMPLE_GAMES: GameDefinition[] = [ForestBeachGame, SpaceRunnerGame];

// -----------------------------
// UI Helpers
// -----------------------------
function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// -----------------------------
// Main Component
// -----------------------------
export default function GameHub() {
  const [games] = useState<GameDefinition[]>(SAMPLE_GAMES);
  const [activeId, setActiveId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<GameInstance | null>(null);

  const activeGame = useMemo(() => games.find((g) => g.id === activeId) || null, [games, activeId]);

  const leaveGame = useCallback(() => {
    instanceRef.current?.dispose?.();
    instanceRef.current = null;
    setActiveId(null);
    // Clear canvas container
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }
  }, []);

  const joinGame = useCallback(
    (id: string) => {
      if (!containerRef.current) return;
      // leave previous
      if (instanceRef.current) {
        instanceRef.current.dispose();
        instanceRef.current = null;
      }
      const def = games.find((g) => g.id === id);
      if (!def) return;
      const instance = def.init(containerRef.current);
      instanceRef.current = instance;
      setActiveId(id);
    },
    [games]
  );

  // Safety cleanup on unmount
  useEffect(() => () => leaveGame(), [leaveGame]);

  return (
    <div className="w-full h-[80vh] grid grid-cols-12 gap-4 p-4 bg-[#0e0f12] text-slate-200">
      {/* Sidebar */}
      <aside className="col-span-12 md:col-span-3 lg:col-span-3 xl:col-span-2 bg-black/40 rounded-2xl p-3 backdrop-blur border border-white/5">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Game Lobby
        </h2>

        <ul className="space-y-2">
          {games.map((g) => {
            const isActive = activeId === g.id;
            return (
              <li key={g.id} className={classNames("rounded-xl p-3 border", isActive ? "border-emerald-400/40 bg-emerald-400/5" : "border-white/10 bg-white/5")}> 
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{g.title}</div>
                    {g.description && <div className="text-xs text-slate-400 mt-0.5">{g.description}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    {!isActive ? (
                      <button onClick={() => joinGame(g.id)} className="px-3 py-1.5 rounded-lg bg-emerald-500/90 hover:bg-emerald-400 text-black text-sm font-semibold transition">
                        Join
                      </button>
                    ) : (
                      <button onClick={leaveGame} className="px-3 py-1.5 rounded-lg bg-rose-500/90 hover:bg-rose-400 text-black text-sm font-semibold transition">
                        Leave
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 text-[11px] text-slate-400 leading-relaxed">
          <p>Tip: Replace the demo games with your own by updating <code>SAMPLE_GAMES</code>. Each game should return a <code>dispose()</code> function.</p>
        </div>
      </aside>

      {/* Canvas Area */}
      <main className="col-span-12 md:col-span-9 lg:col-span-9 xl:col-span-10 relative rounded-2xl border border-white/5 bg-gradient-to-br from-slate-900/60 to-slate-950/60 overflow-hidden">
        {/* HUD */}
        <div className="absolute z-10 top-3 left-3 right-3 flex items-center justify-between">
          <div className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-xs">
            {activeGame ? (
              <span>Playing: <b>{activeGame.title}</b> — press <kbd className="px-1 bg-white/10 rounded">Leave</kbd> to exit</span>
            ) : (
              <span>Not in a game — choose one from the lobby</span>
            )}
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-xs">FPS depends on your device</div>
        </div>

        {/* Three.js mount point */}
        <div ref={containerRef} className="absolute inset-0" />

        {/* Fallback / Empty state visual */}
        {!activeGame && (
          <div className="absolute inset-0 grid place-items-center select-none">
            <div className="text-center">
              <div className="text-2xl font-semibold mb-2">Welcome to GameHub</div>
              <div className="text-slate-400">Join a game from the left to start playing.</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
