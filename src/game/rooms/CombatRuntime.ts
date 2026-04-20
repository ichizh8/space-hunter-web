// Placeholder combat for Phase 4. Simple chase enemies + click-to-shoot bullets.
// NOT integrated with Game.ts's Enemies/Weapons — this is a standalone stub so
// room flow can be tested end-to-end before real combat integration.

import type { LoadedRoom, Vec2, RuntimeSpawnZone } from './types';

export interface Enemy {
  id: string;
  archetype: string;     // 'grunt' | 'runner' | 'tank'
  pos: Vec2;
  hp: number;
  maxHp: number;
  speed: number;         // world units / sec
  damage: number;
  radius: number;
  color: number;
  attackCooldown: number;
}

export interface Bullet {
  id: string;
  pos: Vec2;
  vel: Vec2;
  speed: number;
  damage: number;
  radius: number;
  life: number;          // seconds remaining
}

export interface PlayerCombat {
  hp: number;
  maxHp: number;
  shootCooldown: number;
}

export interface CombatState {
  enemies: Enemy[];
  bullets: Bullet[];
  player: PlayerCombat;
  enemiesSpawnedTotal: number;
  enemiesKilledTotal: number;
  // Active spawn-zone budgets are tracked on the zones themselves
  // Armored room modifier: fraction of bullet damage absorbed (0–1)
  enemyDamageReduction: number;
}

// Enemy archetypes — stats baked in. Real balance comes post-Phase 4.
const ARCHETYPES: Record<string, Omit<Enemy, 'id' | 'pos' | 'attackCooldown'>> = {
  grunt: {
    archetype: 'grunt',
    hp: 10, maxHp: 10,
    speed: 70,
    damage: 1,
    radius: 14,
    color: 0xcc4444,
  },
  void_hulk: {
    archetype: 'void_hulk',
    hp: 150, maxHp: 150,
    speed: 50,
    damage: 3,
    radius: 28,
    color: 0x660099,
  },
  phase_hunter: {
    archetype: 'phase_hunter',
    hp: 60, maxHp: 60,
    speed: 130,
    damage: 2,
    radius: 13,
    color: 0x33cccc,
  },
  brood_mother: {
    archetype: 'brood_mother',
    hp: 180, maxHp: 180,
    speed: 35,
    damage: 2,
    radius: 30,
    color: 0x996633,
  },
  runner: {
    archetype: 'runner',
    hp: 6, maxHp: 6,
    speed: 130,
    damage: 1,
    radius: 11,
    color: 0xff8844,
  },
  tank: {
    archetype: 'tank',
    hp: 30, maxHp: 30,
    speed: 45,
    damage: 2,
    radius: 20,
    color: 0x884433,
  },
};

// Pool tag → archetype mix. Weighted random pick.
const POOL_MIX: Record<string, Array<{ archetype: string; weight: number }>> = {
  hunt_tier1: [
    { archetype: 'grunt',  weight: 4 },
    { archetype: 'runner', weight: 1 },
  ],
  hunt_tier2: [
    { archetype: 'grunt',  weight: 3 },
    { archetype: 'runner', weight: 2 },
    { archetype: 'tank',   weight: 1 },
  ],
  hunt_tier3: [
    { archetype: 'grunt',  weight: 1 },
    { archetype: 'runner', weight: 2 },
    { archetype: 'tank',   weight: 2 },
  ],
  elite_minions: [
    { archetype: 'grunt',  weight: 3 },
    { archetype: 'runner', weight: 2 },
    { archetype: 'tank',   weight: 2 },
  ],
  elite_void_hulk:    [{ archetype: 'void_hulk',    weight: 1 }],
  elite_phase_hunter: [{ archetype: 'phase_hunter', weight: 1 }],
  elite_brood_mother: [{ archetype: 'brood_mother', weight: 1 }],
  // fallback
  default: [{ archetype: 'grunt', weight: 1 }],
};

function pickArchetype(poolTag: string): string {
  const mix = POOL_MIX[poolTag] ?? POOL_MIX.default;
  const total = mix.reduce((s, m) => s + m.weight, 0);
  let r = Math.random() * total;
  for (const m of mix) {
    r -= m.weight;
    if (r <= 0) return m.archetype;
  }
  return mix[0].archetype;
}

let enemyCounter = 0;
let bulletCounter = 0;

export function createCombatState(): CombatState {
  return {
    enemies: [],
    bullets: [],
    player: { hp: 10, maxHp: 10, shootCooldown: 0 },
    enemiesSpawnedTotal: 0,
    enemiesKilledTotal: 0,
    enemyDamageReduction: 0,
  };
}

// Spawn `count` enemies across a zone (respecting its budget).
// Returns the number actually spawned.
export function spawnFromZone(
  state: CombatState,
  zone: RuntimeSpawnZone,
  count: number
): number {
  const available = Math.max(0, zone.budget - zone.spent);
  const toSpawn = Math.min(count, available);
  for (let i = 0; i < toSpawn; i++) {
    const archetype = pickArchetype(zone.poolTag);
    const base = ARCHETYPES[archetype] ?? ARCHETYPES.grunt;
    const pos = {
      x: zone.rect.x + Math.random() * zone.rect.w,
      y: zone.rect.y + Math.random() * zone.rect.h,
    };
    state.enemies.push({
      ...base,
      id: `en_${enemyCounter++}`,
      pos,
      attackCooldown: 0,
    });
    zone.spent += 1;
    state.enemiesSpawnedTotal += 1;
  }
  return toSpawn;
}

// Fire a bullet from `from` toward `toward` at given speed.
export function spawnBullet(
  state: CombatState,
  from: Vec2,
  toward: Vec2,
  speed = 650,
  damage = 5
): void {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return;
  const vx = (dx / len) * speed;
  const vy = (dy / len) * speed;
  state.bullets.push({
    id: `b_${bulletCounter++}`,
    pos: { x: from.x, y: from.y },
    vel: { x: vx, y: vy },
    speed,
    damage,
    radius: 5,
    life: 1.2,
  });
}

// Advance combat simulation one tick.
export function tickCombat(
  state: CombatState,
  dt: number,
  room: LoadedRoom,
  player: Vec2
): void {
  // Bullets
  for (const b of state.bullets) {
    b.pos.x += b.vel.x * dt;
    b.pos.y += b.vel.y * dt;
    b.life -= dt;
  }
  // Clamp/prune bullets: off-room or expired
  state.bullets = state.bullets.filter((b) => {
    if (b.life <= 0) return false;
    if (b.pos.x < 0 || b.pos.x > room.size.w || b.pos.y < 0 || b.pos.y > room.size.h) {
      return false;
    }
    return true;
  });

  // Bullet-enemy collisions
  for (const b of state.bullets) {
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      const dx = e.pos.x - b.pos.x;
      const dy = e.pos.y - b.pos.y;
      const r = e.radius + b.radius;
      if (dx * dx + dy * dy <= r * r) {
        e.hp -= b.damage * (1 - state.enemyDamageReduction);
        b.life = 0;
        if (e.hp <= 0) state.enemiesKilledTotal += 1;
        break;
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);

  // Enemy AI: move toward player, attack on contact
  if (state.player.shootCooldown > 0) state.player.shootCooldown -= dt;
  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    const dx = player.x - e.pos.x;
    const dy = player.y - e.pos.y;
    const d = Math.hypot(dx, dy);
    if (d > 0) {
      e.pos.x += (dx / d) * e.speed * dt;
      e.pos.y += (dy / d) * e.speed * dt;
    }
    // Contact damage
    if (e.attackCooldown > 0) {
      e.attackCooldown -= dt;
    } else if (d <= e.radius + 18) {
      state.player.hp -= e.damage;
      e.attackCooldown = 0.8;
    }
    // Clamp into room
    e.pos.x = Math.max(0, Math.min(room.size.w, e.pos.x));
    e.pos.y = Math.max(0, Math.min(room.size.h, e.pos.y));
  }

  // Prune dead enemies
  state.enemies = state.enemies.filter((e) => e.hp > 0);
}

// True once at least one enemy has spawned in the room and all spawned enemies are dead.
export function allEnemiesCleared(state: CombatState): boolean {
  return state.enemiesSpawnedTotal > 0 && state.enemies.length === 0;
}
