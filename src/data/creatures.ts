export type EnemyBehavior = 'charge' | 'flank' | 'burst' | 'strafe' | 'pack' | 'lurker' | 'patrol_river' | 'elite' | 'mine_crawler' | 'sentry_drone' | 'tide_phantom' | 'coral_spitter' | 'void_weaver' | 'phase_stalker' | 'slag_brute' | 'cinder_wasp';

export interface CreatureDef {
  name: string;
  radius: number;
  color: number;
  speed: number;
  hp: number;
  detection: number;
  meleeDmg: number;
  ranged: boolean;
  rangedDmg: number;
  rangedCooldown: number;
  voidType: boolean;
  behavior: EnemyBehavior;
  ingredient: { id: string; name: string };
}

export const CREATURE_DEFS: Record<string, CreatureDef> = {
  'Void Leech':     { name: 'Void Leech',     radius: 14, color: 0x8833cc, speed: 100, hp: 5,  detection: 350, meleeDmg: 1, ranged: false, rangedDmg: 0, rangedCooldown: 0, voidType: false, behavior: 'charge',       ingredient: { id: 'void_extract', name: 'Void Extract' } },
  'Shadow Crawler': { name: 'Shadow Crawler', radius: 13, color: 0x556688, speed: 110, hp: 5,  detection: 330, meleeDmg: 1, ranged: false, rangedDmg: 0, rangedCooldown: 0, voidType: false, behavior: 'flank',        ingredient: { id: 'shadow_membrane', name: 'Shadow Membrane' } },
  'Abyss Worm':     { name: 'Abyss Worm',     radius: 18, color: 0x775522, speed: 65,  hp: 9,  detection: 300, meleeDmg: 2, ranged: false, rangedDmg: 0, rangedCooldown: 0, voidType: false, behavior: 'burst',        ingredient: { id: 'abyss_flesh', name: 'Abyss Flesh' } },
  'Nether Stalker': { name: 'Nether Stalker', radius: 13, color: 0x447788, speed: 70,  hp: 6,  detection: 400, meleeDmg: 0, ranged: true,  rangedDmg: 2, rangedCooldown: 2.5, voidType: false, behavior: 'strafe',     ingredient: { id: 'nether_bile', name: 'Nether Bile' } },
  'Rift Parasite':  { name: 'Rift Parasite',  radius: 11, color: 0xbb33ff, speed: 100, hp: 9,  detection: 330, meleeDmg: 1, ranged: false, rangedDmg: 0, rangedCooldown: 0, voidType: true,  behavior: 'pack',         ingredient: { id: 'rift_spore', name: 'Rift Spore' } },
  'Cave Lurker':    { name: 'Cave Lurker',    radius: 16, color: 0xaa8866, speed: 140, hp: 8,  detection: 250, meleeDmg: 3, ranged: false, rangedDmg: 0, rangedCooldown: 0, voidType: false, behavior: 'lurker',       ingredient: { id: 'cave_crystal', name: 'Cave Crystal' } },
  'Tide Wraith':    { name: 'Tide Wraith',    radius: 13, color: 0x3366cc, speed: 120, hp: 5,  detection: 380, meleeDmg: 0, ranged: true,  rangedDmg: 2, rangedCooldown: 2.0, voidType: false, behavior: 'patrol_river', ingredient: { id: 'tide_essence', name: 'Tide Essence' } },
  'Void Spawn':     { name: 'Void Spawn',     radius: 11, color: 0x9922dd, speed: 95,  hp: 6,  detection: 310, meleeDmg: 1, ranged: false, rangedDmg: 0, rangedCooldown: 0, voidType: true,  behavior: 'pack',         ingredient: { id: 'void_core', name: 'Void Core' } },
  // Kepler Outpost enemies
  'Mine Crawler':   { name: 'Mine Crawler',   radius: 20, color: 0xcc7722, speed: 40,  hp: 15, detection: 320, meleeDmg: 2, ranged: false, rangedDmg: 0, rangedCooldown: 0, voidType: false, behavior: 'mine_crawler',  ingredient: { id: 'proximity_coil', name: 'Proximity Coil' } },
  'Sentry Drone':   { name: 'Sentry Drone',   radius: 10, color: 0xff9933, speed: 165, hp: 4,  detection: 420, meleeDmg: 0, ranged: false, rangedDmg: 1, rangedCooldown: 0, voidType: false, behavior: 'sentry_drone',  ingredient: { id: 'optics_chip', name: 'Optics Chip' } },
  // Tidal Flats enemies
  'Tide Phantom':   { name: 'Tide Phantom',   radius: 14, color: 0x22ccbb, speed: 105, hp: 10, detection: 360, meleeDmg: 3, ranged: false, rangedDmg: 0, rangedCooldown: 0, voidType: false, behavior: 'tide_phantom',  ingredient: { id: 'phase_membrane', name: 'Phase Membrane' } },
  'Coral Spitter':  { name: 'Coral Spitter',  radius: 18, color: 0x33aacc, speed: 0,   hp: 20, detection: 390, meleeDmg: 0, ranged: false, rangedDmg: 2, rangedCooldown: 0, voidType: false, behavior: 'coral_spitter', ingredient: { id: 'coral_venom', name: 'Coral Venom' } },
  // Void Reach enemies
  'Void Weaver':    { name: 'Void Weaver',    radius: 16, color: 0xaa44ff, speed: 60,  hp: 14, detection: 400, meleeDmg: 0, ranged: false, rangedDmg: 3, rangedCooldown: 0, voidType: true,  behavior: 'void_weaver',   ingredient: { id: 'living_tissue', name: 'Living Tissue' } },
  'Phase Stalker':  { name: 'Phase Stalker',  radius: 12, color: 0xdd22ff, speed: 135, hp: 7,  detection: 380, meleeDmg: 2, ranged: false, rangedDmg: 0, rangedCooldown: 0, voidType: true,  behavior: 'phase_stalker', ingredient: { id: 'crystal_shards', name: 'Crystal Shards' } },
  // Furnace enemies
  'Slag Brute':     { name: 'Slag Brute',     radius: 24, color: 0xff5500, speed: 35,  hp: 25, detection: 280, meleeDmg: 4, ranged: false, rangedDmg: 3, rangedCooldown: 0, voidType: false, behavior: 'slag_brute',    ingredient: { id: 'slag_core', name: 'Slag Core' } },
  'Cinder Wasp':    { name: 'Cinder Wasp',    radius: 10, color: 0xffaa00, speed: 150, hp: 5,  detection: 400, meleeDmg: 0, ranged: false, rangedDmg: 4, rangedCooldown: 0, voidType: false, behavior: 'cinder_wasp',   ingredient: { id: 'ember_gland', name: 'Ember Gland' } },
};

export const CREATURE_NAMES = Object.keys(CREATURE_DEFS);

export const BIOME_POOLS: Record<string, string[]> = {
  open:       ['Void Leech', 'Nether Stalker', 'Shadow Crawler'],
  river_bank: ['Abyss Worm', 'Tide Wraith', 'Nether Stalker'],
  cave:       ['Cave Lurker', 'Shadow Crawler'],
  void_pool:  ['Rift Parasite', 'Void Spawn', 'Void Leech'],
};

export const PLANET_POOLS: Record<string, string[]> = {
  kepler:     ['Mine Crawler', 'Sentry Drone'],
  tidal:      ['Tide Phantom', 'Coral Spitter'],
  void_reach: ['Void Weaver', 'Phase Stalker'],
  furnace:    ['Slag Brute', 'Cinder Wasp'],
};
