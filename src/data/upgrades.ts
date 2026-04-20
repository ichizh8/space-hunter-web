/**
 * Upgrade generation system — pool-based with rarity weighting.
 *
 * Builds a pool of ALL available upgrades, assigns priority weights,
 * then picks 3 cards weighted by rarity and type diversity.
 * Each screen should feel different.
 */

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

/** Tracks the player's chosen corruption path and run progress. */
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

/** Weighted random pick: higher weight = more likely to be chosen */
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

// ── Internal card builders ──

/**
 * Build all eligible weapon cards for the current state.
 * Mastery perks are filtered to the chosen path when pathState is provided.
 */
function buildWeaponCards(state: ProgressionState, pathState?: RunPathState): UpgradeCard[] {
  const { weaponId, weaponLevel, weaponMutated, weaponMutationType } = state;
  const corruption = pathState?.corruption ?? state.corruption;
  const cards: UpgradeCard[] = [];

  if (weaponLevel >= 5 && !weaponMutated && WEAPON_MUTATIONS[weaponId]) {
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
  } else if (weaponMutated) {
    // After mutation: only mastery perks for the chosen path
    const path = pathState?.path ?? (weaponMutationType as 'clean' | 'void' | null);
    const masteryPool = WEAPON_MASTERY[weaponId]?.[path ?? weaponMutationType];
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
  } else if (weaponLevel < 5) {
    // Next level perk (offered in level order: Lv2, Lv3, Lv4)
    const nextLevel = weaponLevel + 1;
    const perks = WEAPON_LEVEL_PERKS[weaponId];
    if (perks && perks[nextLevel]) {
      const perk = perks[nextLevel];
      const wdef = WEAPON_DEFS[weaponId];
      cards.push({
        type: 'weapon_upgrade', id: `wperk_${weaponId}_${nextLevel}`,
        rarity: nextLevel >= 4 ? 'rare' : 'common',
        icon: perk.icon, label: `${wdef?.name ?? weaponId} — ${perk.name}`, desc: perk.desc,
        weaponId, perkEffect: perk.effect, perkValue: perk.value,
      });
    } else {
      const wdef = WEAPON_DEFS[weaponId];
      cards.push({
        type: 'weapon_upgrade', id: `wperk_${weaponId}_${nextLevel}`,
        rarity: 'common', icon: 'W',
        label: `${wdef?.name ?? weaponId} Lv${nextLevel}`, desc: '+1 damage',
        weaponId, perkEffect: 'damage', perkValue: 1,
      });
    }
    // Generic raw power alternative
    const wdef = WEAPON_DEFS[weaponId];
    cards.push({
      type: 'modifier', id: 'mastery_dmg', rarity: 'common',
      icon: 'W', label: `${wdef?.name ?? weaponId}: Raw Power`, desc: '+2 damage',
    });
  }

  return cards;
}

/** Build all eligible kit cards (resonance > tier upgrades > perks). */
function buildKitCards(state: ProgressionState): UpgradeCard[] {
  const { equippedKits, kitTiers, kitPerksTaken, resonanceTaken } = state;
  const cards: UpgradeCard[] = [];

  // Resonance (only when both kits are T3)
  const bothT3 = equippedKits.length >= 2 &&
    (kitTiers[equippedKits[0]] ?? 1) >= 3 &&
    (kitTiers[equippedKits[1]] ?? 1) >= 3;
  if (bothT3) {
    for (const rp of RESONANCE_POOL) {
      if (resonanceTaken.includes(rp.id)) continue;
      if (!rp.kits.every(k => equippedKits.includes(k))) continue;
      cards.push({
        type: 'resonance', id: rp.id, rarity: 'legendary',
        icon: rp.icon, label: rp.name, desc: rp.desc,
      });
    }
  }

  // Tier upgrades (T2 for kits still at T1)
  for (const kid of equippedKits) {
    const kt = kitTiers[kid] ?? 1;
    if (kt < 2) {
      const kdef = KIT_DEFS[kid];
      cards.push({
        type: 'kit_tier', id: `kit_tier_${kid}_2`, rarity: 'rare',
        icon: kdef?.icon ?? 'K', label: `${kdef?.name ?? kid} Tier 2`,
        desc: '+1 max HP (tier upgrade)', kitId: kid, newTier: 2,
      });
    }
  }

  // Kit perks (only for equipped kits)
  for (const kid of equippedKits) {
    const perksForKit = KIT_PERKS[kid] ?? [];
    for (const kp of perksForKit) {
      if (kitPerksTaken.includes(kp.id)) continue;
      cards.push({
        type: 'kit_perk', id: kp.id, rarity: kp.rarity,
        icon: kp.icon, label: kp.name, desc: kp.desc, kitId: kid,
      });
    }
  }

  return cards;
}

/** Build up to `count` random unused modifier cards. */
function buildModifierCards(state: ProgressionState, count: number): UpgradeCard[] {
  const usedModIds = new Set(state.modifiersTaken);
  const available = shuffle(MODIFIER_DEFS.filter(m => !usedModIds.has(m.id)));
  return available.slice(0, count).map(m => ({
    type: 'modifier' as UpgradeType,
    id: m.id,
    rarity: m.rarity as UpgradeRarity,
    icon: m.rarity === 'rare' ? '★' : '◆',
    label: m.name,
    desc: m.desc,
  }));
}

// ── Door reward helpers (guaranteed single-card picks) ──

function pickOneWeaponCard(state: ProgressionState, pathState?: RunPathState): UpgradeCard {
  const cards = buildWeaponCards(state, pathState);
  if (cards.length > 0) return cards[Math.floor(Math.random() * cards.length)];
  const wdef = WEAPON_DEFS[state.weaponId];
  return {
    type: 'modifier', id: 'mastery_dmg', rarity: 'common',
    icon: 'W', label: `${wdef?.name ?? state.weaponId}: Raw Power`, desc: '+2 damage',
  };
}

/** Returns null when no kits are equipped. */
function pickOneKitCard(state: ProgressionState): UpgradeCard | null {
  const cards = buildKitCards(state);
  if (cards.length === 0) return null;
  const weights = cards.map(c => RARITY_WEIGHT[c.rarity] * TYPE_WEIGHT[c.type]);
  return weightedPick(cards, weights);
}

function pickOneModifierCard(state: ProgressionState): UpgradeCard {
  const mods = buildModifierCards(state, 1);
  if (mods.length > 0) return mods[0];
  return { type: 'fallback', id: 'hp_restore', rarity: 'common', icon: '❤', label: 'Field Medkit', desc: 'Restore 3 HP immediately' };
}

// ── Public API ──

export function generateUpgrades(state: ProgressionState): UpgradeCard[] {
  const pool: UpgradeCard[] = [];
  const usedModIds = new Set(state.modifiersTaken);

  // ── WEAPON CARDS ──
  pool.push(...buildWeaponCards(state));

  // ── KIT CARDS ──
  for (const kid of state.equippedKits) {
    const kt = state.kitTiers[kid] ?? 1;
    if (kt === 2 && !state.kitT3Pending.includes(kid)) {
      state.kitT3Pending.push(kid);
    } else if (kt < 2) {
      const kdef = KIT_DEFS[kid];
      pool.push({
        type: 'kit_tier', id: `kit_tier_${kid}_2`, rarity: 'rare',
        icon: kdef?.icon ?? 'K', label: `${kdef?.name ?? kid} Tier 2`,
        desc: '+1 max HP (tier upgrade)', kitId: kid, newTier: 2,
      });
    }
  }

  for (const kid of state.equippedKits) {
    const perksForKit = KIT_PERKS[kid] ?? [];
    for (const kp of perksForKit) {
      if (state.kitPerksTaken.includes(kp.id)) continue;
      pool.push({
        type: 'kit_perk', id: kp.id, rarity: kp.rarity,
        icon: kp.icon, label: kp.name, desc: kp.desc, kitId: kid,
      });
    }
  }

  // Resonance
  const bothT3 = state.equippedKits.length >= 2 &&
    (state.kitTiers[state.equippedKits[0]] ?? 1) >= 3 &&
    (state.kitTiers[state.equippedKits[1]] ?? 1) >= 3;
  if (bothT3) {
    for (const rp of RESONANCE_POOL) {
      if (state.resonanceTaken.includes(rp.id)) continue;
      if (!rp.kits.every(k => state.equippedKits.includes(k))) continue;
      pool.push({
        type: 'resonance', id: rp.id, rarity: 'legendary',
        icon: rp.icon, label: rp.name, desc: rp.desc,
      });
    }
  }

  // ── MODIFIERS (add several for variety) ──
  const availMods = shuffle(MODIFIER_DEFS.filter(m => !usedModIds.has(m.id)));
  for (const m of availMods.slice(0, 4)) {
    pool.push({
      type: 'modifier', id: m.id, rarity: m.rarity,
      icon: m.rarity === 'rare' ? '★' : '◆', label: m.name, desc: m.desc,
    });
  }

  // ── FALLBACKS (always available) ──
  const fallbacks: UpgradeCard[] = [
    { type: 'fallback', id: 'hp_restore',    rarity: 'common', icon: '❤', label: 'Field Medkit',   desc: 'Restore 3 HP immediately' },
    { type: 'fallback', id: 'corr_purge',    rarity: 'rare',   icon: 'P', label: 'Void Purge',     desc: 'Reduce corruption by 20' },
  ];
  if (!usedModIds.has('void_drain'))   fallbacks.push({ type: 'fallback', id: 'void_drain_f',  rarity: 'common', icon: 'D', label: 'Void Drain',     desc: 'Killing void enemies reduces corruption by 3' });
  if (!usedModIds.has('pack_hunter'))  fallbacks.push({ type: 'fallback', id: 'pack_hunter_f', rarity: 'common', icon: 'P', label: 'Pack Awareness', desc: '+8% damage per enemy within 200px' });
  pool.push(...fallbacks);

  // ── PICK 3 CARDS with weighted selection + type diversity ──
  if (pool.length <= 3) return pool;

  const picked: UpgradeCard[] = [];
  const remaining = [...pool];
  const pickedTypes = new Set<UpgradeType>();

  for (let i = 0; i < 3 && remaining.length > 0; i++) {
    const weights = remaining.map(card => {
      let w = RARITY_WEIGHT[card.rarity] * TYPE_WEIGHT[card.type];
      if (pickedTypes.has(card.type)) w *= 0.15;
      if (picked.some(p => p.id === card.id)) w = 0;
      return w;
    });

    const card = weightedPick(remaining, weights);
    picked.push(card);
    pickedTypes.add(card.type);
    remaining.splice(remaining.indexOf(card), 1);
  }

  const rarityOrder: Record<UpgradeRarity, number> = { legendary: 0, rare: 1, common: 2 };
  picked.sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity]);

  return picked;
}

/**
 * Generate door rewards for room-clear events.
 *
 * Returns an array of `doorCount` single-card arrays. Each door holds exactly
 * one card. The caller presents the doors to the player; the player picks one.
 *
 * Guarantees across all doors:
 *   - Door 0 slot: weapon card (level perk / mutation / mastery)
 *   - Door 1 slot: kit card (resonance > tier upgrade > kit perk), or a modifier
 *                  when no kits are equipped
 *   - Door 2+ slots: modifier / stat card
 *
 * Doors are shuffled before return so the player cannot predict which type is
 * behind which door.
 *
 * @param state      Current progression state
 * @param doorCount  Number of doors (typically 2 or 3)
 * @param pathState  Optional run path state; when provided, mastery perks are
 *                   filtered to the chosen mutation path (clean or void)
 */
export function generateDoorRewards(
  state: ProgressionState,
  doorCount: number,
  pathState?: RunPathState,
): UpgradeCard[][] {
  const slots: UpgradeCard[] = [];

  // Slot 0: guaranteed weapon card
  slots.push(pickOneWeaponCard(state, pathState));

  // Slot 1: kit card (falls back to modifier when no kits equipped)
  if (doorCount >= 2) {
    slots.push(pickOneKitCard(state) ?? pickOneModifierCard(state));
  }

  // Slot 2+: modifier / stat cards
  while (slots.length < doorCount) {
    slots.push(pickOneModifierCard(state));
  }

  return shuffle(slots).map(card => [card]);
}
