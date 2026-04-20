'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { RoomJSON } from '../../editor/editorStore';
import type {
  RoomRuntimeHandle,
  HUDSnapshot,
} from '../../game/rooms/RoomRuntime';
import type { RuntimeDoor } from '../../game/rooms/types';
import crates01 from '../../data/rooms/hunt/pool/crates_01.json';
import crates02 from '../../data/rooms/hunt/pool/crates_02.json';
import extraction from '../../data/rooms/hunt/fixed/extraction.json';
import voidHulkArena from '../../data/rooms/hunt/elite/void_hulk_arena.json';
import phaseHunterCover from '../../data/rooms/hunt/elite/phase_hunter_cover.json';
import broodMotherNest from '../../data/rooms/hunt/elite/brood_mother_nest.json';
import { registerAction } from '../../game/rooms/ActionRegistry';
import { useGameStore } from '../../store/gameStore';
import type { RoomModifierDef } from '../../data/modifiers';

// Index of rooms keyed by their `id` so doors can link via `nextPool`.
const ROOM_INDEX: Record<string, RoomJSON> = {
  hunt_pool_crates_01:           crates01       as unknown as RoomJSON,
  hunt_pool_crates_02:           crates02       as unknown as RoomJSON,
  hunt_fixed_extraction:         extraction     as unknown as RoomJSON,
  hunt_elite_void_hulk_arena:    voidHulkArena  as unknown as RoomJSON,
  hunt_elite_phase_hunter_cover: phaseHunterCover as unknown as RoomJSON,
  hunt_elite_brood_mother_nest:  broodMotherNest as unknown as RoomJSON,
};

const ELITE_DOORS: Array<{ nextPool: string; eliteType: string }> = [
  { nextPool: 'hunt_elite_void_hulk_arena',    eliteType: 'Void Hulk'    },
  { nextPool: 'hunt_elite_phase_hunter_cover', eliteType: 'Phase Hunter' },
  { nextPool: 'hunt_elite_brood_mother_nest',  eliteType: 'Brood Mother' },
];

// Inject a second (elite) door alongside the normal exit, from room 3 onward.
// Never injects into elite rooms themselves (they already have their own exits).
function maybeInjectEliteDoor(json: RoomJSON, roomsCleared: number): RoomJSON {
  if (roomsCleared < 2) return json;
  if (json.id.startsWith('hunt_elite_')) return json;
  if (Math.random() > 0.4) return json;

  const chosen = ELITE_DOORS[Math.floor(Math.random() * ELITE_DOORS.length)];
  const normalDoor = json.entities.find(e => e.type === 'door');
  const elitePos = normalDoor
    ? { x: normalDoor.pos.x, y: normalDoor.pos.y + 130 }
    : { x: json.size.w - 60, y: json.size.h - 120 };

  return {
    ...json,
    entities: [
      ...json.entities,
      {
        id: 'elite_door_injected',
        type: 'door' as const,
        pos: elitePos,
        radius: 45,
        rewardTag: 'elite',
        nextPool: chosen.nextPool,
        requiresCleared: true,
        label: `[Elite] ${chosen.eliteType}`,
        eliteType: chosen.eliteType,
      },
    ],
  };
}

const START_ROOM_ID = 'hunt_pool_crates_01';

interface RunState {
  startedAt: number;
  kills: number;
  roomsCleared: number;
}

export default function RunDemoPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<RoomRuntimeHandle | null>(null);

  const runPath = useGameStore(s => s.runPath);
  const runCorruption = useGameStore(s => s.runCorruption);
  const setRunPath = useGameStore(s => s.setRunPath);

  const [currentRoomId, setCurrentRoomId] = useState<string>(START_ROOM_ID);
  const [hud, setHud] = useState<HUDSnapshot>({
    hp: 10, maxHp: 10, kills: 0, spawned: 0, cleared: false,
  });
  const [prompt, setPrompt] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<'running' | 'success' | 'fail'>('running');
  const runStateRef = useRef<RunState>({ startedAt: Date.now(), kills: 0, roomsCleared: 0 });
  const pendingModifierRef = useRef<RoomModifierDef | undefined>(undefined);
  const [tick, setTick] = useState(0);
  const [roomSummary, setRoomSummary] = useState<{ killsInRoom: number; timeMs: number } | null>(null);

  // Action handlers for this run
  useEffect(() => {
    registerAction('complete_extraction', () => {
      // Accumulate final kills before showing summary
      const r = runtimeRef.current;
      if (r) {
        runStateRef.current.kills += r.getCombat().enemiesKilledTotal;
      }
      setOutcome('success');
    });
  }, []);

  const handleDoorUse = useCallback((door: RuntimeDoor) => {
    // Carry kills across rooms
    const r = runtimeRef.current;
    if (r) {
      runStateRef.current.kills += r.getCombat().enemiesKilledTotal;
      runStateRef.current.roomsCleared += 1;
    }
    // Corruption drift fires on each room transition, but only after path is chosen (post-Fork)
    const { runPath: path, applyCorruptionDrift } = useGameStore.getState();
    if (path !== null) applyCorruptionDrift();
    const next = door.nextPool;
    if (!next || !ROOM_INDEX[next]) {
      // End of chain without extraction
      setOutcome('success');
      return;
    }
    // Carry door modifier into the next room
    pendingModifierRef.current = door.modifier;
    setRoomSummary({
      killsInRoom: r?.getCombat().enemiesKilledTotal ?? 0,
      timeMs: Date.now() - runStateRef.current.startedAt,
    });
    setCurrentRoomId(next);
  }, []);

  const handleDeath = useCallback(() => {
    setOutcome('fail');
  }, []);

  // Boot room runtime whenever currentRoomId changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container || outcome !== 'running') return;

    const rawJson = ROOM_INDEX[currentRoomId];
    if (!rawJson) {
      console.error('[run-demo] unknown room id', currentRoomId);
      return;
    }
    const json = maybeInjectEliteDoor(rawJson, runStateRef.current.roomsCleared);

    // Small delay so a previous runtime finishes cleanup
    let cancelled = false;
    let localHandle: RoomRuntimeHandle | null = null;
    (async () => {
      const { createRoomRuntime } = await import('../../game/rooms/RoomRuntime');
      if (cancelled) return;

      // Tear down previous
      runtimeRef.current?.destroy();
      runtimeRef.current = null;

      try {
        const handle = await createRoomRuntime(container, json, {
          combat: true,
          zoom: 0.7,
          onHUD: setHud,
          onPromptChange: setPrompt,
          onDoorUse: handleDoorUse,
          onPlayerDeath: handleDeath,
          onBiomeTick: (delta) => useGameStore.getState().addCorruption(delta),
          activeRoomModifier: pendingModifierRef.current,
          debug: false,
        });
        if (cancelled) { handle.destroy(); return; }
        localHandle = handle;
        runtimeRef.current = handle;
        // Dev hook: expose runtime to window for browser-automation testing.
        (window as unknown as { __runDemo?: RoomRuntimeHandle }).__runDemo = handle;
        setTick((t) => t + 1);
      } catch (e) {
        console.error('[run-demo] runtime init failed', e);
      }
    })();

    return () => {
      cancelled = true;
      localHandle?.destroy();
      if (runtimeRef.current === localHandle) runtimeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoomId, outcome]);

  // Clear the short inter-room summary after 1.5s
  useEffect(() => {
    if (!roomSummary) return;
    const t = setTimeout(() => setRoomSummary(null), 1500);
    return () => clearTimeout(t);
  }, [roomSummary]);

  const hpPct = Math.max(0, hud.hp) / Math.max(1, hud.maxHp);
  const roomName = ROOM_INDEX[currentRoomId]?.name ?? currentRoomId;

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#080810',
        color: '#aabbcc',
        fontFamily: 'monospace',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Top HUD */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '6px 12px',
          background: '#0a0a14cc',
          borderBottom: '1px solid #1a2233',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          fontSize: 12,
        }}
      >
        <span style={{ color: '#556677', letterSpacing: 2, pointerEvents: 'none' }}>HUNT DEMO</span>
        <span style={{ color: '#aabbcc', pointerEvents: 'none' }}>{roomName}</span>
        {/* Path selector for testing */}
        <span style={{ color: '#445566', fontSize: 10 }}>PATH:</span>
        <button
          onClick={() => setRunPath('clean')}
          style={{
            fontSize: 10, padding: '1px 6px', cursor: 'pointer',
            border: `1px solid ${runPath === 'clean' ? '#44aaff' : '#334455'}`,
            color: runPath === 'clean' ? '#44aaff' : '#556677',
            background: runPath === 'clean' ? 'rgba(68,170,255,0.12)' : 'transparent',
          }}
        >CLEAN</button>
        <button
          onClick={() => setRunPath('void')}
          style={{
            fontSize: 10, padding: '1px 6px', cursor: 'pointer',
            border: `1px solid ${runPath === 'void' ? '#aa44ff' : '#334455'}`,
            color: runPath === 'void' ? '#aa44ff' : '#556677',
            background: runPath === 'void' ? 'rgba(170,68,255,0.12)' : 'transparent',
          }}
        >VOID</button>
        <span style={{ marginLeft: 'auto', color: hud.cleared ? '#33e633' : '#ffaa44', pointerEvents: 'none' }}>
          {hud.cleared ? 'CLEARED · exit through door' : `${hud.kills}/${hud.spawned} kills`}
        </span>
      </div>

      {/* HP bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          width: 180,
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: 2, color: '#556677', marginBottom: 2 }}>
          HP {Math.max(0, hud.hp)}/{hud.maxHp}
        </div>
        <div
          style={{
            height: 8,
            background: '#2a0e0e',
            border: '1px solid #334455',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${hpPct * 100}%`,
              background: hpPct > 0.3 ? '#33e633' : '#cc4444',
              transition: 'width 80ms linear',
            }}
          />
        </div>
      </div>

      {/* Corruption bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 210,
          width: 140,
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: 2, color: runPath === 'void' ? '#aa44ff' : runPath === 'clean' ? '#44aaff' : '#556677', marginBottom: 2 }}>
          CORRUPTION {Math.floor(runCorruption)}%
        </div>
        <div style={{ height: 8, background: '#1a0a2a', border: '1px solid #334455' }}>
          <div
            style={{
              height: '100%',
              width: `${Math.min(runCorruption, 100)}%`,
              background: runCorruption >= 80 ? '#cc2200' : runCorruption >= 50 ? '#cc8800' : '#6622cc',
              transition: 'width 120ms linear',
            }}
          />
        </div>
      </div>

      {/* Controls hint */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          fontSize: 10,
          color: '#445566',
          pointerEvents: 'none',
        }}
      >
        WASD move · click shoot · E interact
      </div>

      {/* Mid-screen prompt */}
      {prompt && outcome === 'running' && (
        <div
          style={{
            position: 'absolute',
            bottom: 50,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 16px',
            border: '1px solid #ffcc00',
            color: '#ffcc00',
            background: 'rgba(13,13,26,0.85)',
            fontSize: 12,
            letterSpacing: 1,
            pointerEvents: 'none',
          }}
        >
          {prompt}
        </div>
      )}

      {/* Inter-room flash summary */}
      {roomSummary && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '20px 28px',
            border: '1px solid #44ccff',
            color: '#aabbcc',
            background: 'rgba(13,13,26,0.95)',
            fontSize: 14,
            letterSpacing: 1,
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{ color: '#44ccff', letterSpacing: 3, fontSize: 11 }}>ROOM CLEARED</div>
          <div style={{ marginTop: 6 }}>{roomSummary.killsInRoom} kills · {(roomSummary.timeMs / 1000).toFixed(1)}s</div>
        </div>
      )}

      {/* Outcome overlays */}
      {outcome === 'success' && (
        <EndScreen
          title="EXTRACTION COMPLETE"
          color="#33e633"
          stats={{
            rooms: runStateRef.current.roomsCleared,
            kills: runStateRef.current.kills,
            timeSec: ((Date.now() - runStateRef.current.startedAt) / 1000).toFixed(1),
          }}
        />
      )}
      {outcome === 'fail' && (
        <EndScreen
          title="HUNTER DOWN"
          color="#cc4444"
          stats={{
            rooms: runStateRef.current.roomsCleared,
            kills: runStateRef.current.kills + (runtimeRef.current?.getCombat().enemiesKilledTotal ?? 0),
            timeSec: ((Date.now() - runStateRef.current.startedAt) / 1000).toFixed(1),
          }}
        />
      )}

      {/* Debug tick so React re-renders when runtime attaches */}
      <div style={{ display: 'none' }}>{tick}</div>
    </div>
  );
}

function EndScreen({
  title,
  color,
  stats,
}: {
  title: string;
  color: string;
  stats: { rooms: number; kills: number; timeSec: string };
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(5,5,8,0.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 20,
        color: '#aabbcc',
        fontFamily: 'monospace',
      }}
    >
      <div style={{ color, fontSize: 16, letterSpacing: 4 }}>{title}</div>
      <div style={{ fontSize: 13 }}>
        {stats.rooms} rooms · {stats.kills} kills · {stats.timeSec}s
      </div>
      <button
        onClick={() => { window.location.href = '/run-demo'; }}
        style={{
          padding: '8px 16px',
          border: `1px solid ${color}`,
          color,
          background: 'transparent',
          fontFamily: 'monospace',
          fontSize: 12,
          letterSpacing: 2,
          cursor: 'pointer',
        }}
      >
        RETRY
      </button>
    </div>
  );
}
