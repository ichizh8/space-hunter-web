'use client';

import dynamic from 'next/dynamic';
import { useRef } from 'react';
import {
  useEditorStore,
  serializeLevel,
  newWaveId,
  type ToolMode,
  type RoomKind,
  type EditorEntity,
  type RoomJSON,
  type LegacySerializedLevel,
  OBSTACLE_CATALOG,
  CAVE_PRESETS,
  VOID_POOL_PRESETS,
  SURFACE_TYPES,
} from '../../editor/editorStore';
import { CREATURE_NAMES } from '../../data/creatures';

const EditorCanvas = dynamic(
  () => import('../../editor/EditorCanvas').then((m) => m.EditorCanvas),
  { ssr: false }
);

// ---- Tool definitions -------------------------------------------------------
const TOOL_GROUPS: { label: string; tools: { id: ToolMode; label: string; color: string }[] }[] = [
  {
    label: 'Core',
    tools: [
      { id: 'select',       label: 'Select',       color: '#aabbcc' },
      { id: 'surface',      label: 'Surface',      color: '#4a8a6a' },
    ],
  },
  {
    label: 'Terrain',
    tools: [
      { id: 'cave',         label: 'Cave',         color: '#556677' },
      { id: 'void_pool',    label: 'Void Pool',    color: '#8822cc' },
      { id: 'obstacle',     label: 'Obstacle',     color: '#445566' },
    ],
  },
  {
    label: 'Spawn',
    tools: [
      { id: 'player_spawn', label: 'Player',       color: '#00ccff' },
      { id: 'enemy',        label: 'Enemy',        color: '#cc3333' },
      { id: 'interactable', label: 'Interactable', color: '#ffcc00' },
      { id: 'spawn_zone',   label: 'Spawn Zone',   color: '#ff6644' },
      { id: 'zone',         label: 'Zone',         color: '#ffcc00' },
    ],
  },
  {
    label: 'Map',
    tools: [
      { id: 'entrance',     label: 'Entrance',     color: '#22cc66' },
      { id: 'exit',         label: 'Exit',         color: '#ff3333' },
      { id: 'door',         label: 'Door',         color: '#44ccff' },
    ],
  },
  {
    label: 'Objects',
    tools: [
      { id: 'npc',          label: 'NPC',          color: '#4488ff' },
      { id: 'loot_cache',   label: 'Loot Cache',   color: '#ffcc00' },
      { id: 'trigger_zone', label: 'Trigger Zone', color: '#ffaa44' },
      { id: 'no_spawn',     label: 'No-Spawn',     color: '#ff4444' },
    ],
  },
];

const ROOM_KINDS: { id: RoomKind; label: string }[] = [
  { id: 'arena',      label: 'Arena (big map)' },
  { id: 'hub',        label: 'Hub' },
  { id: 'fixed',      label: 'Fixed' },
  { id: 'pool',       label: 'Pool' },
  { id: 'chain_link', label: 'Chain Link' },
];

const BIOMES = ['void_waste', 'crater_field', 'ruin_city', 'ice_crypt', 'crystal_garden'];

const WAVE_PALETTE = [
  '#e67e22', '#3498db', '#2ecc71', '#9b59b6',
  '#e74c3c', '#1abc9c', '#f39c12', '#8e44ad',
];

// ---- Context sidebar panels -------------------------------------------------

function ObstacleCatalogPanel() {
  const store = useEditorStore();
  const groups = ['Structural', 'Industrial', 'Doors'] as const;
  return (
    <div className="flex flex-col gap-1 px-1 pt-1">
      <div className="text-[9px] uppercase tracking-wider px-1 pb-0.5" style={{ color: '#445566' }}>
        Variant
      </div>
      {groups.map((g) => (
        <div key={g} className="flex flex-col gap-0.5">
          <div className="text-[9px] px-1" style={{ color: '#334455' }}>{g}</div>
          {OBSTACLE_CATALOG.filter((o) => o.group === g).map((o) => {
            const active = store.activeObstacleVariant === o.variant;
            return (
              <button
                key={o.variant}
                onClick={() => store.setActiveObstacleVariant(o.variant)}
                className="text-left px-1.5 py-0.5 text-[10px] border transition-all leading-tight"
                style={{
                  borderColor: active ? '#445566' : '#1a2233',
                  color: active ? '#aabbcc' : '#556677',
                  background: active ? '#22334411' : 'transparent',
                }}
              >
                {o.variant}
                <span className="ml-1 text-[8px]" style={{ color: '#334455' }}>
                  {o.w}x{o.h}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function CaveSizePanel() {
  const store = useEditorStore();
  return (
    <div className="flex flex-col gap-1 px-1 pt-1">
      <div className="text-[9px] uppercase tracking-wider px-1 pb-0.5" style={{ color: '#445566' }}>Cave Size</div>
      {CAVE_PRESETS.map((p) => {
        const active = store.activeCaveSize === p.label;
        return (
          <button
            key={p.label}
            onClick={() => store.setActiveCaveSize(p.label)}
            className="text-left px-2 py-1 text-[10px] border transition-all"
            style={{
              borderColor: active ? '#556677' : '#1a2233',
              color: active ? '#aabbcc' : '#556677',
              background: active ? '#22334411' : 'transparent',
            }}
          >
            {p.label}
            <span className="ml-1 text-[9px]" style={{ color: '#334455' }}>r={p.radius}</span>
          </button>
        );
      })}
    </div>
  );
}

function VoidPoolSizePanel() {
  const store = useEditorStore();
  return (
    <div className="flex flex-col gap-1 px-1 pt-1">
      <div className="text-[9px] uppercase tracking-wider px-1 pb-0.5" style={{ color: '#445566' }}>Pool Size</div>
      {VOID_POOL_PRESETS.map((p) => {
        const active = store.activeVoidPoolSize === p.label;
        return (
          <button
            key={p.label}
            onClick={() => store.setActiveVoidPoolSize(p.label)}
            className="text-left px-2 py-1 text-[10px] border transition-all"
            style={{
              borderColor: active ? '#8822cc' : '#1a2233',
              color: active ? '#aabbcc' : '#556677',
              background: active ? '#8822cc11' : 'transparent',
            }}
          >
            {p.label}
            <span className="ml-1 text-[9px]" style={{ color: '#334455' }}>r={p.radius}</span>
          </button>
        );
      })}
    </div>
  );
}

function SurfacePanel() {
  const store = useEditorStore();
  const brushSizes = [1, 3, 5, 7] as const;

  return (
    <div className="flex flex-col gap-2 px-1 pt-1">
      {/* Surface type swatches */}
      <div>
        <div className="text-[9px] uppercase tracking-wider px-1 pb-1" style={{ color: '#445566' }}>Type</div>
        <div className="grid gap-0.5" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {SURFACE_TYPES.map((st) => {
            const active = store.activeSurfaceType === st.id;
            return (
              <button
                key={st.id}
                onClick={() => store.setActiveSurfaceType(st.id)}
                className="flex items-center gap-1 px-1 py-0.5 text-[9px] border transition-all"
                style={{
                  borderColor: active ? '#aabbcc' : '#1a2233',
                  color: active ? '#aabbcc' : '#556677',
                  background: active ? '#aabbcc11' : 'transparent',
                }}
              >
                <span
                  className="inline-block shrink-0"
                  style={{
                    width: 8, height: 8,
                    background: st.color ?? 'transparent',
                    border: st.color ? 'none' : '1px solid #334455',
                  }}
                />
                <span className="truncate">{st.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Brush size */}
      <div>
        <div className="text-[9px] uppercase tracking-wider px-1 pb-1" style={{ color: '#445566' }}>Brush</div>
        <div className="flex gap-1 px-1">
          {brushSizes.map((sz) => {
            const active = store.brushSize === sz;
            return (
              <button
                key={sz}
                onClick={() => store.setBrushSize(sz)}
                className="flex-1 py-0.5 text-[10px] border transition-all"
                style={{
                  borderColor: active ? '#4a8a6a' : '#1a2233',
                  color: active ? '#4a8a6a' : '#556677',
                  background: active ? '#4a8a6a11' : 'transparent',
                }}
              >
                {sz}x{sz}
              </button>
            );
          })}
        </div>
      </div>

      {/* Fill / Eraser mode */}
      <div className="flex flex-col gap-1 px-1">
        <button
          onClick={() => store.setFillMode(!store.fillMode)}
          className="py-0.5 text-[10px] border transition-all"
          style={{
            borderColor: store.fillMode ? '#4a8a6a' : '#1a2233',
            color: store.fillMode ? '#4a8a6a' : '#556677',
            background: store.fillMode ? '#4a8a6a11' : 'transparent',
          }}
        >
          {store.fillMode ? 'Fill Mode ON' : 'Fill Mode'}
        </button>
        <button
          onClick={() => { store.setActiveSurfaceType(0); store.setFillMode(false); }}
          className="py-0.5 text-[10px] border transition-all"
          style={{ borderColor: '#1a2233', color: '#556677' }}
        >
          Eraser
        </button>
      </div>
    </div>
  );
}

// ---- Room Metadata Panel ---------------------------------------------------
function RoomMetadataPanel() {
  const store = useEditorStore();

  const tagsStr = store.contractTags.join(', ');
  const modsStr = store.modifiers.join(', ');

  return (
    <div className="p-3 flex flex-col gap-3 text-xs" style={{ color: '#aabbcc' }}>
      <div className="font-bold uppercase tracking-widest" style={{ color: '#8899aa' }}>
        Room Metadata
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Kind</label>
        <select
          value={store.roomKind}
          onChange={(e) => store.setRoomKind(e.target.value as RoomKind)}
          className="bg-transparent border px-2 py-1 font-mono"
          style={{ borderColor: '#223344', color: '#aabbcc', background: '#0a0a14' }}
        >
          {ROOM_KINDS.map((k) => (
            <option key={k.id} value={k.id}>{k.label}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Biome</label>
        <select
          value={store.biome}
          onChange={(e) => store.setBiome(e.target.value)}
          className="bg-transparent border px-2 py-1 font-mono"
          style={{ borderColor: '#223344', color: '#aabbcc', background: '#0a0a14' }}
        >
          {BIOMES.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>
          Contract Tags (comma-separated)
        </label>
        <input
          type="text"
          value={tagsStr}
          onChange={(e) =>
            store.setContractTags(
              e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            )
          }
          placeholder="hunt, boss_hunt, extraction"
          className="w-full bg-transparent border px-2 py-1 font-mono"
          style={{ borderColor: '#223344', color: '#aabbcc' }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>
          Difficulty ({store.difficulty})
        </label>
        <input
          type="range"
          min={1}
          max={5}
          value={store.difficulty}
          onChange={(e) => store.setDifficulty(Number(e.target.value))}
          className="w-full"
          style={{ accentColor: '#ff6644' }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>
          Modifiers (comma-separated)
        </label>
        <input
          type="text"
          value={modsStr}
          onChange={(e) =>
            store.setModifiers(
              e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            )
          }
          placeholder="dark, elite_only, burning"
          className="w-full bg-transparent border px-2 py-1 font-mono"
          style={{ borderColor: '#223344', color: '#aabbcc' }}
        />
      </div>
    </div>
  );
}

// ---- Properties Panel ------------------------------------------------------
function PropertiesPanel() {
  const store    = useEditorStore();
  const selected = store.entities.find((e) => e.id === store.selectedEntityId);

  if (!selected) {
    return (
      <div className="p-3 text-xs" style={{ color: '#556677' }}>
        No selection.<br />Click an entity to inspect it.
      </div>
    );
  }

  const update = (patch: Partial<EditorEntity>) =>
    store.updateEntity(selected.id, patch);

  return (
    <div className="p-3 flex flex-col gap-3 text-xs overflow-y-auto" style={{ color: '#aabbcc' }}>
      <div className="font-bold uppercase tracking-widest" style={{ color: '#8899aa' }}>
        {selected.type.replace(/_/g, ' ')}
      </div>

      {/* Position */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Position</label>
        <div className="flex gap-2">
          <input type="number" value={selected.pos.x}
            onChange={(e) => update({ pos: { ...selected.pos, x: Number(e.target.value) } })}
            className="w-full bg-transparent border px-2 py-1 font-mono"
            style={{ borderColor: '#223344', color: '#aabbcc' }} />
          <input type="number" value={selected.pos.y}
            onChange={(e) => update({ pos: { ...selected.pos, y: Number(e.target.value) } })}
            className="w-full bg-transparent border px-2 py-1 font-mono"
            style={{ borderColor: '#223344', color: '#aabbcc' }} />
        </div>
      </div>

      {/* Radius — for circular entities */}
      {selected.radius !== undefined && (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Radius</label>
          <input type="number" min={5} max={800} value={selected.radius}
            onChange={(e) => update({ radius: Number(e.target.value) })}
            className="w-full bg-transparent border px-2 py-1 font-mono"
            style={{ borderColor: '#223344', color: '#aabbcc' }} />
          <input type="range" min={5} max={800} value={selected.radius}
            onChange={(e) => update({ radius: Number(e.target.value) })}
            className="w-full" style={{ accentColor: '#8822cc' }} />
        </div>
      )}

      {/* Width / Height — obstacle + rect-based zones */}
      {(selected.type === 'obstacle' ||
        selected.type === 'spawn_zone' ||
        (selected.type === 'trigger_zone' && (selected.width !== undefined || selected.height !== undefined))) && (
        <div className="flex gap-2">
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Width</label>
            <input type="number" min={8} value={selected.width ?? 64}
              onChange={(e) => update({ width: Number(e.target.value) })}
              className="w-full bg-transparent border px-2 py-1 font-mono"
              style={{ borderColor: '#223344', color: '#aabbcc' }} />
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Height</label>
            <input type="number" min={8} value={selected.height ?? 64}
              onChange={(e) => update({ height: Number(e.target.value) })}
              className="w-full bg-transparent border px-2 py-1 font-mono"
              style={{ borderColor: '#223344', color: '#aabbcc' }} />
          </div>
        </div>
      )}

      {/* Obstacle variant display */}
      {selected.type === 'obstacle' && (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Variant</label>
          <select
            value={selected.variant ?? ''}
            onChange={(e) => {
              const { w, h } = OBSTACLE_CATALOG.find((o) => o.variant === e.target.value)
                ?? { w: 64, h: 64 };
              update({ variant: e.target.value, width: w, height: h });
            }}
            className="bg-transparent border px-2 py-1 font-mono text-xs"
            style={{ borderColor: '#223344', color: '#aabbcc', background: '#0a0a14' }}
          >
            <option value="">(custom)</option>
            {OBSTACLE_CATALOG.map((o) => (
              <option key={o.variant} value={o.variant}>{o.variant} {o.w}x{o.h}</option>
            ))}
          </select>
        </div>
      )}

      {/* Enemy-specific */}
      {selected.type === 'enemy_spawn' && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Creature</label>
            <select
              value={selected.creature ?? 'Void Leech'}
              onChange={(e) => update({ creature: e.target.value })}
              className="bg-transparent border px-2 py-1 font-mono"
              style={{ borderColor: '#223344', color: '#aabbcc', background: '#0a0a14' }}
            >
              {CREATURE_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Count</label>
            <input type="number" min={1} max={50} value={selected.count ?? 1}
              onChange={(e) => update({ count: Number(e.target.value) })}
              className="w-full bg-transparent border px-2 py-1 font-mono"
              style={{ borderColor: '#223344', color: '#aabbcc' }} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={selected.isElite ?? false}
              onChange={(e) => update({ isElite: e.target.checked })}
              style={{ accentColor: '#ffcc00' }} />
            <span>Elite</span>
          </label>
          <WaveAssignDropdown entityId={selected.id} currentWaveId={selected.waveId} />
        </>
      )}

      {/* Interactable */}
      {(selected.type === 'interactable' || selected.type === 'interaction_zone') && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Kind</label>
            <input
              type="text"
              value={selected.kind ?? ''}
              onChange={(e) => update({ kind: e.target.value })}
              placeholder="contract_board, hal, workbench"
              className="w-full bg-transparent border px-2 py-1 font-mono"
              style={{ borderColor: '#223344', color: '#aabbcc' }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Prompt</label>
            <input
              type="text"
              value={selected.prompt ?? ''}
              onChange={(e) => update({ prompt: e.target.value })}
              placeholder="Press E: View Contracts"
              className="w-full bg-transparent border px-2 py-1 font-mono"
              style={{ borderColor: '#223344', color: '#aabbcc' }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Action ID</label>
            <input
              type="text"
              value={selected.action ?? ''}
              onChange={(e) => update({ action: e.target.value })}
              placeholder="open_contract_board"
              className="w-full bg-transparent border px-2 py-1 font-mono"
              style={{ borderColor: '#223344', color: '#aabbcc' }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Label</label>
            <input
              type="text"
              value={selected.label ?? ''}
              onChange={(e) => update({ label: e.target.value })}
              className="w-full bg-transparent border px-2 py-1 font-mono"
              style={{ borderColor: '#223344', color: '#aabbcc' }}
            />
          </div>
        </>
      )}

      {/* Spawn zone */}
      {selected.type === 'spawn_zone' && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Pool Tag</label>
            <input
              type="text"
              value={selected.poolTag ?? ''}
              onChange={(e) => update({ poolTag: e.target.value })}
              placeholder="hunt_tier2"
              className="w-full bg-transparent border px-2 py-1 font-mono"
              style={{ borderColor: '#223344', color: '#aabbcc' }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Budget (max enemies)</label>
            <input
              type="number"
              min={1}
              max={200}
              value={selected.budget ?? 8}
              onChange={(e) => update({ budget: Number(e.target.value) })}
              className="w-full bg-transparent border px-2 py-1 font-mono"
              style={{ borderColor: '#223344', color: '#aabbcc' }}
            />
          </div>
          <WaveAssignDropdown entityId={selected.id} currentWaveId={selected.waveId} />
        </>
      )}

      {/* Trigger zone (RoomJSON style) */}
      {selected.type === 'trigger_zone' && (selected.width !== undefined || selected.height !== undefined) && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Trigger On</label>
            <select
              value={selected.triggerOn ?? 'enter'}
              onChange={(e) =>
                update({ triggerOn: e.target.value as EditorEntity['triggerOn'] })
              }
              className="bg-transparent border px-2 py-1 font-mono"
              style={{ borderColor: '#223344', color: '#aabbcc', background: '#0a0a14' }}
            >
              <option value="enter">enter</option>
              <option value="all_enemies_dead">all_enemies_dead</option>
              <option value="timer">timer</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>
              Actions (comma-separated)
            </label>
            <input
              type="text"
              value={(selected.triggerActions ?? []).join(', ')}
              onChange={(e) =>
                update({
                  triggerActions: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="lock_doors, start_wave:w_intro"
              className="w-full bg-transparent border px-2 py-1 font-mono"
              style={{ borderColor: '#223344', color: '#aabbcc' }}
            />
          </div>
        </>
      )}

      {/* Door */}
      {selected.type === 'door' && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Label</label>
            <input
              type="text"
              value={selected.label ?? ''}
              onChange={(e) => update({ label: e.target.value })}
              placeholder="Exit North"
              className="w-full bg-transparent border px-2 py-1 font-mono"
              style={{ borderColor: '#223344', color: '#aabbcc' }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Reward Tag</label>
            <select
              value={selected.rewardTag ?? 'mystery'}
              onChange={(e) => update({ rewardTag: e.target.value })}
              className="bg-transparent border px-2 py-1 font-mono"
              style={{ borderColor: '#223344', color: '#aabbcc', background: '#0a0a14' }}
            >
              <option value="weapon">weapon</option>
              <option value="heal">heal</option>
              <option value="perk">perk</option>
              <option value="credits">credits</option>
              <option value="mystery">mystery</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Next Pool Tag</label>
            <input
              type="text"
              value={selected.nextPool ?? ''}
              onChange={(e) => update({ nextPool: e.target.value })}
              placeholder="hunt_tier3"
              className="w-full bg-transparent border px-2 py-1 font-mono"
              style={{ borderColor: '#223344', color: '#aabbcc' }}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.requiresCleared ?? false}
              onChange={(e) => update({ requiresCleared: e.target.checked })}
              style={{ accentColor: '#ffcc00' }}
            />
            <span>Requires room cleared</span>
          </label>
        </>
      )}

      {/* Entrance */}
      {selected.type === 'entrance' && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Source Map</label>
            <input type="text" value={selected.sourceMap ?? ''}
              onChange={(e) => update({ sourceMap: e.target.value })}
              className="w-full bg-transparent border px-2 py-1 font-mono"
              style={{ borderColor: '#223344', color: '#aabbcc' }} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Spawn Dir</label>
            <select value={selected.spawnDirection ?? 'south'}
              onChange={(e) => update({ spawnDirection: e.target.value as typeof selected.spawnDirection })}
              className="bg-transparent border px-2 py-1 font-mono"
              style={{ borderColor: '#223344', color: '#aabbcc', background: '#0a0a14' }}>
              {(['north','south','east','west'] as const).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Exit */}
      {selected.type === 'exit' && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Target Map</label>
            <input type="text" value={selected.targetMap ?? ''}
              onChange={(e) => update({ targetMap: e.target.value })}
              className="w-full bg-transparent border px-2 py-1 font-mono"
              style={{ borderColor: '#223344', color: '#aabbcc' }} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Prompt</label>
            <input type="text" value={selected.interactionPrompt ?? ''}
              onChange={(e) => update({ interactionPrompt: e.target.value })}
              className="w-full bg-transparent border px-2 py-1 font-mono"
              style={{ borderColor: '#223344', color: '#aabbcc' }} />
          </div>
        </>
      )}

      {/* NPC */}
      {selected.type === 'npc' && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>NPC ID</label>
            <input type="text" value={selected.npcId ?? ''}
              onChange={(e) => update({ npcId: e.target.value })}
              className="w-full bg-transparent border px-2 py-1 font-mono"
              style={{ borderColor: '#223344', color: '#aabbcc' }} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Dialogue</label>
            <textarea value={selected.dialogue ?? ''}
              onChange={(e) => update({ dialogue: e.target.value })}
              rows={3}
              className="w-full bg-transparent border px-2 py-1 font-mono text-xs resize-none"
              style={{ borderColor: '#223344', color: '#aabbcc' }} />
          </div>
        </>
      )}

      {/* Loot Cache */}
      {selected.type === 'loot_cache' && (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Loot Table</label>
          <input type="text" value={selected.lootTable ?? ''}
            onChange={(e) => update({ lootTable: e.target.value })}
            className="w-full bg-transparent border px-2 py-1 font-mono"
            style={{ borderColor: '#223344', color: '#aabbcc' }} />
        </div>
      )}

      {/* Trigger Zone (circle / legacy style) */}
      {selected.type === 'trigger_zone' && selected.width === undefined && selected.height === undefined && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Event ID</label>
            <input type="text" value={selected.eventId ?? ''}
              onChange={(e) => update({ eventId: e.target.value })}
              className="w-full bg-transparent border px-2 py-1 font-mono"
              style={{ borderColor: '#223344', color: '#aabbcc' }} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Trigger</label>
            <select value={selected.triggerType ?? 'enter'}
              onChange={(e) => update({ triggerType: e.target.value as typeof selected.triggerType })}
              className="bg-transparent border px-2 py-1 font-mono"
              style={{ borderColor: '#223344', color: '#aabbcc', background: '#0a0a14' }}>
              <option value="enter">enter</option>
              <option value="timer">timer</option>
              <option value="kill_all">kill_all</option>
            </select>
          </div>
        </>
      )}

      <button
        onClick={() => store.deleteEntity(selected.id)}
        className="mt-2 px-3 py-1 text-xs border transition-all hover:opacity-80"
        style={{ borderColor: '#cc2222', color: '#cc2222' }}
      >
        DELETE
      </button>
    </div>
  );
}

function WaveAssignDropdown({ entityId, currentWaveId }: { entityId: string; currentWaveId?: string }) {
  const store = useEditorStore();
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>Wave</label>
      <select
        value={currentWaveId ?? ''}
        onChange={(e) => store.updateEntity(entityId, { waveId: e.target.value || undefined })}
        className="bg-transparent border px-2 py-1 font-mono"
        style={{ borderColor: '#223344', color: '#aabbcc', background: '#0a0a14' }}
      >
        <option value="">(none)</option>
        {store.waves.map((w) => (
          <option key={w.id} value={w.id}>Wave {w.id.slice(-4)} @ {w.triggerTime}s</option>
        ))}
      </select>
    </div>
  );
}

// ---- Wave Timeline ----------------------------------------------------------
function WaveTimeline() {
  const store = useEditorStore();
  const DURATION = 180;
  const timelineRef  = useRef<HTMLDivElement>(null);
  const dragWaveRef  = useRef<{ id: string; startX: number; startTime: number } | null>(null);

  const addWave = () => {
    const usedTimes = new Set(store.waves.map((w) => w.triggerTime));
    let t = 10;
    while (usedTimes.has(t)) t += 10;
    store.addWave({
      id: newWaveId(),
      triggerTime: t,
      color: WAVE_PALETTE[store.waves.length % WAVE_PALETTE.length],
    });
  };

  const onWavePointerDown = (e: React.PointerEvent<HTMLDivElement>, waveId: string, triggerTime: number) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    store.selectWave(waveId);
    dragWaveRef.current = { id: waveId, startX: e.clientX, startTime: triggerTime };
  };

  const onTimelinePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragWaveRef.current;
    if (!drag || !timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const dx   = e.clientX - drag.startX;
    const pct  = dx / rect.width;
    const dt   = Math.round(pct * DURATION);
    const newTime = Math.max(0, Math.min(DURATION, drag.startTime + dt));
    store.updateWave(drag.id, { triggerTime: newTime });
  };

  const onTimelinePointerUp = () => { dragWaveRef.current = null; };

  return (
    <div className="flex flex-col gap-1 select-none" onPointerMove={onTimelinePointerMove} onPointerUp={onTimelinePointerUp}>
      <div className="flex items-center justify-between px-2">
        <span className="text-[10px] uppercase tracking-wider" style={{ color: '#556677' }}>
          Wave Timeline (0 – {DURATION}s)
        </span>
        <button onClick={addWave}
          className="text-[10px] px-2 py-0.5 border transition-all hover:opacity-80"
          style={{ borderColor: '#334455', color: '#aabbcc' }}>
          + Wave
        </button>
      </div>

      <div
        ref={timelineRef}
        className="relative mx-2 rounded"
        style={{ height: 36, background: '#0d0d1a', border: '1px solid #1a2233' }}
      >
        {[0, 30, 60, 90, 120, 150, 180].map((t) => (
          <div key={t} className="absolute top-0 h-full flex items-end pb-1"
            style={{ left: `${(t / DURATION) * 100}%`, borderLeft: '1px solid #1a2233' }}>
            <span className="text-[9px] pl-0.5" style={{ color: '#334455' }}>{t}s</span>
          </div>
        ))}

        {store.waves.map((wave) => {
          const left       = (wave.triggerTime / DURATION) * 100;
          const isSelected = wave.id === store.selectedWaveId;
          return (
            <div key={wave.id} className="absolute top-1 flex items-center cursor-grab"
              style={{
                left: `${left}%`, width: 48, height: 28,
                background: wave.color + '33',
                border: `1px solid ${wave.color}${isSelected ? '' : '88'}`,
                boxShadow: isSelected ? `0 0 6px ${wave.color}` : undefined,
                transform: 'translateX(-50%)', userSelect: 'none',
              }}
              onPointerDown={(e) => onWavePointerDown(e, wave.id, wave.triggerTime)}>
              <div className="absolute inset-x-0 top-0 text-center text-[9px] font-mono truncate px-0.5"
                style={{ color: wave.color }}>
                {wave.triggerTime}s
              </div>
              <button className="absolute top-0 right-0 text-[9px] leading-none px-0.5"
                style={{ color: '#cc4444' }}
                onClick={(e) => { e.stopPropagation(); store.deleteWave(wave.id); }}
                onPointerDown={(e) => e.stopPropagation()}>
                ×
              </button>
            </div>
          );
        })}
      </div>

      {store.selectedWaveId && (() => {
        const w = store.waves.find((x) => x.id === store.selectedWaveId);
        if (!w) return null;
        return (
          <div className="flex items-center gap-2 px-2 text-xs">
            <span style={{ color: '#556677' }}>Trigger:</span>
            <input type="number" min={0} max={DURATION} value={w.triggerTime}
              onChange={(e) => store.updateWave(w.id, { triggerTime: Number(e.target.value) })}
              className="w-16 bg-transparent border px-1 py-0.5 font-mono"
              style={{ borderColor: '#223344', color: w.color }} />
            <span style={{ color: '#556677' }}>s</span>
            <span className="ml-2 text-[10px]" style={{ color: '#556677' }}>
              ({store.entities.filter((e) => e.waveId === w.id).length} spawns)
            </span>
          </div>
        );
      })()}
    </div>
  );
}

// ---- Main Page --------------------------------------------------------------
export default function EditorPage() {
  const store       = useEditorStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNew = () => {
    if (!confirm('Clear the current room?')) return;
    store.reset();
  };

  const handleSave = () => {
    const data = serializeLevel(store);
    const json = JSON.stringify(data, null, 2);
    localStorage.setItem(`room:${data.id}`, json);
    alert(`Saved "${data.name}" to localStorage.`);
  };

  const handleLoad = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data: RoomJSON | LegacySerializedLevel = JSON.parse(ev.target?.result as string);
        store.loadLevel(data);
      } catch {
        alert('Failed to parse JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExport = () => {
    const data = serializeLevel(store);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `${data.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeTool = store.activeTool;

  return (
    <div className="flex flex-col"
      style={{ width: '100vw', height: '100vh', background: '#080810', color: '#aabbcc', fontFamily: 'monospace' }}>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 shrink-0"
        style={{ height: 40, background: '#0d0d1a', borderBottom: '1px solid #1a2233' }}>
        <span className="text-xs font-bold tracking-widest uppercase mr-2" style={{ color: '#556677' }}>
          Room Editor
        </span>

        <input type="text" value={store.levelName}
          onChange={(e) => store.setLevelName(e.target.value)}
          className="bg-transparent border px-2 py-0.5 text-xs font-mono mr-3"
          style={{ borderColor: '#223344', color: '#aabbcc', width: 160 }} />

        <select value={store.levelMode}
          onChange={(e) => store.setLevelMode(e.target.value as 'exploration' | 'combat')}
          className="bg-transparent border px-2 py-0.5 text-xs font-mono mr-3"
          style={{ borderColor: '#223344', color: '#aabbcc', background: '#0d0d1a' }}>
          <option value="combat">Combat</option>
          <option value="exploration">Exploration</option>
        </select>

        <div className="flex gap-1 ml-auto">
          {[
            { label: 'NEW',    action: handleNew    },
            { label: 'SAVE',   action: handleSave   },
            { label: 'LOAD',   action: handleLoad   },
            { label: 'EXPORT', action: handleExport },
          ].map(({ label, action }) => (
            <button
              key={label}
              onClick={action}
              className="px-3 py-1 text-[11px] border transition-all hover:opacity-80"
              style={{ borderColor: '#334455', color: '#aabbcc' }}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => {
              const data = serializeLevel(store);
              localStorage.setItem('roomPreview', JSON.stringify(data));
              window.open('/play-room', '_blank');
            }}
            className="px-3 py-1 text-[11px] border transition-all hover:opacity-80"
            style={{ borderColor: '#44ccff', color: '#44ccff' }}
            title="Play Test — open this room in a preview tab"
          >
            PLAY TEST
          </button>
        </div>

        <input type="file" ref={fileInputRef} accept=".json" className="hidden" onChange={handleFileChange} />
      </div>

      {/* Main row */}
      <div className="flex flex-1 min-h-0">

        {/* Left sidebar -- Tools + Context */}
        <div
          className="flex flex-col shrink-0 overflow-hidden"
          style={{ width: 180, background: '#0d0d1a', borderRight: '1px solid #1a2233' }}
        >
          {/* Tool groups */}
          <div className="flex flex-col gap-0.5 p-2 overflow-y-auto">
            {TOOL_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="text-[9px] uppercase tracking-wider px-1 pt-1 pb-0.5" style={{ color: '#334455' }}>
                  {group.label}
                </div>
                {group.tools.map((t) => {
                  const active = activeTool === t.id;
                  return (
                    <button key={t.id} onClick={() => store.setActiveTool(t.id)}
                      className="w-full text-left px-2 py-1.5 text-[11px] border transition-all"
                      style={{
                        borderColor: active ? t.color : '#1a2233',
                        color: active ? t.color : '#556677',
                        background: active ? `${t.color}11` : 'transparent',
                      }}>
                      {t.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="px-3 pb-1 text-[10px]" style={{ color: '#334455' }}>
            {store.entities.length} placed
          </div>

          {/* Context panel */}
          {activeTool === 'obstacle'  && <div className="border-t overflow-y-auto" style={{ borderColor: '#1a2233' }}><ObstacleCatalogPanel /></div>}
          {activeTool === 'cave'      && <div className="border-t" style={{ borderColor: '#1a2233' }}><CaveSizePanel /></div>}
          {activeTool === 'void_pool' && <div className="border-t" style={{ borderColor: '#1a2233' }}><VoidPoolSizePanel /></div>}
          {activeTool === 'surface'   && <div className="border-t" style={{ borderColor: '#1a2233' }}><SurfacePanel /></div>}

          {/* Room Metadata at the bottom */}
          <div className="flex-1 overflow-y-auto border-t" style={{ borderColor: '#1a2233' }}>
            <RoomMetadataPanel />
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 min-w-0 min-h-0">
          <EditorCanvas />
        </div>

        {/* Right sidebar -- Properties */}
        <div
          className="flex flex-col shrink-0 overflow-hidden"
          style={{ width: 220, background: '#0d0d1a', borderLeft: '1px solid #1a2233' }}
        >
          <div
            className="text-[10px] uppercase tracking-wider px-3 py-2 shrink-0"
            style={{ color: '#445566', borderBottom: '1px solid #1a2233' }}
          >
            Properties
          </div>
          <div className="flex-1 overflow-y-auto">
            <PropertiesPanel />
          </div>
        </div>
      </div>

      {/* Wave Timeline */}
      <div className="shrink-0 pb-2 pt-1"
        style={{ minHeight: 80, background: '#0a0a14', borderTop: '1px solid #1a2233' }}>
        <WaveTimeline />
      </div>
    </div>
  );
}
