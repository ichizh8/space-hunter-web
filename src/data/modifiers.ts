/** Run Modifiers — picked between waves during a hunt */

export type ModifierRarity = 'common' | 'rare';

// ── Room Modifiers — shown on door previews, applied for one room ───────────

export type RoomModifierPolarity = 'positive' | 'negative' | 'neutral';

export interface RoomModifierDef {
  id: string;
  name: string;
  desc: string;
  polarity: RoomModifierPolarity;
}

export const ROOM_MODIFIER_DEFS: RoomModifierDef[] = [
  // Positive
  { id: 'armory_cache',   name: 'Armory Cache',   desc: '+20% fire rate',                      polarity: 'positive' },
  { id: 'void_drain',     name: 'Void Drain',     desc: 'Kills reduce corruption by 2',        polarity: 'positive' },
  { id: 'second_wind',    name: 'Second Wind',    desc: 'Regen 1 HP every 10s',                polarity: 'positive' },
  // Negative
  { id: 'corrupted_air',  name: 'Corrupted Air',  desc: '+2 corruption/s',                     polarity: 'negative' },
  { id: 'dense_pack',     name: 'Dense Pack',     desc: '+50% enemies',                        polarity: 'negative' },
  { id: 'armored',        name: 'Armored',        desc: 'Enemies: 25% damage reduction',       polarity: 'negative' },
  { id: 'void_fog',       name: 'Void Fog',       desc: 'Reduced visibility',                  polarity: 'negative' },
  // Neutral
  { id: 'volatile',       name: 'Volatile',       desc: 'Enemies explode on death',            polarity: 'neutral' },
  { id: 'void_resonance', name: 'Void Resonance', desc: 'Corruption scales all damage',        polarity: 'neutral' },
  { id: 'close_quarters', name: 'Close Quarters', desc: 'Room 30% smaller effective area',     polarity: 'neutral' },
];

/**
 * Pick a room modifier for a door reward of the given rarity.
 * Better rewards skew toward negative modifiers (harder room, bigger payoff).
 * Returns undefined ~35% of the time (no modifier).
 */
export function pickDoorModifier(rarity: string): RoomModifierDef | undefined {
  if (Math.random() > 0.65) return undefined;
  const pos = ROOM_MODIFIER_DEFS.filter(m => m.polarity === 'positive');
  const neg = ROOM_MODIFIER_DEFS.filter(m => m.polarity === 'negative');
  const neu = ROOM_MODIFIER_DEFS.filter(m => m.polarity === 'neutral');
  let pool: RoomModifierDef[];
  if (rarity === 'legendary') {
    pool = [...neg, ...neg, ...neg, ...neu];
  } else if (rarity === 'rare') {
    pool = [...neg, ...neg, ...neu, ...pos];
  } else {
    pool = [...pos, ...pos, ...neu, ...neg];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export interface ModifierDef {
  id: string;
  name: string;
  desc: string;
  rarity: ModifierRarity;
}

export const MODIFIER_DEFS: ModifierDef[] = [
  // ── Common ──
  { id: 'void_hunger',  name: 'Void Hunger',       desc: 'Kill void enemies → heal +1 HP',               rarity: 'common' },
  { id: 'scavenger',    name: 'Scavenger',          desc: 'Ingredient drops also grant +1 essence',       rarity: 'common' },
  { id: 'void_drain',   name: 'Void Drain',         desc: 'Kill void enemies → −3 corruption',            rarity: 'common' },
  { id: 'tough',         name: 'Tough',              desc: '+3 max HP (heal to full)',                     rarity: 'common' },
  { id: 'speed',         name: 'Speed',              desc: '+25 move speed',                               rarity: 'common' },
  { id: 'reload',        name: 'Reload',             desc: 'Reload time −30%',                             rarity: 'common' },
  { id: 'magplus',       name: 'Magplus',            desc: '+4 magazine ammo',                             rarity: 'common' },
  { id: 'pack_hunter',   name: 'Pack Hunter',        desc: '+8% damage per enemy within 200px',           rarity: 'common' },
  // ── Rare ──
  { id: 'adrenaline',    name: 'Adrenaline',         desc: '3 kills in 3s → +5% speed (stacks)',          rarity: 'rare' },
  { id: 'stalker',       name: 'Stalker',            desc: '+40% damage to enemies not targeting you',    rarity: 'rare' },
  { id: 'momentum',      name: 'Momentum',           desc: '+15% bullet speed per consecutive hit',       rarity: 'rare' },
  { id: 'last_stand',    name: 'Last Stand',         desc: 'Below 3 HP → +50% damage, +30% speed',       rarity: 'rare' },
  { id: 'biome_bond',    name: 'Biome Bond',         desc: '+20% damage in starting biome',               rarity: 'rare' },
  { id: 'precision',     name: 'Precision',          desc: 'First shot after reload → 2× damage',        rarity: 'rare' },
  { id: 'dodge',         name: 'Dodge',              desc: '10% chance to dodge a hit',                   rarity: 'rare' },
  { id: 'vamp',          name: 'Vamp',               desc: '1 in 5 kills heals +1 HP',                   rarity: 'rare' },
  { id: 'elite_dmg',     name: 'Elite Dmg',          desc: '+30% damage vs elites',                      rarity: 'rare' },
  { id: 'corruption_resist', name: 'Corruption Resist', desc: 'Corruption gain −25%',                    rarity: 'rare' },
];

/** Pick N random modifiers, weighted: common 3× more likely than rare */
export function rollModifiers(count: number, alreadyPicked: string[]): ModifierDef[] {
  const pool = MODIFIER_DEFS.filter(m => !alreadyPicked.includes(m.id));
  // Build weighted pool
  const weighted: ModifierDef[] = [];
  for (const m of pool) {
    const w = m.rarity === 'common' ? 3 : 1;
    for (let i = 0; i < w; i++) weighted.push(m);
  }
  // Shuffle and deduplicate
  const shuffled = weighted.sort(() => Math.random() - 0.5);
  const picked: ModifierDef[] = [];
  const seen = new Set<string>();
  for (const m of shuffled) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    picked.push(m);
    if (picked.length >= count) break;
  }
  return picked;
}
