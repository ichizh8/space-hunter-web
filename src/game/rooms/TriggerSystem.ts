// Evaluates room triggers and fires their actions.
// Supported `on` conditions: 'enter' (fired once when player first enters the rect),
// 'all_enemies_dead' (fired once when the room clears), 'timer' (TODO, skipped for now).
//
// Built-in actions understood here: 'start_wave:<id>', 'lock_doors', 'unlock_doors'.
// Anything else is passed through to the ActionRegistry.

import type { LoadedRoom, RuntimeSpawnZone, Vec2, RuntimeTrigger } from './types';
import type { CombatState } from './CombatRuntime';
import { spawnFromZone } from './CombatRuntime';
import { dispatchAction } from './ActionRegistry';

export interface TriggerContext {
  room: LoadedRoom;
  combat: CombatState;
  player: Vec2;
}

function pointInRect(p: Vec2, r: { x: number; y: number; w: number; h: number }): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function evaluateTriggers(ctx: TriggerContext): void {
  for (const tr of ctx.room.triggers) {
    if (tr.fired) continue;

    let shouldFire = false;
    if (tr.on === 'enter') {
      if (!tr.rect || pointInRect(ctx.player, tr.rect)) shouldFire = true;
    } else if (tr.on === 'all_enemies_dead') {
      shouldFire = ctx.combat.enemiesSpawnedTotal > 0 && ctx.combat.enemies.length === 0;
    }

    if (shouldFire) {
      tr.fired = true;
      for (const action of tr.actions) {
        runBuiltinOrDispatch(action, ctx);
      }
    }
  }
}

function runBuiltinOrDispatch(action: string, ctx: TriggerContext): void {
  const colon = action.indexOf(':');
  const id = colon < 0 ? action : action.slice(0, colon);
  const args = colon < 0 ? undefined : action.slice(colon + 1);

  switch (id) {
    case 'start_wave': {
      // Spawn all enemies from spawn zones tagged with this waveId.
      // If no waveId specified, fire all zones with no waveId.
      const wantedWave = args;
      for (const sz of ctx.room.spawnZones) {
        const matches =
          wantedWave === undefined
            ? sz.waveId === undefined
            : sz.waveId === wantedWave;
        if (!matches) continue;
        // Default: spawn full budget at once. Real wave pacing comes later.
        spawnFromZone(ctx.combat, sz, sz.budget - sz.spent);
      }
      return;
    }
    case 'spawn_all_zones': {
      for (const sz of ctx.room.spawnZones) {
        spawnFromZone(ctx.combat, sz, sz.budget - sz.spent);
      }
      return;
    }
    case 'lock_doors': {
      for (const d of ctx.room.doors) d.requiresCleared = true;
      return;
    }
    case 'unlock_doors': {
      for (const d of ctx.room.doors) d.requiresCleared = false;
      ctx.room.cleared = true;
      return;
    }
    case 'mark_cleared': {
      ctx.room.cleared = true;
      return;
    }
    default:
      dispatchAction(action, {
        room: ctx.room as unknown as Record<string, unknown>,
        player: ctx.player as unknown as Record<string, unknown>,
      });
  }
}

// Re-export types so consumers can pull from one place.
export type { RuntimeSpawnZone, RuntimeTrigger };
