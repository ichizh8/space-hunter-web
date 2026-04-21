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
import { VFXManager, DIR_NAMES, SPRITES_WITH_DIRS } from './VFXManager';
import { type Vec2, v2dist, v2, v2sub, v2norm, v2mul, v2len, v2fromAngle, randRange, lineSegHitsCircle, pick } from '../lib/math';
import { pickNextRoom } from '../data/rooms/roomPool';
import type { RoomJSON } from '../editor/editorStore';
import {
  PLAYER_BASE_HP, PLAYER_BASE_SPEED, WORLD_W, WORLD_H,
  PLAYER_COLOR
} from './constants';
import { CREATURE_DEFS, BIOME_POOLS, PLANET_POOLS } from '../data/creatures';
import { type ModifierDef } from '../data/modifiers';
import { WEAPON_DEFS, WEAPON_LEVEL_PERKS, WEAPON_MUTATIONS } from '../data/weapons';
import { KIT_DEFS } from '../data/kits';
import { PLANETS, type PlanetId, type PlanetPhysics } from '../data/planets';
import { type UpgradeCard, type ProgressionState, type RunPathState, generateDoorRewards } from '../data/upgrades';
import {
  halSay,
  HAL_HUNT_START, HAL_FIRST_KILL, HAL_KILL_STREAK,
  HAL_ELITE_SPAWNED, HAL_LOW_HP, HAL_CRITICAL_HP, HAL_TOOK_DAMAGE,
  HAL_CORRUPTION_VALLEY, HAL_CORRUPTION_CORRUPT, HAL_CORRUPTION_VOID,
  HAL_OBJECTIVE_HALF, HAL_OBJECTIVE_NEAR,
  HAL_PLAYER_DIED, HAL_CONTRACT_DONE, HAL_RELOAD,
} from '../data/hal';

// Sprite base path for GitHub Pages support
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

const BEHAVIOR_COLORS: Record<string, number> = {
  charge: 0xFF3333, flank: 0xFF8800, pack: 0x33FF33,
  lurker: 0xAA44FF, burst: 0xFFFF00, strafe: 0x00FFFF, patrol_river: 0x888888,
  mine_crawler: 0xcc7722, sentry_drone: 0xff9933, tide_phantom: 0x22ccbb, coral_spitter: 0x33aacc,
  void_weaver: 0xaa44ff, phase_stalker: 0xdd22ff,
  slag_brute: 0xff5500, cinder_wasp: 0xffaa00,
};

/** Blend a hex color toward white at the given strength (0=white, 1=full color). */
function subtleTint(color: number, strength: number): number {
  const r = Math.round(0xFF + ((color >> 16 & 0xFF) - 0xFF) * strength);
  const g = Math.round(0xFF + ((color >> 8  & 0xFF) - 0xFF) * strength);
  const b = Math.round(0xFF + ((color        & 0xFF) - 0xFF) * strength);
  return (r << 16) | (g << 8) | b;
}

// Sprite name -> creature name mapping

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
  /** Called after room 1 to let the player choose clean or void path. */
  onForkChoice: (weaponId: string, resolve: (path: 'clean' | 'void') => void) => void;
  /** Called when weapon auto-mutates (for gameStore sync). */
  onMutationApplied?: (path: 'clean' | 'void') => void;
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

  // Planet physics (applied at hunt start)
  planetPhysics: PlanetPhysics = PLANETS.kepler.physics;

  // Run path / room tracking (fork at room 1, auto-mutation at mutationRoom)
  planet = 'kepler';
  currentRoom: RoomJSON | null = null;
  roomsCleared = 0;
  runPath: 'clean' | 'void' | null = null;
  forkChoicePending = false;
  mutationRoom = 4;
  // Room-based door system
  doors: Array<{ id: string; pos: Vec2; radius: number; rewardTag: string; nextPool: string; locked: boolean; label: string }> = [];
  roomCleared = false;   // true when all enemies in current room are dead
  roomTransitioning = false; // brief pause during room load

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
  vfx = new VFXManager();

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
    contractExtras?: { holdTime?: number; podHp?: number; cacheCount?: number; reward?: number; parTime?: number; difficulty?: number; planet?: string },
    startingWeapon?: string
  ) {
    this.app = app;
    this.callbacks = callbacks;
    this.equippedKits = kits;
    this.contractType = contractType;
    this.planet = contractExtras?.planet ?? 'kepler';
    try { this.currentRoom = pickNextRoom(this.planet, 'opening'); } catch { /* planet not yet in pool */ }
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
    // Short contracts (boss hunt or difficulty 1) mutate at room 3, others at room 4
    this.mutationRoom = (contractType === 'boss_hunt' || this.contractDifficulty <= 1) ? 3 : 4;

    const vw = app.screen.width;
    const vh = app.screen.height;

    this.camera = new Camera(vw, vh);
    this.map = new GameMap();
    if (this.currentRoom) {
      this.map.generateFromRoom(this.currentRoom);
      this.camera.worldW = this.map.roomW;
      this.camera.worldH = this.map.roomH;
      this.loadRoomEntities(this.currentRoom);
    } else {
      this.map.generate();
    }

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

    // Planet physics -- apply movement modifiers
    const planetDef = PLANETS[this.planet as PlanetId];
    if (planetDef?.physics) {
      this.planetPhysics = planetDef.physics;
      this.player.inertia = planetDef.physics.inertia;
      this.player.baseSpeed = Math.round(this.player.baseSpeed * planetDef.physics.moveSpeedMult);
      this.player.speed = this.player.baseSpeed;
    }

    this.weapons = new WeaponSystem();
    // Planet weapon physics
    this.weapons.planetBulletSpeedMult = this.planetPhysics.bulletSpeedMult;
    this.weapons.planetBulletLifeMult = this.planetPhysics.bulletLifeMult;
    this.weapons.planetFireRateMult = this.planetPhysics.fireRateMult;
    this.weapons.planetWeaponMods = planetDef?.weaponMods ?? [];
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
    this.hudLayer.addChild(this.hud.messageText);
    this.hudLayer.addChild(this.hud.halStripText);

    // Draw static map
    this.map.drawStatic(this.mapGfx);

    // Spawn initial enemies: use room spawn zones if available, else legacy wave
    if (this.currentRoom?.spawnZones?.length) {
      this.spawnFromRoomZones(this.currentRoom);
    } else {
      this.enemies.spawnWave(30, this.player.pos, this.map);
    }
    this.hud.showMessage('HUNT STARTED', 2);
    setTimeout(() => this.hud.showHalMessage(halSay(HAL_HUNT_START), 5), 2500);

    // Contract-specific setup (only for legacy non-room mode)
    if (!this.currentRoom) {
      if (this.contractType === 'void_breach') {
        this.spawnManager.spawnBreaches(this);
      }
      if (this.contractType === 'extraction_run') {
        this.spawnManager.spawnCaches(this);
      }
      if (this.contractType === 'payload_escort') {
        this.spawnManager.spawnPodPath(this);
      }
    }
    // Input
    this.setupInput();
  }

  /** Load door entities from a room JSON */
  private loadRoomEntities(room: RoomJSON) {
    this.doors = [];
    if (!room.entities) return;
    const SX = GameMap.ROOM_SCALE_X;
    const SY = GameMap.ROOM_SCALE_Y;
    for (const ent of room.entities) {
      if (ent.type === 'door') {
        this.doors.push({
          id: ent.id,
          pos: v2(ent.pos.x * SX, ent.pos.y * SY),
          radius: (ent.radius ?? 45) * Math.max(SX, SY),
          rewardTag: ent.rewardTag ?? 'mystery',
          nextPool: ent.nextPool ?? '',
          locked: true,
          label: ent.label ?? 'Door',
        });
      }
    }
  }

  /** Spawn enemies from room's spawn zones + extra top/bottom waves */
  private spawnFromRoomZones(room: RoomJSON) {
    const SX = GameMap.ROOM_SCALE_X;
    const SY = GameMap.ROOM_SCALE_Y;
    const W = this.map.roomW;
    const H = this.map.roomH;

    // Spawn from defined zones
    if (room.spawnZones) {
      for (const zone of room.spawnZones) {
        const budget = zone.budget ?? 5;
        for (let i = 0; i < budget; i++) {
          const x = (zone.rect.x + Math.random() * zone.rect.w) * SX;
          const y = (zone.rect.y + Math.random() * zone.rect.h) * SY;
          this.spawnRoomEnemy(x, y);
        }
      }
    }

    // Extra top and bottom spawns (portrait-oriented mobile play)
    const extraTop = 4 + Math.floor(Math.random() * 4);
    const extraBottom = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < extraTop; i++) {
      const x = randRange(80, W - 80);
      const y = randRange(60, H * 0.25);
      this.spawnRoomEnemy(x, y);
    }
    for (let i = 0; i < extraBottom; i++) {
      const x = randRange(80, W - 80);
      const y = randRange(H * 0.75, H - 60);
      this.spawnRoomEnemy(x, y);
    }
  }

  /** Helper: spawn a single enemy at world pos using planet/biome pools.
   *  Enforces minimum distance from player spawn to prevent unfair hits. */
  private spawnRoomEnemy(x: number, y: number) {
    // Push away from player spawn if too close
    const minDist = 200;
    const dx = x - this.player.pos.x;
    const dy = y - this.player.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist && dist > 1) {
      const push = (minDist - dist) / dist;
      x += dx * push;
      y += dy * push;
    } else if (dist <= 1) {
      // Exactly on player -- push to a random direction
      const angle = Math.random() * Math.PI * 2;
      x = this.player.pos.x + Math.cos(angle) * minDist;
      y = this.player.pos.y + Math.sin(angle) * minDist;
    }
    // Clamp within room
    x = Math.max(30, Math.min(this.map.roomW - 30, x));
    y = Math.max(30, Math.min(this.map.roomH - 30, y));

    // Push out of obstacles (retry up to 5 times)
    for (let attempt = 0; attempt < 5 && this.map.isBlocked(x, y, 15); attempt++) {
      const escaped = this.map.pushOut(x, y, 15);
      x = escaped.x;
      y = escaped.y;
    }
    // If still blocked, skip this enemy
    if (this.map.isBlocked(x, y, 15)) return;

    const biome = this.map.getBiome(x, y);
    const biomePool = BIOME_POOLS[biome] || BIOME_POOLS.open;
    const planetPool = PLANET_POOLS[this.planet];
    const name = (planetPool && Math.random() < 0.45) ? pick(planetPool) : pick(biomePool);
    const enemy = createEnemy(name, v2(x, y), true);
    this.enemies.enemies.push(enemy);
  }

  /** Transition to a new room via door */
  private transitionToRoom(door: { nextPool: string; rewardTag: string }) {
    if (this.roomTransitioning) return;
    this.roomTransitioning = true;

    // Extraction complete: finish the contract
    if (door.nextPool === 'extraction_complete') {
      this.roomTransitioning = false;
      this.complete = true;
      this.hud.showMessage('EXTRACTION COMPLETE', 2);
      this.hud.showHalMessage(halSay(HAL_CONTRACT_DONE), 5);
      setTimeout(() => this.finishHunt('COMPLETED'), 2000);
      return;
    }

    // Parse nextPool to determine planet and roomType (e.g. "furnace_elite" -> planet=furnace, type=elite)
    const parts = door.nextPool.split('_');
    let nextPlanet = this.planet;
    let nextType = 'standard';
    if (parts.length >= 2) {
      // Check if first part is a known planet
      const possiblePlanet = parts[0] === 'void' ? 'void_reach' : parts[0];
      if (PLANETS[possiblePlanet as PlanetId]) {
        nextPlanet = possiblePlanet;
        nextType = parts.slice(parts[0] === 'void' ? 2 : 1).join('_') || 'standard';
      } else {
        nextType = door.nextPool;
      }
    }

    // Pick the next room template
    let nextRoom: RoomJSON | null = null;
    try {
      nextRoom = pickNextRoom(nextPlanet, nextType);
    } catch {
      // Fallback to standard if pool not found
      try { nextRoom = pickNextRoom(nextPlanet, 'standard'); } catch { /* give up */ }
    }

    if (!nextRoom) {
      this.roomTransitioning = false;
      return;
    }

    // Clear current state
    this.enemies.enemies = [];
    this.enemies.mines = [];
    this.enemies.enemyBullets = [];
    this.particles = [];
    this.explosions = [];
    // Clear enemy sprites from previous room
    for (const [id, spr] of this.spritePool) {
      spr.destroy();
    }
    this.spritePool.clear();
    this.roomCleared = false;

    // Load new room
    this.currentRoom = nextRoom;
    this.map.generateFromRoom(nextRoom);
    this.camera.worldW = this.map.roomW;
    this.camera.worldH = this.map.roomH;
    this.loadRoomEntities(nextRoom);

    // Clear old obstacle sprites and recreate for new room
    this.obstacleLayer.removeChildren();
    const OBS_KEYS = ['obs_asteroid', 'obs_crystal', 'obs_debris'];
    for (const obs of this.map.obstacles) {
      // Skip sprite for wall-like obstacles (aspect ratio > 3:1) -- drawn as rects in map
      const aspect = Math.max(obs.w, obs.h) / Math.max(1, Math.min(obs.w, obs.h));
      if (aspect > 3) continue;
      const key = OBS_KEYS[obs.obsType] ?? OBS_KEYS[0];
      const tex = this.textures[key];
      if (!tex) continue;
      const spr = new Sprite(tex);
      spr.anchor.set(0.5, 0.5);
      spr.x = obs.pos.x;
      spr.y = obs.pos.y;
      // Scale each axis independently so sprites aren't stretched
      spr.scale.set(obs.w / 64, obs.h / 64);
      spr.roundPixels = true;
      spr.rotation = Math.random() * Math.PI * 2;
      this.obstacleLayer.addChild(spr);
    }

    // Redraw static map
    this.mapGfx.clear();
    this.map.drawStatic(this.mapGfx);

    // Move player to new spawn
    this.player.pos.x = this.map.spawnPos.x;
    this.player.pos.y = this.map.spawnPos.y;
    this.player.vel = v2(0, 0);
    this.player.iFrames = 2.0; // invincibility on room entry (time to react)

    // Spawn enemies from new room
    this.spawnFromRoomZones(nextRoom);

    // Lock doors
    for (const d of this.doors) d.locked = true;

    // Show room upgrade panel before transitioning
    this.offerUpgradePanel();

    this.screenFlash = 0.3;
    this.roomTransitioning = false;
  }

  /** Check if all enemies are dead and unlock doors */
  private checkRoomClear() {
    if (this.roomCleared || this.doors.length === 0) return;
    const aliveCount = this.enemies.enemies.filter(e => e.hp > 0 && !e.isAlly).length;
    if (aliveCount === 0 && this.enemies.enemies.length > 0) {
      this.roomCleared = true;
      for (const d of this.doors) d.locked = false;
      this.hud.showMessage('ROOM CLEARED', 1.5);
    }
  }

  /** Check if player is touching an unlocked door */
  private checkDoorEntry() {
    if (!this.roomCleared || this.roomTransitioning) return;
    for (const door of this.doors) {
      if (door.locked) continue;
      if (v2dist(this.player.pos, door.pos) < door.radius + this.player.radius) {
        this.transitionToRoom(door);
        return;
      }
    }
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
      // Skip sprite for wall-like obstacles (aspect ratio > 3:1) -- drawn as rects in map
      const aspect = Math.max(obs.w, obs.h) / Math.max(1, Math.min(obs.w, obs.h));
      if (aspect > 3) continue;
      const key = OBS_KEYS[obs.obsType] ?? OBS_KEYS[0];
      const tex = this.textures[key];
      if (!tex) continue;
      const spr = new Sprite(tex);
      spr.anchor.set(0.5, 0.5);
      spr.x = obs.pos.x;
      spr.y = obs.pos.y;
      // Scale each axis independently so sprites aren't stretched
      spr.scale.set(obs.w / 64, obs.h / 64);
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
    return this.vfx.getOrCreateEnemySprite(enemy, this);
  }

  private cleanupDeadSprites() {
    this.vfx.cleanupDeadSprites(this);
  }

  private setupInput() {
    const canvas = this.app.canvas;

    // Touch (with swipe-to-dash detection)
    let swipeStartX = 0, swipeStartY = 0, swipeStartTime = 0;
    const SWIPE_MIN_DIST = 50;  // pixels
    const SWIPE_MAX_TIME = 300; // ms

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const tx = t.clientX - rect.left;
      const ty = t.clientY - rect.top;
      swipeStartX = tx;
      swipeStartY = ty;
      swipeStartTime = performance.now();
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
      // Detect swipe for dash
      if (e.changedTouches.length > 0) {
        const t = e.changedTouches[0];
        const rect = canvas.getBoundingClientRect();
        const endX = t.clientX - rect.left;
        const endY = t.clientY - rect.top;
        const dx = endX - swipeStartX;
        const dy = endY - swipeStartY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const elapsed = performance.now() - swipeStartTime;
        if (dist >= SWIPE_MIN_DIST && elapsed <= SWIPE_MAX_TIME && this.dashMaxCharges > 0) {
          // Override dash direction with swipe direction
          const len = dist;
          this.player.vel.x = (dx / len) * this.player.speed;
          this.player.vel.y = (dy / len) * this.player.speed;
          this.activateDash();
        }
      }
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

    this.vfx.updateEffects(dt, this);

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

    // Room system: check if room is cleared, check door entry
    if (this.currentRoom) {
      this.checkRoomClear();
      this.checkDoorEntry();
    }

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
    this.vfx.updateSprites(this);
  }

  private drawBiomeVignette() {
    this.vfx.drawBiomeVignette(this);
  }

  private drawEntities() {
    this.vfx.drawEntities(this);
  }

  /** Build current progression state snapshot for upgrade generation */
  private getProgressionState(): ProgressionState {
    return this.progression.getProgressionState(this);
  }

  /** Auto-apply weapon mutation based on chosen run path. */
  private _autoApplyMutation() {
    const path = this.runPath!;
    const wid = this.player.weaponId;
    const mut = WEAPON_MUTATIONS[wid]?.[path];
    if (!mut || this.player.mutated !== '') return;
    const card: UpgradeCard = {
      type: 'mutation',
      id: `mut_${wid}_${path}`,
      rarity: 'legendary',
      icon: mut.icon,
      label: mut.name,
      desc: mut.desc,
      weaponId: wid,
      mutationType: path,
    };
    this.applyUpgrade(card);
    this.screenFlash = 0.5;
    this.callbacks.onMutationApplied?.(path);
  }

  /** Pause game and show door reward picker. Increments roomsCleared.
   *  Room 1: shows fork choice first, then upgrade cards.
   *  mutationRoom: auto-applies mutation before showing upgrade cards. */
  private offerUpgradePanel() {
    this.roomsCleared++;
    // Only pick a new room if transitionToRoom hasn't already set one
    if (!this.currentRoom) {
      try { this.currentRoom = pickNextRoom(this.planet, 'standard'); } catch { /* planet not yet in pool */ }
    }

    const doOfferCards = () => {
      // Auto-mutate at the designated room if path is chosen and not yet mutated
      if (this.roomsCleared === this.mutationRoom && this.runPath !== null && this.player.mutated === '') {
        this._autoApplyMutation();
      }

      const state = this.getProgressionState();
      // T3 kit advancement: mirror the side-effect previously in generateUpgrades
      for (const kid of state.equippedKits) {
        const kt = state.kitTiers[kid] ?? 1;
        if (kt === 2 && !state.kitT3Pending.includes(kid)) {
          state.kitT3Pending.push(kid);
        }
      }
      this.kitT3Pending = state.kitT3Pending;

      const pathState: RunPathState | undefined = this.runPath
        ? { path: this.runPath, roomsCleared: this.roomsCleared, corruption: this.player.corruption }
        : undefined;
      const choices = generateDoorRewards(state, 3, pathState).flat();
      if (choices.length === 0) return;
      this.upgradePending = true;
      this.paused = true;
      this.callbacks.onUpgradePick(choices, (picked) => {
        this.applyUpgrade(picked);
        this.upgradePending = false;
        this.paused = false;
      });
    };

    // Room 1: pause and present fork choice before the upgrade cards
    if (this.roomsCleared === 1 && this.runPath === null) {
      this.forkChoicePending = true;
      this.paused = true;
      this.callbacks.onForkChoice(this.player.weaponId, (path) => {
        this.runPath = path;
        this.forkChoicePending = false;
        doOfferCards();
      });
      return;
    }

    doOfferCards();
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
