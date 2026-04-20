export type IngredientRarity = 'common' | 'rare' | 'boss';

export interface Ingredient {
  id: string;
  name: string;
  planet: string;
  rarity: IngredientRarity;
  color: number;
}

export const INGREDIENTS: Record<string, Ingredient> = {
  // Kepler Outpost
  scrap_metal:              { id: 'scrap_metal',              name: 'Scrap Metal',              planet: 'kepler',     rarity: 'common', color: 0x888888 },
  mineral_dust:             { id: 'mineral_dust',             name: 'Mineral Dust',             planet: 'kepler',     rarity: 'common', color: 0xc8a060 },
  circuit_chips:            { id: 'circuit_chips',            name: 'Circuit Chips',            planet: 'kepler',     rarity: 'common', color: 0x44cc66 },
  reactor_core:             { id: 'reactor_core',             name: 'Reactor Core',             planet: 'kepler',     rarity: 'rare',   color: 0xff8800 },
  nano_fiber:               { id: 'nano_fiber',               name: 'Nano Fiber',               planet: 'kepler',     rarity: 'rare',   color: 0x44aaff },
  wardens_heart:            { id: 'wardens_heart',            name: "Warden's Heart",           planet: 'kepler',     rarity: 'boss',   color: 0xff4444 },

  // Tidal Flats
  bio_gel:                  { id: 'bio_gel',                  name: 'Bio Gel',                  planet: 'tidal',      rarity: 'common', color: 0x44ff88 },
  coral_fragment:           { id: 'coral_fragment',           name: 'Coral Fragment',           planet: 'tidal',      rarity: 'common', color: 0xff6688 },
  salt_crystal:             { id: 'salt_crystal',             name: 'Salt Crystal',             planet: 'tidal',      rarity: 'common', color: 0xddeeff },
  bioluminescent_extract:   { id: 'bioluminescent_extract',   name: 'Bioluminescent Extract',   planet: 'tidal',      rarity: 'rare',   color: 0x44d4ff },
  deep_pearl:               { id: 'deep_pearl',               name: 'Deep Pearl',               planet: 'tidal',      rarity: 'rare',   color: 0xeeeeff },
  leviathan_scale:          { id: 'leviathan_scale',          name: 'Leviathan Scale',          planet: 'tidal',      rarity: 'boss',   color: 0x2255aa },

  // Void Reach
  void_sap:                 { id: 'void_sap',                 name: 'Void Sap',                 planet: 'void_reach', rarity: 'common', color: 0x8833cc },
  crystal_shards:           { id: 'crystal_shards',           name: 'Crystal Shards',           planet: 'void_reach', rarity: 'common', color: 0xaa66ff },
  corruption_spores:        { id: 'corruption_spores',        name: 'Corruption Spores',        planet: 'void_reach', rarity: 'common', color: 0x662288 },
  living_tissue:            { id: 'living_tissue',            name: 'Living Tissue',            planet: 'void_reach', rarity: 'rare',   color: 0xff44aa },
  rift_amber:               { id: 'rift_amber',               name: 'Rift Amber',               planet: 'void_reach', rarity: 'rare',   color: 0xffaa22 },
  hollow_core:              { id: 'hollow_core',              name: 'Hollow Core',              planet: 'void_reach', rarity: 'boss',   color: 0x7722cc },

  // Furnace
  slag_chunk:               { id: 'slag_chunk',               name: 'Slag Chunk',               planet: 'furnace',    rarity: 'common', color: 0x554433 },
  magma_glass:              { id: 'magma_glass',              name: 'Magma Glass',              planet: 'furnace',    rarity: 'common', color: 0xff6600 },
  heat_coil:                { id: 'heat_coil',                name: 'Heat Coil',                planet: 'furnace',    rarity: 'common', color: 0xff8800 },
  molten_core:              { id: 'molten_core',              name: 'Molten Core',              planet: 'furnace',    rarity: 'rare',   color: 0xff3300 },
  obsidian_shard:           { id: 'obsidian_shard',           name: 'Obsidian Shard',           planet: 'furnace',    rarity: 'rare',   color: 0x333333 },
  forge_heart:              { id: 'forge_heart',              name: 'Forge Heart',              planet: 'furnace',    rarity: 'boss',   color: 0xff0000 },
};

export const INGREDIENTS_BY_PLANET: Record<string, { common: string[]; rare: string[]; boss: string[] }> = {
  kepler: {
    common: ['scrap_metal', 'mineral_dust', 'circuit_chips'],
    rare:   ['reactor_core', 'nano_fiber'],
    boss:   ['wardens_heart'],
  },
  tidal: {
    common: ['bio_gel', 'coral_fragment', 'salt_crystal'],
    rare:   ['bioluminescent_extract', 'deep_pearl'],
    boss:   ['leviathan_scale'],
  },
  void_reach: {
    common: ['void_sap', 'crystal_shards', 'corruption_spores'],
    rare:   ['living_tissue', 'rift_amber'],
    boss:   ['hollow_core'],
  },
  furnace: {
    common: ['slag_chunk', 'magma_glass', 'heat_coil'],
    rare:   ['molten_core', 'obsidian_shard'],
    boss:   ['forge_heart'],
  },
};
