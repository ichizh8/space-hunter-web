import { WEAPON_DEFS, WEAPON_LEVEL_PERKS, WEAPON_MUTATIONS, WEAPON_MASTERY } from './weapons';
import { KIT_DEFS, KIT_PERKS, RESONANCE_POOL } from './kits';
import { MODIFIER_DEFS } from './modifiers';

export type UpgradeRarity = 'common' | 'rare' | 'legendary';

export type UpgradeType =
  | 'weapon_upgrade'
  | 'mutation'
  | 'mastery'
  | 'kit_tier'
  | 'kit_perk'
  | 'resonance'
  | 'modifier'
  | 'fallback';

export interface UpgradeCard {
  type: UpgradeType;
  id: string;
  rarity: UpgradeRarity;
  icon: string;
  label: string;
  desc: string;
  weaponId?: string;
  mutationType?: 'clean' | 'void';
  kitId?: string;
  newTier?: number;
  perkEffect?: string;
  perkValue?: number | boolean;
}

export interface ProgressionState {
  weaponId: string;
  weaponLevel: number;
  weaponMutated: boolean;
  weaponMutationType: string;
  corruption: number;
  equippedKits: string[];
  kitTiers: Record<string, number>;
  kitPerksTaken: string[];
  masteryTaken: string[];
  resonanceTaken: string[];
  modifiersTaken: string[];
  kitT3Pending: string[];
}

/** Run-level path state — tracks which fork was chosen and how far in the run we are. */
export interface RunPathState {
  path: 'clean' | 'void' | null;
  roomsCleared: number;
  corruption: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

const RARITY_WEIGHT: Record<UpgradeRarity, number> = {
  legendary: 5,
  rare: 3,
  common: 1.5,
};

const TYPE_WEIGHT: Record<UpgradeType, number> = {
  mutation: 6,
  resonance: 5,
  mastery: 4,
  weapon_upgrade: 3,
  kit_tier: 3,
  kit_perk: 2.5,
  modifier: 1,
  fallback: 0.5,
};

const RARITY_ORDER: Record<UpgradeRarity, number> = { legendary: 0, rare: 1, common: 2 };

// ── Sub-pool builders (loadout-scoped) ──

function buildWeaponCards(state: ProgressionState, runPath?: RunPathState): UpgradeCard[] {
  const { weaponId, weaponLevel, weaponMutated, weaponMutationType } = state;
  const corruption = runPath?.corruption ?? state.corruption;
  const cards: UpgradeCard[] = [];

  if (!weaponMutated && weaponLevel >= 5 && WEAPON_MUTATIONS[weaponId]) {
    // Mutation fork — offer forks based on corruption level
    if (corruption < 35) {
      const mut = WEAPON_MUTATIONS[weaponId].clean;
      cards.push({
        type: 'mutation', id: `mut_${weaponId}_clean`, rarity: 'legendary',
        icon: mut.icon, label: mut.name, desc: mut.desc,
        weaponId, mutationType: 'clean',
      });
    }
    if (corruption > 20) {
      const mut = WEAPON_MUTATIONS[weaponId].void;
      cards.push({
        type: 'mutation', id: `mut_${weaponId}_void`, rarity: 'legendary',
        icon: mut.icon, label: mut.name, desc: mut.desc,
        weaponId, mutationType: 'void',
      });
    }
  } else if (!weaponMutated && weaponLevel < 5) {
    // Next weapon perk in level order (Lv2 → Lv3 → Lv4 → Lv5)
    const nextLevel = weaponLevel + 1;
    const perks = WEAPON_LEVEL_PERKS[weaponId];
    const perk = perks?.[nextLevel];
    const wdef = WEAPON_DEFS[weaponId];
    if (perk) {
      cards.push({
        type: 'weapon_upgrade', id: `wperk_${weaponId}_${nextLevel}`,
        rarity: nextLevel >= 4 ? 'rare' : 'common',
        icon: perk.icon, label: `${wdef?.name ?? weaponId} — ${perk.name}`, desc: perk.desc,
        weaponId, perkEffect: perk.effect, perkValue: perk.value,
      });
    } else {
      cards.push({
        type: 'weapon_upgrade', id: `wperk_${weaponId}_${nextLevel}`,
        rarity: 'common', icon: 'W',
        label: `${wdef?.name ?? weaponId} Lv${nextLevel}`, desc: '+1 damage',
        weaponId, perkEffect: 'damage', perkValue: 1,
      });
    }
  } else if (weaponMutated) {
    // Mastery perks — path determines which pool: runPath.path overrides weaponMutationType
    const masteryPath = runPath?.path ?? (weaponMutationType as 'clean' | 'void');
    const masteryPool = masteryPath ? WEAPON_MASTERY[weaponId]?.[masteryPath] : undefined;
    if (masteryPool) {
      const available = shuffle(masteryPool.filter(mp => !state.masteryTaken.includes(mp.id)));
      for (const perk of available.slice(0, 2)) {
        cards.push({
          type: 'mastery', id: perk.id, rarity: 'rare',
          icon: perk.icon, label: perk.name, desc: perk.desc, weaponId,
        });
      }
    }
    if (cards.length === 0) {
      const wdef = WEAPON_DEFS[weaponId];
      cards.push({
        type: 'modifier', id: 'mastery_dmg', rarity: 'common',
        icon: 'W', label: `Mastery: ${wdef?.name ?? weaponId}`, desc: '+2 damage',
      });
    }
  }

  return cards;
}

function buildKitCards(state: ProgressionState): UpgradeCard[] {
  const cards: UpgradeCard[] = [];

  // Tier upgrades — only for equipped kits
  for (const kid of state.equippedKits) {
    const kt = state.kitTiers[kid] ?? 1;
    const kdef = KIT_DEFS[kid];
    if (kt < 2) {
      cards.push({
        type: 'kit_tier', id: `kit_tier_${kid}_2`, rarity: 'rare',
        icon: kdef?.icon ?? 'K', label: `${kdef?.name ?? kid} Tier 2`,
        desc: 'Kit tier upgrade', kitId: kid, newTier: 2,
      });
    } else if (kt === 2) {
      cards.push({
        type: 'kit_tier', id: `kit_tier_${kid}_3`, rarity: 'legendary',
        icon: kdef?.icon ?? 'K', label: `${kdef?.name ?? kid} Tier 3`,
        desc: 'Kit tier upgrade', kitId: kid, newTier: 3,
      });
    }
  }

  // Perks — only for equipped kits
  for (const kid of state.equippedKits) {
    const perksForKit = KIT_PERKS[kid] ?? [];
    for (const kp of perksForKit) {
      if (state.kitPerksTaken.includes(kp.id)) continue;
      cards.push({
        type: 'kit_perk', id: kp.id, rarity: kp.rarity,
        icon: kp.icon, label: kp.name, desc: kp.desc, kitId: kid,
      });
    }
  }

  // Resonance — only when both equipped kits are T3
  const bothT3 =
    state.equippedKits.length >= 2 &&
    (state.kitTiers[state.equippedKits[0]] ?? 1) >= 3 &&
    (state.kitTiers[state.equippedKits[1]] ?? 1) >= 3;
  if (bothT3) {
    for (const rp of RESONANCE_POOL) {
      if (state.resonanceTaken.includes(rp.id)) continue;
      if (!rp.kits.every(k => state.equippedKits.includes(k))) continue;
      cards.push({
        type: 'resonance', id: rp.id, rarity: 'legendary',
        icon: rp.icon, label: rp.name, desc: rp.desc,
      });
    }
  }

  return cards;
}

function buildModifierCards(state: ProgressionState): UpgradeCard[] {
  const usedModIds = new Set(state.modifiersTaken);
  return shuffle(MODIFIER_DEFS.filter(m => !usedModIds.has(m.id))).map(m => ({
    type: 'modifier' as UpgradeType,
    id: m.id,
    rarity: m.rarity as UpgradeRarity,
    icon: m.rarity === 'rare' ? '★' : '◆',
    label: m.name,
    desc: m.desc,
  }));
}

function pickFromPool(pool: UpgradeCard[]): UpgradeCard | undefined {
  if (pool.length === 0) return undefined;
  const weights = pool.map(c => RARITY_WEIGHT[c.rarity] * TYPE_WEIGHT[c.type]);
  return weightedPick(pool, weights);
}

// ── Public API ──

/**
 * Generate a 2-3 card upgrade screen for between-room door rewards.
 *
 * Guarantees one weapon card, one kit card, and (if either pool is non-empty
 * for both) one modifier card.  Signature is backward-compatible — runPath is
 * optional and only affects mastery-path filtering.
 */
export function generateUpgrades(state: ProgressionState, runPath?: RunPathState): UpgradeCard[] {
  const weaponPool = buildWeaponCards(state, runPath);
  const kitPool    = buildKitCards(state);
  const modPool    = buildModifierCards(state);

  const result: UpgradeCard[] = [];

  const wCard = pickFromPool(weaponPool);
  if (wCard) result.push(wCard);

  const kCard = pickFromPool(kitPool);
  if (kCard) result.push(kCard);

  if (modPool.length > 0) result.push(modPool[0]);

  result.sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]);
  return result;
}

/**
 * Generate one card per door.  Each door gets exactly one card; the caller
 * presents all doors and the player picks one.
 *
 * Cards are distributed across categories (weapon → kit → modifier → repeat)
 * so adjacent doors always offer something different.
 */
export function generateDoorRewards(
  state: ProgressionState,
  doorCount: number,
  runPath?: RunPathState,
): UpgradeCard[][] {
  const pools: UpgradeCard[][] = [
    shuffle(buildWeaponCards(state, runPath)),
    shuffle(buildKitCards(state)),
    shuffle(buildModifierCards(state)),
  ];

  const fallback: UpgradeCard = {
    type: 'fallback', id: 'hp_restore', rarity: 'common',
    icon: '❤', label: 'Field Medkit', desc: 'Restore 3 HP immediately',
  };

  const doors: UpgradeCard[][] = [];
  for (let i = 0; i < doorCount; i++) {
    let card: UpgradeCard | undefined;
    // Try assigned category first, then fall through to any non-empty pool
    for (let attempt = 0; attempt < pools.length; attempt++) {
      const pool = pools[(i + attempt) % pools.length];
      if (pool.length > 0) {
        card = pool.shift()!;
        break;
      }
    }
    doors.push([card ?? fallback]);
  }

  return doors;
}
