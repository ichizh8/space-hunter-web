export type PlanetId = 'kepler' | 'tidal' | 'void_reach' | 'furnace' | 'hollow';

export interface PlanetPhysics {
  moveSpeedMult: number;
  inertia: number;           // 0 = instant stop (current behavior), 1 = ice
  bulletSpeedMult: number;
  bulletLifeMult: number;
  fireRateMult: number;      // >1 = slower fire rate (longer cooldown)
  enemySpeedMult: number;
  enemyHpMult: number;
  enemyDamageMult: number;
  knockbackMult: number;
}

export interface PlanetWeaponMod {
  weaponId: string;
  speedMult?: number;
  rangeMult?: number;
  damageMult?: number;
  spreadMult?: number;
  aoeMult?: number;
  trackingMult?: number;
  piercingAdd?: number;
  bouncesAdd?: number;
  reachMult?: number;
}

export interface Planet {
  id: PlanetId;
  name: string;
  unlockCondition: { planet: PlanetId; clears: number } | null;
  difficultyRange: [number, number];
  allowedContractTypes: string[];
  floorTiles: string[];
  palette: { base: number; accent: number; highlight: number };
  weatherVariants: string[];
  physics: PlanetPhysics;
  weaponMods: PlanetWeaponMod[];
}

export const PLANETS: Record<PlanetId, Planet> = {
  kepler: {
    id: 'kepler',
    name: 'Kepler Outpost',
    unlockCondition: null,
    difficultyRange: [1, 3],
    allowedContractTypes: ['hunt', 'extraction_run'],
    floorTiles: ['outpost_concrete', 'outpost_dirt', 'outpost_metal'],
    palette: { base: 0x7a7060, accent: 0xff8c2e, highlight: 0x44ccff },
    weatherVariants: ['night_shift', 'dust_storm'],
    physics: {
      moveSpeedMult: 1.0,
      inertia: 0,
      bulletSpeedMult: 1.0,
      bulletLifeMult: 1.0,
      fireRateMult: 1.0,
      enemySpeedMult: 1.0,
      enemyHpMult: 1.0,
      enemyDamageMult: 1.0,
      knockbackMult: 1.0,
    },
    weaponMods: [],
  },
  tidal: {
    id: 'tidal',
    name: 'Tidal Flats',
    unlockCondition: { planet: 'kepler', clears: 10 },
    difficultyRange: [2, 4],
    allowedContractTypes: ['hunt', 'payload_escort', 'extraction_run'],
    floorTiles: ['tidal_platform', 'tidal_sand', 'tidal_coral', 'tidal_shallows'],
    palette: { base: 0x1a3a4a, accent: 0x44d4ff, highlight: 0xffe066 },
    weatherVariants: ['high_tide', 'bioloom'],
    physics: {
      moveSpeedMult: 1.10,
      inertia: 0.35,
      bulletSpeedMult: 0.80,
      bulletLifeMult: 1.25,
      fireRateMult: 1.0,
      enemySpeedMult: 0.90,
      enemyHpMult: 1.0,
      enemyDamageMult: 1.0,
      knockbackMult: 1.5,
    },
    weaponMods: [
      { weaponId: 'sidearm', rangeMult: 0.85 },
      { weaponId: 'entropy_cannon', rangeMult: 0.85 },
      { weaponId: 'dart', trackingMult: 0.70 },
      { weaponId: 'baton', reachMult: 1.10 },
      { weaponId: 'scatter', spreadMult: 1.15 },
    ],
  },
  void_reach: {
    id: 'void_reach',
    name: 'Void Reach',
    unlockCondition: { planet: 'tidal', clears: 12 },
    difficultyRange: [3, 5],
    allowedContractTypes: ['hunt', 'void_breach', 'boss_hunt'],
    floorTiles: ['void_flesh', 'void_crystal', 'void_remnant'],
    palette: { base: 0x1a0a2e, accent: 0xcc44ff, highlight: 0xff2266 },
    weatherVariants: ['pulse_storm', 'dead_zone'],
    physics: {
      moveSpeedMult: 0.85,
      inertia: 0.20,
      bulletSpeedMult: 1.30,
      bulletLifeMult: 0.70,
      fireRateMult: 0.90,
      enemySpeedMult: 1.10,
      enemyHpMult: 1.0,
      enemyDamageMult: 1.10,
      knockbackMult: 1.0,
    },
    weaponMods: [
      { weaponId: 'sidearm', rangeMult: 1.25, damageMult: 1.10 },
      { weaponId: 'entropy_cannon', rangeMult: 1.25, damageMult: 1.10 },
      { weaponId: 'grenade_launcher', aoeMult: 1.30 },
      { weaponId: 'flamethrower', rangeMult: 0.75 },
      { weaponId: 'sniper_carbine', speedMult: 1.20 },
      { weaponId: 'lance', piercingAdd: 1 },
    ],
  },
  furnace: {
    id: 'furnace',
    name: 'Furnace',
    unlockCondition: { planet: 'void_reach', clears: 12 },
    difficultyRange: [4, 6],
    allowedContractTypes: ['hunt', 'boss_hunt'],
    floorTiles: ['furnace_metal', 'furnace_rock', 'furnace_grate'],
    palette: { base: 0x1a1208, accent: 0xff5500, highlight: 0xffcc00 },
    weatherVariants: ['eruption', 'cooldown'],
    physics: {
      moveSpeedMult: 0.80,
      inertia: 0.0,
      bulletSpeedMult: 0.65,
      bulletLifeMult: 0.85,
      fireRateMult: 1.15,
      enemySpeedMult: 0.80,
      enemyHpMult: 1.25,
      enemyDamageMult: 1.0,
      knockbackMult: 1.0,
    },
    weaponMods: [
      { weaponId: 'scatter', damageMult: 1.20 },
      { weaponId: 'grenade_launcher', aoeMult: 0.80, damageMult: 1.15 },
      { weaponId: 'dart', trackingMult: 1.40 },
      { weaponId: 'flamethrower', rangeMult: 1.20 },
      { weaponId: 'pulse_cannon', bouncesAdd: -1 },
    ],
  },
  hollow: {
    id: 'hollow',
    name: 'The Hollow',
    unlockCondition: { planet: 'furnace', clears: 12 },
    difficultyRange: [7, 7],
    allowedContractTypes: ['final_hunt'],
    floorTiles: ['hollow_void', 'hollow_bone', 'hollow_flesh'],
    palette: { base: 0x050008, accent: 0xff0044, highlight: 0xffffff },
    weatherVariants: ['collapse'],
    physics: {
      moveSpeedMult: 0.90,
      inertia: 0.10,
      bulletSpeedMult: 1.0,
      bulletLifeMult: 1.0,
      fireRateMult: 1.0,
      enemySpeedMult: 1.15,
      enemyHpMult: 1.40,
      enemyDamageMult: 1.25,
      knockbackMult: 0.5, // can't cheese with knockback
    },
    weaponMods: [
      // All weapons slightly nerfed -- no single weapon dominates
      { weaponId: 'scatter', spreadMult: 1.20 },
      { weaponId: 'flamethrower', rangeMult: 0.85 },
      { weaponId: 'sniper_carbine', damageMult: 0.85 },
      { weaponId: 'entropy_cannon', rangeMult: 0.80 },
    ],
  },
};

export const PLANET_ORDER: PlanetId[] = ['kepler', 'tidal', 'void_reach', 'furnace', 'hollow'];

export function isUnlocked(planetId: PlanetId, clearance: Record<string, number>): boolean {
  const cond = PLANETS[planetId].unlockCondition;
  if (!cond) return true;
  return (clearance[cond.planet] ?? 0) >= cond.clears;
}

export function getUnlockedPlanets(clearance: Record<string, number>): Planet[] {
  return PLANET_ORDER.map(id => PLANETS[id]).filter(p => isUnlocked(p.id, clearance));
}
