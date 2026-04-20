import { Application, Container, Graphics, Sprite, Assets, Texture } from 'pixi.js';
import { Camera } from './Camera';
import { GameMap } from './Map';
import { Player } from './Player';
import { WeaponSystem } from './Weapons';
import { EnemySystem, type Enemy, createEnemy } from './Enemies';
import { HUD } from './HUD';
import { DropSystem, type DropCapsule, type DropType } from './DropSystem';
import { SpawnManager } from './SpawnManager';
import { BulletSystem } from './BulletSystem';
import { ContractObjectives } from './ContractObjectives';
import { KitAbilitySystem } from './KitAbilitySystem';
import { ProgressionManager } from './ProgressionManager';
import { v2dist, v2, v2sub, v2norm, v2mul, v2len, v2fromAngle, randRange, lineSegHitsCircle } from '../lib/math';
import {
  PLAYER_BASE_HP, PLAYER_BASE_SPEED, WORLD_W, WORLD_H,
  PLAYER_COLOR, XP_PER_LEVEL, MAX_LEVEL, POST_CAP_XP
} from './constants';
import { CREATURE_DEFS } from '../data/creatures';
import { type ModifierDef } from '../data/modifiers';
import { WEAPON_DEFS, WEAPON_LEVEL_PERKS, WEAPON_MUTATIONS } from '../data/weapons';
import { KIT_DEFS } from '../data/kits';
import { type UpgradeCard, type ProgressionState, generateUpgrades } from '../data/upgrades';
import {
  halSay,
  HAL_HUNT_START, HAL_FIRST_KILL, HAL_KILL_STREAK,
  HAL_ELITE_SPAWNED, HAL_LOW_HP, HAL_CRITICAL_HP, HAL_TOOK_DAMAGE,
  HAL_CORRUPTION_VALLEY, HAL_CORRUPTION_CORRUPT, HAL_CORRUPTION_VOID,
  HAL_OBJECTIVE_HALF, HAL_OBJECTIVE_NEAR, HAL_LEVEL_UP,
  HAL_PLAYER_DIED, HAL_CONTRACT_DONE, HAL_RELOAD,
} from '../data/hal';

// Sprite base path for GitHub Pages support
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

const BEHAVIOR_COLORS: Record<string, number> = {
  charge: 0xFF3333, flank: 0xFF8800, pack: 0x33FF33,
  lurker: 0xAA44FF, burst: 0xFFFF00, strafe: 0x00FFFF, patrol_river: 0x888888,
};

/** Blend a hex color toward white at the given strength (0=white, 1=full color). */
function subtleTint(color: number, strength: number): number {
  const r = Math.round(0xFF + ((color >> 16 & 0xFF) - 0xFF) * strength);
  const g = Math.round(0xFF + ((color >> 8  & 0xFF) - 0xFF) * strength);
  const b = Math.round(0xFF + ((color        & 0xFF) - 0xFF) * strength);
  return (r << 16) | (g << 8) | b;
}

// Sprite name -> creature name mapping
const CREATURE_SPRITE_MAP: Record<string, string> = {
  'Void Leech': 'void_leech',
  'Shadow Crawler': 'shadow_crawler',
  'Abyss Worm': 'abyss_worm',
  'Nether Stalker': 'nether_stalker',
  'Rift Parasite': 'rift_parasite',
  'Cave Lurker': 'cave_lurker',
  'Tide Wraith': 'tide_wraith',
  'Void Spawn': 'void_spawn',
};

// 8-direction system
const DIR_NAMES = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'] as const;

/** Convert velocity to one of 8 direction names */
function angleTo8Dir(vx: number, vy: number): string {
  if (vx === 0 && vy === 0) return 'south';
  const angle = Math.atan2(vy, vx);
  const norm = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const sector = Math.round(norm / (Math.PI / 4)) % 8;
  return DIR_NAMES[sector];
}

// Sprites that have 8-direction folders
const SPRITES_WITH_DIRS = ['player', 'void_leech', 'shadow_crawler', 'abyss_worm', 'nether_stalker', 'cave_lurker', 'tide_wraith'];

// Ã¢ÂÂÃ¢ÂÂ Void breach zone interface Ã¢ÂÂÃ¢ÂÂ
interface VoidBreachZone {
  id: number;
  pos: { x: number; y: number };
  sealed: boolean;
  holdTimer: number;
  holdTime: number;
  radius: number;
}

// Ã¢ÂÂÃ¢ÂÂ Extraction cache interface Ã¢ÂÂÃ¢ÂÂ
interface ExtractionCache {
  id: number;
  pos: { x: number; y: number };
  collected: boolean;
  radius: number;
}



export interface GameCallbacks {
  onDeath: () => void;
  onComplete: () => void;
  onHuntResult: (result: {
    credits: number;
    corruption: number;
    timeSurvived: number;
    totalKills: number;
    eliteKills: number;
    apexKills: number;
    peakCorruption: number;
    damageDealt: number;
    damageTaken: number;
    ingredients: Array<{ id: string; name: string }>;
  }) => void;
  /** Called between waves to let the player pick an upgrade. Game is paused until resolved. */
  onModifierPick: (choices: ModifierDef[], resolve: (picked: ModifierDef) => void) => void;
  onWeaponPerkPick: (perks: string[], weaponName: string, resolve: (picked: string) => void) => void;
  onUpgradePick: (choices: UpgradeCard[], resolve: (picked: UpgradeCard) => void) => void;
  onKitT3Choice: (kitId: string, kitName: string, resolve: (path: 'clean' | 'void') => void) => void;
}

export class Game {
  app: Application;
  camera: Camera;
  map: GameMap;
  player: Player;
  weapons: WeaponSystem;
  enemies: EnemySystem;
  hud: HUD;
  callbacks: GameCallbacks;

  // Layers
  worldLayer: Container;
  mapGfx: Graphics;
  dynamicGfx: Graphics;
  obstacleLayer: Container;
  entityGfx: Graphics;
  bulletGfx: Graphics;
  spriteLayer: Container;
  hudLayer: Container;
  biomeGfx: Graphics; // screen-space biome vignette overlay

  // Sprite textures
  textures: Record<string, Texture> = {};
  spritePool: Map<number, Sprite> = new Map();
  playerSprite: Sprite | null = null;
  animFrame = 0;
  animTimer = 0;
  animFPS = 8;

  // Kit state
  kitCooldowns: Record<string, number> = {};

  // Explosion effects
  explosions: Array<{ x: number; y: number; radius: number; maxRadius: number; life: number; maxLife: number; type?: string }> = [];

  // Screen flash (used by flash_trap)
  screenFlash = 0;

  // Behavior + biome particles
  particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: number; radius: number }> = [];
  biomeParticleTimer = 0;

  // Active turrets
  turrets: Array<{
    x: number; y: number;
    life: number; maxLife: number;
    fireTimer: number; fireRate: number;
    damage: number; range: number;
  }> = [];

  // Decoys (mirage_kit)
  decoys: Array<{ x: number; y: number; hp: number; life: number; maxLife: number }> = [];

  // Smoke zones (smoke_kit) — extended with mastery-perk fields
  smokeZones: Array<{ x: number; y: number; radius: number; life: number; maxLife: number; slowing?: boolean; toxic?: boolean; corrupting?: boolean; corruptionField?: boolean; pull?: boolean; tickDamage?: number }> = [];

  // Gravity wells (anchor_kit)
  gravityWells: Array<{ x: number; y: number; radius: number; life: number; maxLife: number; pullSpeed: number; damageField?: boolean; explodeOnEnd?: boolean; enemiesInside?: number }> = [];

  // Drone state (drone_kit)
  droneActive = false;
  dronePos = v2(0, 0);
  droneFireTimer = 0;
  droneInterceptTimer = 0;

  // Familiar state (familiar_kit)
  familiarActive = false;
  familiarPos = v2(0, 0);
  familiarAttackTimer = 0;
  familiarState: 'idle' | 'hunting' | 'biting' | 'returning' | 'delivering' = 'idle';
  familiarTarget: Enemy | null = null;
  familiarBuffToken = '';        // behavior of bitten enemy
  familiarGlowColor = 0x9933ff; // glow color during 'returning'
  familiarCooldown = 0;          // cooldown between hunts
  familiarSpeedTimer = 0;        // pack buff: +30% speed for 4s
  familiarDmgTimer = 0;          // flank/strafe buff: +25% dmg for 5s

  // Void surge state
  voidSurgeActive = false;
  voidSurgeTimer = 0;

  // Charge kit state
  chargeCharging = false;

  // Stim T3 clean speed timer
  stimSpeedTimer = 0;

  // Blink T3 clean empowered shot
  blinkEmpowered = false;

  // Kit T3 path choices (persisted per run)
  kitT3Choices: Record<string, string> = {};

  // Post-cap stat drip
  postCapIndex = 0;

  // Kit perk state
  stimWithdrawalActive = false;
  sacrificeInvincibleTimer = 0;
  ruptureDrainTimer = 2;
  voidTrailDropTimer = 0;
  familiarLeashUsed = false;
  // Mastery perk runtime state
  missilesFiredSinceLastBurst = 0; // multi_lock: track every 3rd missile
  prevPlayerHp = 0;                // feedback: detect when player took damage
  voidLatchOriginalDamage: Map<number, number> = new Map(); // void_latch: restore meleeDmg on expiry

  // Baton mastery state
  batonHitTimes: number[] = [];   // static_charge: track hit timestamps for 3-in-3s trigger
  batonDrainCounter = 0;          // deep_drain: accumulate drained-enemy count for heal
  batonVortices: Array<{ x: number; y: number; currentRadius: number; maxRadius: number; life: number; maxLife: number; shockwaveFired: boolean }> = [];

  // Resonance runtime state
  lastFlashTrapPos: { x: number; y: number } | null = null;
  droneOverchargeTimer = 0;
  turretFamiliarHealTimer = 5;

  // Weapon leveling (starts at 1; perks are levels 2-5)
  weaponLevel = 1;
  weaponPerkPending = false;

  // State
  elapsed = 0;
  waveTimer = 15;
  waveCount = 0;
  totalKills = 0;
  eliteKills = 0;
  apexKills = 0;
  damageDealt = 0;
  damageTaken = 0;
  peakCorruption = 0;
  ingredients: Array<{ id: string; name: string }> = [];
  paused = false;
  dead = false;
  complete = false;
  equippedKits: string[] = [];
  contractType = 'hunt';
  targetTotal = 10;
  targetCount = 0;
  hpBonus = 0;
  magBonus = 0;

  // Contract-specific state
  holdTime = 0;       // void_breach: total seconds across all breaches
  holdZoneActive = false;
  breaches: VoidBreachZone[] = [];  // void_breach: sequential zones
  activeBreachIdx = 0;              // void_breach: current breach index
  breachEnemyTimer = 0;             // void_breach: timer for spawning enemies near breach
  breachesSealed = 0;               // void_breach: count of sealed breaches
  // void_breach: swarms and instability
  breachSwarmTimer = 15;
  instabilityZones: Array<{ x: number; y: number; timer: number; maxTimer: number; radius: number }> = [];
  instabilityTimer = 10;
  breachEliteTimer = 45;            // void_breach: elite every 45s during holds

  podHp = 0;          // payload_escort: pod HP
  podMaxHp = 0;
  podProgress = 0;    // payload_escort: 0->1 delivery progress
  // payload_escort: winding waypoint path
  podPath: Array<{ x: number; y: number }> = [];
  podPathProgress = 0;  // float 0...(podPath.length-1)
  podSlowZones: Array<{ x: number; y: number; timer: number; radius: number }> = [];
  podSlowZoneTimer = 20;

  cacheCount = 0;     // extraction_run: total caches
  cachesCollected = 0;
  caches: ExtractionCache[] = [];  // extraction_run: spawned cache positions
  nextCacheId = 1;

  // Boss hunt state
  apexSpawned = false; // boss_hunt: has the apex target been spawned?
  apexId = -1;         // boss_hunt: enemy id of the apex
  apexName = '';
  apexPhase = 1;
  apexAttackTimer = 5;
  apexPackTimer = 25;
  apexShieldTimer = 30;
  apexShieldActive = false;
  apexShieldDuration = 0;
  apexPhaseTransitionTimer = 0;
  apexInstabilityTimer = 8;

  // Elite spawning
  eliteTimer = 0;
  eliteSpawnedCount = 0;

  // Screen shake
  shakeTimer = 0;
  shakeAmt = 0;

  // Scorch marks left by elite charge impacts
  scorchMarks: Array<{ x: number; y: number; life: number; maxLife: number }> = [];

  // Contract reward / par time (passed via contractExtras)
  contractReward = 0;
  contractParTime = 300;
  contractDifficulty = 1;
  parTimeWarningSent = false;

  // Hunt: elite kills toward objective (separate from totalKills)
  eliteKillsForContract = 0;

  // Active modifiers
  activeModifiers: string[] = [];
  modifierPickPending = false;
  upgradePending = false;
  pendingLevelUpPicks = 0;
  adrenalineKills = 0;
  adrenalineTimer = 0;
  adrenalineStacks = 0;
  momentumHits = 0;
  killsSinceLastHeal = 0;

  // Progression state (per-run)
  runKitTiers: Record<string, number> = {};
  kitPerksTaken: string[] = [];
  masteryTaken: string[] = [];
  resonanceTaken: string[] = [];
  kitT3Pending: string[] = [];
  kitT3ChoicePending = false;

  // Ship (hub) upgrades applied to this run
  shipUpgrades: Record<string, number> = {};

  // Dash (Thrusters upgrade)
  dashCharges = 0;
  dashMaxCharges = 0;
  dashCooldown = 0;
  dashMaxCooldown = 1.5;
  dashActive = false;
  dashTimer = 0;
  dashVelX = 0;
  dashVelY = 0;

  // Emergency Protocol (revive once)
  emergencyProtocolUsed = false;

  // Active drop effects
  damageBurstTimer = 0;
  speedBoostTimer = 0;

  // Ally drones (from drop capsule)
  allyDrones: Array<{ x: number; y: number; hp: number; maxHp: number; life: number; fireTimer: number }> = [];

  // Drop capsules
  dropSystem = new DropSystem();

  // Spawn management
  spawnManager!: SpawnManager;
  bulletSystem!: BulletSystem;
  contractObjectives = new ContractObjectives();
  kitSystem = new KitAbilitySystem();
  progression = new ProgressionManager();

  // HAL event tracking
  halCooldown = 0;
  halReloadSaid = false;
  halLowHpSaid = false;
  halCriticalHpSaid = false;
  halCorruptionValleySaid = false;
  halCorruptionCorruptSaid = false;
  halCorruptionVoidSaid = false;
  halKillStreakTimer = 0;
  halKillsSinceStreak = 0;
  halHalfSaid = false;
  halNearSaid = false;

  // Mastery perk runtime state
  killcamReady = false;        // killcam: skip cooldown on next sidearm shot after a kill
  sidearmShotCount = 0;        // overheat: fires extra fragments on every 10th sidearm shot
  chainRifleShotCount = 0;     // pm_crit: crit every 5th shot; sp_burst: AOE slow every 20th
  entropyShotCount = 0;          // stable_crit: every 5th shot crits 2x
  corruptionBurstReady = false;  // corruption_burst: at 80+ corruption, next flame hit 5x
  vcDrainAccum = 0;              // vc_drain: accumulate 0.5 HP per bounce
  enemyCorruption = new Map<number, number>(); // vc_corrupt / res_aura: per-enemy corruption buildup

  constructor(
    app: Application,
    kits: string[],
    contractType: string,
    targetTotal: number,
    shipUpgrades: Record<string, number>,
    callbacks: GameCallbacks,
    contractExtras?: { holdTime?: number; podHp?: number; cacheCount?: number; reward?: number; parTime?: number; difficulty?: number },
    startingWeapon?: string
  ) {
    this.app = app;
    this.callbacks = callbacks;
    this.equippedKits = kits;
    this.contractType = contractType;
    this.targetTotal = targetTotal;
    this.shipUpgrades = shipUpgrades;
    this.hpBonus = 0;
    this.magBonus = 0;

    // Initialize kit cooldowns and run-local kit tiers
    for (const kit of kits) {
      this.kitCooldowns[kit] = 0;
      this.runKitTiers[kit] = 1;
    }

    // First elite spawn: 45s for hunt (elite-focused), scaled 90-150s for others
    if (contractType === 'hunt') {
      this.eliteTimer = 45;
    } else {
      const depth = Math.min(3, Math.ceil(targetTotal / 10));
      this.eliteTimer = 90 - depth * 15 + Math.random() * 60;
    }

    // Contract-specific init
    if (contractExtras?.holdTime) {
      this.holdTime = contractExtras.holdTime;
    }
    if (contractExtras?.podHp) {
      this.podHp = contractExtras.podHp;
      this.podMaxHp = contractExtras.podHp;
    }
    if (contractExtras?.cacheCount) {
      this.cacheCount = contractExtras.cacheCount;
    }
    if (contractExtras?.reward !== undefined) {
      this.contractReward = contractExtras.reward;
    }
    if (contractExtras?.parTime !== undefined) {
      this.contractParTime = contractExtras.parTime;
    }
    if (contractExtras?.difficulty !== undefined) {
      this.contractDifficulty = contractExtras.difficulty;
    }

    const vw = app.screen.width;
    const vh = app.screen.height;

    this.camera = new Camera(vw, vh);
    this.map = new GameMap();
    this.map.generate();

    // Apply hub upgrades
    const condLevel = shipUpgrades.conditioning ?? 0;
    const maxHp = Math.round(PLAYER_BASE_HP * (1 + condLevel * 0.05));
    this.player = new Player(this.map.spawnPos.x, this.map.spawnPos.y, maxHp, 12);
    if (startingWeapon && WEAPON_DEFS[startingWeapon]) {
      this.player.weaponId = startingWeapon;
      this.player.magSize = WEAPON_DEFS[startingWeapon].magSize;
      this.player.magAmmo = this.player.magSize;
    }
    // Reflex Training: +3% move speed per level
    const reflexLevel = shipUpgrades.reflex_training ?? 0;
    if (reflexLevel > 0) {
      this.player.baseSpeed = Math.round(PLAYER_BASE_SPEED * (1 + reflexLevel * 0.03));
      this.player.speed = this.player.baseSpeed;
    }
    // Quick Hands: -5% reload time per level
    const quickLevel = shipUpgrades.quick_hands ?? 0;
    if (quickLevel > 0) {
      this.player.reloadTimeMult = Math.max(0.5, 1 - quickLevel * 0.05);
    }
    this.weapons = new WeaponSystem();
    // Trigger Discipline: +4% fire rate per level (reduces cooldown)
    const triggerLevel = shipUpgrades.trigger_discipline ?? 0;
    if (triggerLevel > 0) {
      this.weapons.fireRateBonus = -(triggerLevel * 0.04);
    }
    // Thrusters: dash ability
    const thrusterLevel = shipUpgrades.thrusters ?? 0;
    if (thrusterLevel >= 1) {
      this.dashMaxCharges = thrusterLevel >= 2 ? 2 : 1;
      this.dashCharges = this.dashMaxCharges;
      this.dashMaxCooldown = thrusterLevel >= 3 ? 1.5 * 0.6 : 1.5;
    }
    this.enemies = new EnemySystem();
    this.hud = new HUD(vw, vh);
    this.spawnManager = new SpawnManager();
    this.bulletSystem = new BulletSystem();

    // Build scene graph
    this.worldLayer = new Container();
    this.mapGfx = new Graphics();
    this.dynamicGfx = new Graphics();
    this.obstacleLayer = new Container();
    this.spriteLayer = new Container();
    this.entityGfx = new Graphics();
    this.bulletGfx = new Graphics();
    this.hudLayer = new Container();

    this.worldLayer.addChild(this.mapGfx);
    this.worldLayer.addChild(this.dynamicGfx);
    this.worldLayer.addChild(this.obstacleLayer);
    this.worldLayer.addChild(this.spriteLayer);
    this.worldLayer.addChild(this.entityGfx);
    this.worldLayer.addChild(this.bulletGfx);
    app.stage.addChild(this.worldLayer);
    app.stage.addChild(this.hudLayer);

    // Biome vignette sits below HUD elements
    this.biomeGfx = new Graphics();
    this.hudLayer.addChild(this.biomeGfx);

    // Load sprite textures (non-blocking)
    this.loadSprites();

    this.hudLayer.addChild(this.hud.gfx);
    this.hudLayer.addChild(this.hud.hpText);
    this.hudLayer.addChild(this.hud.ammoText);
    this.hudLayer.addChild(this.hud.weaponText);
    this.hudLayer.addChild(this.hud.corrText);
    this.hudLayer.addChild(this.hud.killsText);
    this.hudLayer.addChild(this.hud.timerText);
    this.hudLayer.addChild(this.hud.levelText);
    this.hudLayer.addChild(this.hud.messageText);
    this.hudLayer.addChild(this.hud.halStripText);

    // Draw static map
    this.map.drawStatic(this.mapGfx);

    // Spawn initial wave
    this.enemies.spawnWave(30, this.player.pos, this.map);
    this.hud.showMessage('HUNT STARTED', 2);
    setTimeout(() => this.hud.showHalMessage(halSay(HAL_HUNT_START), 5), 2500);

    // Ã¢ÂÂÃ¢ÂÂ Contract-specific setup Ã¢ÂÂÃ¢ÂÂ
    if (this.contractType === 'void_breach') {
      this.spawnManager.spawnBreaches(this);
    }
    if (this.contractType === 'extraction_run') {
      this.spawnManager.spawnCaches(this);
    }
    if (this.contractType === 'payload_escort') {
      this.spawnManager.spawnPodPath(this);
    }

    // Input
    this.setupInput();
  }

  /** Current world-space pod position interpolated along podPath */
  getPodPos(): { x: number; y: number } {
    if (this.podPath.length < 2) return { x: WORLD_W * this.podProgress, y: WORLD_H / 2 };
    const total = this.podPath.length - 1;
    const segIdx = Math.min(total - 1, Math.floor(this.podPathProgress));
    const segT = this.podPathProgress - segIdx;
    const a = this.podPath[segIdx];
    const b = this.podPath[segIdx + 1];
    return { x: a.x + (b.x - a.x) * segT, y: a.y + (b.y - a.y) * segT };
  }

  private async loadSprites() {
    const ANIM_NAMES: Record<string, string> = {
      player: 'walking',
      void_leech: 'running-4-frames',
      shadow_crawler: 'running-4-frames',
      abyss_worm: 'running-4-frames',
      nether_stalker: 'running-4-frames',
      cave_lurker: 'running-4-frames',
    };
    const FRAME_COUNTS: Record<string, number> = {
      player: 6,
      void_leech: 4,
      shadow_crawler: 4,
      abyss_worm: 4,
      nether_stalker: 4,
      cave_lurker: 4,
    };

    const loadBatch = async (batch: Array<{ key: string; url: string }>) => {
      const results = await Promise.allSettled(
        batch.map(async ({ key, url }) => {
          const tex = await Assets.load(url);
          return { key, tex };
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled') this.textures[r.value.key] = r.value.tex;
      }
    };

    // Phase 1: rotation stills + singles + obstacles
    const phase1: Array<{ key: string; url: string }> = [];
    for (const name of SPRITES_WITH_DIRS) {
      for (const dir of DIR_NAMES) {
        phase1.push({ key: `${name}/${dir}`, url: `${BASE}/sprites/${name}/${dir}.png` });
      }
    }
    for (const name of ['rift_parasite', 'void_spawn', 'bullet_player', 'bullet_enemy', 'hal_eye', 'explosion', 'essence_orb']) {
      phase1.push({ key: name, url: `${BASE}/sprites/${name}.png` });
    }
    for (const name of ['obs_asteroid', 'obs_crystal', 'obs_debris']) {
      phase1.push({ key: name, url: `${BASE}/sprites/obstacles/${name}.png` });
    }
    await loadBatch(phase1);

    // Create player sprite
    const playerTex = this.textures['player/south'];
    if (playerTex) {
      this.playerSprite = new Sprite(playerTex);
      this.playerSprite.anchor.set(0.5, 0.5);
      this.playerSprite.scale.set(2);
      this.playerSprite.roundPixels = true;
      this.spriteLayer.addChild(this.playerSprite);
    }

    // Place obstacle sprites
    const OBS_KEYS = ['obs_asteroid', 'obs_crystal', 'obs_debris'];
    for (const obs of this.map.obstacles) {
      const key = OBS_KEYS[obs.obsType] ?? OBS_KEYS[0];
      const tex = this.textures[key];
      if (!tex) continue;
      const spr = new Sprite(tex);
      spr.anchor.set(0.5, 0.5);
      spr.x = obs.pos.x;
      spr.y = obs.pos.y;
      const scaleX = obs.w / 64;
      const scaleY = obs.h / 64;
      spr.scale.set(Math.max(scaleX, scaleY));
      spr.roundPixels = true;
      spr.rotation = Math.random() * Math.PI * 2;
      this.obstacleLayer.addChild(spr);
    }

    // Phase 2: animation frames in background
    const phase2: Array<{ key: string; url: string }> = [];
    for (const name of SPRITES_WITH_DIRS) {
      const animName = ANIM_NAMES[name] || 'walking';
      const frames = FRAME_COUNTS[name] || 6;
      for (const dir of DIR_NAMES) {
        for (let f = 0; f < frames; f++) {
          const fStr = String(f).padStart(3, '0');
          phase2.push({ key: `${name}/anim/${dir}/${f}`, url: `${BASE}/sprites/${name}/${animName}/${dir}/frame_${fStr}.png` });
        }
      }
    }
    loadBatch(phase2); // intentionally not awaited
  }

  private getOrCreateEnemySprite(enemy: Enemy): Sprite | null {
    const texBase = CREATURE_SPRITE_MAP[enemy.name];
    if (!texBase) return null;
    const dir = angleTo8Dir(enemy.vel.x, enemy.vel.y);
    const dirKey = `${texBase}/${dir}`;
    const fallbackKey = `${texBase}/south`;
    const singleKey = texBase;
    const tex = this.textures[dirKey] || this.textures[fallbackKey] || this.textures[singleKey];
    if (!tex) return null;

    if (this.spritePool.has(enemy.id)) {
      const spr = this.spritePool.get(enemy.id)!;
      spr.texture = tex;
      return spr;
    }

    const spr = new Sprite(tex);
    spr.anchor.set(0.5, 0.5);
    spr.scale.set(2);
    spr.roundPixels = true;
    this.spriteLayer.addChild(spr);
    this.spritePool.set(enemy.id, spr);
    return spr;
  }

  private cleanupDeadSprites() {
    const alive = new Set(this.enemies.enemies.map(e => e.id));
    for (const [id, spr] of this.spritePool) {
      if (!alive.has(id)) {
        this.spriteLayer.removeChild(spr);
        spr.destroy();
        this.spritePool.delete(id);
      }
    }
  }

  private setupInput() {
    const canvas = this.app.canvas;

    // Touch
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const tx = t.clientX - rect.left;
      const ty = t.clientY - rect.top;
      // Check kit button taps
      const kitBtnW = 72;
      const kitBtnH = 52;
      const viewW = this.app.screen.width;
      const viewH = this.app.screen.height;
      const R = viewW - 16;
      let kitTapped = false;
      for (let i = 0; i < this.equippedKits.length; i++) {
        const kx = R - (this.equippedKits.length - i) * (kitBtnW + 8);
        const ky = viewH - 70;
        if (tx >= kx && tx <= kx + kitBtnW && ty >= ky && ty <= ky + kitBtnH) {
          this.activateKit(this.equippedKits[i]);
          kitTapped = true;
          break;
        }
      }
      if (!kitTapped) {
        this.player.onTouchStart(tx, ty);
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      this.player.onTouchMove(t.clientX - rect.left, t.clientY - rect.top);
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.player.onTouchEnd();
    }, { passive: false });

    // Keyboard
    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (down) {
        this.player.onKeyDown(e.key);
        if (e.key.toLowerCase() === 'q' && this.equippedKits.length > 0) {
          this.activateKit(this.equippedKits[0]);
        }
        if (e.key.toLowerCase() === 'e' && this.equippedKits.length > 1) {
          this.activateKit(this.equippedKits[1]);
        }
        if (e.key === 'Shift' || e.key === ' ') {
          e.preventDefault();
          this.activateDash();
        }
      } else {
        this.player.onKeyUp(e.key);
      }
    };

    window.addEventListener('keydown', (e) => onKey(e, true));
    window.addEventListener('keyup', (e) => onKey(e, false));
  }

  activateDash() {
    if (this.dashMaxCharges === 0 || this.dashCharges <= 0 || this.dashActive) return;
    this.dashCharges--;
    this.dashActive = true;
    this.dashTimer = 0.12; // dash lasts 0.12s
    // Dash in current movement direction or aim direction
    const vx = this.player.vel.x, vy = this.player.vel.y;
    const len = Math.sqrt(vx * vx + vy * vy);
    if (len > 0.1) {
      this.dashVelX = (vx / len) * 1250;
      this.dashVelY = (vy / len) * 1250;
    } else {
      const a = this.player.aimAngle;
      this.dashVelX = Math.cos(a) * 1250;
      this.dashVelY = Math.sin(a) * 1250;
    }
    // Start recharge cooldown if not already ticking
    if (this.dashCooldown <= 0) this.dashCooldown = this.dashMaxCooldown;
  }

  activateKit(kitId: string) {
    this.kitSystem.activateKit(kitId, this);
  }

  update(dt: number) {
    if (this.dead || this.complete || this.paused) return;
    this.elapsed += dt;

    // Par time warning at 80%
    if (!this.parTimeWarningSent && this.contractParTime > 0 && this.elapsed >= this.contractParTime * 0.8) {
      this.parTimeWarningSent = true;
      this.hud.showMessage('TIME RUNNING OUT', 3);
      if (this.halCooldown <= 0) {
        this.hud.showHalMessage('Warning: you are approaching the par time. Reward will be halved if exceeded.', 5);
        this.halCooldown = 6;
      }
    }

    // Animation frame stepping
    this.animTimer += dt;
    if (this.animTimer >= 1 / this.animFPS) {
      this.animTimer -= 1 / this.animFPS;
      this.animFrame++;
    }

    // Decrement kit cooldowns
    for (const kit of Object.keys(this.kitCooldowns)) {
      if (this.kitCooldowns[kit] > 0) {
        this.kitCooldowns[kit] -= dt;
      }
    }

    // Speed multipliers: void surge + stim T3 clean + instability zone slow
    let speedMult = 1.0;
    if (this.voidSurgeActive) speedMult *= 1.8;
    if (this.stimSpeedTimer > 0) { speedMult *= 1.2; this.stimSpeedTimer -= dt; }
    if (this.familiarSpeedTimer > 0) speedMult *= 1.3;
    // Instability zone (void_breach): 40% slow while inside
    if (this.contractType === 'void_breach') {
      for (const iz of this.instabilityZones) {
        if (v2dist(this.player.pos, { x: iz.x, y: iz.y }) < iz.radius) {
          speedMult *= 0.6;
          break;
        }
      }
    }
    this.player.externalSpeedMult = speedMult;

    // Frenzy Aura perk: nearby allies increase fire rate
    if (this.hasPerk('frenzy_aura')) {
      let allyNear = 0;
      for (const e of this.enemies.enemies) {
        if (e.isAlly && e.hp > 0 && v2dist(this.player.pos, e.pos) < 150) allyNear++;
      }
      allyNear = Math.min(allyNear, 3);
      // Apply as temporary fire cooldown reduction
      if (allyNear > 0 && this.player.fireCooldown > 0) {
        this.player.fireCooldown *= (1 - allyNear * 0.08);
      }
    }

    // Frenzy mastery (scatter void): each enemy within 40px increases fire rate 10%
    if (this.hasMod('frenzy') && this.player.weaponId === 'scatter' && this.player.fireCooldown > 0) {
      let nearCount = 0;
      for (const e of this.enemies.enemies) {
        if (e.hp > 0 && !e.isAlly && v2dist(this.player.pos, e.pos) < 40) nearCount++;
      }
      if (nearCount > 0) this.player.fireCooldown /= (1 + nearCount * 0.1);
    }

    // Player update
    this.player.update(dt, this.map);
    this.peakCorruption = Math.max(this.peakCorruption, this.player.corruption);

    // HAL commentary cooldown
    if (this.halCooldown > 0) this.halCooldown -= dt;
    this.halKillStreakTimer = Math.max(0, this.halKillStreakTimer - dt);

    // HAL: HP warnings
    const hpFrac = this.player.hp / this.player.maxHp;
    if (hpFrac < 0.15 && !this.halCriticalHpSaid) {
      this.halCriticalHpSaid = true;
      this.halLowHpSaid = true;
      this.hud.showHalMessage(halSay(HAL_CRITICAL_HP), 4);
      this.halCooldown = 8;
    } else if (hpFrac < 0.35 && !this.halLowHpSaid && this.halCooldown <= 0) {
      this.halLowHpSaid = true;
      this.hud.showHalMessage(halSay(HAL_LOW_HP), 4);
      this.halCooldown = 10;
    } else if (hpFrac > 0.6) {
      this.halLowHpSaid = false;
      this.halCriticalHpSaid = false;
    }

    // HAL: Corruption thresholds
    const c = this.player.corruption;
    if (c >= 70 && !this.halCorruptionVoidSaid && this.halCooldown <= 0) {
      this.halCorruptionVoidSaid = true;
      this.hud.showHalMessage(halSay(HAL_CORRUPTION_VOID), 5);
      this.halCooldown = 12;
    } else if (c >= 36 && !this.halCorruptionCorruptSaid && this.halCooldown <= 0) {
      this.halCorruptionCorruptSaid = true;
      this.hud.showHalMessage(halSay(HAL_CORRUPTION_CORRUPT), 5);
      this.halCooldown = 10;
    } else if (c >= 16 && !this.halCorruptionValleySaid && this.halCooldown <= 0) {
      this.halCorruptionValleySaid = true;
      this.hud.showHalMessage(halSay(HAL_CORRUPTION_VALLEY), 4);
      this.halCooldown = 8;
    }

    // HAL: Reload commentary
    if (this.player.reloadTimer > 0 && !this.halReloadSaid && Math.random() < 0.12 && this.halCooldown <= 0) {
      this.halReloadSaid = true;
      this.hud.showHalMessage(halSay(HAL_RELOAD), 2);
      this.halCooldown = 6;
    } else if (this.player.reloadTimer <= 0) {
      this.halReloadSaid = false;
    }

    // HAL: Objective progress (use elite count for hunt)
    const progressCount = this.contractType === 'hunt' ? this.eliteKillsForContract : this.targetCount;
    if (!this.halHalfSaid && progressCount >= Math.floor(this.targetTotal * 0.5) && this.targetTotal > 0 && this.halCooldown <= 0) {
      this.halHalfSaid = true;
      this.hud.showHalMessage(halSay(HAL_OBJECTIVE_HALF), 4);
      this.halCooldown = 6;
    } else if (!this.halNearSaid && progressCount >= Math.floor(this.targetTotal * 0.75) && this.targetTotal > 0 && this.halCooldown <= 0) {
      this.halNearSaid = true;
      this.hud.showHalMessage(halSay(HAL_OBJECTIVE_NEAR), 4);
      this.halCooldown = 6;
    }

    // HAL: Kill streak
    if (this.halKillsSinceStreak >= 5 && this.halKillStreakTimer <= 0 && this.halCooldown <= 0) {
      this.halKillsSinceStreak = 0;
      this.hud.showHalMessage(halSay(HAL_KILL_STREAK), 3);
      this.halCooldown = 8;
    }

    // HAL: took damage
    if (this.player.hitFlash > 0.12 && this.halCooldown <= 0 && Math.random() < 0.18) {
      this.hud.showHalMessage(halSay(HAL_TOOK_DAMAGE), 2);
      this.halCooldown = 4;
    }

    // Deferred level-up: offer 3-slot upgrade panel
    if (this.pendingLevelUpPicks > 0 && !this.upgradePending && !this.kitT3ChoicePending) {
      this.pendingLevelUpPicks--;
      this.offerUpgradePanel();
    }
    // Process kit T3 path choices
    if (this.kitT3Pending.length > 0 && !this.upgradePending && !this.kitT3ChoicePending) {
      this.processKitT3Choice();
    }

    // Camera
    this.camera.follow(this.player.pos, dt);

    // Find nearest enemy for auto-aim
    let nearestDist = Infinity;
    for (const e of this.enemies.enemies) {
      if (e.hp <= 0 || e.isAlly) continue;
      const d = v2dist(this.player.pos, e.pos);
      if (d < nearestDist && d < 400) {
        nearestDist = d;
        this.player.nearestEnemyPos = e.pos;
      }
    }
    if (nearestDist === Infinity) this.player.nearestEnemyPos = null;

    // Sync corruption level for bullet scaling (entropy cannon radius, etc.)
    this.weapons.corruptionLevel = this.player.corruption;

    // Auto-fire when enemies in range
    if (this.player.nearestEnemyPos) {
      // killcam mastery: skip fire cooldown for next shot after a sidearm kill
      if (this.hasMod('killcam') && this.killcamReady && this.player.weaponId === 'sidearm') {
        this.player.fireCooldown = 0;
        this.killcamReady = false;
      }
      const prevBulletCount = this.weapons.bullets.length;
      const _fired = this.weapons.fire(this.player);
      const newBulletCount = this.weapons.bullets.length - prevBulletCount;
      if (_fired.length > 0) {
        // overheat mastery: every 10th sidearm shot auto-fires an extra fragment burst
        if (this.player.weaponId === 'sidearm' && this.hasMod('overheat')) {
          this.sidearmShotCount++;
          if (this.sidearmShotCount % 10 === 0) {
            const ang = this.player.aimAngle;
            for (let _i = 0; _i < 5; _i++) {
              const a = ang + (Math.random() - 0.5) * 1.5;
              this.weapons.bullets.push({
                pos: { x: this.player.pos.x, y: this.player.pos.y },
                vel: { x: Math.cos(a) * 280, y: Math.sin(a) * 280 },
                radius: 3, color: 0xaa44ff, damage: 2,
                life: 0.5, maxLife: 0.5,
                piercing: false, homing: this.hasMod('fragment_magnet'), bounces: 0, aoeRadius: 0,
                fromPlayer: true, hitSet: new Set(), tag: 'fragment',
              });
            }
          }
        }
        // chain rifle shot counting for pm_crit and sp_burst
        if (this.player.weaponId === 'chain_rifle') {
          this.chainRifleShotCount++;
          // pm_crit mastery: every 5th precision-mode shot crits (2x damage)
          if (this.hasMod('pm_crit') && this.player.mutated === 'clean' && this.chainRifleShotCount % 5 === 0) {
            for (const b of _fired) b.damage *= 2;
          }
          // sp_burst mastery: every 20th suppressor bullet creates 100px AOE slow zone
          if (this.hasMod('sp_burst') && this.player.mutated === 'void' && this.chainRifleShotCount % 20 === 0) {
            const b0 = _fired[0];
            this.smokeZones.push({ x: b0.pos.x, y: b0.pos.y, radius: 100, life: 2, maxLife: 2, slowing: true } as typeof this.smokeZones[number]);
            this.explosions.push({ x: b0.pos.x, y: b0.pos.y, radius: 0, maxRadius: 100, life: 0.4, maxLife: 0.4 });
          }
        }
        // entropy cannon shot count for stable_crit
        if (this.player.weaponId === 'entropy_cannon') this.entropyShotCount++;
      }

      // Multi-lock mastery (dart clean): every 3rd missile fires 2 simultaneously
      if (newBulletCount > 0 && this.hasMod('multi_lock') && this.player.weaponId === 'dart') {
        this.missilesFiredSinceLastBurst++;
        if (this.missilesFiredSinceLastBurst >= 3) {
          this.missilesFiredSinceLastBurst = 0;
          const ref = this.weapons.bullets[this.weapons.bullets.length - 1];
          if (ref) {
            const extraAngle = Math.atan2(ref.vel.y, ref.vel.x) + randRange(-0.25, 0.25);
            const spd = v2len(ref.vel);
            this.weapons.bullets.push({
              pos: v2(this.player.pos.x, this.player.pos.y),
              vel: v2fromAngle(extraAngle, spd),
              radius: ref.radius, color: ref.color, damage: ref.damage,
              life: 3.0, maxLife: 3.0, piercing: false, homing: true,
              bounces: 0, aoeRadius: 0, fromPlayer: true, hitSet: new Set(),
            });
          }
        }
      }

      // Carpet Bomb mastery (grenade clean): fire 2 grenades side-by-side
      if (newBulletCount > 0 && this.hasMod('carpet_bomb') && this.player.weaponId === 'grenade_launcher') {
        const ref = this.weapons.bullets[this.weapons.bullets.length - 1];
        if (ref && ref.aoeRadius > 0) {
          const angle2 = Math.atan2(ref.vel.y, ref.vel.x) + 0.15;
          const spd = v2len(ref.vel);
          this.weapons.bullets.push({
            pos: v2(this.player.pos.x, this.player.pos.y),
            vel: v2fromAngle(angle2, spd),
            radius: ref.radius, color: ref.color, damage: ref.damage,
            life: ref.life, maxLife: ref.maxLife, piercing: false, homing: false,
            bounces: 0, aoeRadius: ref.aoeRadius, fromPlayer: true, hitSet: new Set(),
          });
        }
      }
      // sympathetic_fire: drone fires immediately when player fires (not on timer)
      if (_fired.length > 0 && this.droneActive && this.hasMod('sympathetic_fire')) {
        let sfBest = 300; let sfTarget: Enemy | null = null;
        for (const e of this.enemies.enemies) {
          if (e.hp <= 0 || e.isAlly) continue;
          const d = v2dist(this.dronePos, e.pos);
          if (d < sfBest) { sfBest = d; sfTarget = e; }
        }
        if (sfTarget) {
          sfTarget.hp -= 2;
          sfTarget.hitFlash = 0.15;
          this.damageDealt += 2;
          if (sfTarget.hp <= 0) this.onEnemyKilled(sfTarget);
          this.explosions.push({ x: this.dronePos.x, y: this.dronePos.y, radius: 0, maxRadius: 8, life: 0.1, maxLife: 0.1 });
        }
      }
    }

    // Feedback mastery (scatter void): when player takes damage, heal 1 HP
    this.prevPlayerHp = this.player.hp;

    // Enemies update
    this.enemies.update(dt, this.player, this.map, this.decoys.map(d => ({ x: d.x, y: d.y })));

    // Feedback: detect damage taken this frame and heal it back
    if (this.hasMod('feedback') && this.player.weaponId === 'scatter'
        && this.player.hp < this.prevPlayerHp && this.player.hp > 0) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
    }

    // Process elite charge impacts: screen shake + scorch mark + explosion particles
    for (const impactPos of this.enemies._pendingImpacts) {
      this.shakeTimer = 0.3;
      this.shakeAmt = 6;
      this.scorchMarks.push({ x: impactPos.x, y: impactPos.y, life: 3.0, maxLife: 3.0 });
      for (let i = 0; i < 18; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 60 + Math.random() * 120;
        this.particles.push({ x: impactPos.x, y: impactPos.y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd, life: 0.5, maxLife: 0.5, color: 0xff6600, radius: 4 + Math.random() * 4 });
      }
    }
    this.enemies._pendingImpacts = [];

    // Update scorch marks
    for (let i = this.scorchMarks.length - 1; i >= 0; i--) {
      this.scorchMarks[i].life -= dt;
      if (this.scorchMarks[i].life <= 0) this.scorchMarks.splice(i, 1);
    }
    this.shakeTimer = Math.max(0, this.shakeTimer - dt);

    // Behavior trail particles
    if (this.particles.length < 600) {
      for (const e of this.enemies.enemies) {
        if (e.hp <= 0 || !e.isAggroed) continue;
        const spd = v2len(e.vel);
        switch (e.behavior) {
          case 'charge':
            // Red trail when rushing (phase 2)
            if ((e.phase as number) === 2 && spd > 20) {
              for (let i = 0; i < 3; i++) {
                this.particles.push({ x: e.pos.x + (Math.random()-0.5)*6, y: e.pos.y + (Math.random()-0.5)*6, vx: -e.vel.x*0.15 + (Math.random()-0.5)*20, vy: -e.vel.y*0.15 + (Math.random()-0.5)*20, life: 0.35, maxLife: 0.35, color: 0xff3333, radius: 3 + Math.random()*2 });
              }
            }
            break;
          case 'flank':
            // Orange ghost particles when moving
            if (spd > 30 && Math.random() < 0.4) {
              this.particles.push({ x: e.pos.x, y: e.pos.y, vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15, life: 0.25, maxLife: 0.25, color: 0xff8800, radius: 4 });
            }
            break;
          case 'pack':
            // Green motes floating upward
            if (Math.random() < 0.25) {
              this.particles.push({ x: e.pos.x + (Math.random()-0.5)*e.radius, y: e.pos.y + (Math.random()-0.5)*e.radius, vx: (Math.random()-0.5)*10, vy: -15 - Math.random()*15, life: 0.6, maxLife: 0.6, color: 0x33ff33, radius: 2 });
            }
            break;
          case 'lurker':
            // Dark mist
            if (Math.random() < 0.35) {
              this.particles.push({ x: e.pos.x + (Math.random()-0.5)*e.radius*2, y: e.pos.y + (Math.random()-0.5)*e.radius*2, vx: (Math.random()-0.5)*8, vy: (Math.random()-0.5)*8, life: 0.8, maxLife: 0.8, color: 0x440066, radius: 5 + Math.random()*3 });
            }
            break;
          case 'burst':
            // Yellow sparks when dashing
            if (e.burstActive && spd > 40) {
              for (let i = 0; i < 2; i++) {
                this.particles.push({ x: e.pos.x + (Math.random()-0.5)*8, y: e.pos.y + (Math.random()-0.5)*8, vx: (Math.random()-0.5)*50, vy: (Math.random()-0.5)*50, life: 0.2, maxLife: 0.2, color: 0xffee00, radius: 3 + Math.random()*2 });
              }
            }
            break;
          case 'strafe':
            // Cyan smoke arc
            if (spd > 20 && Math.random() < 0.45) {
              this.particles.push({ x: e.pos.x + (Math.random()-0.5)*e.radius, y: e.pos.y + (Math.random()-0.5)*e.radius, vx: -e.vel.x*0.1, vy: -e.vel.y*0.1, life: 0.3, maxLife: 0.3, color: 0x00ccff, radius: 3 });
            }
            break;
          case 'elite':
            // Bright trail during long-range charge (phase 31)
            if ((e.phase as number) === 31) {
              for (let i = 0; i < 4; i++) {
                this.particles.push({ x: e.pos.x + (Math.random()-0.5)*e.radius, y: e.pos.y + (Math.random()-0.5)*e.radius, vx: -e.vel.x*0.08 + (Math.random()-0.5)*30, vy: -e.vel.y*0.08 + (Math.random()-0.5)*30, life: 0.2, maxLife: 0.2, color: 0xffcc00, radius: 5 + Math.random()*4 });
              }
            }
            break;
        }
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    // Biome ambient particles
    this.biomeParticleTimer -= dt;
    if (this.biomeParticleTimer <= 0 && this.particles.length < 600) {
      this.biomeParticleTimer = 0.05;
      const biome = this.map.getBiome(this.player.pos.x, this.player.pos.y);
      const px = this.player.pos.x, py = this.player.pos.y;
      if (biome === 'cave') {
        for (let i = 0; i < 4; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 80 + Math.random() * 120;
          this.particles.push({ x: px + Math.cos(angle)*dist, y: py + Math.sin(angle)*dist, vx: (Math.random()-0.5)*5, vy: (Math.random()-0.5)*5, life: 2.0, maxLife: 2.0, color: 0x110033, radius: 6 + Math.random()*4 });
        }
      } else if (biome === 'void_pool') {
        for (let i = 0; i < 3; i++) {
          this.particles.push({ x: px + (Math.random()-0.5)*200, y: py + 80 + Math.random()*80, vx: (Math.random()-0.5)*10, vy: -20 - Math.random()*25, life: 1.5, maxLife: 1.5, color: 0x6600aa, radius: 3 + Math.random()*3 });
        }
      } else if (biome === 'river_bank') {
        for (let i = 0; i < 2; i++) {
          this.particles.push({ x: px + (Math.random()-0.5)*150, y: py + (Math.random()-0.5)*150, vx: (Math.random()-0.5)*12, vy: -8 - Math.random()*10, life: 1.2, maxLife: 1.2, color: 0x2244ff, radius: 2 + Math.random()*2 });
        }
      }
    }

    // Enemy runtime: affixes + kit perks
    for (const e of this.enemies.enemies) {
      if (e.hp <= 0) continue;
      // Marked timer decay
      if (e.markedTimer > 0) e.markedTimer -= dt;
      // Parasite DoT (dart void mutation) — 2 dmg/s
      if (e.parasiteTimer > 0) {
        e.parasiteTimer -= dt;
        e.hp -= 2 * dt;
        e.hitFlash = Math.max(e.hitFlash, 0.04);
        if (e.hp <= 0) { this.onEnemyKilled(e); continue; }
        // Restore meleeDmg when parasite expires (void_latch)
        if (e.parasiteTimer <= 0 && this.voidLatchOriginalDamage.has(e.id)) {
          e.meleeDmg = this.voidLatchOriginalDamage.get(e.id)!;
          this.voidLatchOriginalDamage.delete(e.id);
        }
      }
      // Fragile State perk: when stun ends, mark for 2x damage 1s
      if (this.hasPerk('fragile_state') && e.stunTimer > 0 && e.stunTimer - dt <= 0) {
        e.markedTimer = 1.0;
        e.markedDmgBonus = 2.0;
      }
      // Drag perk: pull stunned enemies toward player 20px/s
      if (this.hasPerk('drag') && e.stunTimer > 0 && !e.isAlly) {
        const dragD = v2dist(e.pos, this.player.pos);
        if (dragD > 20) {
          const dragDir = v2norm(v2sub(this.player.pos, e.pos));
          e.pos.x += dragDir.x * 20 * dt;
          e.pos.y += dragDir.y * 20 * dt;
        }
      }
      // sp_corrupt mastery: chain rifle void slowed enemies take 3 dmg/s corruption DoT
      if (this.hasMod('sp_corrupt') && this.player.weaponId === 'chain_rifle' && this.player.mutated === 'void' && !e.isAlly) {
        const _baseSpd2 = CREATURE_DEFS[e.name]?.speed ?? e.speed;
        if (e.speed < _baseSpd2 * 0.95) {
          e.hp -= 3 * dt;
          e.hitFlash = Math.max(e.hitFlash, 0.05);
          if (e.hp <= 0) this.onEnemyKilled(e);
        }
      }
      // Skip affix processing for non-elites
      if (e.affixes.length === 0) continue;
      // Teleporter: blink toward player every 8s
      if (e.affixes.includes('teleporter')) {
        e.tpTimer -= dt;
        if (e.tpTimer <= 0) {
          e.tpTimer = 8;
          const dir = v2norm(v2sub(this.player.pos, e.pos));
          e.pos.x = this.player.pos.x - dir.x * 100;
          e.pos.y = this.player.pos.y - dir.y * 100;
          this.explosions.push({ x: e.pos.x, y: e.pos.y, radius: 0, maxRadius: 30, life: 0.2, maxLife: 0.2 });
        }
      }
      // Magnetic: pull player toward elite
      if (e.affixes.includes('magnetic')) {
        const md = v2dist(this.player.pos, e.pos);
        if (md < 300 && md > 5) {
          const pullDir = v2norm(v2sub(e.pos, this.player.pos));
          this.player.pos.x += pullDir.x * 30 * dt;
          this.player.pos.y += pullDir.y * 30 * dt;
        }
      }
      // Berserker: +50% speed and damage below 30% HP
      if (e.affixes.includes('berserker') && e.hp / e.maxHp < 0.3) {
        if (CREATURE_DEFS[e.name]) {
          e.speed = Math.max(e.speed, (CREATURE_DEFS[e.name]?.speed ?? e.speed) * 1.5);
        }
      }
    }

    // Elite special attacks handled inside 'elite' behavior case in Enemies.ts

    // ── Payload escort: enemies damage pod ──
    if (this.contractType === 'payload_escort' && this.podHp > 0) {
      const { x: podX, y: podY } = this.getPodPos();
      for (const e of this.enemies.enemies) {
        if (!e.isAggroed) continue;
        const distToPod = v2dist(e.pos, { x: podX, y: podY });
        if (distToPod < 60 + e.radius && e.meleeCooldown <= 0) {
          this.podHp -= e.meleeDmg;
          e.meleeCooldown = 1.5;
        }
      }
      // Enemy bullets also damage pod
      for (let i = this.enemies.enemyBullets.length - 1; i >= 0; i--) {
        const b = this.enemies.enemyBullets[i];
        if (v2dist(b.pos, { x: podX, y: podY }) < 25 + b.radius) {
          this.podHp -= b.damage;
          this.enemies.enemyBullets.splice(i, 1);
        }
      }
    }

    // Player bullets update
    this.weapons.update(dt, this.enemies.enemies.map(e => ({ pos: e.pos, id: e.id })));

    this.bulletSystem.processHits(dt, this);

    this.kitSystem.update(dt, this);

    this.contractObjectives.update(dt, this);

    // Dynamic map
    this.map.drawDynamic(this.dynamicGfx, this.elapsed, this.player.pos.x, this.player.pos.y);

    // Biome screen-space vignette
    this.drawBiomeVignette();

    // Update sprites
    this.updateSprites();
    this.cleanupDeadSprites();

    // Draw entity overlays
    this.drawEntities();
    this.bulletSystem.draw(this.bulletGfx, this);

    // Update camera on world layer (with screen shake)
    const shakeX = this.shakeTimer > 0 ? (Math.random() - 0.5) * this.shakeAmt * 2 : 0;
    const shakeY = this.shakeTimer > 0 ? (Math.random() - 0.5) * this.shakeAmt * 2 : 0;
    this.worldLayer.x = -this.camera.x + shakeX;
    this.worldLayer.y = -this.camera.y + shakeY;

    // HUD
    this.hud.draw(this.player, dt, this.totalKills, this.elapsed, this.equippedKits, this.kitCooldowns, this.screenFlash);
  }

  onEnemyKilled(enemy: Enemy) {
    this.progression.onEnemyKilled(enemy, this);
  }


  updateApexBoss(dt: number) {
    const apex = this.enemies.enemies.find(e => e.id === this.apexId);
    if (!apex || apex.hp <= 0) return;

    const hpFrac = apex.hp / apex.maxHp;
    const newPhase = hpFrac > 0.6 ? 1 : hpFrac > 0.3 ? 2 : 3;

    // Phase transition
    if (newPhase > this.apexPhase) {
      this.apexPhase = newPhase;
      this.apexPhaseTransitionTimer = 1.0;
      this.shakeTimer = 0.6;
      this.shakeAmt = 10;
      this.screenFlash = 0.7;
      this.apexAttackTimer = 3;
      const phaseNames = ['', 'PHASE 2: UNLEASHED', 'PHASE 3: VOID FORM'];
      this.hud.showMessage(phaseNames[newPhase - 1] ?? `PHASE ${newPhase}`, 3);
      // Phase 3: spawn 1 elite minion
      if (newPhase === 3) {
        this.spawnManager.spawnElite(this);
        this.apexInstabilityTimer = 4;
      }
    }

    // Phase transition invulnerability
    if (this.apexPhaseTransitionTimer > 0) {
      this.apexPhaseTransitionTimer -= dt;
      return; // skip attacks during transition
    }

    // Phase 2+: speed boost
    if (this.apexPhase >= 2) {
      apex.speed = 143; // 110 * 1.3
    }

    // Phase 2+: periodic shield (5s every 30s)
    if (this.apexPhase >= 2) {
      this.apexShieldTimer -= dt;
      if (this.apexShieldTimer <= 0 && !this.apexShieldActive) {
        this.apexShieldActive = true;
        this.apexShieldDuration = 5.0;
        this.apexShieldTimer = 30;
        this.hud.showMessage('APEX SHIELDED', 1.5);
      }
      if (this.apexShieldActive) {
        this.apexShieldDuration -= dt;
        if (this.apexShieldDuration <= 0) this.apexShieldActive = false;
      }
    }

    // Pack spawning
    const packInterval = this.apexPhase >= 2 ? 20 : 25;
    this.apexPackTimer -= dt;
    if (this.apexPackTimer <= 0) {
      this.apexPackTimer = packInterval;
      const count = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 80 + Math.random() * 120;
        const spawnPos = {
          x: Math.max(100, Math.min(WORLD_W - 100, apex.pos.x + Math.cos(angle) * dist)),
          y: Math.max(100, Math.min(WORLD_H - 100, apex.pos.y + Math.sin(angle) * dist)),
        };
        const mob = createEnemy('Void Leech', spawnPos, true);
        mob.hp = 8; mob.maxHp = 8;
        this.enemies.enemies.push(mob);
      }
    }

    // Phase 3: gravity pull toward apex
    if (this.apexPhase >= 3) {
      const toApex = v2norm(v2sub(apex.pos, this.player.pos));
      this.player.pos.x += toApex.x * 25 * dt;
      this.player.pos.y += toApex.y * 25 * dt;

      // Spawn instability corruption zones around arena
      this.apexInstabilityTimer -= dt;
      if (this.apexInstabilityTimer <= 0) {
        this.apexInstabilityTimer = 4 + Math.random() * 3;
        const angle = Math.random() * Math.PI * 2;
        const dist = 120 + Math.random() * 220;
        this.instabilityZones.push({
          x: apex.pos.x + Math.cos(angle) * dist,
          y: apex.pos.y + Math.sin(angle) * dist,
          timer: 14, maxTimer: 14, radius: 80,
        });
      }
    }

    // Attack timer
    const cdMult = this.apexPhase >= 3 ? 0.6 : 1.0;
    this.apexAttackTimer -= dt;
    if (this.apexAttackTimer > 0) return;

    // Choose attack based on phase cycle
    let attack: 'charge' | 'slam' | 'ring';
    if (this.apexPhase === 1) {
      attack = apex.eliteAttackCycle % 2 === 0 ? 'charge' : 'slam';
    } else {
      const cycle = apex.eliteAttackCycle % 3;
      attack = cycle === 0 ? 'charge' : cycle === 1 ? 'slam' : 'ring';
    }
    apex.eliteAttackCycle++;

    if (attack === 'charge') {
      // Reuse elite charge wind-up: phase 30
      apex.phase = 30;
      apex.phaseTimer = 0.7;
      apex.aggroOrigin = { x: this.player.pos.x, y: this.player.pos.y };
      apex.lockAngle = Math.atan2(this.player.pos.y - apex.pos.y, this.player.pos.x - apex.pos.x);
    } else if (attack === 'slam') {
      // AOE slam: reuse elite phase 10 (charge-up)
      apex.phase = 10;
      apex.phaseTimer = 0.8;
    } else if (attack === 'ring') {
      // Ring of 8 projectiles
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        this.enemies.enemyBullets.push({
          pos: { x: apex.pos.x, y: apex.pos.y },
          vel: v2fromAngle(angle, 190),
          radius: 7,
          damage: 3,
          life: 2.5,
          color: 0xff3300,
        });
      }
      this.hud.showMessage('VOID RING!', 1.2);
    }

    const baseCd = 5;
    this.apexAttackTimer = baseCd * cdMult;
  }


  private updateSprites() {
    const isMoving = Math.abs(this.player.vel.x) > 5 || Math.abs(this.player.vel.y) > 5;

    // Player sprite
    if (this.playerSprite) {
      this.playerSprite.x = this.player.pos.x;
      this.playerSprite.y = this.player.pos.y;
      this.playerSprite.alpha = this.player.iFrames > 0 ? 0.4 : 1;
      this.playerSprite.rotation = 0;

      let dir: string;
      if (isMoving) {
        dir = angleTo8Dir(this.player.vel.x, this.player.vel.y);
      } else if (this.player.nearestEnemyPos) {
        dir = angleTo8Dir(this.player.nearestEnemyPos.x - this.player.pos.x, this.player.nearestEnemyPos.y - this.player.pos.y);
      } else {
        dir = 'south';
      }

      if (isMoving) {
        const animTex = this.textures[`player/anim/${dir}/${this.animFrame % 6}`];
        if (animTex) this.playerSprite.texture = animTex;
        else {
          const still = this.textures[`player/${dir}`];
          if (still) this.playerSprite.texture = still;
        }
      } else {
        const still = this.textures[`player/${dir}`];
        if (still) this.playerSprite.texture = still;
      }
      this.playerSprite.tint = this.player.hitFlash > 0 ? 0xff2200 : 0xffffff;
    }

    // Behavior tints for sprites (subtle: 30% toward behavior color)
    const SPRITE_BEHAVIOR_TINTS: Record<string, number> = {
      charge: 0xFF3333, flank: 0xFF8800, pack: 0x33FF33,
      lurker: 0xAA44FF, burst: 0xFFFF00, strafe: 0x00FFFF,
    };

    // Enemy sprites
    for (const e of this.enemies.enemies) {
      const spr = this.getOrCreateEnemySprite(e);
      if (!spr) continue;
      spr.x = e.pos.x;
      spr.y = e.pos.y;
      spr.visible = this.camera.isVisible(e.pos.x, e.pos.y, e.radius * 2);
      const rawTint = e.isAlly ? 0x33ffaa : (SPRITE_BEHAVIOR_TINTS[e.behavior] ?? 0xffffff);
      const behaviorTint = subtleTint(rawTint, e.isAlly ? 0.65 : 0.3);
      spr.tint = e.hitFlash > 0 ? 0xff4444 : behaviorTint;

      if (!e.isAlly) spr.scale.set(1);

      // Lurker: semi-transparent + flicker every 2s
      if (e.isAlly) {
        spr.alpha = 0.95;
        spr.scale.set(1.15);
      } else if (e.behavior === 'lurker') {
        const lurkerDormant = (e.phase as number) === 0;
        const flicker = Math.floor(this.elapsed / 2) % 2 === 0 ? 1.0 : 0.6;
        spr.alpha = lurkerDormant ? 0.3 * flicker : 0.5 * flicker;
      } else {
        spr.alpha = 1;
      }

      // Scale up apex enemy sprite
      if (e.id === this.apexId) {
        spr.scale.set(3.5);
        const apexAuraColor = this.apexPhase === 3 ? 0x9900cc : this.apexPhase === 2 ? 0xff8800 : 0xff3300;
        spr.tint = e.hitFlash > 0 ? 0xff4444 : subtleTint(apexAuraColor, 0.3);
        spr.alpha = this.apexPhaseTransitionTimer > 0 ? 0.5 + Math.sin(this.elapsed * 20) * 0.5 : 1;
      }

      const eMoving = Math.abs(e.vel.x) > 3 || Math.abs(e.vel.y) > 3;
      const texBase = CREATURE_SPRITE_MAP[e.name];
      if (texBase && eMoving) {
        const dir = angleTo8Dir(e.vel.x, e.vel.y);
        const animTex = this.textures[`${texBase}/anim/${dir}/${this.animFrame % 4}`];
        if (animTex) spr.texture = animTex;
      }
    }
  }

  private drawBiomeVignette() {
    // Disabled: vignette rendering was blacking out the entire screen.
    // TODO: fix fill-then-cut layering before re-enabling.
    this.biomeGfx.clear();
  }

  private drawEntities() {
    const g = this.entityGfx;
    g.clear();
    const px = this.player.pos.x, py = this.player.pos.y, pr = this.player.radius;
    const pAlpha = this.player.iFrames > 0 ? 0.4 : 1;
    const hit = this.player.hitFlash > 0;

    this.contractObjectives.draw(g, this, px, py);

    // Player glow ring
    g.circle(px, py, pr * 2.2).fill({ color: 0x0066aa, alpha: 0.06 * pAlpha });
    g.circle(px, py, pr * 1.5).stroke({ color: 0x00aaff, width: 1, alpha: 0.2 * pAlpha });

    // Geometric fallback only if no sprite
    if (!this.playerSprite) {
      const d = pr * 0.9;
      g.moveTo(px, py - d).lineTo(px + d, py).lineTo(px, py + d).lineTo(px - d, py).closePath();
      g.fill({ color: hit ? 0xff2200 : 0x00ccff, alpha: 0.7 * pAlpha });
      g.moveTo(px, py - d).lineTo(px + d, py).lineTo(px, py + d).lineTo(px - d, py).closePath();
      g.stroke({ color: hit ? 0xff4400 : 0x44eeff, width: 2, alpha: pAlpha });
      g.circle(px, py, 3).fill({ color: 0xffffff, alpha: 0.9 * pAlpha });
    }

    // Aim line
    if (this.player.nearestEnemyPos) {
      const dist = 50;
      const ax = px + Math.cos(this.player.aimAngle) * dist;
      const ay = py + Math.sin(this.player.aimAngle) * dist;
      g.moveTo(px, py).lineTo(ax, ay).stroke({ color: 0xff2200, width: 1, alpha: 0.4 });
      g.circle(ax, ay, 4).stroke({ color: 0xff2200, width: 1, alpha: 0.6 });
    }

    // Elite charge warning: pulsing target marker at locked position (phase 30 = wind-up)
    for (const e of this.enemies.enemies) {
      if (!e.isElite || (e.phase as number) !== 30) continue;
      const wx = e.aggroOrigin.x, wy = e.aggroOrigin.y;
      if (!this.camera.isVisible(wx, wy, 80)) continue;
      const pulse = 0.4 + Math.abs(Math.sin(e.phaseTimer * 8)) * 0.6;
      g.circle(wx, wy, 60).stroke({ color: 0xff2200, width: 3, alpha: pulse });
      g.circle(wx, wy, 40).stroke({ color: 0xff6600, width: 2, alpha: pulse * 0.7 });
      g.circle(wx, wy, 15).fill({ color: 0xff2200, alpha: pulse * 0.25 });
    }
    // Scorch marks left after elite charge impact
    for (const mark of this.scorchMarks) {
      if (!this.camera.isVisible(mark.x, mark.y, 80)) continue;
      const alpha = (mark.life / mark.maxLife) * 0.45;
      g.circle(mark.x, mark.y, 80).fill({ color: 0x220000, alpha });
      g.circle(mark.x, mark.y, 60).stroke({ color: 0xff4400, width: 2, alpha: alpha * 0.8 });
    }

    // Enemies
    for (const e of this.enemies.enemies) {
      if (!this.camera.isVisible(e.pos.x, e.pos.y, e.radius * 2)) continue;
      const ex = e.pos.x, ey = e.pos.y;
      // Behavior-based radius scaling
      const erBase = e.radius * 1.5;
      const er = e.behavior === 'charge' ? erBase * 1.2 : e.behavior === 'pack' ? erBase * 0.85 : erBase;
      // Behavior-based color override
      const bColor = BEHAVIOR_COLORS[e.behavior] ?? e.color;
      const col = e.hitFlash > 0 ? 0xffffff : bColor;
      const isVoid = e.voidType;
      const hasSprite = this.spritePool.has(e.id);
      // Lurker: semi-transparent (0.5) + flicker every 2s; fully dormant at 0.3
      const lurkerDormant = e.behavior === 'lurker' && (e.phase as number) === 0;
      const lurkerFlicker = e.behavior === 'lurker' ? (Math.floor(this.elapsed / 2) % 2 === 0 ? 1.0 : 0.6) : 1.0;
      const sa = lurkerDormant ? 0.3 * lurkerFlicker : e.behavior === 'lurker' ? 0.5 * lurkerFlicker : 1.0;

      if (e.isAggroed) {
        g.circle(ex, ey, er * 1.6).stroke({ color: col, width: 1.5, alpha: 0.35 * sa });
      }

      if (!hasSprite) {
        if (e.behavior === 'charge') {
          g.moveTo(ex, ey - er).lineTo(ex + er * 0.87, ey + er * 0.5).lineTo(ex - er * 0.87, ey + er * 0.5).closePath();
          g.fill({ color: col, alpha: 0.6 * sa });
          g.moveTo(ex, ey - er).lineTo(ex + er * 0.87, ey + er * 0.5).lineTo(ex - er * 0.87, ey + er * 0.5).closePath();
          g.stroke({ color: col, width: 1.5, alpha: 0.9 * sa });
        } else if (e.behavior === 'pack') {
          g.moveTo(ex, ey - er).lineTo(ex + er * 0.87, ey + er * 0.5).lineTo(ex - er * 0.87, ey + er * 0.5).closePath();
          g.fill({ color: col, alpha: 0.6 * sa });
          g.moveTo(ex, ey - er).lineTo(ex + er * 0.87, ey + er * 0.5).lineTo(ex - er * 0.87, ey + er * 0.5).closePath();
          g.stroke({ color: col, width: 1.5, alpha: 0.9 * sa });
          // Draw thin lines to nearby pack members
          for (const other of this.enemies.enemies) {
            if (other !== e && other.hp > 0 && other.behavior === 'pack' && v2dist(e.pos, other.pos) < 200) {
              g.moveTo(ex, ey).lineTo(other.pos.x, other.pos.y).stroke({ color: 0x33ff33, width: 0.5, alpha: 0.3 });
            }
          }
        } else if (e.behavior === 'strafe' || e.behavior === 'patrol_river') {
          for (let i = 0; i < 6; i++) {
            const a1 = (i / 6) * Math.PI * 2 - Math.PI / 2;
            const a2 = ((i + 1) / 6) * Math.PI * 2 - Math.PI / 2;
            if (i === 0) g.moveTo(ex + Math.cos(a1) * er, ey + Math.sin(a1) * er);
            g.lineTo(ex + Math.cos(a2) * er, ey + Math.sin(a2) * er);
          }
          g.closePath().fill({ color: col, alpha: 0.4 * sa });
          for (let i = 0; i < 6; i++) {
            const a1 = (i / 6) * Math.PI * 2 - Math.PI / 2;
            const a2 = ((i + 1) / 6) * Math.PI * 2 - Math.PI / 2;
            if (i === 0) g.moveTo(ex + Math.cos(a1) * er, ey + Math.sin(a1) * er);
            g.lineTo(ex + Math.cos(a2) * er, ey + Math.sin(a2) * er);
          }
          g.closePath().stroke({ color: col, width: 1.5, alpha: 0.8 * sa });
        } else if (e.behavior === 'lurker') {
          g.moveTo(ex - er, ey - er).lineTo(ex + er, ey + er).stroke({ color: col, width: 3, alpha: 0.7 * sa });
          g.moveTo(ex + er, ey - er).lineTo(ex - er, ey + er).stroke({ color: col, width: 3, alpha: 0.7 * sa });
        } else {
          g.rect(ex - er * 0.7, ey - er * 0.7, er * 1.4, er * 1.4).fill({ color: col, alpha: 0.5 * sa });
          g.rect(ex - er * 0.7, ey - er * 0.7, er * 1.4, er * 1.4).stroke({ color: col, width: 1.5, alpha: 0.8 * sa });
        }
      }

      // Glow ring for sprite enemies — makes behavior color obvious
      if (hasSprite) {
        g.circle(ex, ey, er * 1.2).fill({ color: bColor, alpha: 0.18 * sa });
        g.circle(ex, ey, er * 1.2).stroke({ color: bColor, width: 2.5, alpha: 0.65 * sa });
        // Pack link lines (only needed here for sprite enemies — no-sprite already has them)
        if (e.behavior === 'pack') {
          for (const other of this.enemies.enemies) {
            if (other !== e && other.hp > 0 && other.behavior === 'pack' && v2dist(e.pos, other.pos) < 200) {
              g.moveTo(ex, ey).lineTo(other.pos.x, other.pos.y).stroke({ color: 0x33ff33, width: 1, alpha: 0.4 });
            }
          }
        }
      }

      if (isVoid) {
        g.circle(ex, ey, er * 0.4).fill({ color: 0xff2200, alpha: 0.5 + Math.sin(this.elapsed * 4) * 0.2 });
      }

      // Stunned: white sparkling ring
      if (e.stunTimer > 0) {
        const stunAlpha = 0.5 + Math.sin(this.elapsed * 12) * 0.3;
        g.circle(ex, ey, er * 1.7).stroke({ color: 0xffffff, width: 2.5, alpha: stunAlpha });
        g.circle(ex, ey, er * 1.3).stroke({ color: 0xbbccff, width: 1, alpha: stunAlpha * 0.6 });
      }

      // Pack member link lines already drawn above in shape block
      // Elite: pulsing glow ring using original creature color
      if (e.isElite) {
        const pulseAlpha = 0.3 + Math.sin(this.elapsed * 3) * 0.2;
        const eliteGlowColor = e.id === this.apexId
          ? (this.apexPhase === 3 ? 0x9900cc : this.apexPhase === 2 ? 0xff8800 : 0xff3300)
          : e.color;
        g.circle(ex, ey, er * 2.0).stroke({ color: eliteGlowColor, width: e.id === this.apexId ? 4 : 3, alpha: pulseAlpha });
        g.circle(ex, ey, er * 2.4).stroke({ color: eliteGlowColor, width: 1, alpha: pulseAlpha * 0.4 });
        // Apex: extra large outer aura
        if (e.id === this.apexId) {
          g.circle(ex, ey, er * 3.2).stroke({ color: eliteGlowColor, width: 2, alpha: pulseAlpha * 0.25 });
          g.circle(ex, ey, er * 2.0).fill({ color: eliteGlowColor, alpha: 0.05 + Math.sin(this.elapsed * 2) * 0.02 });
          // Phase 2 shield visual
          if (this.apexShieldActive) {
            const shieldAlpha = 0.4 + Math.sin(this.elapsed * 10) * 0.3;
            g.circle(ex, ey, er * 2.8).stroke({ color: 0x44aaff, width: 3, alpha: shieldAlpha });
            g.circle(ex, ey, er * 2.8).fill({ color: 0x44aaff, alpha: 0.06 });
          }
        }

        // AOE Slam charge-up: expanding pulse ring
        if (e.phase === 10) {
          const chargeRatio = Math.max(0, 1 - e.phaseTimer / 0.8);
          const aoeR = chargeRatio * 120 + er;
          const pA = 0.35 + Math.sin(this.elapsed * 20) * 0.2;
          g.circle(ex, ey, aoeR).stroke({ color: 0xff6600, width: 3, alpha: pA });
          g.circle(ex, ey, aoeR * 0.5).fill({ color: 0xff6600, alpha: 0.12 * chargeRatio });
        }
        // AOE detonation flash
        if (e.phase === 11) {
          const flashA = e.phaseTimer / 0.2;
          g.circle(ex, ey, 120 + er).fill({ color: 0xff8800, alpha: 0.25 * flashA });
          g.circle(ex, ey, 120 + er).stroke({ color: 0xff6600, width: 4, alpha: 0.9 * flashA });
        }
        // Dash charge: preview trail line
        if (e.phase === 20) {
          const trailLen = 280;
          const tx = ex + Math.cos(e.lockAngle) * trailLen;
          const ty = ey + Math.sin(e.lockAngle) * trailLen;
          const ta = 0.2 + Math.sin(this.elapsed * 14) * 0.12;
          g.moveTo(ex, ey).lineTo(tx, ty).stroke({ color: 0xff3300, width: 4, alpha: ta });
          g.circle(tx, ty, 10).stroke({ color: 0xff3300, width: 2, alpha: ta + 0.15 });
        }
        // Dashing: speed trail
        if (e.phase === 21) {
          const trailBack = v2fromAngle(e.lockAngle + Math.PI, er * 3);
          g.moveTo(ex, ey).lineTo(ex + trailBack.x, ey + trailBack.y)
            .stroke({ color: 0xff6600, width: er * 2, alpha: 0.3 });
        }
      }

      if (e.hp < e.maxHp) {
        const bw = er * 2.5;
        const bh = 3;
        const bx = ex - bw / 2;
        const by = ey - er - 10;
        const frac = e.hp / e.maxHp;
        g.rect(bx, by, bw, bh).fill({ color: 0x110000, alpha: 0.8 });
        g.rect(bx, by, bw * frac, bh).fill({ color: e.id === this.apexId ? 0xff8000 : 0xff2200, alpha: 0.9 });
      }
    }

    // ── Drop capsules ──
    this.dropSystem.draw(g, this);

    // ── Scanner: all-enemy dots in minimap-style corners (level 3) ──
    const scannerLevel = this.shipUpgrades.scanner ?? 0;
    if (scannerLevel >= 3) {
      for (const e of this.enemies.enemies) {
        if (e.hp <= 0 || e.isAlly) continue;
        if (this.camera.isVisible(e.pos.x, e.pos.y, e.radius * 2)) continue;
        // tiny dot near edge in world space
        const dx = e.pos.x - this.player.pos.x;
        const dy = e.pos.y - this.player.pos.y;
        const ang = Math.atan2(dy, dx);
        const edgeDist = Math.min(this.camera.viewW, this.camera.viewH) * 0.47;
        const dotX = this.player.pos.x + Math.cos(ang) * edgeDist;
        const dotY = this.player.pos.y + Math.sin(ang) * edgeDist;
        const dc = e.isElite ? (e.color || 0xffdd11) : 0x888888;
        g.circle(dotX, dotY, 3).fill({ color: dc, alpha: 0.7 });
      }
    }

    // ── Ally drones ──
    for (const d of this.allyDrones) {
      if (!this.camera.isVisible(d.x, d.y, 20)) continue;
      const pulseA = 0.7 + Math.sin(this.elapsed * 5) * 0.3;
      g.circle(d.x, d.y, 10).fill({ color: 0xffdd00, alpha: 0.75 * pulseA });
      g.circle(d.x, d.y, 10).stroke({ color: 0xffffff, width: 1.5, alpha: 0.8 });
      g.circle(d.x, d.y, 14).stroke({ color: 0xffdd00, width: 1, alpha: 0.3 });
      // HP bar
      if (d.hp < d.maxHp) {
        const bw = 18;
        g.rect(d.x - bw / 2, d.y - 18, bw, 3).fill({ color: 0x110000, alpha: 0.8 });
        g.rect(d.x - bw / 2, d.y - 18, bw * (d.hp / d.maxHp), 3).fill({ color: 0xffdd00, alpha: 0.9 });
      }
    }

    // ── Boss HP bar (screen-space via camera offset) ──
    if (this.contractType === 'boss_hunt' && this.apexSpawned) {
      const apex = this.enemies.enemies.find(e => e.id === this.apexId);
      if (apex) {
        const barW = Math.min(this.camera.viewW * 0.6, 360);
        const barH = 14;
        const bx = this.camera.x + (this.camera.viewW - barW) / 2;
        const by = this.camera.y + 10;
        const frac = Math.max(0, apex.hp / apex.maxHp);
        const barColor = this.apexPhase === 3 ? 0x9900cc : this.apexPhase === 2 ? 0xff8800 : 0xff3300;
        g.rect(bx, by, barW, barH).fill({ color: 0x110000, alpha: 0.85 });
        g.rect(bx, by, barW * frac, barH).fill({ color: barColor, alpha: 0.9 });
        g.rect(bx, by, barW, barH).stroke({ color: barColor, width: 1, alpha: 0.5 });
        // Phase markers
        for (const pct of [0.6, 0.3]) {
          const mx = bx + barW * pct;
          g.moveTo(mx, by).lineTo(mx, by + barH).stroke({ color: 0xffffff, width: 1.5, alpha: 0.6 });
        }
        // Shield glow
        if (this.apexShieldActive) {
          g.rect(bx, by, barW, barH).stroke({ color: 0x44aaff, width: 3, alpha: 0.7 + Math.sin(this.elapsed * 8) * 0.3 });
        }
        // Name label above bar
        const labelX = this.camera.x + this.camera.viewW / 2;
        const labelY = this.camera.y + 10 + barH + 4;
        // Draw small text indicator using a rect as placeholder (text is in HUD layer)
        const ph = this.apexPhase;
        const phaseColors = [0, 0xff3300, 0xff8800, 0x9900cc];
        g.circle(labelX, labelY + 4, 4).fill({ color: phaseColors[ph] ?? 0xff3300, alpha: 0.8 + Math.sin(this.elapsed * 3) * 0.2 });
      }
    }

    // Screen-edge arrows for off-screen elites
    const camLeft = this.camera.x, camRight = this.camera.x + this.camera.viewW;
    const camTop = this.camera.y, camBottom = this.camera.y + this.camera.viewH;
    for (const e of this.enemies.enemies) {
      if (!e.isElite || e.hp <= 0) continue;
      if (e.pos.x >= camLeft && e.pos.x <= camRight && e.pos.y >= camTop && e.pos.y <= camBottom) continue;
      // Off-screen: draw arrow on screen edge
      const dx = e.pos.x - this.player.pos.x;
      const dy = e.pos.y - this.player.pos.y;
      const angle = Math.atan2(dy, dx);
      const edgeDist = Math.min(this.camera.viewW, this.camera.viewH) * 0.42;
      const arrowX = this.player.pos.x + Math.cos(angle) * edgeDist;
      const arrowY = this.player.pos.y + Math.sin(angle) * edgeDist;
      const sz = 10;
      const pulseA = 0.7 + Math.sin(this.elapsed * 4) * 0.3;
      g.moveTo(arrowX + Math.cos(angle) * sz, arrowY + Math.sin(angle) * sz)
        .lineTo(arrowX + Math.cos(angle + 2.4) * sz, arrowY + Math.sin(angle + 2.4) * sz)
        .lineTo(arrowX + Math.cos(angle - 2.4) * sz, arrowY + Math.sin(angle - 2.4) * sz)
        .closePath().fill({ color: e.color || 0xffdd11, alpha: pulseA });
      g.circle(arrowX, arrowY, sz * 1.5).stroke({ color: e.color || 0xffdd11, width: 1.5, alpha: pulseA * 0.4 });
    }
  }

  /** Build current progression state snapshot for upgrade generation */
  private getProgressionState(): ProgressionState {
    return this.progression.getProgressionState(this);
  }

  /** Pause game and show 3-slot upgrade panel */
  private offerUpgradePanel() {
    const state = this.getProgressionState();
    const choices = generateUpgrades(state);
    // Sync back kitT3Pending (generateUpgrades may have pushed new entries)
    this.kitT3Pending = state.kitT3Pending;
    if (choices.length === 0) return;
    this.upgradePending = true;
    this.paused = true;
    this.callbacks.onUpgradePick(choices, (picked) => {
      this.applyUpgrade(picked);
      this.upgradePending = false;
      this.paused = false;
    });
  }

  /** Process pending kit T3 path choices */
  private processKitT3Choice() {
    if (this.kitT3Pending.length === 0) return;
    const kitId = this.kitT3Pending.shift()!;
    const kdef = KIT_DEFS[kitId];
    this.kitT3ChoicePending = true;
    this.paused = true;
    this.callbacks.onKitT3Choice(kitId, kdef?.name ?? kitId, (path) => {
      this.runKitTiers[kitId] = 3;
      this.player.maxHp += 1;
      this.player.hp = Math.min(this.player.hp + 1, this.player.maxHp);
      this.hud.showMessage(`${(kdef?.name ?? kitId).toUpperCase()} T3 — ${path.toUpperCase()} PATH`, 2);
      this.kitT3ChoicePending = false;
      this.paused = false;
    });
  }

  /** Apply a picked upgrade card */
  private applyUpgrade(card: UpgradeCard) {
    this.progression.applyUpgrade(card, this);
  }

  /** Apply instant stat changes for mastery perks when picked */
  private applyMasteryPerk(id: string) {
    this.progression.applyMasteryPerk(id, this);
  }

  /** Check if a modifier is active */
  hasMod(id: string): boolean {
    return this.activeModifiers.includes(id);
  }

  /** Check if a kit perk is taken */
  hasPerk(id: string): boolean {
    return this.kitPerksTaken.includes(id);
  }

  /** Get damage multiplier from active modifiers */
  getModDamageMult(enemy: { isElite?: boolean; targetingPlayer?: boolean; pos?: { x: number; y: number }; markedTimer?: number; markedDmgBonus?: number }): number {
    let mult = 1;
    // Combat Training: +3% damage per level
    const combatLevel = this.shipUpgrades.combat_training ?? 0;
    if (combatLevel > 0) mult *= 1 + combatLevel * 0.03;
    // Damage Burst pickup: +50% damage for 8s
    if (this.damageBurstTimer > 0) mult *= 1.5;
    // Blink T3 clean: empowered shot 3x
    if (this.blinkEmpowered) {
      mult *= 3;
      this.blinkEmpowered = false;
    }
    // Crush Zone perk: 2x damage to enemies in gravity well
    if (this.hasPerk('crush_zone') && enemy.pos) {
      for (const gw of this.gravityWells) {
        if (v2dist(enemy.pos, { x: gw.x, y: gw.y }) < gw.radius) {
          mult *= 2;
          break;
        }
      }
    }
    // Marked damage bonus (from spotter, chain T3, etc.)
    if (enemy.markedTimer && enemy.markedTimer > 0 && enemy.markedDmgBonus) {
      mult *= enemy.markedDmgBonus;
    }
    if (this.familiarDmgTimer > 0) mult *= 1.25;
    if (this.hasMod('elite_dmg') && enemy.isElite) mult *= 1.3;
    if (this.hasMod('stalker') && !enemy.targetingPlayer) mult *= 1.4;
    if (this.hasMod('pack_hunter')) {
      const nearby = this.enemies.enemies.filter(e => v2dist(this.player.pos, e.pos) < 200).length;
      mult *= 1 + nearby * 0.08;
    }
    if (this.hasMod('last_stand') && this.player.hp < 3) mult *= 1.5;
    if (this.hasMod('precision') && this.player.justReloaded) mult *= 2;
    if (this.hasMod('momentum')) mult *= 1 + this.momentumHits * 0.15;
    return mult;
  }

  /** Get speed multiplier from active modifiers */
  getFamiliarBuffColor(behavior: string): number {
    switch (behavior) {
      case 'charge': case 'burst': return 0x00ff44;   // green - heal
      case 'pack': return 0xffee00;                    // yellow - speed
      case 'flank': case 'strafe': return 0xff3333;   // red - damage
      case 'lurker': return 0x3366ff;                  // blue - shield
      case 'elite': return 0xaa33ff;                   // purple - corruption
      default: return 0x00ff44;                        // green - default heal
    }
  }

  applyFamiliarBuff(behavior: string, durationMult: number) {
    switch (behavior) {
      case 'charge': case 'burst':
        this.player.heal(2);
        this.hud.showMessage('+2 HP', 1.5);
        break;
      case 'pack':
        this.familiarSpeedTimer = 4 * durationMult;
        this.hud.showMessage('+SPEED 4s', 1.5);
        break;
      case 'flank': case 'strafe':
        this.familiarDmgTimer = 5 * durationMult;
        this.hud.showMessage('+25% DMG 5s', 1.5);
        break;
      case 'lurker':
        this.player.shieldHits = 3;
        this.hud.showMessage('SHIELD x3', 1.5);
        break;
      case 'elite':
        this.player.corruption = Math.max(0, this.player.corruption - 15);
        this.hud.showMessage('-15 CORRUPTION', 1.5);
        break;
      default:
        this.player.heal(1);
        this.hud.showMessage('+1 HP', 1.5);
    }
  }

  getModSpeedMult(): number {
    let mult = 1;
    if (this.hasMod('last_stand') && this.player.hp < 3) mult *= 1.3;
    if (this.hasMod('adrenaline')) mult *= 1 + this.adrenalineStacks * 0.05;
    // Speed Boost pickup: +40% speed for 10s
    if (this.speedBoostTimer > 0) mult *= 1.4;
    return mult;
  }

  finishHunt(status: 'COMPLETED' | 'FAILED' | 'ABANDONED') {
    // Use contract reward; failed/abandoned gives 20% salvage
    let credits = status === 'COMPLETED'
      ? this.contractReward
      : Math.floor(this.contractReward * 0.2);

    // Par time exceeded: halve reward
    if (this.contractParTime > 0 && this.elapsed > this.contractParTime) {
      credits = Math.floor(credits * 0.5);
    }

    // Hunt diff ≥ 4 COMPLETED: grant +1 Elite Core
    if (status === 'COMPLETED' && this.contractType === 'hunt' && this.contractDifficulty >= 4) {
      this.ingredients.push({ id: 'ingredient_elite_core', name: 'Elite Core' });
    }

    this.callbacks.onHuntResult({
      credits,
      corruption: Math.floor(this.player.corruption),
      timeSurvived: this.elapsed,
      totalKills: this.totalKills,
      eliteKills: this.eliteKills,
      apexKills: this.apexKills,
      peakCorruption: this.peakCorruption,
      damageDealt: this.damageDealt,
      damageTaken: this.damageTaken,
      ingredients: this.ingredients,
    });
  }

  destroy() {
    this.app.stage.removeChild(this.worldLayer);
    this.app.stage.removeChild(this.hudLayer);
    this.worldLayer.destroy({ children: true });
    this.hudLayer.destroy({ children: true });
  }
}
