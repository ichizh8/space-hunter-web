import type {
  LoadedRoom,
  Vec2,
  RuntimeInteractable,
  RuntimeDoor,
} from './types';

export type InteractionTarget =
  | { kind: 'interactable'; ref: RuntimeInteractable; distance: number }
  | { kind: 'door'; ref: RuntimeDoor; distance: number };

// Find the closest interactable or usable door within its radius.
// Doors flagged `requiresCleared` are skipped until the room is cleared.
// Consumed doors are skipped.
export function findInteractionTarget(
  room: LoadedRoom,
  playerPos: Vec2
): InteractionTarget | null {
  let best: InteractionTarget | null = null;
  let bestDist = Infinity;

  for (const e of room.interactables) {
    const d = distance(playerPos, e.pos);
    if (d <= e.radius && d < bestDist) {
      best = { kind: 'interactable', ref: e, distance: d };
      bestDist = d;
    }
  }

  for (const door of room.doors) {
    if (door.consumed) continue;
    if (door.requiresCleared && !room.cleared) continue;
    const d = distance(playerPos, door.pos);
    if (d <= door.radius && d < bestDist) {
      best = { kind: 'door', ref: door, distance: d };
      bestDist = d;
    }
  }

  return best;
}

function distance(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
