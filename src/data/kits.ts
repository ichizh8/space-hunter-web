export interface KitDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  cooldown: number;
  charges: number; // -1 = unlimited (cooldown-based)
  unlockCost: number;
  tierCosts: [number, number, number]; // T1 unlock, T2, T3
}

export const KIT_DEFS: Record<string, KitDef> = {
  stim_pack:    { id: 'stim_pack',    name: 'Stim Pack',  icon: 'S', desc: '+4 HP, +15 corruption',       cooldown: 8,  charges: -1, unlockCost: 0,   tierCosts: [0, 60, 120] },
  flash_trap:   { id: 'flash_trap',   name: 'Flash Trap', icon: 'T', desc: 'Stun trap 80px 2s',           cooldown: 0,  charges: 2,  unlockCost: 0,   tierCosts: [0, 80, 160] },
  blink_kit:    { id: 'blink_kit',    name: 'Phase Shift', icon: 'B', desc: 'Invulnerable 1.5s, slow enemies 70%', cooldown: 12, charges: -1, unlockCost: 120, tierCosts: [120, 100, 200] },
  chain_kit:    { id: 'chain_kit',    name: 'Chain',       icon: 'C', desc: 'Tether enemy 3s',             cooldown: 12, charges: -1, unlockCost: 150, tierCosts: [150, 120, 220] },
  charge_kit:   { id: 'charge_kit',   name: 'Charge',      icon: 'X', desc: 'Knockback blast 150px',       cooldown: 12, charges: -1, unlockCost: 120, tierCosts: [120, 100, 200] },
  mirage_kit:   { id: 'mirage_kit',   name: 'Mirage',      icon: 'M', desc: 'Decoy draws aggro 6s',        cooldown: 18, charges: -1, unlockCost: 180, tierCosts: [180, 140, 260] },
  turret_kit:   { id: 'turret_kit',   name: 'Turret',      icon: 'R', desc: 'Auto-turret 12s',             cooldown: 20, charges: -1, unlockCost: 150, tierCosts: [150, 120, 220] },
  smoke_kit:    { id: 'smoke_kit',    name: 'Smoke',       icon: 'K', desc: 'Smoke screen 150px 6s',       cooldown: 14, charges: -1, unlockCost: 100, tierCosts: [100, 80, 180] },
  anchor_kit:   { id: 'anchor_kit',   name: 'Anchor',      icon: 'A', desc: 'Gravity pull 400px 4s',       cooldown: 20, charges: -1, unlockCost: 180, tierCosts: [180, 150, 280] },
  drone_kit:    { id: 'drone_kit',    name: 'Drone',       icon: 'D', desc: 'Intercepts 1 bullet/4s',      cooldown: 0,  charges: -1, unlockCost: 200, tierCosts: [200, 150, 300] },
  familiar_kit: { id: 'familiar_kit', name: 'Familiar',    icon: 'F', desc: 'Void familiar, rams enemies', cooldown: 0,  charges: -1, unlockCost: 160, tierCosts: [160, 130, 250] },
  pack_kit:     { id: 'pack_kit',     name: 'Pack',        icon: 'P', desc: 'Summon 2 allies 15s',         cooldown: 25, charges: -1, unlockCost: 180, tierCosts: [180, 150, 280] },
  void_surge:   { id: 'void_surge',   name: 'Void Surge',  icon: 'V', desc: 'Spend 20 corr: +80% speed 3s', cooldown: 0, charges: -1, unlockCost: 220, tierCosts: [220, 180, 320] },
  rupture_kit:  { id: 'rupture_kit',  name: 'Rupture',     icon: 'U', desc: 'Detonate corruption bar AOE', cooldown: 0,  charges: -1, unlockCost: 250, tierCosts: [250, 200, 380] },
};

export const ALL_KIT_IDS = Object.keys(KIT_DEFS);

// Kit tree prerequisites (same as Godot v47)
export const KIT_PREREQUISITES: Record<string, Array<{ kit: string; tier: number }>> = {
  stim_pack: [],
  flash_trap: [],
  smoke_kit: [{ kit: 'stim_pack', tier: 2 }],
  blink_kit: [{ kit: 'flash_trap', tier: 2 }],
  charge_kit: [{ kit: 'stim_pack', tier: 2 }],
  chain_kit: [{ kit: 'blink_kit', tier: 2 }],
  turret_kit: [{ kit: 'charge_kit', tier: 2 }],
  familiar_kit: [{ kit: 'smoke_kit', tier: 2 }],
  mirage_kit: [{ kit: 'blink_kit', tier: 2 }],
  anchor_kit: [{ kit: 'chain_kit', tier: 2 }],
  drone_kit: [{ kit: 'turret_kit', tier: 2 }],
  pack_kit: [{ kit: 'familiar_kit', tier: 2 }],
  void_surge: [{ kit: 'anchor_kit', tier: 2 }, { kit: 'chain_kit', tier: 3 }],
  rupture_kit: [{ kit: 'pack_kit', tier: 2 }, { kit: 'familiar_kit', tier: 3 }],
};

export const KIT_TREE_SECTIONS: Record<string, string[]> = {
  Starter: ['stim_pack', 'flash_trap'],
  Basic: ['smoke_kit', 'blink_kit', 'charge_kit'],
  Advanced: ['chain_kit', 'turret_kit', 'familiar_kit', 'mirage_kit'],
  Elite: ['anchor_kit', 'drone_kit', 'pack_kit'],
  Apex: ['void_surge', 'rupture_kit'],
};

export const KIT_SLOT_COSTS = [200, 400];

export function checkKitPrereqs(kitId: string, kitTiers: Record<string, number>, unlockedKits: string[]): boolean {
  const prereqs = KIT_PREREQUISITES[kitId] || [];
  for (const p of prereqs) {
    if (!unlockedKits.includes(p.kit)) return false;
    if ((kitTiers[p.kit] || 0) < p.tier) return false;
  }
  return true;
}

export function getPrereqText(kitId: string): string {
  const prereqs = KIT_PREREQUISITES[kitId] || [];
  if (prereqs.length === 0) return '';
  return 'Requires: ' + prereqs.map(p => `${KIT_DEFS[p.kit]?.name || p.kit} T${p.tier}`).join(', ');
}

// ── Kit Perks (2 per kit, offered during runs) ──

export interface KitPerkDef {
  id: string;
  icon: string;
  name: string;
  rarity: 'common' | 'rare';
  desc: string;
}

export const KIT_PERKS: Record<string, KitPerkDef[]> = {
  stim_pack: [
    { id: 'withdrawal',       icon: 'W', name: 'Withdrawal',       rarity: 'common', desc: 'After stim wears off: next hit absorbed (0 dmg).' },
    { id: 'overdose',         icon: 'A', name: 'Overdose',         rarity: 'rare',   desc: 'Stim above 50% corruption: +2 extra HP, +10 extra corruption.' },
  ],
  flash_trap: [
    { id: 'trap_magnetism',   icon: 'M', name: 'Trap Magnetism',   rarity: 'rare',   desc: 'Stunned enemy pulls 2 nearby enemies toward it.' },
    { id: 'fragile_state',    icon: 'F', name: 'Fragile State',    rarity: 'common', desc: 'Enemies emerging from stun take 2x dmg for 1s.' },
  ],
  smoke_kit: [
    { id: 'afterburn',        icon: 'A', name: 'Afterburn',        rarity: 'common', desc: 'Enemies exiting smoke are slowed 40% for 2s.' },
    { id: 'lure',             icon: 'L', name: 'Lure',             rarity: 'rare',   desc: 'Multiple enemies inside smoke ignore player and attack each other.' },
  ],
  familiar_kit: [
    { id: 'spotter',          icon: 'S', name: 'Spotter',          rarity: 'common', desc: 'Familiar marks highest-HP enemy — your bullets +30% to marked target.' },
    { id: 'leash_break',      icon: 'X', name: 'Leash Break',      rarity: 'rare',   desc: 'If familiar is hit, it explodes once (5 dmg, 80px AOE).' },
  ],
  blink_kit: [
    { id: 'phase_mark',      icon: 'M', name: 'Phase Mark',       rarity: 'common', desc: 'Enemies in range during shift take +30% damage for 3s after.' },
    { id: 'phase_pulse',     icon: 'P', name: 'Phase Pulse',      rarity: 'rare',   desc: 'Exiting phase shift releases a 200px shockwave (4 dmg).' },
  ],
  chain_kit: [
    { id: 'conductor',        icon: 'C', name: 'Conductor',        rarity: 'rare',   desc: 'While enemy is tethered, your bullets ricochet off them once.' },
    { id: 'drag',             icon: 'D', name: 'Drag',             rarity: 'common', desc: 'Tethered enemy is slowly pulled toward you 20px/s.' },
  ],
  charge_kit: [
    { id: 'aftershock',       icon: 'A', name: 'Aftershock',       rarity: 'common', desc: 'Charge impact leaves a 3s slow field at landing point.' },
    { id: 'battering_ram',    icon: 'R', name: 'Battering Ram',    rarity: 'rare',   desc: 'Enemies hit by charge knock into others (3 dmg to both).' },
  ],
  mirage_kit: [
    { id: 'fragile_clone',    icon: 'M', name: 'Fragile Clone',    rarity: 'common', desc: 'Decoy explodes when destroyed (80px, 3 dmg).' },
    { id: 'copycat',          icon: 'X', name: 'Copycat',          rarity: 'rare',   desc: 'Decoy fires your last weapon shot every 3s.' },
  ],
  turret_kit: [
    { id: 'overclocked',      icon: 'T', name: 'Overclocked',      rarity: 'common', desc: 'Turret fire rate doubles when player is within 60px.' },
    { id: 'overheat_turret',  icon: 'O', name: 'Overheat',         rarity: 'rare',   desc: 'Turret explodes on death (70px AOE, 4 dmg) instead of disappearing.' },
  ],
  drone_kit: [
    { id: 'intercept_link',   icon: 'I', name: 'Intercept Link',   rarity: 'rare',   desc: 'Drone-intercepted bullets explode (20px AOE) damaging the shooter.' },
    { id: 'overclock_drone',  icon: 'H', name: 'Overclock Protocol', rarity: 'common', desc: 'After intercepting, next intercept cooldown halved.' },
  ],
  pack_kit: [
    { id: 'rally_cry',        icon: 'S', name: 'Rally Cry',        rarity: 'rare',   desc: 'On summon: all enemies within 200px are feared 1.5s.' },
    { id: 'frenzy_aura',      icon: 'F', name: 'Frenzy Aura',      rarity: 'common', desc: 'Each nearby ally increases your fire rate 8% (max 3).' },
  ],
  void_surge: [
    { id: 'void_trail',       icon: 'V', name: 'Void Trail',       rarity: 'common', desc: 'Surge leaves a corruption zone along your path (3s, +3 corr/s to enemies).' },
    { id: 'phase_burst',      icon: 'P', name: 'Phase Burst',      rarity: 'rare',   desc: 'At surge end: shockwave pushes all enemies 80px.' },
  ],
  anchor_kit: [
    { id: 'crush_zone',       icon: 'C', name: 'Crush Zone',       rarity: 'common', desc: 'Enemies inside anchor pull zone take 2x dmg from all sources.' },
    { id: 'chain_reaction',   icon: 'X', name: 'Chain Reaction',   rarity: 'rare',   desc: 'Enemies killed inside anchor explosion each spawn a mini void pool.' },
  ],
  rupture_kit: [
    { id: 'scatter_field',    icon: 'S', name: 'Scatter',          rarity: 'common', desc: 'Rupture launches shrapnel in 8 directions (3 dmg each).' },
    { id: 'aftershock_rupture', icon: 'D', name: 'Aftershock',     rarity: 'rare',   desc: 'Rupture field persists 3s longer, pulls enemies inward.' },
  ],
};

// ── Resonance Pool (cross-kit combos, available when both equipped kits are T3) ──

export interface ResonanceDef {
  id: string;
  kits: [string, string];
  icon: string;
  name: string;
  desc: string;
}

export const RESONANCE_POOL: ResonanceDef[] = [
  { id: 'linked_fuse',      kits: ['flash_trap', 'blink_kit'],    icon: 'L', name: 'Time Lock',      desc: 'Flash trap stuns last 2x longer during phase shift.' },
  { id: 'sympathetic_fire',  kits: ['drone_kit', 'blink_kit'],    icon: 'S', name: 'Sympathetic Fire', desc: 'Drone fires 3x faster during phase shift.' },
  { id: 'overcharge_drone',  kits: ['drone_kit', 'anchor_kit'],   icon: 'O', name: 'Overcharge',      desc: 'Drone fires 2x faster after anchor well expires.' },
  { id: 'trap_aggro',        kits: ['flash_trap', 'mirage_kit'],  icon: 'T', name: 'Trap Aggro',      desc: 'Decoy automatically moves toward nearest trap.' },
  { id: 'void_feedback',     kits: ['void_surge', 'rupture_kit'], icon: 'V', name: 'Void Feedback',   desc: 'Rupture recharges void surge instantly.' },
  { id: 'familiar_bond',     kits: ['familiar_kit', 'pack_kit'],  icon: 'F', name: 'Familiar Bond',   desc: 'Familiar buffs your summoned allies (+30% speed).' },
  { id: 'smoke_blink',       kits: ['smoke_kit', 'blink_kit'],    icon: 'B', name: 'Phantom Smoke',   desc: 'Phase shift drops a smoke cloud at your feet.' },
  { id: 'turret_familiar',   kits: ['turret_kit', 'familiar_kit'], icon: 'U', name: 'Familiar Link',  desc: 'Turret gains familiar healing aura (1 HP regen/5s to player while turret active).' },
  { id: 'chain_anchor',      kits: ['chain_kit', 'anchor_kit'],   icon: 'C', name: 'Gravity Chain',   desc: 'Tethered enemies are also pulled by anchor wells.' },
  { id: 'surge_charge',      kits: ['void_surge', 'charge_kit'],  icon: 'X', name: 'Surge Charge',    desc: 'Void surge resets charge kit cooldown instantly.' },
];
