// Runtime types for a loaded room. Distinct from editor-facing RoomJSON.

import type { RoomJSON, TriggerOn } from '../../editor/editorStore';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RuntimeInteractable {
  id: string;
  kind: string;
  pos: Vec2;
  radius: number;
  prompt: string;
  action: string;
  label?: string;
}

export interface RuntimeDoor {
  id: string;
  pos: Vec2;
  radius: number;
  rewardTag: string;
  nextPool?: string;
  requiresCleared: boolean;
  label?: string;
  consumed: boolean;
}

export interface RuntimeSpawnZone {
  id: string;
  rect: Rect;
  poolTag: string;
  waveId?: string;
  budget: number;
  spent: number;
}

export interface RuntimeTrigger {
  id: string;
  rect?: Rect;
  on: TriggerOn;
  actions: string[];
  fired: boolean;
}

export interface RuntimeTerrain {
  caves: Array<{ pos: Vec2; radius: number }>;
  voidPools: Array<{ pos: Vec2; radius: number }>;
  obstacles: Rect[];
}

export interface LoadedRoom {
  id: string;
  name: string;
  kind: RoomJSON['kind'];
  biome: string;
  size: { w: number; h: number };
  playerSpawn: Vec2;
  terrain: RuntimeTerrain;
  interactables: RuntimeInteractable[];
  doors: RuntimeDoor[];
  spawnZones: RuntimeSpawnZone[];
  triggers: RuntimeTrigger[];
  modifiers: string[];
  cleared: boolean;
}
