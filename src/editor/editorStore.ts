import { create } from 'zustand';
import { WORLD_W, WORLD_H } from '../game/constants';

// ---------------------------------------------------------------------------
// Tool modes — what the user has selected in the left palette
// ---------------------------------------------------------------------------
export type ToolMode =
  | 'select'
  | 'cave'
  | 'void_pool'
  | 'obstacle'
  | 'enemy'             // pinned enemy spawn (point)
  | 'player_spawn'
  | 'interactable'      // point-based interactable (NPC, console, etc.)
  | 'spawn_zone'        // rect-based enemy pool spawner
  | 'trigger_zone'      // rect-based trigger region
  | 'door';             // room exit / transition marker

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
  | 'interaction_zone';   // kept so old saves still load; new placements use 'interactable'

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

  // trigger_zone
  triggerOn?: TriggerOn;
  triggerActions?: string[];    // e.g. ['lock_doors', 'start_wave:w_intro']

  // door
  rewardTag?: string;           // 'weapon' | 'heal' | 'perk' | 'credits' | 'mystery'
  nextPool?: string;            // pool tag for next room
  requiresCleared?: boolean;    // door only opens when room cleared
}

export interface WaveDefinition {
  id: string;
  triggerTime: number;
  color: string;
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
  terrain: {
    rivers: Array<{ points: Array<{ x: number; y: number }>; width: number }>;
    caves: Array<{ pos: { x: number; y: number }; radius: number }>;
    voidPools: Array<{ pos: { x: number; y: number }; radius: number }>;
    obstacles: Array<{ pos: { x: number; y: number }; w: number; h: number; obsType: number }>;
    playerSpawn: { x: number; y: number };
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
  entities: [] as EditorEntity[],
  waves: [] as WaveDefinition[],
  selectedEntityId: null as string | null,
  selectedWaveId: null as string | null,
  activeTool: 'select' as ToolMode,
  camera: { x: WORLD_W / 2, y: WORLD_H / 2, zoom: 0.15 },
  levelName: 'Untitled Room',
  levelMode: 'combat' as const,
  mapWidth: WORLD_W,
  mapHeight: WORLD_H,

  // Room metadata defaults — legacy 4800² map authors get 'arena' by default
  roomKind: 'arena' as RoomKind,
  biome: 'void_waste',
  contractTags: [] as string[],
  difficulty: 1,
  modifiers: [] as string[],
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
      entities.push({ id: newEntityId(), type: 'obstacle', pos: o.pos, width: o.w, height: o.h })
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
    });
  },

  reset: () => set({ ...defaultState, entities: [], waves: [] }),
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
    .map((e) => ({
      pos: e.pos,
      w: e.width ?? 64,
      h: e.height ?? 64,
      obsType: 0,
    }));

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
