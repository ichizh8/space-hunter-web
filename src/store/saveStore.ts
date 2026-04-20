import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { REP_THRESHOLDS } from '../data/recipes';

export interface SaveState {
  totalCredits: number;
  totalCorruption: number;
  contractsCompleted: number;
  pantry: Record<string, number>;
  shipUpgrades: Record<string, number>;
  unlockedWeapons: string[];
  equippedKits: string[];
  kitTiers: Record<string, number>;
  unlockedKits: string[];
  kitT3Choices: Record<string, string>;
  kitT2Paths: Record<string, string>;
  activeBonuses: Record<string, boolean | number>;
  unlockedRecipes: string[];
  reputation: number;
  planetClearance: Record<string, number>;
  ingredientInventory: Record<string, number>;
  kitchenStations: Record<string, number>;
  recipesUnlocked: string[];
  introSeen: boolean;
  endowedProgress: boolean;
}

export interface SaveActions {
  completeContract: (credits: number, corruption: number) => void;
  buyUpgrade: (id: string, cost: number, maxLevel: number) => boolean;
  unlockWeapon: (id: string, cost: number) => boolean;
  unlockKit: (id: string, cost: number) => void;
  upgradeKitTier: (id: string, newTier: number, cost: number) => void;
  assignKit: (kitId: string, slot: number) => void;
  addIngredients: (items: Array<{ id: string }>) => void;
  cookRecipe: (cost: Record<string, number>, track: string, rep: number, bonus: string) => void;
  getRepTier: () => number;
  addReputation: (amount: number) => void;
  addIngredient: (id: string, count: number) => void;
  removeIngredients: (items: Record<string, number>) => void;
  unlockRecipe: (id: string) => void;
  upgradeKitchenStation: (station: string) => void;
  completePlanetContract: (planet: string) => void;
  getPlanetUnlocked: (planet: string) => boolean;
  getAvailableWeapons: () => string[];
  markIntroSeen: () => void;
  endowProgress: () => void;
  devGiveResources: () => void;
}

const DEFAULT_PANTRY: Record<string, number> = {
  rift_dust: 0, void_crystal: 0, cave_moss: 0, river_silt: 0, elite_core: 0,
};

export const useSaveStore = create<SaveState & SaveActions>()(
  persist(
    (set, get) => ({
      // State
      totalCredits: 0,
      totalCorruption: 0,
      contractsCompleted: 0,
      pantry: { ...DEFAULT_PANTRY },
      shipUpgrades: { thrusters: 0, salvage_module: 0, emergency_protocol: 0, conditioning: 0, reflex_training: 0, trigger_discipline: 0, combat_training: 0, quick_hands: 0, kit_slots: 0 },
      unlockedWeapons: ['sidearm'],
      equippedKits: ['stim_pack', 'flash_trap'],
      kitTiers: { stim_pack: 1, flash_trap: 1 },
      unlockedKits: ['stim_pack', 'flash_trap'],
      kitT3Choices: {},
      kitT2Paths: {},
      activeBonuses: {},
      unlockedRecipes: ['field_ration', 'void_brew', 'cave_jerky', 'silt_stew'],
      reputation: 0,
      planetClearance: { kepler: 0, tidal: 0, void_reach: 0, furnace: 0 },
      ingredientInventory: {},
      kitchenStations: { basic: 1, prep: 0, exotic: 0, void_infuser: 0, forge: 0 },
      recipesUnlocked: [],
      introSeen: false,
      endowedProgress: false,

      // Actions
      completeContract: (credits, corruption) => set(s => ({
        totalCredits: s.totalCredits + credits,
        totalCorruption: s.totalCorruption + corruption,
        contractsCompleted: s.contractsCompleted + 1,
      })),

      buyUpgrade: (id, cost, maxLevel) => {
        const s = get();
        const level = s.shipUpgrades[id] ?? 0;
        if (level >= maxLevel || s.totalCredits < cost) return false;
        set({
          totalCredits: s.totalCredits - cost,
          shipUpgrades: { ...s.shipUpgrades, [id]: level + 1 },
        });
        return true;
      },

      unlockWeapon: (id, cost) => {
        const s = get();
        if (s.unlockedWeapons.includes(id) || s.totalCredits < cost) return false;
        set({
          totalCredits: s.totalCredits - cost,
          unlockedWeapons: [...s.unlockedWeapons, id],
        });
        return true;
      },

      unlockKit: (id, cost) => {
        const s = get();
        if (s.totalCredits < cost) return;
        set({
          totalCredits: s.totalCredits - cost,
          unlockedKits: [...s.unlockedKits, id],
          kitTiers: { ...s.kitTiers, [id]: 1 },
        });
      },

      upgradeKitTier: (id, newTier, cost) => {
        const s = get();
        if (s.totalCredits < cost) return;
        set({
          totalCredits: s.totalCredits - cost,
          kitTiers: { ...s.kitTiers, [id]: newTier },
        });
      },

      assignKit: (kitId, slot) => {
        const s = get();
        const maxSlots = 2 + (s.shipUpgrades.kit_slots || 0);
        const eq = [...s.equippedKits];
        while (eq.length < maxSlots) eq.push('');
        // Swap if already equipped in another slot
        for (let i = 0; i < eq.length; i++) {
          if (i !== slot && eq[i] === kitId) {
            eq[i] = eq[slot];
            break;
          }
        }
        eq[slot] = kitId;
        set({ equippedKits: eq });
      },

      addIngredients: (items) => set(s => {
        const pantry = { ...s.pantry };
        for (const item of items) {
          const key = item.id.replace('ingredient_', '');
          pantry[key] = (pantry[key] ?? 0) + 1;
        }
        return { pantry };
      }),

      cookRecipe: (cost, _track, rep, bonus) => set(s => {
        const pantry = { ...s.pantry };
        for (const [k, v] of Object.entries(cost)) {
          pantry[k] = (pantry[k] ?? 0) - v;
        }
        const bonuses = { ...s.activeBonuses };
        if (bonus) bonuses[bonus] = true;
        return { pantry, reputation: s.reputation + rep, activeBonuses: bonuses };
      }),

      getRepTier: () => {
        const pts = get().reputation;
        let level = 0;
        for (let i = REP_THRESHOLDS.length - 1; i >= 0; i--) {
          if (pts >= REP_THRESHOLDS[i]) { level = i; break; }
        }
        return level;
      },

      addReputation: (amount) => set(s => ({ reputation: s.reputation + amount })),

      addIngredient: (id, count) => set(s => ({
        ingredientInventory: { ...s.ingredientInventory, [id]: (s.ingredientInventory[id] ?? 0) + count },
      })),

      removeIngredients: (items) => set(s => {
        const inv = { ...s.ingredientInventory };
        for (const [k, v] of Object.entries(items)) {
          inv[k] = Math.max(0, (inv[k] ?? 0) - v);
        }
        return { ingredientInventory: inv };
      }),

      unlockRecipe: (id) => set(s => ({
        recipesUnlocked: s.recipesUnlocked.includes(id) ? s.recipesUnlocked : [...s.recipesUnlocked, id],
      })),

      upgradeKitchenStation: (station) => set(s => ({
        kitchenStations: { ...s.kitchenStations, [station]: (s.kitchenStations[station] ?? 0) + 1 },
      })),

      completePlanetContract: (planet) => set(s => ({
        planetClearance: { ...s.planetClearance, [planet]: (s.planetClearance[planet] ?? 0) + 1 },
      })),

      getPlanetUnlocked: (planet) => {
        const { planetClearance } = get();
        if (planet === 'kepler') return true;
        if (planet === 'tidal') return (planetClearance.kepler ?? 0) >= 5;
        if (planet === 'void_reach') return (planetClearance.tidal ?? 0) >= 3;
        if (planet === 'furnace') return (planetClearance.void_reach ?? 0) >= 3;
        return false;
      },

      getAvailableWeapons: () => get().unlockedWeapons,

      markIntroSeen: () => set({ introSeen: true }),

      devGiveResources: () => set(s => {
        const ALL_WEAPONS = ['sidearm', 'scatter', 'lance', 'baton', 'dart', 'flamethrower', 'grenade_launcher', 'entropy_cannon', 'pulse_cannon', 'sniper_carbine', 'chain_rifle'];
        const ALL_KITS = ['stim_pack', 'flash_trap', 'smoke_kit', 'blink_kit', 'charge_kit', 'chain_kit', 'turret_kit', 'familiar_kit', 'mirage_kit', 'anchor_kit', 'drone_kit', 'pack_kit', 'void_surge', 'rupture_kit'];
        const kitTiers = { ...s.kitTiers };
        for (const k of ALL_KITS) {
          if (!kitTiers[k]) kitTiers[k] = 1;
        }
        return {
          totalCredits: s.totalCredits + 5000,
          pantry: { rift_dust: 99, void_crystal: 99, cave_moss: 99, river_silt: 99, elite_core: 99 },
          reputation: 1200,
          planetClearance: { kepler: 10, tidal: 10, void_reach: 10, furnace: 10 },
          ingredientInventory: { ...s.ingredientInventory },
          unlockedWeapons: ALL_WEAPONS,
          unlockedKits: ALL_KITS,
          kitTiers,
        };
      }),

      endowProgress: () => set(s => {
        if (s.endowedProgress) return {};
        const pantry = { ...s.pantry };
        for (const i of ['rift_dust', 'void_crystal', 'cave_moss', 'river_silt']) {
          pantry[i] = (pantry[i] ?? 0) + 1;
        }
        return { reputation: s.reputation + 5, pantry, endowedProgress: true };
      }),
    }),
    {
      name: 'space_hunter_save',
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        if (version < 2) {
          const oldRep = state.reputation;
          if (oldRep && typeof oldRep === 'object') {
            state.reputation = Object.values(oldRep as Record<string, number>)
              .reduce((a: number, b: number) => a + b, 0);
          }
        }
        return state;
      },
    }
  )
);
