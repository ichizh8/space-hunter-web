import type { RoomJSON } from '../../editor/editorStore';
import type { LoadedRoom } from './types';

// Pure transform: take an editor-authored RoomJSON, produce a runtime room.
// No PixiJS, no side effects — safe to call at module scope.
export function loadRoom(json: RoomJSON): LoadedRoom {
  return {
    id: json.id,
    name: json.name,
    kind: json.kind,
    biome: json.biome,
    size: json.size,
    playerSpawn: json.playerSpawn ?? { x: json.size.w / 2, y: json.size.h / 2 },
    terrain: {
      caves: json.terrain.caves.map((c) => ({ pos: c.pos, radius: c.radius })),
      voidPools: json.terrain.voidPools.map((v) => ({ pos: v.pos, radius: v.radius })),
      obstacles: json.terrain.obstacles.map((o) => ({
        x: o.pos.x - o.w / 2,
        y: o.pos.y - o.h / 2,
        w: o.w,
        h: o.h,
      })),
    },
    interactables: json.entities
      .filter((e) => e.type === 'interactable')
      .map((e) => ({
        id: e.id,
        kind: e.kind ?? 'unknown',
        pos: e.pos,
        radius: e.radius ?? 40,
        prompt: e.prompt ?? 'Press E',
        action: e.action ?? 'noop',
        label: e.label,
      })),
    doors: json.entities
      .filter((e) => e.type === 'door')
      .map((e) => ({
        id: e.id,
        pos: e.pos,
        radius: e.radius ?? 40,
        rewardTag: e.rewardTag ?? 'mystery',
        nextPool: e.nextPool,
        requiresCleared: e.requiresCleared ?? false,
        label: e.label,
        consumed: false,
      })),
    spawnZones: json.spawnZones.map((sz) => ({
      id: sz.id,
      rect: sz.rect,
      poolTag: sz.poolTag,
      waveId: sz.waveId,
      budget: sz.budget ?? 8,
      spent: 0,
    })),
    triggers: json.triggers.map((tr) => ({
      id: tr.id,
      rect: tr.rect,
      on: tr.on,
      actions: tr.actions,
      fired: false,
    })),
    modifiers: json.modifiers,
    cleared: false,
  };
}
