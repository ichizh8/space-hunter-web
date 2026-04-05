export const ELITE_TYPES = [
  'Void Hulk', 'Phase Hunter', 'Brood Mother', 'Rift Colossus',
  'Null Wraith', 'Stone Sentinel', 'Tide Reaper', 'Current Stalker',
] as const;

export const APEX_TYPES = [
  'Rift Sovereign', 'The Hollow', 'Ancient Brood', 'Abyssal Tide',
] as const;

export interface EliteStatOverride {
  hp: number;
  speed: number;
  radius: number;
  color: number;
  meleeDmg: number;
  ranged: boolean;
  rangedDmg: number;
}

export const ELITE_OVERRIDES: Partial<Record<string, Partial<EliteStatOverride>>> = {
  'Void Hulk':       { hp: 150, speed: 50,  radius: 28, color: 0x660099, meleeDmg: 3 },
  'Phase Hunter':    { hp: 60,  speed: 130, radius: 13, color: 0x33cccc, meleeDmg: 2 },
  'Brood Mother':    { hp: 180, speed: 35,  radius: 30, color: 0x996633, meleeDmg: 2 },
  'Rift Colossus':   { hp: 250, speed: 40,  radius: 35, color: 0x4d0080 },
  'Null Wraith':     { hp: 90,  speed: 110, radius: 12, color: 0x331a4d },
  'Stone Sentinel':  { hp: 200, speed: 0,   radius: 22, color: 0x808080 },
  'Tide Reaper':     { hp: 120, speed: 70,  radius: 16, color: 0x1a3399 },
  'Current Stalker': { hp: 80,  speed: 85,  radius: 14, color: 0x00ccb3 },
};

export const ELITE_EPITHETS = [
  'the Ravenous', 'the Hollow', 'the Undying', 'the Silent',
  'of the Deep', 'the Blighted', 'the Forsaken', 'Worldbreaker',
  'the Devourer', 'Nightcrawler', 'the Consuming', 'Voidborn',
];

// 12-affix system matching Godot
export const ALL_AFFIXES = [
  'extra_fast', 'vampiric', 'shielded', 'teleporter', 'venomous',
  'berserker', 'spectral', 'multiplier', 'magnetic', 'voidbound',
  'armored', 'corrupting',
] as const;

export type AffixId = typeof ALL_AFFIXES[number];

export const AFFIX_DESCS: Record<string, string> = {
  extra_fast: '+50% speed',
  vampiric: 'Heals on dealing damage',
  shielded: '30% HP shield absorbs hits',
  teleporter: 'Blinks to player every 8s',
  venomous: 'Leaves poison trail',
  berserker: '+50% speed and damage below 30% HP',
  spectral: 'Phases through obstacles',
  multiplier: 'Spawns 2 copies at 30% HP on death',
  magnetic: 'Pulls player toward it',
  voidbound: 'Gains power near void pools',
  armored: 'Ranged damage halved',
  corrupting: 'Hits add +5 corruption',
};

export const BANNED_COMBOS: [string, string][] = [
  ['voidbound', 'teleporter'],
  ['multiplier', 'spectral'],
];

export function rollAffixes(count: number, isApex = false): string[] {
  const available: string[] = [...ALL_AFFIXES];
  if (isApex) {
    const idx = available.indexOf('multiplier');
    if (idx >= 0) available.splice(idx, 1);
  }
  const chosen: string[] = [];
  for (let i = 0; i < count; i++) {
    if (available.length === 0) break;
    const idx = Math.floor(Math.random() * available.length);
    const affix = available[idx];
    chosen.push(affix);
    available.splice(idx, 1);
    // Remove banned combos
    for (const [a, b] of BANNED_COMBOS) {
      if (chosen.includes(a)) {
        const bi = available.indexOf(b);
        if (bi >= 0) available.splice(bi, 1);
      }
      if (chosen.includes(b)) {
        const ai = available.indexOf(a);
        if (ai >= 0) available.splice(ai, 1);
      }
    }
  }
  return chosen;
}
