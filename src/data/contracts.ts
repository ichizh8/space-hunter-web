import { type PlanetId, type Planet, PLANETS, getUnlockedPlanets } from './planets';

export interface ContractTypeDef {
  label: string;
  iconColor: number;
  desc: string;
}

export const CONTRACT_TYPE_DEFS: Record<string, ContractTypeDef> = {
  hunt:            { label: 'Hunt',           iconColor: 0xe64d4d, desc: 'Survive and eliminate elite targets' },
  payload_escort:  { label: 'Payload Escort', iconColor: 0x4db3e6, desc: 'Protect the cargo pod to the exit' },
  void_breach:     { label: 'Void Breach',    iconColor: 0x9919e6, desc: 'Hold position near the void rift' },
  boss_hunt:       { label: 'Boss Hunt',      iconColor: 0xff8000, desc: 'Find and eliminate a named apex target' },
  extraction_run:  { label: 'Extraction Run', iconColor: 0x33e666, desc: 'Collect ingredient caches across biomes' },
};

export const CONTRACT_TYPES = Object.keys(CONTRACT_TYPE_DEFS);

export const CONTRACT_UNLOCK_REP: Record<string, number> = {
  hunt: 0,
  extraction_run: 50,
  payload_escort: 150,
  void_breach: 350,
  boss_hunt: 700,
};

const CONTRACT_REWARDS: Record<string, (diff: number) => number> = {
  hunt:           (d) => 150 + d * 80,
  extraction_run: (d) => 200 + d * 70,
  payload_escort: (d) => 200 + d * 80,
  void_breach:    (d) => 250 + d * 80,
  boss_hunt:      (d) => 350 + d * 100,
};

const CONTRACT_PAR_TIME: Record<string, (diff: number) => number> = {
  hunt:           (d) => 180 + d * 30,
  extraction_run: (d) => 240 + d * 30,
  payload_escort: (d) => 300 + d * 30,
  void_breach:    (d) => 180 + d * 30,
  boss_hunt:      (d) => 300 + d * 60,
};

export interface Contract {
  type: string;
  label: string;
  name: string;
  desc: string;
  difficulty: number;
  reward: number;
  specialReward: string;
  iconColor: number;
  targetTotal: number;
  /** Par time in seconds (for time bonus on results) */
  parTime: number;
  /** Planet this contract takes place on */
  planet: PlanetId;
  /** Number of rooms in the run */
  roomCount: number;
  /** Hunt targets are elite enemies only */
  eliteOnly?: boolean;
  /** Payload HP (payload_escort only) */
  podHp?: number;
  /** Hold duration in seconds (void_breach only) */
  holdTime?: number;
  /** Number of caches to collect (extraction_run only) */
  cacheCount?: number;
}

const CONTRACT_NAMES: Record<string, string[]> = {
  hunt:           ['Void Sweep', 'Infestation Clear', 'Perimeter Purge', 'Dead Zone Recon'],
  payload_escort: ['Supply Run', 'Cargo Extraction', 'Pod Delivery', 'Emergency Resupply'],
  void_breach:    ['Rift Containment', 'Void Seal', 'Breach Lockdown', 'Dimensional Hold'],
  boss_hunt:      ['Apex Target', 'Priority Kill', 'Named Bounty', 'Alpha Elimination'],
  extraction_run: ['Cache Sweep', 'Ingredient Run', 'Biome Harvest', 'Supply Scavenge'],
};

// Hunt: 5-8 rooms by difficulty; indexed by difficulty 1-6
const HUNT_ROOM_COUNTS = [0, 5, 5, 6, 6, 7, 8] as const;

function getRoomCount(type: string, difficulty: number): number {
  switch (type) {
    case 'hunt':           return HUNT_ROOM_COUNTS[Math.min(difficulty, 6)] ?? 5;
    case 'boss_hunt':      return difficulty >= 5 ? 5 : 4;
    case 'extraction_run': return difficulty >= 3 ? 6 : 5;
    case 'void_breach':    return 3;
    case 'payload_escort': return 1;
    default:               return 5;
  }
}

function getPlanetDifficulty(planet: Planet, clearance: number): number {
  const [floor, ceil] = planet.difficultyRange;
  const step = Math.min(Math.floor(clearance / 2), ceil - floor);
  const base = floor + step;
  const variance = clearance > 0 && Math.random() < 0.4 ? 1 : 0;
  return Math.min(ceil, base + variance);
}

function pickPlanetsForBoard(unlocked: Planet[], count: number): Planet[] {
  if (unlocked.length === 0) return Array.from({ length: count }, () => PLANETS.kepler);
  const result: Planet[] = [];
  for (let i = 0; i < count; i++) {
    if (i === 0) result.push(unlocked[0]);
    else if (i === count - 1) result.push(unlocked[unlocked.length - 1]);
    else result.push(unlocked[Math.floor(Math.random() * unlocked.length)]);
  }
  return result;
}

function computeSpecial(type: string, difficulty: number): string {
  switch (type) {
    case 'boss_hunt':       return '2x Elite Core + T3 Recipe';
    case 'payload_escort':  return difficulty >= 2 ? '+1 T2 Recipe' : '';
    case 'extraction_run':  return 'All ingredients kept + rep bonus';
    case 'void_breach':     return 'Void Walker rep bonus';
    default:                return difficulty >= 4 ? '+1 Elite Core' : '';
  }
}

function buildContract(type: string, planet: Planet, difficulty: number): Contract {
  const def = CONTRACT_TYPE_DEFS[type];
  const roomCount = getRoomCount(type, difficulty);
  const names = CONTRACT_NAMES[type] || ['Unknown Mission'];
  const rewardFn = CONTRACT_REWARDS[type] ?? ((d: number) => 150 + d * 80);
  const parTimeFn = CONTRACT_PAR_TIME[type] ?? ((d: number) => 180 + d * 30);

  const base: Contract = {
    type,
    label: def.label,
    name: names[Math.floor(Math.random() * names.length)],
    desc: def.desc,
    difficulty,
    reward: rewardFn(difficulty),
    specialReward: computeSpecial(type, difficulty),
    iconColor: def.iconColor,
    targetTotal: 1 + difficulty,
    parTime: parTimeFn(difficulty),
    planet: planet.id,
    roomCount,
  };

  switch (type) {
    case 'hunt':
      base.eliteOnly = true;
      break;
    case 'payload_escort':
      base.podHp = 200 + difficulty * 50;
      break;
    case 'void_breach':
      base.holdTime = 30 + difficulty * 10;
      base.targetTotal = 0;
      break;
    case 'boss_hunt':
      base.targetTotal = 1;
      break;
    case 'extraction_run': {
      const totalCaches = 5 + difficulty * 3;
      base.cacheCount = totalCaches;
      base.targetTotal = totalCaches;
      break;
    }
  }

  return base;
}

export function generateContracts(
  count: number = 3,
  reputation: number = 0,
  planetClearance: Record<string, number> = {}
): Contract[] {
  const unlockedPlanets = getUnlockedPlanets(planetClearance);
  const selectedPlanets = pickPlanetsForBoard(unlockedPlanets, count);

  const used = new Set<string>();
  return selectedPlanets.map(planet => {
    const clearance = planetClearance[planet.id] ?? 0;
    const difficulty = getPlanetDifficulty(planet, clearance);

    // Pick a contract type from this planet's allowed types, avoiding repeats when possible
    const pool = planet.allowedContractTypes.filter(t => !used.has(t));
    const available = pool.length > 0 ? pool : planet.allowedContractTypes;
    const type = available[Math.floor(Math.random() * available.length)];
    used.add(type);

    return buildContract(type, planet, difficulty);
  });
}
