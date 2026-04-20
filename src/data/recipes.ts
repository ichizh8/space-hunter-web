export interface Recipe {
  id: string;
  displayName: string;
  tier: number;
  track: string;
  cost: Record<string, number>;
  rep: number;
  bonus: string;
}

export const RECIPES: Record<string, Recipe> = {
  field_ration:      { id: 'field_ration',      displayName: 'Field Ration',       tier: 1, track: 'contractor',  cost: { rift_dust: 1 },                 rep: 10, bonus: '' },
  void_brew:         { id: 'void_brew',         displayName: 'Void Brew',          tier: 1, track: 'void_walker', cost: { void_crystal: 1 },               rep: 10, bonus: '' },
  cave_jerky:        { id: 'cave_jerky',        displayName: 'Cave Jerky',         tier: 1, track: 'tactician',   cost: { cave_moss: 1 },                  rep: 10, bonus: '' },
  silt_stew:         { id: 'silt_stew',         displayName: 'Silt Stew',          tier: 1, track: 'scrapper',    cost: { river_silt: 1 },                 rep: 10, bonus: '' },
  silt_cured_meat:   { id: 'silt_cured_meat',   displayName: 'Silt-Cured Meat',    tier: 2, track: 'contractor',  cost: { river_silt: 2 },                 rep: 25, bonus: 'credits_boost' },
  void_infusion:     { id: 'void_infusion',     displayName: 'Void Infusion',      tier: 2, track: 'void_walker', cost: { void_crystal: 2 },               rep: 25, bonus: 'start_corrupted' },
  cave_broth:        { id: 'cave_broth',        displayName: 'Cave Broth',         tier: 2, track: 'tactician',   cost: { cave_moss: 2 },                  rep: 25, bonus: 'trap_charge' },
  gland_tonic:       { id: 'gland_tonic',       displayName: 'Gland Tonic',        tier: 2, track: 'scrapper',    cost: { rift_dust: 2 },                  rep: 25, bonus: 'stim_boost' },
  purified_extract:  { id: 'purified_extract',  displayName: 'Purified Extract',   tier: 3, track: 'contractor',  cost: { elite_core: 1, river_silt: 1 },  rep: 60, bonus: 'reveal_elites' },
  void_communion:    { id: 'void_communion',     displayName: 'Void Communion',     tier: 3, track: 'void_walker', cost: { elite_core: 1, void_crystal: 1 }, rep: 60, bonus: 'early_mutation' },
  tactical_compound: { id: 'tactical_compound', displayName: 'Tactical Compound',  tier: 3, track: 'tactician',   cost: { elite_core: 1, cave_moss: 1 },   rep: 60, bonus: 'kit_charge_all' },
  ironblood_draught: { id: 'ironblood_draught', displayName: 'Ironblood Draught',  tier: 3, track: 'scrapper',    cost: { elite_core: 1, rift_dust: 1 },   rep: 60, bonus: 'temp_hp' },
};

export const BONUS_DESCS: Record<string, string> = {
  credits_boost: '+20% credits next hunt',
  start_corrupted: 'Start at corruption 10',
  trap_charge: '+1 trap charge next hunt',
  stim_boost: 'Stim cooldown -20% next hunt',
  reveal_elites: 'Reveal elite spawns on map',
  early_mutation: 'Void mutation from Lv4',
  kit_charge_all: 'All kits +1 charge',
  temp_hp: 'Start with 30 temp HP',
};

export const TRACK_ORDER = ['contractor', 'void_walker', 'tactician', 'scrapper'] as const;

export const TRACK_COLORS: Record<string, number> = {
  contractor: 0x44cc44,
  void_walker: 0xaa44ff,
  tactician: 0x4d80e6,
  scrapper: 0xff8844,
};

export const PANTRY_COLORS: Record<string, number> = {
  rift_dust: 0xe6cc4d,
  void_crystal: 0xaa44ff,
  cave_moss: 0x4db366,
  river_silt: 0x4d99e6,
  elite_core: 0xffd900,
};

export const REP_THRESHOLDS = [0, 50, 150, 350, 700, 1200];

// ---------------------------------------------------------------------------
// Kitchen recipe system (planet ingredient cooking)
// ---------------------------------------------------------------------------

export type KitchenRecipeTier = 'common' | 'standard' | 'exotic' | 'legendary';

export interface KitchenRecipe {
  id: string;
  name: string;
  tier: KitchenRecipeTier;
  /** ingredient id -> quantity required */
  ingredients: Record<string, number>;
  creditReward: number;
  repReward: number;
}

export const KITCHEN_RECIPES: Record<string, KitchenRecipe> = {
  // --- Kepler (common) ---
  field_scrap:        { id: 'field_scrap',        name: 'Field Scrap Plate',      tier: 'common',    ingredients: { scrap_metal: 1 },                                    creditReward: 120, repReward: 15 },
  mineral_cake:       { id: 'mineral_cake',        name: 'Mineral Cake',           tier: 'common',    ingredients: { mineral_dust: 1 },                                   creditReward: 100, repReward: 12 },
  circuit_snack:      { id: 'circuit_snack',       name: 'Circuit Snack',          tier: 'common',    ingredients: { circuit_chips: 1 },                                  creditReward: 110, repReward: 13 },
  // --- Kepler (standard) ---
  reinforced_alloy:   { id: 'reinforced_alloy',    name: 'Reinforced Alloy Stew',  tier: 'standard',  ingredients: { scrap_metal: 2, circuit_chips: 1 },                  creditReward: 280, repReward: 40 },
  reactor_fuel:       { id: 'reactor_fuel',        name: 'Reactor Fuel Tonic',     tier: 'standard',  ingredients: { reactor_core: 1, mineral_dust: 1 },                  creditReward: 320, repReward: 50 },
  // --- Kepler (exotic) ---
  nanoweave_plate:    { id: 'nanoweave_plate',     name: 'Nanoweave Plate',        tier: 'exotic',    ingredients: { nano_fiber: 1, bio_gel: 1 },                         creditReward: 500, repReward: 80 },
  // --- Kepler (legendary) ---
  wardens_extract:    { id: 'wardens_extract',     name: "Warden's Extract",       tier: 'legendary', ingredients: { wardens_heart: 1, reactor_core: 1, nano_fiber: 1 },  creditReward: 1200, repReward: 180 },

  // --- Tidal (common) ---
  brine_broth:        { id: 'brine_broth',         name: 'Brine Broth',            tier: 'common',    ingredients: { salt_crystal: 1 },                                   creditReward: 110, repReward: 13 },
  bio_paste:          { id: 'bio_paste',           name: 'Bio Paste',              tier: 'common',    ingredients: { bio_gel: 1 },                                        creditReward: 120, repReward: 15 },
  coral_dust:         { id: 'coral_dust',          name: 'Coral Dust Wafer',       tier: 'common',    ingredients: { coral_fragment: 1 },                                 creditReward: 100, repReward: 12 },
  // --- Tidal (standard) ---
  deep_sea_tonic:     { id: 'deep_sea_tonic',      name: 'Deep Sea Tonic',         tier: 'standard',  ingredients: { bio_gel: 1, salt_crystal: 1 },                       creditReward: 260, repReward: 40 },
  luminescent_brew:   { id: 'luminescent_brew',    name: 'Luminescent Brew',       tier: 'standard',  ingredients: { bioluminescent_extract: 1, coral_fragment: 1 },      creditReward: 350, repReward: 55 },
  // --- Tidal (exotic) ---
  pearl_infusion:     { id: 'pearl_infusion',      name: 'Pearl Infusion',         tier: 'exotic',    ingredients: { deep_pearl: 1, crystal_shards: 1 },                  creditReward: 550, repReward: 85 },
  // --- Tidal (legendary) ---
  leviathan_dish:     { id: 'leviathan_dish',      name: 'Leviathan Dish',         tier: 'legendary', ingredients: { leviathan_scale: 1, deep_pearl: 1, bioluminescent_extract: 1 }, creditReward: 1400, repReward: 200 },

  // --- Void Reach (common) ---
  void_tincture:      { id: 'void_tincture',       name: 'Void Tincture',          tier: 'common',    ingredients: { void_sap: 1 },                                       creditReward: 130, repReward: 16 },
  crystal_dust:       { id: 'crystal_dust',        name: 'Crystal Dust Tablet',    tier: 'common',    ingredients: { crystal_shards: 1 },                                 creditReward: 115, repReward: 14 },
  spore_concentrate:  { id: 'spore_concentrate',   name: 'Spore Concentrate',      tier: 'common',    ingredients: { corruption_spores: 1 },                              creditReward: 120, repReward: 15 },
  // --- Void Reach (standard) ---
  rift_extract:       { id: 'rift_extract',        name: 'Rift Extract',           tier: 'standard',  ingredients: { void_sap: 1, rift_amber: 1 },                        creditReward: 380, repReward: 60 },
  living_void_broth:  { id: 'living_void_broth',   name: 'Living Void Broth',      tier: 'standard',  ingredients: { living_tissue: 1, corruption_spores: 1 },            creditReward: 340, repReward: 55 },
  // --- Void Reach (exotic) ---
  amber_crystal:      { id: 'amber_crystal',       name: 'Amber Crystal Fusion',   tier: 'exotic',    ingredients: { rift_amber: 1, magma_glass: 1 },                     creditReward: 600, repReward: 90 },
  // --- Void Reach (legendary) ---
  hollow_essence:     { id: 'hollow_essence',      name: 'Hollow Essence',         tier: 'legendary', ingredients: { hollow_core: 1, living_tissue: 1, rift_amber: 1 },   creditReward: 1600, repReward: 220 },

  // --- Furnace (common) ---
  slag_gruel:         { id: 'slag_gruel',          name: 'Slag Gruel',             tier: 'common',    ingredients: { slag_chunk: 1 },                                     creditReward: 115, repReward: 14 },
  magma_glass_shard:  { id: 'magma_glass_shard',   name: 'Magma Glass Shard',      tier: 'common',    ingredients: { magma_glass: 1 },                                    creditReward: 130, repReward: 16 },
  heat_coil_tonic:    { id: 'heat_coil_tonic',     name: 'Heat Coil Tonic',        tier: 'common',    ingredients: { heat_coil: 1 },                                      creditReward: 120, repReward: 15 },
  // --- Furnace (standard) ---
  molten_alloy:       { id: 'molten_alloy',        name: 'Molten Alloy Plate',     tier: 'standard',  ingredients: { slag_chunk: 1, heat_coil: 1 },                       creditReward: 300, repReward: 48 },
  obsidian_extract:   { id: 'obsidian_extract',    name: 'Obsidian Extract',       tier: 'standard',  ingredients: { obsidian_shard: 1, molten_core: 1 },                 creditReward: 420, repReward: 65 },
  // --- Furnace (legendary) ---
  forge_heart_dish:   { id: 'forge_heart_dish',    name: 'Forge Heart Dish',       tier: 'legendary', ingredients: { forge_heart: 1, molten_core: 1, obsidian_shard: 1 }, creditReward: 2000, repReward: 250 },

  // --- Cross-planet exotic ---
  void_furnace_fusion: { id: 'void_furnace_fusion', name: 'Void-Furnace Fusion',   tier: 'exotic',    ingredients: { rift_amber: 1, molten_core: 1 },                     creditReward: 700, repReward: 100 },
};

export function canCook(recipe: KitchenRecipe, inventory: Record<string, number>): boolean {
  return Object.entries(recipe.ingredients).every(
    ([id, qty]) => (inventory[id] ?? 0) >= qty
  );
}

export function getAvailableRecipes(
  inventory: Record<string, number>,
  unlocked: string[]
): KitchenRecipe[] {
  return Object.values(KITCHEN_RECIPES).filter(
    r => unlocked.includes(r.id) && canCook(r, inventory)
  );
}
