export type PlanetId = 'kepler' | 'tidal' | 'void_reach' | 'furnace';

export interface Planet {
  id: PlanetId;
  name: string;
  unlockCondition: { planet: PlanetId; clears: number } | null;
  difficultyRange: [number, number];
  allowedContractTypes: string[];
  floorTiles: string[];
  palette: { base: number; accent: number; highlight: number };
  weatherVariants: string[];
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
  },
  tidal: {
    id: 'tidal',
    name: 'Tidal Flats',
    unlockCondition: { planet: 'kepler', clears: 5 },
    difficultyRange: [2, 4],
    allowedContractTypes: ['hunt', 'payload_escort', 'extraction_run'],
    floorTiles: ['tidal_platform', 'tidal_sand', 'tidal_coral', 'tidal_shallows'],
    palette: { base: 0x1a3a4a, accent: 0x44d4ff, highlight: 0xffe066 },
    weatherVariants: ['high_tide', 'bioloom'],
  },
  void_reach: {
    id: 'void_reach',
    name: 'Void Reach',
    unlockCondition: { planet: 'tidal', clears: 3 },
    difficultyRange: [3, 5],
    allowedContractTypes: ['hunt', 'void_breach', 'boss_hunt'],
    floorTiles: ['void_flesh', 'void_crystal', 'void_remnant'],
    palette: { base: 0x1a0a2e, accent: 0xcc44ff, highlight: 0xff2266 },
    weatherVariants: ['pulse_storm', 'dead_zone'],
  },
  furnace: {
    id: 'furnace',
    name: 'Furnace',
    unlockCondition: { planet: 'void_reach', clears: 3 },
    difficultyRange: [4, 6],
    allowedContractTypes: ['hunt', 'boss_hunt'],
    floorTiles: ['furnace_metal', 'furnace_rock', 'furnace_grate'],
    palette: { base: 0x1a1208, accent: 0xff5500, highlight: 0xffcc00 },
    weatherVariants: ['eruption', 'cooldown'],
  },
};

export const PLANET_ORDER: PlanetId[] = ['kepler', 'tidal', 'void_reach', 'furnace'];

export function isUnlocked(planetId: PlanetId, clearance: Record<string, number>): boolean {
  const cond = PLANETS[planetId].unlockCondition;
  if (!cond) return true;
  return (clearance[cond.planet] ?? 0) >= cond.clears;
}

export function getUnlockedPlanets(clearance: Record<string, number>): Planet[] {
  return PLANET_ORDER.map(id => PLANETS[id]).filter(p => isUnlocked(p.id, clearance));
}
