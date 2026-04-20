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

function getContractDifficulty(avgRep: number): number {
  if (avgRep < 50) return 1;
  if (avgRep < 150) return 1 + Math.floor(Math.random() * 2); // 1-2
  if (avgRep < 350) return 2 + Math.floor(Math.random() * 2); // 2-3
  if (avgRep < 700) return 3 + Math.floor(Math.random() * 2); // 3-4
  return 4 + Math.floor(Math.random() * 2); // 4-5
}

function computeSpecial(type: string, difficulty: number): string {
  switch (type) {
    case 'boss_hunt':       return '2× Elite Core + T3 Recipe';
    case 'payload_escort':  return difficulty >= 2 ? '+1 T2 Recipe' : '';
    case 'extraction_run':  return 'All ingredients kept + rep bonus';
    case 'void_breach':     return 'Void Walker rep bonus';
    default:                return difficulty >= 4 ? '+1 Elite Core' : '';
  }
}

export function generateContracts(count: number = 3, reputation: number = 0): Contract[] {
  const maxRep = reputation;
  const avgRep = reputation;

  const unlockedTypes = CONTRACT_TYPES.filter(t => maxRep >= (CONTRACT_UNLOCK_REP[t] ?? 0));
  const pool = unlockedTypes.length > 0 ? unlockedTypes : ['hunt'];

  const types = [...pool].sort(() => Math.random() - 0.5).slice(0, count);
  return types.map(type => {
    const def = CONTRACT_TYPE_DEFS[type];
    const difficulty = getContractDifficulty(avgRep);
    const names = CONTRACT_NAMES[type] || ['Unknown Mission'];
    const rewardFn = CONTRACT_REWARDS[type] ?? ((d) => 150 + d * 80);
    const parTimeFn = CONTRACT_PAR_TIME[type] ?? ((d) => 180 + d * 30);

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
    };

    // Contract-type-specific fields
    switch (type) {
      case 'hunt':
        base.eliteOnly = true;
        break;
      case 'payload_escort':
        base.podHp = 200 + difficulty * 50;
        break;
      case 'void_breach':
        base.holdTime = 30 + difficulty * 10; // per-zone hold in seconds
        base.targetTotal = 0; // no kill target, survive + hold
        break;
      case 'boss_hunt':
        base.targetTotal = 1; // kill the apex
        break;
      case 'extraction_run': {
        const totalCaches = 5 + difficulty * 3; // 8 at d=1, up to 17 at d=4
        base.cacheCount = totalCaches;
        base.targetTotal = totalCaches;
        break;
      }
    }

    return base;
  });
}
