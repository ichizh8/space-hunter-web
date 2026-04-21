export type FiringPattern = 'single' | 'scatter' | 'piercing' | 'melee_aoe' | 'homing' | 'cone_stream' | 'arc_aoe' | 'bounce' | 'beam_stream' | 'laser';

export interface WeaponDef {
  id: string;
  name: string;
  desc: string;
  fireRate: number;
  damage: number;
  bulletSpeed: number;
  bulletRadius: number;
  color: number;
  range: number;
  pattern: FiringPattern;
  magSize: number;
  reloadTime: number;
}

export const WEAPON_DEFS: Record<string, WeaponDef> = {
  sidearm:          { id: 'sidearm',          name: 'Laser Pistol', desc: 'Directional laser beam', fireRate: 1.25, damage: 2.8, bulletSpeed: 420, bulletRadius: 4, color: 0x00ffcc, range: 286, pattern: 'laser',       magSize: 12, reloadTime: 1.5 },
  scatter:          { id: 'scatter',          name: 'Scatter',  desc: 'Close-range burst',         fireRate: 0.8,  damage: 1, bulletSpeed: 360, bulletRadius: 3,  color: 0xff8844, range: 180, pattern: 'scatter',     magSize: 8,  reloadTime: 1.8 },
  lance:            { id: 'lance',            name: 'Lance',    desc: 'Piercing beam',             fireRate: 1.6,  damage: 5, bulletSpeed: 260, bulletRadius: 5,  color: 0x44ddff, range: 500, pattern: 'piercing',    magSize: 4,  reloadTime: 2.0 },
  baton:            { id: 'baton',            name: 'Plasma Sword', desc: 'Energy blade',          fireRate: 0.75, damage: 4, bulletSpeed: 0,   bulletRadius: 40, color: 0x00eeff, range: 115, pattern: 'melee_aoe',   magSize: 999, reloadTime: 0 },
  dart:             { id: 'dart',             name: 'Dart',     desc: 'Homing shots',              fireRate: 1.1,  damage: 3, bulletSpeed: 180, bulletRadius: 4,  color: 0x44ff66, range: 400, pattern: 'homing',      magSize: 6,  reloadTime: 1.5 },
  flamethrower:     { id: 'flamethrower',     name: 'Flamer',   desc: 'Cone fire — burn DoT core', fireRate: 0.07, damage: 0.5, bulletSpeed: 180, bulletRadius: 9, color: 0xff6622, range: 220, pattern: 'cone_stream', magSize: 60, reloadTime: 2.5 },
  grenade_launcher: { id: 'grenade_launcher', name: 'Grenade',  desc: 'Explosive arc',             fireRate: 2.5,  damage: 8, bulletSpeed: 220, bulletRadius: 8,  color: 0xffaa00, range: 300, pattern: 'arc_aoe',     magSize: 2,  reloadTime: 2.0 },
  entropy_cannon:   { id: 'entropy_cannon',   name: 'Void Beam', desc: 'Corruption-scaling beam',  fireRate: 0.08, damage: 0.4, bulletSpeed: 800, bulletRadius: 3, color: 0xaa44ff, range: 250, pattern: 'beam_stream', magSize: 80, reloadTime: 1.0 },
  pulse_cannon:     { id: 'pulse_cannon',     name: 'Pulse',    desc: 'Slow orb — AOE pulses in flight', fireRate: 1.0, damage: 3, bulletSpeed: 140, bulletRadius: 7, color: 0x44aaff, range: 550, pattern: 'bounce',      magSize: 8,  reloadTime: 1.5 },
  sniper_carbine:   { id: 'sniper_carbine',   name: 'Sniper',   desc: 'Near-perfect accuracy, blazing fast round', fireRate: 2.5,  damage: 8, bulletSpeed: 1800, bulletRadius: 3,  color: 0xffffff, range: 600, pattern: 'single',      magSize: 4,  reloadTime: 2.5 },
  chain_rifle:      { id: 'chain_rifle',      name: 'Chain',    desc: 'Rapid suppression',         fireRate: 0.13, damage: 1, bulletSpeed: 450, bulletRadius: 3,  color: 0x88ffaa, range: 280, pattern: 'single',      magSize: 40, reloadTime: 3.0 },
};

export const ALL_WEAPON_IDS = Object.keys(WEAPON_DEFS);

// ── Weapon Level Perks (levels 2-5) ──

export type WeaponPerkEffect =
  | 'fire_rate' | 'damage' | 'piercing' | 'fire_rate_mag'
  | 'pellets' | 'slow' | 'pellets_rate'
  | 'bullet_speed' | 'on_kill_lance' | 'explode'
  | 'radius' | 'damage_knockback' | 'leech' | 'chain'
  | 'tracking' | 'dual' | 'split_on_kill'
  | 'range_bonus' | 'burning' | 'fire_rate'
  | 'cluster' | 'grenade_knockback'
  | 'bounce_extra' | 'bounce_radius'
  | 'sniper_range'
  | 'chain_slow_boost' | 'chain_autocrit'
  | 'deflect' | 'beam_width'
  | 'laser_range' | 'laser_mark' | 'laser_pierce'
  | 'lance_trail' | 'backblast' | 'proximity_fuse' | 'siphon_link'
  | 'shatter_bounce' | 'killstreak' | 'spin_up'
  // Fork effects (level 5 for weapons without named perks at 5)
  | 'sidearm_fork' | 'flamer_fork' | 'grenade_fork' | 'entropy_fork'
  | 'pulse_fork' | 'sniper_fork' | 'chain_fork';

export interface WeaponPerk {
  icon: string;
  name: string;
  desc: string;
  effect: string;
  value: number | boolean;
}

export const WEAPON_LEVEL_PERKS: Record<string, Record<number, WeaponPerk>> = {
  sidearm: {
    2: { icon: '⚡', name: 'Focused Lens',    desc: 'Beam range +40%, +1 damage',        effect: 'laser_range',   value: 0.4 },
    3: { icon: '🎯', name: 'Tracer Rounds',   desc: 'Every 3rd hit marks enemy: +25% dmg from all sources 2s', effect: 'laser_mark', value: true },
    4: { icon: '💥', name: 'Overcharge',      desc: 'Beam pierces first enemy, hits 2nd', effect: 'laser_pierce', value: true },
    5: { icon: '🌀', name: 'Fork',            desc: 'Clean: Marksman Beam | Void: Entropy Beam', effect: 'sidearm_fork', value: true },
  },
  scatter: {
    2: { icon: '↔',  name: 'Wide Bore',      desc: 'Cone spread +30%, 1 extra pellet',  effect: 'pellets',       value: 1 },
    3: { icon: '💥', name: 'Buckshot',       desc: '+1 damage per pellet',              effect: 'damage',        value: 1 },
    4: { icon: '🔥', name: 'Slug Shot',       desc: 'Pellets slow enemies 20% for 1s',   effect: 'slow',          value: true },
    5: { icon: '🌪', name: 'Salvo',          desc: 'Fire rate +30%, 2 extra pellets',   effect: 'pellets_rate',  value: 0 },
  },
  lance: {
    2: { icon: '⚡', name: 'Resonant Shot',   desc: 'Lance leaves 0.5s damage trail (30% dmg)', effect: 'lance_trail', value: true },
    3: { icon: '💎', name: 'Void Core',      desc: '+3 damage',                         effect: 'damage',        value: 3 },
    4: { icon: '🌀', name: 'Overload',       desc: 'On kill: fires a 2nd lance auto',   effect: 'on_kill_lance', value: true },
    5: { icon: '💥', name: 'Singularity',    desc: 'Explosion on impact, 60px AOE',     effect: 'explode',       value: true },
  },
  baton: {
    2: { icon: '↔',  name: 'Extended Arc',   desc: 'Blade reach +30px',                 effect: 'radius',            value: 30 },
    3: { icon: '💥', name: 'Shockwave',      desc: 'Enhanced knockback (100px), stuns enemies 0.5s', effect: 'damage_knockback', value: 0 },
    4: { icon: '🔰', name: 'Deflect',        desc: 'Blade deflects enemy projectiles back at enemies (2x dmg)', effect: 'deflect', value: true },
    5: { icon: '⚡', name: 'Chain Lightning', desc: 'Damage arcs to 2 extra enemies',   effect: 'chain',             value: true },
  },
  dart: {
    2: { icon: '🎯', name: 'Lock-On',        desc: 'Tracking speed +50%',               effect: 'tracking',      value: 1.5 },
    3: { icon: '💥', name: 'Detonator',      desc: 'Explodes on hit, 40px AOE',         effect: 'explode',       value: true },
    4: { icon: '🐍', name: 'Swarm',          desc: 'Fires 2 darts simultaneously',      effect: 'dual',          value: true },
    5: { icon: '💀', name: 'Voidseeker',     desc: 'On kill: splits into 2 new darts',  effect: 'split_on_kill', value: true },
  },
  flamethrower: {
    2: { icon: 'F',  name: 'Backblast',      desc: 'Enemies that die while burning explode (2 dmg, 60px)', effect: 'backblast', value: true },
    3: { icon: 'N',  name: 'Napalm',         desc: 'Burn upgrade: 3 dmg/s (base 2), spreads on kill', effect: 'burning', value: true },
    4: { icon: 'P',  name: 'Pressurized',    desc: 'Fire rate +30%',                    effect: 'fire_rate',     value: -0.036 },
    5: { icon: 'T',  name: 'Fork',           desc: 'Clean: Cryo Flamer | Void: Corruption Spray', effect: 'flamer_fork', value: true },
  },
  grenade_launcher: {
    2: { icon: 'H',  name: 'Proximity Fuse',  desc: 'Grenades detonate early within 30px of enemy', effect: 'proximity_fuse', value: true },
    3: { icon: 'C',  name: 'Cluster Bomb',    desc: 'Explosion spawns 3 mini grenades', effect: 'cluster',           value: true },
    4: { icon: 'S',  name: 'Stagger',         desc: 'Explosion knocks enemies back 80px', effect: 'grenade_knockback', value: true },
    5: { icon: 'A',  name: 'Fork',            desc: 'Clean: Airburst | Void: Void Grenade', effect: 'grenade_fork', value: true },
  },
  entropy_cannon: {
    2: { icon: 'D',  name: 'Siphon Link',     desc: 'Beam on target: +2 corruption/s to player', effect: 'siphon_link', value: true },
    3: { icon: 'R',  name: 'Rapid Decay',     desc: 'Rate of fire +20%',                effect: 'fire_rate',     value: -0.016 },
    4: { icon: 'W',  name: 'Wide Lens',        desc: 'Beam width x2, easier to hit',     effect: 'beam_width',    value: true },
    5: { icon: 'F',  name: 'Fork',            desc: 'Clean: Stabilized | Void: Resonance', effect: 'entropy_fork', value: true },
  },
  pulse_cannon: {
    2: { icon: 'B',  name: 'Extra Bounce',    desc: '+1 bounce (5 total)',               effect: 'bounce_extra',  value: 1 },
    3: { icon: 'D',  name: 'Shatter Bounce',  desc: 'Each bounce releases 20px shockwave (1 dmg)', effect: 'shatter_bounce', value: true },
    4: { icon: 'R',  name: 'Wide Bounce',     desc: 'Bounce radius +60px',               effect: 'bounce_radius', value: 60 },
    5: { icon: 'F',  name: 'Fork',            desc: 'Clean: Overclock | Void: Void Chain', effect: 'pulse_fork', value: true },
  },
  sniper_carbine: {
    2: { icon: 'D',  name: 'Killstreak',      desc: 'Consecutive hits: +1 dmg each (max +5), miss resets', effect: 'killstreak', value: true },
    3: { icon: 'R',  name: 'Long Barrel',     desc: 'Range +100px, speed +100',          effect: 'sniper_range',  value: true },
    4: { icon: 'P',  name: 'AP Rounds',       desc: 'Penetrates 2 enemies',              effect: 'piercing',      value: true },
    5: { icon: 'F',  name: 'Fork',            desc: 'Clean: Killshot | Void: Void Slug', effect: 'sniper_fork',  value: true },
  },
  chain_rifle: {
    2: { icon: 'D',  name: 'Spin Up',          desc: 'Fire rate +10%/s while firing (max +40%)', effect: 'spin_up', value: true },
    3: { icon: 'S',  name: 'Suppression',      desc: 'Slow +20%, stacks higher',         effect: 'chain_slow_boost', value: true },
    4: { icon: 'C',  name: 'Auto-Crit',        desc: 'Every 10th bullet auto-crits (3x)', effect: 'chain_autocrit',  value: true },
    5: { icon: 'F',  name: 'Fork',             desc: 'Clean: Precision Mode | Void: Suppressor', effect: 'chain_fork', value: true },
  },
};

// ── Weapon Mutations (clean/void fork at level 5) ──

export interface MutationDef {
  icon: string;
  name: string;
  desc: string;
}

export const WEAPON_MUTATIONS: Record<string, Record<string, MutationDef>> = {
  sidearm: {
    clean: { icon: 'G', name: 'Marksman Beam', desc: 'Fire rate halved, damage x3, beam range +60%. Beam lingers 0.3s (visual trail).' },
    void:  { icon: 'V', name: 'Entropy Beam',  desc: 'Each hit plants a void seed. 3 seeds on same enemy = AOE detonation (80px, 5 dmg).' },
  },
  scatter: {
    clean: { icon: 'G', name: 'Flechette',      desc: 'Tighter cone, pellets pierce 2 enemies.' },
    void:  { icon: 'V', name: 'Chaos Spray',    desc: '270 degree cone, pellets home slightly. Chip dmg to self if enemies in 40px.' },
  },
  lance: {
    clean: { icon: 'G', name: 'Null Spear',     desc: 'Fire rate x2, leaves a 3s slow field where it lands.' },
    void:  { icon: 'V', name: 'Singularity',    desc: 'On hit: 2s gravity vortex. Your bullets deal +50% to pulled enemies.' },
  },
  baton: {
    clean: { icon: 'G', name: 'Arc Blade',      desc: 'Melee leaves 3s slow fields on the ground.' },
    void:  { icon: 'V', name: 'Consuming Vortex', desc: 'AOE expands 1.5s. Drains HP from enemies, heals you.' },
  },
  dart: {
    clean: { icon: 'G', name: 'Smart Missile',  desc: 'Single large slow missile. Massive damage, perfect tracking.' },
    void:  { icon: 'V', name: 'Parasite Swarm', desc: 'Darts latch on, drain HP 4s. Spreads to 1 nearby enemy on death.' },
  },
  flamethrower: {
    clean: { icon: 'C', name: 'Cryo Flamer',      desc: 'Freezes enemies. No damage, 2s stun per hit.' },
    void:  { icon: 'V', name: 'Corruption Spray',  desc: '+5 corruption/s to player while firing, triple damage.' },
  },
  grenade_launcher: {
    clean: { icon: 'A', name: 'Airburst',       desc: 'Explodes at max range regardless. Hits everything in 80px.' },
    void:  { icon: 'V', name: 'Void Grenade',    desc: 'Explosion leaves a corruption zone for 5s.' },
  },
  entropy_cannon: {
    clean: { icon: 'S', name: 'Stabilized',     desc: 'Damage ignores corruption state, stays at 3x multiplier.' },
    void:  { icon: 'R', name: 'Resonance',       desc: 'Corruption gain from kills +50%, triple scaling.' },
  },
  pulse_cannon: {
    clean: { icon: 'O', name: 'Overclock',      desc: 'Fire rate +50%, limited to 3 bounces.' },
    void:  { icon: 'V', name: 'Void Chain',      desc: 'Each bounce adds +2 corruption to enemy, no self damage.' },
  },
  sniper_carbine: {
    clean: { icon: 'K', name: 'Killshot',        desc: 'One-shots enemies under 20% HP.' },
    void:  { icon: 'V', name: 'Void Slug',       desc: 'Leaves corruption trail along bullet path.' },
  },
  chain_rifle: {
    clean: { icon: 'P', name: 'Precision Mode',  desc: 'Fire rate halved, each bullet does 4x damage, no slow.' },
    void:  { icon: 'S', name: 'Suppressor',       desc: 'Slowed enemies take +30% from all sources, +50% corruption on hit.' },
  },
};

// ── Weapon Mastery (post-mutation perks) ──

export interface MasteryPerk {
  id: string;
  icon: string;
  name: string;
  desc: string;
}

export const WEAPON_MASTERY: Record<string, Record<string, MasteryPerk[]>> = {
  sidearm: {
    clean: [
      { id: 'killcam',          icon: 'K', name: 'Killcam',       desc: 'After a kill: next shot fires instantly (no cooldown).' },
      { id: 'headhunter',       icon: 'H', name: 'Headhunter',    desc: '+50% damage vs elites.' },
      { id: 'suppressor',       icon: 'S', name: 'Suppressor',    desc: 'Beam does not aggro nearby undetected enemies.' },
      { id: 'armor_pierce',     icon: 'A', name: 'Armor Pierce',  desc: 'Beam ignores armored affix.' },
      { id: 'lingering_beam',   icon: 'R', name: 'Lingering Beam', desc: 'Beam trail lasts 0.5s (was 0.3s), damages enemies passing through.' },
    ],
    void: [
      { id: 'seed_spread',      icon: 'M', name: 'Seed Spread',    desc: 'Void seed detonations plant 1 seed on nearby enemies.' },
      { id: 'deep_roots',       icon: 'C', name: 'Deep Roots',     desc: 'Seeds detonate at 2 stacks instead of 3.' },
      { id: 'entropy_field',    icon: 'E', name: 'Entropy Field',   desc: 'Detonation leaves a 3s corruption zone.' },
      { id: 'void_resonance',   icon: 'V', name: 'Void Resonance', desc: 'Each seed adds +5 corruption to the enemy.' },
    ],
  },
  scatter: {
    clean: [
      { id: 'tight_spread',   icon: 'T', name: 'Tight Spread',   desc: 'Cone narrows further, +1 pellet.' },
      { id: 'stagger',        icon: 'S', name: 'Stagger',        desc: 'Each pellet has 15% chance to stun 0.5s.' },
      { id: 'glass_cannon',   icon: 'G', name: 'Glass Cannon',   desc: '+3 pellet damage, -2 max HP.' },
      { id: 'penetrator',     icon: 'P', name: 'Penetrator',     desc: 'Pellets pierce 1 additional enemy.' },
    ],
    void: [
      { id: 'feedback',       icon: 'F', name: 'Feedback',       desc: 'Self-chip damage heals at 2x rate.' },
      { id: 'swarm_chaos',    icon: 'W', name: 'Swarm Chaos',    desc: 'Pellets bounce off walls once.' },
      { id: 'contagion',      icon: 'C', name: 'Contagion',      desc: 'Enemies hit by chaos spread 5 corruption to nearby.' },
      { id: 'frenzy',         icon: 'V', name: 'Frenzy',         desc: 'Each enemy in 40px increases fire rate 10%.' },
    ],
  },
  lance: {
    clean: [
      { id: 'slow_field_persist', icon: 'P', name: 'Persistent Field', desc: 'Slow fields last 5s (was 3s).' },
      { id: 'chain_null',         icon: 'C', name: 'Chain Null',       desc: 'Null Spear pierces 2 enemies.' },
      { id: 'aimed_shot',         icon: 'A', name: 'Aimed Shot',       desc: 'Lance damage +50% if player is standing still.' },
      { id: 'field_expand',       icon: 'E', name: 'Field Expand',     desc: 'Slow field radius +40px.' },
    ],
    void: [
      { id: 'nested_vortex',  icon: 'N', name: 'Nested Vortex',  desc: 'Gravity vortex pulls enemies 50% faster.' },
      { id: 'vortex_damage',  icon: 'D', name: 'Vortex Damage',  desc: '+50% damage to pulled enemies (stacks).' },
      { id: 'chain_vortex',   icon: 'C', name: 'Chain Vortex',   desc: 'Killing a pulled enemy spawns mini vortex.' },
      { id: 'void_attractor', icon: 'V', name: 'Void Attractor', desc: 'Vortex lasts 1s longer.' },
    ],
  },
  baton: {
    clean: [
      { id: 'field_chain',    icon: 'C', name: 'Field Chain',    desc: 'Arc fields chain to nearest enemy (jump dmg).' },
      { id: 'field_persist',  icon: 'P', name: 'Field Persist',  desc: 'Arc fields last 5s (was 3s).' },
      { id: 'wide_arc',       icon: 'W', name: 'Wide Arc',       desc: 'AOE radius +40px.' },
      { id: 'static_charge',  icon: 'S', name: 'Static Charge',  desc: '3rd baton hit in 3s: free AOE pulse.' },
    ],
    void: [
      { id: 'vortex_speed',   icon: 'V', name: 'Vortex Speed',   desc: 'Vortex expansion 50% faster.' },
      { id: 'deep_drain',     icon: 'D', name: 'Deep Drain',     desc: 'Drain heals +1 HP per 2 enemies.' },
      { id: 'overload_void',  icon: 'O', name: 'Overload',       desc: 'Full vortex expansion fires a shockwave.' },
      { id: 'hunger_field',   icon: 'H', name: 'Hunger Field',   desc: 'Vortex zone pulls enemies inward.' },
    ],
  },
  dart: {
    clean: [
      { id: 'missile_burst',  icon: 'B', name: 'Missile Burst',  desc: 'On elite kill: fire 2 smart missiles instantly.' },
      { id: 'tracking_plus',  icon: 'T', name: 'Tracking Plus',  desc: 'Missile tracking speed +50%.' },
      { id: 'payload',        icon: 'P', name: 'Payload',        desc: 'Missile explodes on impact 50px AOE.' },
      { id: 'multi_lock',     icon: 'M', name: 'Multi-Lock',     desc: 'Every 3rd missile fires 2 simultaneously.' },
    ],
    void: [
      { id: 'rapid_spread',   icon: 'R', name: 'Rapid Spread',   desc: 'Parasite spreads to 2 enemies on death.' },
      { id: 'toxic_cloud',    icon: 'C', name: 'Toxic Cloud',    desc: 'Parasite death leaves a 3s poison cloud.' },
      { id: 'deep_parasite',  icon: 'D', name: 'Deep Parasite',  desc: 'Parasite duration 6s (was 4s).' },
      { id: 'void_latch',     icon: 'V', name: 'Void Latch',     desc: 'Parasitized enemies deal 20% less damage.' },
    ],
  },
  flamethrower: {
    clean: [
      { id: 'cryo_range',     icon: 'R', name: 'Cryo Range',     desc: 'Freeze cone range +40px.' },
      { id: 'deep_freeze',    icon: 'D', name: 'Deep Freeze',    desc: 'Stun duration 3s (was 2s).' },
      { id: 'shatter',        icon: 'S', name: 'Shatter',        desc: 'Frozen enemies take +50% damage from other sources.' },
      { id: 'cryo_aura',      icon: 'A', name: 'Cryo Aura',      desc: 'Enemies near frozen targets are slowed 30%.' },
    ],
    void: [
      { id: 'corr_efficiency',  icon: 'E', name: 'Corruption Efficiency', desc: 'Corruption cost reduced to +3/s.' },
      { id: 'void_flames',      icon: 'V', name: 'Void Flames',           desc: 'Flame projectiles pierce 1 enemy.' },
      { id: 'corruption_burst', icon: 'B', name: 'Corruption Burst',      desc: 'At 80 corruption: next flame burst deals 5x.' },
      { id: 'siphon',           icon: 'S', name: 'Siphon',                desc: 'Kill with flames restores 1 HP.' },
    ],
  },
  grenade_launcher: {
    clean: [
      { id: 'wide_burst',    icon: 'W', name: 'Wide Burst',     desc: 'Airburst radius +30px.' },
      { id: 'carpet_bomb',   icon: 'C', name: 'Carpet Bomb',    desc: 'Fire 2 grenades side-by-side.' },
      { id: 'concussion',    icon: 'X', name: 'Concussion',     desc: 'Airburst stuns 1s.' },
      { id: 'barrage',       icon: 'B', name: 'Barrage',        desc: 'Fire rate +25%.' },
    ],
    void: [
      { id: 'corr_zone_expand', icon: 'E', name: 'Zone Expand',  desc: 'Corruption zone radius +40px.' },
      { id: 'zone_damage',      icon: 'D', name: 'Zone Damage',  desc: 'Corruption zone deals 2 dmg/s.' },
      { id: 'void_pull',        icon: 'P', name: 'Void Pull',    desc: 'Corruption zone pulls enemies inward.' },
      { id: 'cascade_void',     icon: 'V', name: 'Cascade',      desc: 'Enemies killed in zone spawn mini zone.' },
    ],
  },
  entropy_cannon: {
    clean: [
      { id: 'stable_focus',   icon: 'F', name: 'Stable Focus',   desc: 'Fire rate +15%.' },
      { id: 'stable_pierce',  icon: 'P', name: 'Stable Pierce',  desc: 'Pierce 2 enemies.' },
      { id: 'stable_range',   icon: 'R', name: 'Stable Range',   desc: 'Range +60px.' },
      { id: 'stable_crit',    icon: 'C', name: 'Stable Crit',    desc: 'Every 5th shot crits (2x).' },
    ],
    void: [
      { id: 'res_scaling',    icon: 'S', name: 'Deep Resonance',  desc: 'Corruption scaling x4 instead of x3.' },
      { id: 'res_aura',       icon: 'A', name: 'Corruption Aura', desc: 'Kills spread +5 corruption to nearby enemies.' },
      { id: 'res_leech',      icon: 'L', name: 'Void Leech',      desc: 'Kills at 60+ corruption heal 1 HP.' },
      { id: 'res_burst',      icon: 'B', name: 'Entropy Burst',   desc: 'At 80+ corruption, shots explode 40px AOE.' },
    ],
  },
  pulse_cannon: {
    clean: [
      { id: 'oc_speed',   icon: 'S', name: 'Quick Pulse',     desc: 'Bullet speed +25%.' },
      { id: 'oc_damage',  icon: 'D', name: 'Heavy Pulse',     desc: '+2 damage per bounce.' },
      { id: 'oc_range',   icon: 'R', name: 'Extended Reach',  desc: 'Range +80px.' },
      { id: 'oc_chain',   icon: 'C', name: 'Chain Reaction',  desc: 'Final bounce explodes 40px AOE.' },
    ],
    void: [
      { id: 'vc_corrupt', icon: 'C', name: 'Deep Chain',      desc: 'Bounce corruption +3 (5 total).' },
      { id: 'vc_slow',    icon: 'S', name: 'Chain Slow',      desc: 'Each bounce slows enemy 20% for 1s.' },
      { id: 'vc_extra',   icon: 'E', name: 'Extra Bounce',    desc: '+2 bounces.' },
      { id: 'vc_drain',   icon: 'D', name: 'Void Drain',      desc: 'Each bounce heals 0.5 HP.' },
    ],
  },
  sniper_carbine: {
    clean: [
      { id: 'ks_execute', icon: 'E', name: 'Execute',         desc: 'Killshot threshold raised to 30% HP.' },
      { id: 'ks_reload',  icon: 'R', name: 'Quick Scope',     desc: 'Reload time -40%.' },
      { id: 'ks_crit',    icon: 'C', name: 'Vital Shot',      desc: 'Headshot zone +15px radius.' },
      { id: 'ks_chain',   icon: 'X', name: 'Chain Kill',      desc: 'Killshot resets fire cooldown.' },
    ],
    void: [
      { id: 'vs_trail',   icon: 'T', name: 'Lingering Trail', desc: 'Corruption trail lasts 4s.' },
      { id: 'vs_damage',  icon: 'D', name: 'Void Penetration', desc: '+4 damage to corrupted enemies.' },
      { id: 'vs_slow',    icon: 'S', name: 'Entropic Slug',   desc: 'Trail slows enemies 30%.' },
      { id: 'vs_burst',   icon: 'B', name: 'Void Impact',     desc: 'Headshots on elites create 60px corruption burst.' },
    ],
  },
  chain_rifle: {
    clean: [
      { id: 'pm_damage',  icon: 'D', name: 'Heavy Rounds',    desc: '+2 damage in precision mode.' },
      { id: 'pm_pierce',  icon: 'P', name: 'AP Rounds',       desc: 'Precision shots pierce 1 enemy.' },
      { id: 'pm_range',   icon: 'R', name: 'Extended Barrel',  desc: 'Range +60px.' },
      { id: 'pm_crit',    icon: 'C', name: 'Focused Fire',    desc: 'Every 5th shot crits (2x).' },
    ],
    void: [
      { id: 'sp_slow',    icon: 'S', name: 'Deep Suppression', desc: 'Slow cap raised to 70%.' },
      { id: 'sp_damage',  icon: 'D', name: 'Void Rounds',     desc: '+1 damage to slowed enemies.' },
      { id: 'sp_corrupt', icon: 'C', name: 'Corruption Feed', desc: 'Slowed enemies gain +3 corruption/s.' },
      { id: 'sp_burst',   icon: 'B', name: 'Suppression Wave', desc: 'Every 20th bullet: AOE slow 100px.' },
    ],
  },
};
