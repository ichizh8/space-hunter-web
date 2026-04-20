import { create } from 'zustand';
import { WORLD_W, WORLD_H } from '../game/constants';

// ---------------------------------------------------------------------------
// Tool modes — what the user has selected in the left palette
// ---------------------------------------------------------------------------
export type ToolMode =
  | 'select'
  | 'surface'
  | 'cave'
  | 'void_pool'
  | 'obstacle'
  | 'enemy'             // pinned enemy spawn (point)
  | 'player_spawn'
  | 'interactable'      // point-based interactable (NPC, console, etc.)
  | 'spawn_zone'        // rect-based enemy pool spawner
  | 'trigger_zone'      // rect-based trigger region
  | 'door'              // room exit / transition marker
  | 'zone'
  | 'entrance'
  | 'exit'
  | 'npc'
  | 'loot_cache'
  | 'no_spawn';

// ---------------------------------------------------------------------------
// Entity types that live in the room. Some legacy types kept for backwards
// compatibility with already-saved levels.
// ---------------------------------------------------------------------------
export type EntityType =
  // terrain
  | 'cave'
  | 'void_pool'
  | 'obstacle'
  // placement
  | 'player_spawn'
  | 'enemy_spawn'         // pinned single-point enemy spawn (legacy + scripted)
  // spatial pivot additions
  | 'interactable'        // contract board, HAL, workbench, shop, etc.
  | 'spawn_zone'          // rect with a pool tag — resolved at runtime
  | 'trigger_zone'        // rect with on/actions
  | 'door'                // room exit
  // legacy aliases
  | 'interaction_zone'    // kept so old saves still load; new placements use 'interactable'
  // new entity types from branch
  | 'entrance'
  | 'exit'
  | 'npc'
  | 'loot_cache'
  | 'no_spawn';

// ---------------------------------------------------------------------------
// Room kinds (spatial pivot). Arena is the default for legacy 4800x4800 maps.
// ---------------------------------------------------------------------------
export type RoomKind = 'hub' | 'fixed' | 'pool' | 'arena' | 'chain_link';

export type TriggerOn = 'enter' | 'all_enemies_dead' | 'timer';

// ---------------------------------------------------------------------------
// EditorEntity — single in-editor record. Fields are optional per entity type.
// ---------------------------------------------------------------------------
export interface EditorEntity {
  id: string;
  type: EntityType;
  pos: { x: number; y: number };

  // shape
  radius?: number;
  width?: number;
  height?: number;

  // enemy_spawn
  creature?: string;
  count?: number;
  isElite?: boolean;
  waveId?: string;

  // label (shown in canvas)
  label?: string;
  targetMap?: string;  // legacy

  // interactable / door
  kind?: string;                // stable identifier, e.g. 'contract_board', 'hal'
  prompt?: string;              // e.g. 'Press E: View Contracts'
  action?: string;              // e.g. 'open_contract_board'

  // spawn_zone
  poolTag?: string;             // e.g. 'hunt_tier2'
  budget?: number;              // max enemies this zone may spawn

  // trigger_zone (RoomJSON style)
  triggerOn?: TriggerOn;
  triggerActions?: string[];    // e.g. ['lock_doors', 'start_wave:w_intro']

  // door
  rewardTag?: string;           // 'weapon' | 'heal' | 'perk' | 'credits' | 'mystery'
  nextPool?: string;            // pool tag for next room
  requiresCleared?: boolean;    // door only opens when room cleared

  // obstacle variant
  variant?: string;

  // entrance
  sourceMap?: string;
  spawnDirection?: 'north' | 'south' | 'east' | 'west';

  // exit
  interactionPrompt?: string;

  // npc
  npcId?: string;
  dialogue?: string;

  // loot cache
  lootTable?: string;

  // trigger zone (legacy/branch style)
  eventId?: string;
  triggerType?: 'enter' | 'timer' | 'kill_all';
}

export interface WaveDefinition {
  id: string;
  triggerTime: number;
  color: string;
}

// ---- Obstacle catalog -------------------------------------------------------

export const OBSTACLE_CATALOG = [
  { variant: 'Rock Small',         w: 48,  h: 48,  group: 'Structural' },
  { variant: 'Rock Large',         w: 96,  h: 96,  group: 'Structural' },
  { variant: 'Wall H',             w: 128, h: 32,  group: 'Structural' },
  { variant: 'Wall V',             w: 32,  h: 128, group: 'Structural' },
  { variant: 'Wall Corner',        w: 32,  h: 32,  group: 'Structural' },
  { variant: 'Pillar',             w: 32,  h: 32,  group: 'Structural' },
  { variant: 'Pillar Wide',        w: 48,  h: 48,  group: 'Structural' },
  { variant: 'Railing H',          w: 128, h: 16,  group: 'Structural' },
  { variant: 'Railing V',          w: 16,  h: 128, group: 'Structural' },
  { variant: 'Crate',              w: 48,  h: 48,  group: 'Industrial' },
  { variant: 'Crate Stack',        w: 48,  h: 96,  group: 'Industrial' },
  { variant: 'Cargo Container',    w: 96,  h: 48,  group: 'Industrial' },
  { variant: 'Terminal',           w: 48,  h: 64,  group: 'Industrial' },
  { variant: 'Generator',          w: 64,  h: 64,  group: 'Industrial' },
  { variant: 'Storage Tank',       w: 48,  h: 96,  group: 'Industrial' },
  { variant: 'Pipe H',             w: 160, h: 24,  group: 'Industrial' },
  { variant: 'Pipe V',             w: 24,  h: 160, group: 'Industrial' },
  { variant: 'Debris Pile',        w: 96,  h: 96,  group: 'Industrial' },
  { variant: 'Blast Door H',       w: 128, h: 32,  group: 'Doors'      },
  { variant: 'Blast Door V',       w: 32,  h: 128, group: 'Doors'      },
  { variant: 'Barricade',          w: 96,  h: 48,  group: 'Doors'      },
  { variant: 'Energy Barrier H',   w: 128, h: 8,   group: 'Doors'      },
  { variant: 'Energy Barrier V',   w: 8,   h: 128, group: 'Doors'      },
] as const;

export type ObstacleVariant = typeof OBSTACLE_CATALOG[number]['variant'];

export function getObstacleSize(variant: string): { w: number; h: number } {
  const found = OBSTACLE_CATALOG.find((o) => o.variant === variant);
  return found ? { w: found.w, h: found.h } : { w: 64, h: 64 };
}

// ---- Cave / void pool presets -----------------------------------------------

export const CAVE_PRESETS = [
  { label: 'Small',  radius: 100 },
  { label: 'Medium', radius: 200 },
  { label: 'Large',  radius: 350 },
] as const;

export const VOID_POOL_PRESETS = [
  { label: 'Small',  radius: 60  },
  { label: 'Medium', radius: 120 },
  { label: 'Large',  radius: 200 },
] as const;

export type CaveSize     = typeof CAVE_PRESETS[number]['label'];
export type VoidPoolSize = typeof VOID_POOL_PRESETS[number]['label'];

// ---- Surface ----------------------------------------------------------------

export const SURFACE_TILE = 64;
export const SURFACE_COLS = Math.ceil(WORLD_W / SURFACE_TILE); // 75
export const SURFACE_ROWS = Math.ceil(WORLD_H / SURFACE_TILE); // 75

export const SURFACE_TYPES = [
  { id: 0, name: 'Void',          color: null      },
  { id: 1, name: 'Station Floor', color: '#334455' },
  { id: 2, name: 'Metal Grate',   color: '#2a3a4a' },
  { id: 3, name: 'Dirt',          color: '#5a4a30' },
  { id: 4, name: 'Grass',         color: '#2a4a2a' },
  { id: 5, name: 'Sand',          color: '#6a5a3a' },
  { id: 6, name: 'Cave Rock',     color: '#3a3a3a' },
  { id: 7, name: 'Water Shallow', color: '#1a3a5a' },
  { id: 8, name: 'Plating Dark',  color: '#1a2233' },
  { id: 9, name: 'Plating Light', color: '#4a5566' },
] as const;

function makeSurfaceGrid(): number[] {
  return new Array(SURFACE_COLS * SURFACE_ROWS).fill(0);
}

// ---------------------------------------------------------------------------
// Editor state — includes room metadata added in the spatial pivot
// ---------------------------------------------------------------------------
export interface EditorState {
  entities: EditorEntity[];
  waves: WaveDefinition[];
  selectedEntityId: string | null;
  selectedWaveId: string | null;
  activeTool: ToolMode;
  camera: { x: number; y: number; zoom: number };
  levelName: string;
  levelMode: 'exploration' | 'combat';
  mapWidth: number;
  mapHeight: number;

  // Room metadata (spatial pivot)
  roomKind: RoomKind;
  biome: string;
  contractTags: string[];
  difficulty: number;
  modifiers: string[];

  // Surface
  surfaceGrid: number[];
  activeSurfaceType: number;
  brushSize: 1 | 3 | 5 | 7;
  fillMode: boolean;

  // Tool sub-state
  activeObstacleVariant: string;
  activeCaveSize: CaveSize;
  activeVoidPoolSize: VoidPoolSize;

  // Actions
  addEntity: (entity: EditorEntity) => void;
  updateEntity: (id: string, patch: Partial<EditorEntity>) => void;
  deleteEntity: (id: string) => void;
  selectEntity: (id: string | null) => void;
  setActiveTool: (tool: ToolMode) => void;
  setCamera: (camera: Partial<EditorState['camera']>) => void;
  setLevelName: (name: string) => void;
  setLevelMode: (mode: 'exploration' | 'combat') => void;
  setRoomKind: (kind: RoomKind) => void;
  setBiome: (biome: string) => void;
  setContractTags: (tags: string[]) => void;
  setDifficulty: (d: number) => void;
  setModifiers: (m: string[]) => void;
  addWave: (wave: WaveDefinition) => void;
  updateWave: (id: string, patch: Partial<WaveDefinition>) => void;
  deleteWave: (id: string) => void;
  selectWave: (id: string | null) => void;
  loadLevel: (data: RoomJSON | LegacySerializedLevel) => void;
  reset: () => void;

  paintSurface: (col: number, row: number) => void;
  floodFillSurface: (col: number, row: number) => void;
  setActiveSurfaceType: (type: number) => void;
  setBrushSize: (size: 1 | 3 | 5 | 7) => void;
  setFillMode: (fill: boolean) => void;
  setActiveObstacleVariant: (variant: string) => void;
  setActiveCaveSize: (size: CaveSize) => void;
  setActiveVoidPoolSize: (size: VoidPoolSize) => void;
}

// ---------------------------------------------------------------------------
// RoomJSON — canonical save format (matches DESIGN-ROOM-SCHEMA.md)
// ---------------------------------------------------------------------------
export interface RoomJSON {
  schemaVersion: 1;
  id: string;
  name: string;
  kind: RoomKind;
  biome: string;
  contractTags: string[];
  difficulty: number;
  size: { w: number; h: number };

  terrain: {
    caves: Array<{ pos: { x: number; y: number }; radius: number }>;
    voidPools: Array<{ pos: { x: number; y: number }; radius: number }>;
    obstacles: Array<{ pos: { x: number; y: number }; w: number; h: number; obsType: number }>;
    rivers: Array<{ points: Array<{ x: number; y: number }>; width: number }>;
  };

  playerSpawn: { x: number; y: number };

  entities: Array<{
    id: string;
    type: 'interactable' | 'door';
    kind?: string;
    pos: { x: number; y: number };
    radius?: number;
    prompt?: string;
    action?: string;
    label?: string;
    rewardTag?: string;
    nextPool?: string;
    requiresCleared?: boolean;
  }>;

  spawnZones: Array<{
    id: string;
    rect: { x: number; y: number; w: number; h: number };
    poolTag: string;
    waveId?: string;
    budget?: number;
  }>;

  triggers: Array<{
    id: string;
    rect?: { x: number; y: number; w: number; h: number };
    on: TriggerOn;
    actions: string[];
  }>;

  waves: Array<{
    id: string;
    triggerTime: number;
    color: string;
    enemies: Array<{
      creature: string;
      count: number;
      pos?: { x: number; y: number };
      isElite?: boolean;
    }>;
  }>;

  modifiers: string[];

  mode?: 'exploration' | 'combat';  // legacy field, kept optional
}

// Legacy shape (pre-schemaVersion). Kept around for loadLevel backwards compat.
export interface LegacySerializedLevel {
  id: string;
  name: string;
  width: number;
  height: number;
  mode: 'exploration' | 'combat';
  surfaceGrid?: number[];
  terrain: {
    rivers: Array<{ points: Array<{ x: number; y: number }>; width: number }>;
    caves: Array<{ pos: { x: number; y: number }; radius: number }>;
    voidPools: Array<{ pos: { x: number; y: number }; radius: number }>;
    obstacles: Array<{ pos: { x: number; y: number }; w: number; h: number; obsType: number; variant?: string }>;
    playerSpawn: { x: number; y: number };
    entrances?: Array<{ pos: { x: number; y: number }; sourceMap?: string; spawnDirection?: string }>;
    exits?: Array<{ pos: { x: number; y: number }; targetMap?: string; interactionPrompt?: string }>;
    npcs?: Array<{ pos: { x: number; y: number }; npcId?: string; dialogue?: string }>;
    lootCaches?: Array<{ pos: { x: number; y: number }; lootTable?: string }>;
    triggerZones?: Array<{ pos: { x: number; y: number }; radius: number; eventId?: string; triggerType?: string }>;
    noSpawnZones?: Array<{ pos: { x: number; y: number }; radius: number }>;
  };
  waves: Array<{
    id: string;
    triggerTime: number;
    color: string;
    enemies: Array<{
      creature: string;
      count: number;
      pos?: { x: number; y: number };
      isElite?: boolean;
    }>;
  }>;
}

// Public alias retained for back-compat with importers elsewhere
export type SerializedLevel = RoomJSON;

// ---------------------------------------------------------------------------
// ID helpers
// ---------------------------------------------------------------------------
const WAVE_COLORS = ['#e67e22', '#3498db', '#2ecc71', '#9b59b6', '#e74c3c', '#1abc9c'];

let entityCounter = 0;
let waveCounter = 0;

export function newEntityId(): string {
  return `e_${Date.now()}_${entityCounter++}`;
}

export function newWaveId(): string {
  return `w_${Date.now()}_${waveCounter++}`;
}

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------
const defaultState = {
  entities:            [] as EditorEntity[],
  waves:               [] as WaveDefinition[],
  selectedEntityId:    null as string | null,
  selectedWaveId:      null as string | null,
  activeTool:          'select' as ToolMode,
  camera:              { x: WORLD_W / 2, y: WORLD_H / 2, zoom: 0.15 },
  levelName:           'Untitled Room',
  levelMode:           'combat' as const,
  mapWidth:            WORLD_W,
  mapHeight:           WORLD_H,

  // Room metadata defaults — legacy 4800² map authors get 'arena' by default
  roomKind:            'arena' as RoomKind,
  biome:               'void_waste',
  contractTags:        [] as string[],
  difficulty:          1,
  modifiers:           [] as string[],

  // Surface defaults
  surfaceGrid:         makeSurfaceGrid(),
  activeSurfaceType:   1,
  brushSize:           3 as const,
  fillMode:            false,
  activeObstacleVariant: 'Rock Small',
  activeCaveSize:      'Medium' as CaveSize,
  activeVoidPoolSize:  'Medium' as VoidPoolSize,
};

// ---------------------------------------------------------------------------
// Zustand store
// ---------------------------------------------------------------------------
export const useEditorStore = create<EditorState>((set) => ({
  ...defaultState,

  addEntity: (entity) =>
    set((s) => ({ entities: [...s.entities, entity] })),

  updateEntity: (id, patch) =>
    set((s) => ({
      entities: s.entities.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    })),

  deleteEntity: (id) =>
    set((s) => ({
      entities: s.entities.filter((e) => e.id !== id),
      selectedEntityId: s.selectedEntityId === id ? null : s.selectedEntityId,
    })),

  selectEntity: (id) => set({ selectedEntityId: id }),

  setActiveTool: (tool) => set({ activeTool: tool }),

  setCamera: (camera) =>
    set((s) => ({ camera: { ...s.camera, ...camera } })),

  setLevelName: (levelName) => set({ levelName }),

  setLevelMode: (levelMode) => set({ levelMode }),

  setRoomKind: (roomKind) => set({ roomKind }),
  setBiome: (biome) => set({ biome }),
  setContractTags: (contractTags) => set({ contractTags }),
  setDifficulty: (difficulty) => set({ difficulty }),
  setModifiers: (modifiers) => set({ modifiers }),

  addWave: (wave) =>
    set((s) => ({ waves: [...s.waves, wave] })),

  updateWave: (id, patch) =>
    set((s) => ({
      waves: s.waves.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    })),

  deleteWave: (id) =>
    set((s) => ({
      waves: s.waves.filter((w) => w.id !== id),
      selectedWaveId: s.selectedWaveId === id ? null : s.selectedWaveId,
      entities: s.entities.map((e) =>
        e.waveId === id ? { ...e, waveId: undefined } : e
      ),
    })),

  selectWave: (id) => set({ selectedWaveId: id }),

  paintSurface: (col, row) =>
    set((s) => {
      const half = Math.floor(s.brushSize / 2);
      const grid = s.surfaceGrid.slice();
      for (let dr = -half; dr <= half; dr++) {
        for (let dc = -half; dc <= half; dc++) {
          const c = col + dc;
          const r = row + dr;
          if (c >= 0 && c < SURFACE_COLS && r >= 0 && r < SURFACE_ROWS) {
            grid[r * SURFACE_COLS + c] = s.activeSurfaceType;
          }
        }
      }
      return { surfaceGrid: grid };
    }),

  floodFillSurface: (col, row) =>
    set((s) => {
      if (col < 0 || col >= SURFACE_COLS || row < 0 || row >= SURFACE_ROWS) return s;
      const grid = s.surfaceGrid.slice();
      const targetType = grid[row * SURFACE_COLS + col];
      const fillType = s.activeSurfaceType;
      if (targetType === fillType) return s;

      const queue: Array<[number, number]> = [[col, row]];
      const visited = new Set<number>([row * SURFACE_COLS + col]);

      while (queue.length > 0) {
        const [c, r] = queue.shift()!;
        grid[r * SURFACE_COLS + c] = fillType;
        const neighbors: Array<[number, number]> = [
          [c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1],
        ];
        for (const [nc, nr] of neighbors) {
          if (nc >= 0 && nc < SURFACE_COLS && nr >= 0 && nr < SURFACE_ROWS) {
            const idx = nr * SURFACE_COLS + nc;
            if (!visited.has(idx) && grid[idx] === targetType) {
              visited.add(idx);
              queue.push([nc, nr]);
            }
          }
        }
      }
      return { surfaceGrid: grid };
    }),

  setActiveSurfaceType:    (activeSurfaceType)    => set({ activeSurfaceType }),
  setBrushSize:            (brushSize)            => set({ brushSize }),
  setFillMode:             (fillMode)             => set({ fillMode }),
  setActiveObstacleVariant:(activeObstacleVariant)=> set({ activeObstacleVariant }),
  setActiveCaveSize:       (activeCaveSize)       => set({ activeCaveSize }),
  setActiveVoidPoolSize:   (activeVoidPoolSize)   => set({ activeVoidPoolSize }),

  loadLevel: (data) => {
    const entities: EditorEntity[] = [];
    const waves: WaveDefinition[] = [];

    // Detect schema: RoomJSON has schemaVersion, legacy does not.
    const isNew = 'schemaVersion' in data;

    if (isNew) {
      const r = data as RoomJSON;

      // Player spawn
      if (r.playerSpawn) {
        entities.push({
          id: newEntityId(),
          type: 'player_spawn',
          pos: r.playerSpawn,
        });
      }

      // Terrain
      r.terrain.caves.forEach((c) =>
        entities.push({ id: newEntityId(), type: 'cave', pos: c.pos, radius: c.radius })
      );
      r.terrain.voidPools.forEach((v) =>
        entities.push({ id: newEntityId(), type: 'void_pool', pos: v.pos, radius: v.radius })
      );
      r.terrain.obstacles.forEach((o) =>
        entities.push({ id: newEntityId(), type: 'obstacle', pos: o.pos, width: o.w, height: o.h })
      );

      // Interactables + doors
      r.entities.forEach((en) =>
        entities.push({
          id: en.id ?? newEntityId(),
          type: en.type,
          pos: en.pos,
          radius: en.radius,
          kind: en.kind,
          prompt: en.prompt,
          action: en.action,
          label: en.label,
          rewardTag: en.rewardTag,
          nextPool: en.nextPool,
          requiresCleared: en.requiresCleared,
        })
      );

      // Spawn zones
      r.spawnZones.forEach((sz) =>
        entities.push({
          id: sz.id ?? newEntityId(),
          type: 'spawn_zone',
          pos: { x: sz.rect.x + sz.rect.w / 2, y: sz.rect.y + sz.rect.h / 2 },
          width: sz.rect.w,
          height: sz.rect.h,
          poolTag: sz.poolTag,
          waveId: sz.waveId,
          budget: sz.budget,
        })
      );

      // Triggers
      r.triggers.forEach((tr) =>
        entities.push({
          id: tr.id ?? newEntityId(),
          type: 'trigger_zone',
          pos: tr.rect
            ? { x: tr.rect.x + tr.rect.w / 2, y: tr.rect.y + tr.rect.h / 2 }
            : { x: r.size.w / 2, y: r.size.h / 2 },
          width: tr.rect?.w,
          height: tr.rect?.h,
          triggerOn: tr.on,
          triggerActions: tr.actions,
        })
      );

      // Waves (and wave-bound pinned enemy spawns)
      r.waves.forEach((wv, wi) => {
        const waveId = wv.id ?? newWaveId();
        waves.push({
          id: waveId,
          triggerTime: wv.triggerTime,
          color: wv.color ?? WAVE_COLORS[wi % WAVE_COLORS.length],
        });
        wv.enemies.forEach((en) =>
          entities.push({
            id: newEntityId(),
            type: 'enemy_spawn',
            pos: en.pos ?? { x: r.size.w / 2, y: r.size.h / 2 },
            creature: en.creature,
            count: en.count,
            isElite: en.isElite,
            waveId,
          })
        );
      });

      set({
        entities,
        waves,
        selectedEntityId: null,
        selectedWaveId: null,
        levelName: r.name,
        levelMode: r.mode ?? 'combat',
        mapWidth: r.size.w,
        mapHeight: r.size.h,
        roomKind: r.kind,
        biome: r.biome,
        contractTags: r.contractTags ?? [],
        difficulty: r.difficulty ?? 1,
        modifiers: r.modifiers ?? [],
      });
      return;
    }

    // ---- Legacy path -------------------------------------------------------
    const legacy = data as LegacySerializedLevel;

    if (legacy.terrain?.playerSpawn) {
      entities.push({ id: newEntityId(), type: 'player_spawn', pos: legacy.terrain.playerSpawn });
    }
    legacy.terrain?.caves.forEach((c) =>
      entities.push({ id: newEntityId(), type: 'cave', pos: c.pos, radius: c.radius })
    );
    legacy.terrain?.voidPools.forEach((v) =>
      entities.push({ id: newEntityId(), type: 'void_pool', pos: v.pos, radius: v.radius })
    );
    legacy.terrain?.obstacles.forEach((o) =>
      entities.push({ id: newEntityId(), type: 'obstacle', pos: o.pos, width: o.w, height: o.h, variant: o.variant })
    );
    legacy.terrain?.entrances?.forEach((e) =>
      entities.push({ id: newEntityId(), type: 'entrance', pos: e.pos, sourceMap: e.sourceMap, spawnDirection: e.spawnDirection as EditorEntity['spawnDirection'] })
    );
    legacy.terrain?.exits?.forEach((e) =>
      entities.push({ id: newEntityId(), type: 'exit', pos: e.pos, targetMap: e.targetMap, interactionPrompt: e.interactionPrompt })
    );
    legacy.terrain?.npcs?.forEach((n) =>
      entities.push({ id: newEntityId(), type: 'npc', pos: n.pos, npcId: n.npcId, dialogue: n.dialogue })
    );
    legacy.terrain?.lootCaches?.forEach((l) =>
      entities.push({ id: newEntityId(), type: 'loot_cache', pos: l.pos, lootTable: l.lootTable })
    );
    legacy.terrain?.triggerZones?.forEach((t) =>
      entities.push({ id: newEntityId(), type: 'trigger_zone', pos: t.pos, radius: t.radius, eventId: t.eventId, triggerType: t.triggerType as EditorEntity['triggerType'] })
    );
    legacy.terrain?.noSpawnZones?.forEach((n) =>
      entities.push({ id: newEntityId(), type: 'no_spawn', pos: n.pos, radius: n.radius })
    );

    legacy.waves?.forEach((wv, wi) => {
      const waveId = wv.id ?? newWaveId();
      waves.push({
        id: waveId,
        triggerTime: wv.triggerTime,
        color: wv.color ?? WAVE_COLORS[wi % WAVE_COLORS.length],
      });
      wv.enemies.forEach((en) =>
        entities.push({
          id: newEntityId(),
          type: 'enemy_spawn',
          pos: en.pos ?? { x: WORLD_W / 2, y: WORLD_H / 2 },
          creature: en.creature,
          count: en.count,
          isElite: en.isElite,
          waveId,
        })
      );
    });

    set({
      entities,
      waves,
      selectedEntityId: null,
      selectedWaveId: null,
      levelName: legacy.name,
      levelMode: legacy.mode,
      mapWidth: legacy.width,
      mapHeight: legacy.height,
      // Legacy loads default to arena kind; user can retype after.
      roomKind: 'arena',
      biome: 'void_waste',
      contractTags: [],
      difficulty: 1,
      modifiers: [],
      surfaceGrid: legacy.surfaceGrid ?? makeSurfaceGrid(),
    });
  },

  reset: () => set({ ...defaultState, entities: [], waves: [], surfaceGrid: makeSurfaceGrid() }),
}));

// ---------------------------------------------------------------------------
// Serialization — produces the canonical RoomJSON
// ---------------------------------------------------------------------------
export function serializeLevel(s: EditorState): RoomJSON {
  const playerSpawnEntity = s.entities.find((e) => e.type === 'player_spawn');

  const caves = s.entities
    .filter((e) => e.type === 'cave')
    .map((e) => ({ pos: e.pos, radius: e.radius ?? 150 }));

  const voidPools = s.entities
    .filter((e) => e.type === 'void_pool')
    .map((e) => ({ pos: e.pos, radius: e.radius ?? 80 }));

  const obstacles = s.entities
    .filter((e) => e.type === 'obstacle')
    .map((e) => ({ pos: e.pos, w: e.width ?? 64, h: e.height ?? 64, obsType: 0, variant: e.variant }));

  // Interactables + doors go into the typed `entities` array
  const interactablesAndDoors = s.entities
    .filter((e) => e.type === 'interactable' || e.type === 'interaction_zone' || e.type === 'door')
    .map((e) => {
      const isDoor = e.type === 'door';
      const out: RoomJSON['entities'][number] = {
        id: e.id,
        type: isDoor ? 'door' : 'interactable',
        pos: e.pos,
      };
      if (e.radius !== undefined) out.radius = e.radius;
      if (e.kind) out.kind = e.kind;
      if (e.prompt) out.prompt = e.prompt;
      if (e.action) out.action = e.action;
      if (e.label) out.label = e.label;
      if (isDoor) {
        if (e.rewardTag) out.rewardTag = e.rewardTag;
        if (e.nextPool) out.nextPool = e.nextPool;
        if (e.requiresCleared !== undefined) out.requiresCleared = e.requiresCleared;
      }
      return out;
    });

  const spawnZones = s.entities
    .filter((e) => e.type === 'spawn_zone')
    .map((e) => {
      const w = e.width ?? 200;
      const h = e.height ?? 200;
      return {
        id: e.id,
        rect: { x: e.pos.x - w / 2, y: e.pos.y - h / 2, w, h },
        poolTag: e.poolTag ?? 'default',
        waveId: e.waveId,
        budget: e.budget,
      };
    });

  const triggers = s.entities
    .filter((e) => e.type === 'trigger_zone')
    .map((e) => {
      const w = e.width ?? 200;
      const h = e.height ?? 200;
      return {
        id: e.id,
        rect: { x: e.pos.x - w / 2, y: e.pos.y - h / 2, w, h },
        on: (e.triggerOn ?? 'enter') as TriggerOn,
        actions: e.triggerActions ?? [],
      };
    });

  const waves = s.waves.map((w) => {
    const spawns = s.entities.filter((e) => e.type === 'enemy_spawn' && e.waveId === w.id);
    return {
      id: w.id,
      triggerTime: w.triggerTime,
      color: w.color,
      enemies: spawns.map((sp) => ({
        creature: sp.creature ?? 'Void Leech',
        count: sp.count ?? 1,
        pos: sp.pos,
        isElite: sp.isElite,
      })),
    };
  });

  return {
    schemaVersion: 1,
    id: s.levelName.toLowerCase().replace(/\s+/g, '_'),
    name: s.levelName,
    kind: s.roomKind,
    biome: s.biome,
    contractTags: s.contractTags,
    difficulty: s.difficulty,
    size: { w: s.mapWidth, h: s.mapHeight },
    terrain: {
      rivers: [],
      caves,
      voidPools,
      obstacles,
    },
    playerSpawn: playerSpawnEntity?.pos ?? { x: s.mapWidth / 2, y: s.mapHeight / 2 },
    entities: interactablesAndDoors,
    spawnZones,
    triggers,
    waves,
    modifiers: s.modifiers,
    mode: s.levelMode,
  };
}
