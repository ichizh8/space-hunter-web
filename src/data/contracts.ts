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

/** Minimum rep on ANY track to unlock each contract type */
export const TIER_UNLOCK: Record<string, number> = {
  hunt:           0,
  extraction_run: 50,
  payload_escort: 150,
  void_breach:    350,
  boss_hunt:      700,
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
  /** Par time in seconds — exceeding it halves reward */
  parTime: number;
  /** Payload HP (payload_escort only) */
  podHp?: number;
  /** Total hold duration in seconds across all 3 breach zones (void_breach only) */
  holdTime?: number;
  /** Number of caches to collect (extraction_run only) */
  cacheCount?: number;
  /** If true this contract is locked (not playable yet) */
  locked?: boolean;
  /** Rep threshold that unlocks this type */
  requiredRep?: number;
}

const CONTRACT_NAMES: Record<string, string[]> = {
  hunt:           ['Void Sweep', 'Infestation Clear', 'Perimeter Purge', 'Dead Zone Recon'],
  payload_escort: ['Supply Run', 'Cargo Extraction', 'Pod Delivery', 'Emergency Resupply'],
  void_breach:    ['Rift Containment', 'Void Seal', 'Breach Lockdown', 'Dimensional Hold'],
  boss_hunt:      ['Apex Target', 'Priority Kill', 'Named Bounty', 'Alpha Elimination'],
  extraction_run: ['Cache Sweep', 'Ingredient Run', 'Biome Harvest', 'Supply Scavenge'],
};

function computeReward(type: string, difficulty: number): number {
  switch (type) {
    case 'hunt':           return 150 + difficulty * 80;
    case 'extraction_run': return 200 + difficulty * 70;
    case 'payload_escort': return 200 + difficulty * 80;
    case 'void_breach':    return 250 + difficulty * 80;
    case 'boss_hunt':      return 350 + difficulty * 100;
    default:               return difficulty * 50;
  }
}

function computeSpecial(type: string, difficulty: number): string {
  switch (type) {
    case 'boss_hunt':       return '2× Elite Core + T3 Recipe';
    case 'payload_escort':  return difficulty >= 2 ? '+1 T2 Recipe' : '';
    case 'extraction_run':  return 'All ingredients kept + rep bonus';
    case 'void_breach':     return 'Void Walker rep bonus';
    case 'hunt':            return difficulty >= 4 ? '+1 Elite Core' : '';
    default:                return '';
  }
}

function computeParTime(type: string, difficulty: number): number {
  switch (type) {
    case 'hunt':           return 180 + difficulty * 30;
    case 'extraction_run': return 240 + difficulty * 30;
    case 'payload_escort': return 300 + difficulty * 30;
    case 'void_breach':    return 180 + difficulty * 30;
    case 'boss_hunt':      return 300 + difficulty * 60;
    default:               return 300;
  }
}

/** Difficulty range based on average rep across all tracks */
function difficultyRange(avgRep: number): [number, number] {
  if (avgRep >= 700) return [4, 5];
  if (avgRep >= 350) return [3, 4];
  if (avgRep >= 150) return [2, 3];
  if (avgRep >= 50)  return [1, 2];
  return [1, 1];
}

export function generateContracts(count: number = 3, reputation: Record<string, number> = {}): Contract[] {
  const repValues = Object.values(reputation).map(v => v ?? 0);
  const maxRep = repValues.length > 0 ? Math.max(...repValues) : 0;
  const avgRep = repValues.length > 0 ? repValues.reduce((a, b) => a + b, 0) / repValues.length : 0;

  const [minDiff, maxDiff] = difficultyRange(avgRep);

  const unlocked = CONTRACT_TYPES.filter(t => maxRep >= TIER_UNLOCK[t]);
  const locked   = CONTRACT_TYPES.filter(t => maxRep < TIER_UNLOCK[t]);

  // Pick `count` from unlocked pool (random shuffle)
  const pool = [...unlocked].sort(() => Math.random() - 0.5).slice(0, count);

  const active: Contract[] = pool.map(type => {
    const def = CONTRACT_TYPE_DEFS[type];
    const difficulty = minDiff + Math.floor(Math.random() * (maxDiff - minDiff + 1));
    const names = CONTRACT_NAMES[type] || ['Unknown Mission'];

    const base: Contract = {
      type,
      label: def.label,
      name: names[Math.floor(Math.random() * names.length)],
      desc: def.desc,
      difficulty,
      reward: computeReward(type, difficulty),
      specialReward: computeSpecial(type, difficulty),
      iconColor: def.iconColor,
      targetTotal: 0,
      parTime: computeParTime(type, difficulty),
    };

    switch (type) {
      case 'hunt':
        // Elite kills only; 1+diff elites (diff1=2 elites … diff5=6 elites)
        base.targetTotal = 1 + difficulty;
        break;
      case 'payload_escort':
        base.podHp = 150 + difficulty * 75;
        base.targetTotal = 0;
        break;
      case 'void_breach':
        // Per-zone hold: 30+diff*10s; 3 zones total
        base.holdTime = (30 + difficulty * 10) * 3;
        base.targetTotal = 0;
        break;
      case 'boss_hunt':
        base.targetTotal = 1;
        break;
      case 'extraction_run':
        base.cacheCount = 3;
        base.targetTotal = 3;
        break;
    }

    return base;
  });

  // Append locked stubs so the board can display them greyed out
  const lockedStubs: Contract[] = locked.map(type => {
    const def = CONTRACT_TYPE_DEFS[type];
    return {
      type,
      label: def.label,
      name: '',
      desc: def.desc,
      difficulty: 0,
      reward: 0,
      specialReward: '',
      iconColor: def.iconColor,
      targetTotal: 0,
      parTime: 0,
      locked: true,
      requiredRep: TIER_UNLOCK[type],
    };
  });

  return [...active, ...lockedStubs];
}
