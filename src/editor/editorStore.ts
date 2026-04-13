import { create } from 'zustand';
import { WORLD_W, WORLD_H } from '../game/constants';

export type ToolMode =
  | 'select'
  | 'cave'
  | 'void_pool'
  | 'obstacle'
  | 'enemy'
  | 'player_spawn'
  | 'zone';

export type EntityType =
  | 'cave'
  | 'void_pool'
  | 'obstacle'
  | 'enemy_spawn'
  | 'interaction_zone'
  | 'door'
  | 'player_spawn';

export interface EditorEntity {
  id: string;
  type: EntityType;
  pos: { x: number; y: number };
  radius?: number;
  width?: number;
  height?: number;
  creature?: string;
  count?: number;
  isElite?: boolean;
  waveId?: string;
  label?: string;
  targetMap?: string;
}

export interface WaveDefinition {
  id: string;
  triggerTime: number;
  color: string;
}

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

  // Actions
  addEntity: (entity: EditorEntity) => void;
  updateEntity: (id: string, patch: Partial<EditorEntity>) => void;
  deleteEntity: (id: string) => void;
  selectEntity: (id: string | null) => void;
  setActiveTool: (tool: ToolMode) => void;
  setCamera: (camera: Partial<EditorState['camera']>) => void;
  setLevelName: (name: string) => void;
  setLevelMode: (mode: 'exploration' | 'combat') => void;
  addWave: (wave: WaveDefinition) => void;
  updateWave: (id: string, patch: Partial<WaveDefinition>) => void;
  deleteWave: (id: string) => void;
  selectWave: (id: string | null) => void;
  loadLevel: (data: SerializedLevel) => void;
  reset: () => void;
}

export interface SerializedLevel {
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

const WAVE_COLORS = ['#e67e22', '#3498db', '#2ecc71', '#9b59b6', '#e74c3c', '#1abc9c'];

let entityCounter = 0;
let waveCounter = 0;

export function newEntityId(): string {
  return `e_${Date.now()}_${entityCounter++}`;
}

export function newWaveId(): string {
  return `w_${Date.now()}_${waveCounter++}`;
}

const defaultState = {
  entities: [] as EditorEntity[],
  waves: [] as WaveDefinition[],
  selectedEntityId: null as string | null,
  selectedWaveId: null as string | null,
  activeTool: 'select' as ToolMode,
  camera: { x: WORLD_W / 2, y: WORLD_H / 2, zoom: 0.15 },
  levelName: 'Untitled Level',
  levelMode: 'combat' as const,
  mapWidth: WORLD_W,
  mapHeight: WORLD_H,
};

export const useEditorStore = create<EditorState>((set, get) => ({
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

    // Player spawn
    if (data.terrain.playerSpawn) {
      entities.push({
        id: newEntityId(),
        type: 'player_spawn',
        pos: data.terrain.playerSpawn,
      });
    }

    // Caves
    data.terrain.caves.forEach((c) =>
      entities.push({
        id: newEntityId(),
        type: 'cave',
        pos: c.pos,
        radius: c.radius,
      })
    );

    // Void pools
    data.terrain.voidPools.forEach((v) =>
      entities.push({
        id: newEntityId(),
        type: 'void_pool',
        pos: v.pos,
        radius: v.radius,
      })
    );

    // Obstacles
    data.terrain.obstacles.forEach((o) =>
      entities.push({
        id: newEntityId(),
        type: 'obstacle',
        pos: o.pos,
        width: o.w,
        height: o.h,
      })
    );

    // Enemy spawns per wave
    const waves: WaveDefinition[] = [];
    data.waves.forEach((wv, wi) => {
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
      levelName: data.name,
      levelMode: data.mode,
      mapWidth: data.width,
      mapHeight: data.height,
    });
  },

  reset: () => set({ ...defaultState, entities: [], waves: [] }),
}));

// Selector: export current state as SerializedLevel JSON
export function serializeLevel(s: EditorState): SerializedLevel {
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

  const waves = s.waves.map((w) => {
    const spawns = s.entities.filter(
      (e) => e.type === 'enemy_spawn' && e.waveId === w.id
    );
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
    id: s.levelName.toLowerCase().replace(/\s+/g, '_'),
    name: s.levelName,
    width: s.mapWidth,
    height: s.mapHeight,
    mode: s.levelMode,
    terrain: {
      rivers: [],
      caves,
      voidPools,
      obstacles,
      playerSpawn: playerSpawnEntity?.pos ?? { x: WORLD_W / 2, y: WORLD_H / 2 },
    },
    waves,
  };
}
