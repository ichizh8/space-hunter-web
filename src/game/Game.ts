import { Application, Container, Graphics, Sprite, Assets, Texture } from 'pixi.js';
import { Camera } from './Camera';
import { GameMap } from './Map';
import { Player } from './Player';
import { WeaponSystem } from './Weapons';
import { EnemySystem, type Enemy, createEnemy } from './Enemies';
import { HUD } from './HUD';
import { v2dist, v2, v2sub, v2norm, v2mul, randRange } from '../lib/math';
import {
  PLAYER_BASE_HP, PLAYER_BASE_SPEED, WORLD_W, WORLD_H,
  PLAYER_COLOR, XP_PER_LEVEL, MAX_LEVEL, POST_CAP_XP
} from './constants';
import { CREATURE_DEFS } from '../data/creatures';
import { type ModifierDef } from '../data/modifiers';
import { WEAPON_DEFS, WEAPON_LEVEL_PERKS, WEAPON_MUTATIONS } from '../data/weapons';
import { KIT_DEFS } from '../data/kits';
import { ELITE_TYPES, ELITE_OVERRIDES, ELITE_EPITHETS, rollAffixes } from '../data/elites';
import { type UpgradeCard, type ProgressionState, generateUpgrades } from '../data/upgrades';
import {
  halSay,
  HAL_HUNT_START, HAL_WAVE_INCOMING, HAL_FIRST_KILL, HAL_KILL_STREAK,
  HAL_ELITE_SPAWNED, HAL_LOW_HP, HAL_CRITICAL_HP, HAL_TOOK_DAMAGE,
  HAL_CORRUPTION_VALLEY, HAL_CORRUPTION_CORRUPT, HAL_CORRUPTION_VOID,
  HAL_OBJECTIVE_HALF, HAL_OBJECTIVE_NEAR, HAL_LEVEL_UP,
  HAL_PLAYER_DIED, HAL_CONTRACT_DONE, HAL_RELOAD,
} from '../data/hal';

// Sprite base path for GitHub Pages support
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

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

let nextCacheId = 1;

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
  explosions: Array<{ x: number; y: number; radius: number; maxRadius: number; life: number; maxLife: number }> = [];

  // Active turrets
  turrets: Array<{
    x: number; y: number;
    life: number; maxLife: number;
    fireTimer: number; fireRate: number;
    damage: number; range: number;
  }> = [];

  // Decoys (mirage_kit)
  decoys: Array<{ x: number; y: number; hp: number; life: number; maxLife: number }> = [];

  // Smoke zones (smoke_kit)
  smokeZones: Array<{ x: number; y: number; radius: number; life: number; maxLife: number; slowing?: boolean; toxic?: boolean }> = [];

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

  podHp = 0;          // payload_escort: pod HP
  podMaxHp = 0;
  podProgress = 0;    // payload_escort: 0->1 delivery progress

  cacheCount = 0;     // extraction_run: total caches
  cachesCollected = 0;
  caches: ExtractionCache[] = [];  // extraction_run: spawned cache positions

  // Boss hunt state
  apexSpawned = false; // boss_hunt: has the apex target been spawned?
  apexId = -1;         // boss_hunt: enemy id of the apex

  // Elite spawning
  eliteTimer = 0;
  eliteSpawnedCount = 0;

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

  constructor(
    app: Application,
    kits: string[],
    contractType: string,
    targetTotal: number,
    hpBonus: number,
    magBonus: number,
    callbacks: GameCallbacks,
    contractExtras?: { holdTime?: number; podHp?: number; cacheCount?: number },
    startingWeapon?: string
  ) {
    this.app = app;
    this.callbacks = callbacks;
    this.equippedKits = kits;
    this.contractType = contractType;
    this.targetTotal = targetTotal;
    this.hpBonus = hpBonus;
    this.magBonus = magBonus;

    // Initialize kit cooldowns and run-local kit tiers
    for (const kit of kits) {
      this.kitCooldowns[kit] = 0;
      this.runKitTiers[kit] = 1;
    }

    // First elite spawn: 90-150s (scaled by difficulty)
    const depth = Math.min(3, Math.ceil(targetTotal / 10));
    this.eliteTimer = 90 - depth * 15 + Math.random() * 60;

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

    const vw = app.screen.width;
    const vh = app.screen.height;

    this.camera = new Camera(vw, vh);
    this.map = new GameMap();
    this.map.generate();

    const maxHp = PLAYER_BASE_HP + hpBonus * 2;
    const magSize = 12 + magBonus * 3;
    this.player = new Player(this.map.spawnPos.x, this.map.spawnPos.y, maxHp, magSize);
    if (startingWeapon && WEAPON_DEFS[startingWeapon]) {
      this.player.weaponId = startingWeapon;
      this.player.magSize = WEAPON_DEFS[startingWeapon].magSize;
      this.player.magAmmo = this.player.magSize;
    }
    this.weapons = new WeaponSystem();
    this.enemies = new EnemySystem();
    this.hud = new HUD(vw, vh);

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
      this.spawnBreaches();
    }
    if (this.contractType === 'extraction_run') {
      this.spawnCaches();
    }
    if (this.contractType === 'boss_hunt') {
      // Spawn the apex enemy after a short delay (wave 2)
      this.apexSpawned = false;
    }

    // Input
    this.setupInput();
  }

  // Ã¢ÂÂÃ¢ÂÂ Extraction: spawn caches across the map Ã¢ÂÂÃ¢ÂÂ
  private spawnCaches() {
    this.caches = [];
    for (let i = 0; i < this.cacheCount; i++) {
      let pos: { x: number; y: number };
      let attempts = 0;
      do {
        pos = {
          x: randRange(200, WORLD_W - 200),
          y: randRange(200, WORLD_H - 200),
        };
        attempts++;
        // Ensure caches aren't too close to player or each other
      } while (
        (v2dist(pos, this.player.pos) < 600 ||
          this.caches.some(c => v2dist(pos, c.pos) < 400)) &&
        attempts < 30
      );
      this.caches.push({
        id: nextCacheId++,
        pos,
        collected: false,
        radius: 30,
      });
    }
  }

  // Ã¢ÂÂÃ¢ÂÂ Void Breach: spawn sequential breach zones Ã¢ÂÂÃ¢ÂÂ
  private spawnBreaches() {
    const BREACH_COUNT = 3;
    const perBreachTime = this.holdTime / BREACH_COUNT;
    this.breaches = [];
    for (let i = 0; i < BREACH_COUNT; i++) {
      let pos: { x: number; y: number };
      let attempts = 0;
      do {
        pos = {
          x: randRange(300, WORLD_W - 300),
          y: randRange(300, WORLD_H - 300),
        };
        attempts++;
      } while (
        (v2dist(pos, this.player.pos) < 500 ||
          this.breaches.some(b => v2dist(pos, b.pos) < 600)) &&
        attempts < 30
      );
      this.breaches.push({
        id: i,
        pos,
        sealed: false,
        holdTimer: 0,
        holdTime: perBreachTime,
        radius: 250,
      });
    }
    this.activeBreachIdx = 0;
    this.breachesSealed = 0;
    this.hud.showMessage(`BREACH 1/${BREACH_COUNT} DETECTED`, 2);
  }

  // Ã¢ÂÂÃ¢ÂÂ Boss Hunt: spawn an apex enemy Ã¢ÂÂÃ¢ÂÂ
  private spawnApex() {
    if (this.apexSpawned) return;
    this.apexSpawned = true;

    // Spawn far from player
    let pos: { x: number; y: number };
    let attempts = 0;
    do {
      pos = {
        x: randRange(200, WORLD_W - 200),
        y: randRange(200, WORLD_H - 200),
      };
      attempts++;
    } while (v2dist(pos, this.player.pos) < 800 && attempts < 30);

    // Create a super-powered enemy based on Cave Lurker (tankiest base creature)
    const apex = createEnemy('Cave Lurker', pos, true);
    apex.hp = 60 + this.targetTotal * 10;  // Very tanky
    apex.maxHp = apex.hp;
    apex.speed = 90;
    apex.meleeDmg = 4;
    apex.radius = 28;
    apex.detection = 600;
    apex.behavior = 'charge'; // Override lurker — apex always charges
    apex.isElite = true;
    apex.isTarget = true;
    apex.leash = 9999; // Never gives up
    this.apexId = apex.id;
    this.enemies.enemies.push(apex);

    this.hud.showMessage('APEX TARGET DETECTED', 2.5);
    if (this.halCooldown <= 0) {
      setTimeout(() => this.hud.showHalMessage(halSay(HAL_ELITE_SPAWNED), 4), 1500);
      this.halCooldown = 6;
    }
  }

  private spawnElite() {
    this.eliteSpawnedCount++;
    // Cycle through elite types, 30% chance random instead
    let eliteIdx = (this.eliteSpawnedCount - 1) % ELITE_TYPES.length;
    if (Math.random() < 0.3) eliteIdx = Math.floor(Math.random() * ELITE_TYPES.length);
    const eliteType = ELITE_TYPES[eliteIdx];
    const epithet = ELITE_EPITHETS[Math.floor(Math.random() * ELITE_EPITHETS.length)];
    const displayName = `${eliteType} ${epithet}`;

    // Spawn away from player
    let pos: { x: number; y: number };
    let attempts = 0;
    do {
      pos = { x: randRange(200, WORLD_W - 200), y: randRange(200, WORLD_H - 200) };
      attempts++;
    } while (v2dist(pos, this.player.pos) < 600 && attempts < 30);

    // Base stats scaled by time
    const depth = Math.min(3, Math.ceil(this.targetTotal / 10));
    const hpScale = 1.0 + (depth - 1) * 0.5 + this.eliteSpawnedCount * 0.2;
    const overrides = ELITE_OVERRIDES[eliteType] || {};
    const baseHp = Math.floor((overrides.hp || 20) * hpScale);
    const baseSpeed = overrides.speed ?? (55 + depth * 10);
    const baseRadius = overrides.radius ?? 20;
    const baseDmg = overrides.meleeDmg ?? (2 + depth);

    const elite = createEnemy('Void Leech', pos, true); // base creature template
    elite.name = eliteType;
    elite.hp = baseHp;
    elite.maxHp = baseHp;
    elite.speed = baseSpeed;
    elite.radius = baseRadius;
    elite.meleeDmg = baseDmg;
    elite.color = overrides.color ?? 0xffdd11;
    elite.detection = 500;
    elite.leash = 1200;
    elite.isElite = true;
    // Give each elite type a distinct behavior pattern
    const eliteBehaviorMap: Record<string, string> = {
      'Void Hulk':       'charge',    // slow + telegraphed charges
      'Phase Hunter':    'burst',     // blink-dash attacks
      'Brood Mother':    'pack',      // moves with minion swarm logic
      'Rift Colossus':   'charge',    // massive knockback charge
      'Null Wraith':     'lurker',    // stalks then pounces
      'Stone Sentinel':  'lurker',    // stationary ambush
      'Tide Reaper':     'strafe',    // orbits and rains ranged fire
      'Current Stalker': 'flank',     // circles then rushes from blind spots
    };
    elite.behavior = eliteBehaviorMap[eliteType] ?? 'charge';

    // Roll affixes
    let affixCount = 1;
    if (this.elapsed > 600) affixCount = 2 + Math.floor(Math.random() * 2); // 2-3
    else if (this.elapsed > 300) affixCount = 1 + Math.floor(Math.random() * 2); // 1-2
    const affixes = rollAffixes(affixCount);
    elite.affixes = affixes;

    // Apply affix stat modifications
    for (const affix of affixes) {
      switch (affix) {
        case 'extra_fast': elite.speed *= 1.5; break;
        case 'shielded': elite.shieldHp = Math.floor(elite.maxHp * 0.3); break;
        case 'teleporter': elite.tpTimer = 8; break;
        case 'magnetic': elite.magneticTimer = 5; break;
        case 'armored': break; // checked on damage
        case 'berserker': break; // checked on update
        default: break;
      }
    }

    this.enemies.enemies.push(elite);
    this.hud.showMessage(`ELITE: ${displayName}`, 2.5);
    if (this.halCooldown <= 0) {
      setTimeout(() => this.hud.showHalMessage(halSay(HAL_ELITE_SPAWNED), 4), 1000);
      this.halCooldown = 6;
    }
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
      } else {
        this.player.onKeyUp(e.key);
      }
    };

    window.addEventListener('keydown', (e) => onKey(e, true));
    window.addEventListener('keyup', (e) => onKey(e, false));
  }

  activateKit(kitId: string) {
    if (!this.equippedKits.includes(kitId)) return;
    if ((this.kitCooldowns[kitId] || 0) > 0) return;
    const kdef = KIT_DEFS[kitId];
    if (!kdef) return;
    const tier = this.runKitTiers[kitId] || 1;
    const t3Choice = this.kitT3Choices[kitId] || '';

    switch (kitId) {
      case 'stim_pack': {
        const heal = tier < 2 ? 4 : 5;
        this.player.heal(heal);
        this.player.corruption = Math.min(100, this.player.corruption + 15);
        // Withdrawal perk: re-arm shield
        if (this.hasPerk('withdrawal')) this.stimWithdrawalActive = true;
        // Adrenaline Spike perk: scatter nearby enemies 80px
        if (this.hasPerk('adrenaline_spike')) {
          for (const e of this.enemies.enemies) {
            if (e.hp > 0 && !e.isAlly && v2dist(this.player.pos, e.pos) < 100) {
              const pushDir = v2norm(v2sub(e.pos, this.player.pos));
              e.pos.x += pushDir.x * 80;
              e.pos.y += pushDir.y * 80;
            }
          }
        }
        // T3 clean: speed boost 5s
        if (tier >= 3 && t3Choice === 'clean') this.stimSpeedTimer = 5.0;
        break;
      }
      case 'flash_trap': {
        // Damage and stun all enemies within 80px
        const stunned: Enemy[] = [];
        for (const e of this.enemies.enemies) {
          if (e.hp <= 0 || e.isAlly) continue;
          if (v2dist(this.player.pos, e.pos) < 80) {
            e.hp -= 3;
            e.hitFlash = 0.3;
            e.stunTimer = 2.0;
            stunned.push(e);
            if (e.hp <= 0) this.onEnemyKilled(e);
          }
        }
        // Trap Magnetism perk: stunned enemy pulls 2 nearby
        if (this.hasPerk('trap_magnetism') && stunned.length > 0) {
          const anchor = stunned[0];
          let pulled = 0;
          for (const e of this.enemies.enemies) {
            if (pulled >= 2) break;
            if (e.hp <= 0 || e.isAlly || stunned.includes(e)) continue;
            if (v2dist(anchor.pos, e.pos) < 200) {
              e.pos.x = anchor.pos.x + (Math.random() - 0.5) * 40;
              e.pos.y = anchor.pos.y + (Math.random() - 0.5) * 40;
              e.stunTimer = 1.0;
              pulled++;
            }
          }
        }
        // Fragile State perk: enemies emerging from stun take 2x (marked in enemy update)
        this.explosions.push({ x: this.player.pos.x, y: this.player.pos.y, radius: 0, maxRadius: 80, life: 0.3, maxLife: 0.3 });
        break;
      }
      case 'blink_kit': {
        const oldPos = { x: this.player.pos.x, y: this.player.pos.y };
        const blinkDist = 200;
        const aim = this.player.nearestEnemyPos;
        if (aim) {
          const dx = aim.x - this.player.pos.x;
          const dy = aim.y - this.player.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            this.player.pos.x += (dx / dist) * blinkDist;
            this.player.pos.y += (dy / dist) * blinkDist;
          }
        } else {
          this.player.pos.y -= blinkDist;
        }
        this.player.pos.x = Math.max(0, Math.min(WORLD_W, this.player.pos.x));
        this.player.pos.y = Math.max(0, Math.min(WORLD_H, this.player.pos.y));
        // T2: stun field at departure point
        if (tier >= 2) {
          for (const e of this.enemies.enemies) {
            if (e.hp > 0 && !e.isAlly && v2dist(oldPos, e.pos) < 100) {
              e.stunTimer = 1.5;
            }
          }
          this.explosions.push({ x: oldPos.x, y: oldPos.y, radius: 0, maxRadius: 100, life: 0.3, maxLife: 0.3 });
        }
        // T3 clean: empowered next shot (3x damage)
        if (tier >= 3 && t3Choice === 'clean') {
          this.blinkEmpowered = true;
        }
        // T3 void: pull enemies with you
        if (tier >= 3 && t3Choice === 'void') {
          for (const e of this.enemies.enemies) {
            if (e.hp > 0 && !e.isAlly && v2dist(oldPos, e.pos) < 150) {
              e.pos.x = this.player.pos.x + (Math.random() - 0.5) * 80;
              e.pos.y = this.player.pos.y + (Math.random() - 0.5) * 80;
            }
          }
        }
        // Arrival Strike perk: push enemies 100px at landing
        if (this.hasPerk('arrival_strike')) {
          for (const e of this.enemies.enemies) {
            if (e.hp > 0 && !e.isAlly && v2dist(this.player.pos, e.pos) < 100) {
              const pd = v2norm(v2sub(e.pos, this.player.pos));
              e.pos.x += pd.x * 100;
              e.pos.y += pd.y * 100;
            }
          }
          this.explosions.push({ x: this.player.pos.x, y: this.player.pos.y, radius: 0, maxRadius: 100, life: 0.2, maxLife: 0.2 });
        }
        // Swap perk: teleport to nearest enemy instead
        if (this.hasPerk('swap')) {
          let swapBest = 400;
          let swapEnemy: Enemy | null = null;
          for (const e of this.enemies.enemies) {
            if (e.hp <= 0 || e.isAlly) continue;
            const d = v2dist(oldPos, e.pos);
            if (d < swapBest) { swapBest = d; swapEnemy = e; }
          }
          if (swapEnemy) {
            this.player.pos.x = swapEnemy.pos.x;
            this.player.pos.y = swapEnemy.pos.y;
            swapEnemy.pos.x = oldPos.x;
            swapEnemy.pos.y = oldPos.y;
          }
        }
        break;
      }
      case 'turret_kit': {
        const turretDur = tier < 2 ? 12 : (tier >= 3 && t3Choice === 'clean' ? 25 : 20);
        const turretDmg = tier < 2 ? 2 : 2;
        this.turrets.push({
          x: this.player.pos.x,
          y: this.player.pos.y,
          life: turretDur, maxLife: turretDur,
          fireTimer: 0, fireRate: tier >= 2 ? 0.1 : 0.35, // T2: burst fire
          damage: turretDmg, range: 250,
        });
        break;
      }
      case 'chain_kit': {
        // Fire tether toward nearest enemy, stun 3s
        let chainNearest: Enemy | null = null;
        let chainDist = 999999;
        let chainNearestIdx = -1;
        for (let i = 0; i < this.enemies.enemies.length; i++) {
          const e = this.enemies.enemies[i];
          if (e.hp <= 0 || e.isAlly) continue;
          const d = v2dist(this.player.pos, e.pos);
          if (d < chainDist) { chainDist = d; chainNearest = e; chainNearestIdx = i; }
        }
        if (chainNearest) {
          chainNearest.stunTimer = 3.0;
          this.explosions.push({ x: chainNearest.pos.x, y: chainNearest.pos.y, radius: 0, maxRadius: 30, life: 0.3, maxLife: 0.3 });
          // T2: arc to second enemy
          if (tier >= 2) {
            let secondDist = 200;
            let secondEnemy: Enemy | null = null;
            for (let i = 0; i < this.enemies.enemies.length; i++) {
              if (i === chainNearestIdx || this.enemies.enemies[i].hp <= 0 || this.enemies.enemies[i].isAlly) continue;
              const d2 = v2dist(chainNearest.pos, this.enemies.enemies[i].pos);
              if (d2 < secondDist) { secondDist = d2; secondEnemy = this.enemies.enemies[i]; }
            }
            if (secondEnemy) {
              secondEnemy.stunTimer = 3.0;
            }
          }
          // T3 clean: chained enemy takes +50% damage (marked)
          if (tier >= 3 && t3Choice === 'clean') {
            (chainNearest as Enemy & { markedTimer?: number; markedDmgBonus?: number }).markedTimer = 5.0;
            (chainNearest as Enemy & { markedDmgBonus?: number }).markedDmgBonus = 1.5;
          }
        }
        break;
      }
      case 'charge_kit': {
        const chargeDmg = tier < 2 ? 2 : 6;
        const kbMult = (tier >= 3 && t3Choice === 'clean') ? 2.0 : 1.0;
        for (const e of this.enemies.enemies) {
          if (e.hp <= 0 || e.isAlly) continue;
          const d = v2dist(this.player.pos, e.pos);
          if (d < 150) {
            const pushDir = v2norm(v2sub(e.pos, this.player.pos));
            e.pos.x += pushDir.x * 200 * kbMult;
            e.pos.y += pushDir.y * 200 * kbMult;
            e.hp -= chargeDmg;
            e.hitFlash = 0.3;
            // T3 clean: stun after knockback
            if (tier >= 3 && t3Choice === 'clean') e.stunTimer = 1.0;
            if (e.hp <= 0) this.onEnemyKilled(e);
          }
        }
        this.explosions.push({ x: this.player.pos.x, y: this.player.pos.y, radius: 0, maxRadius: 150, life: 0.3, maxLife: 0.3 });
        // Aftershock perk: leave slow field
        if (this.hasPerk('aftershock')) {
          this.smokeZones.push({ x: this.player.pos.x, y: this.player.pos.y, radius: 80, life: 3, maxLife: 3, slowing: true });
        }
        break;
      }
      case 'mirage_kit': {
        // T3 clean: 3 decoys instead of 1
        const decoyCount = (tier >= 3 && t3Choice === 'clean') ? 3 : 1;
        for (let di = 0; di < decoyCount; di++) {
          this.decoys.push({
            x: this.player.pos.x + (Math.random() - 0.5) * 40,
            y: this.player.pos.y + (Math.random() - 0.5) * 40,
            hp: 5, life: 6, maxLife: 6,
          });
        }
        break;
      }
      case 'smoke_kit':
        // Smoke zone: de-aggro enemies inside, 6s. T2: slows 40%. T3 void: toxic (1 dmg/s)
        this.smokeZones.push({
          x: this.player.pos.x,
          y: this.player.pos.y,
          radius: 150, life: 6, maxLife: 6,
          slowing: tier >= 2,
          toxic: tier >= 3 && t3Choice === 'void',
        } as typeof this.smokeZones[number]);
        break;
      case 'anchor_kit': {
        // Gravity well: pull enemies. T2: 9s with pulse. T3 clean: damage field. T3 void: explode on end.
        const gwLife = tier >= 2 ? 9 : 4;
        this.gravityWells.push({
          x: this.player.pos.x,
          y: this.player.pos.y,
          radius: 400, life: gwLife, maxLife: gwLife,
          pullSpeed: 120,
          damageField: tier >= 3 && t3Choice === 'clean',
          explodeOnEnd: tier >= 3 && t3Choice === 'void',
        } as typeof this.gravityWells[number]);
        break;
      }
      case 'drone_kit':
        // Persistent drone that orbits, intercepts, attacks
        this.droneActive = true;
        this.dronePos = { x: this.player.pos.x + 50, y: this.player.pos.y };
        this.droneFireTimer = 0;
        this.droneInterceptTimer = 0;
        break;
      case 'familiar_kit':
        // Persistent familiar that orbits and rams
        this.familiarActive = true;
        this.familiarPos = { x: this.player.pos.x + 60, y: this.player.pos.y };
        this.familiarAttackTimer = 0;
        break;
      case 'pack_kit': {
        // T2: spawn 4 allies instead of 2
        const allyCount = tier < 2 ? 2 : 4;
        // Kill existing allies first
        for (const e of this.enemies.enemies) {
          if (e.isAlly) e.hp = 0;
        }
        for (let ai = 0; ai < allyCount; ai++) {
          const angle = (ai / allyCount) * Math.PI * 2 + Math.random() * 0.4;
          const spawnDist = 50 + Math.random() * 40;
          const ally = createEnemy('Rift Parasite', {
            x: this.player.pos.x + Math.cos(angle) * spawnDist,
            y: this.player.pos.y + Math.sin(angle) * spawnDist,
          });
          ally.isAlly = true;
          ally.hp = 8;
          ally.maxHp = 8;
          ally.speed = 130;
          this.enemies.enemies.push(ally);
        }
        break;
      }
      case 'void_surge': {
        // T3 clean: free at 60+ corruption
        let surgeCost = 20;
        if (tier >= 3 && t3Choice === 'clean' && this.player.corruption >= 60) surgeCost = 0;
        if (this.player.corruption >= surgeCost) {
          this.player.corruption -= surgeCost;
          this.voidSurgeActive = true;
          this.voidSurgeTimer = 3;
          // T3 void: fire ring of 8 bullets
          if (tier >= 3 && t3Choice === 'void') {
            for (let bi = 0; bi < 8; bi++) {
              const angle = (bi / 8) * Math.PI * 2;
              const bdir = { x: Math.cos(angle), y: Math.sin(angle) };
              this.weapons.bullets.push({
                pos: { x: this.player.pos.x + bdir.x * 20, y: this.player.pos.y + bdir.y * 20 },
                vel: { x: bdir.x * 300, y: bdir.y * 300 },
                radius: 5, color: 0x6600cc, damage: 3, life: 0.8, maxLife: 0.8,
                piercing: false, homing: false, bounces: 0, aoeRadius: 0,
                fromPlayer: true, hitSet: new Set(),
              });
            }
          }
        } else {
          this.kitCooldowns[kitId] = 0;
          this.hud.showMessage('NOT ENOUGH CORRUPTION', 1.5);
          return;
        }
        break;
      }
      case 'rupture_kit': {
        // AOE damage = corruption/5, clear corruption
        const ruptureDmg = Math.floor(this.player.corruption / 5);
        for (const e of this.enemies.enemies) {
          if (e.hp <= 0) continue;
          if (v2dist(this.player.pos, e.pos) < 200) {
            e.hp -= ruptureDmg;
            e.hitFlash = 0.3;
            if (e.hp <= 0) this.onEnemyKilled(e);
          }
        }
        this.explosions.push({ x: this.player.pos.x, y: this.player.pos.y, radius: 0, maxRadius: 200, life: 0.3, maxLife: 0.3 });
        // Scatter Field perk: 8 shrapnel bullets
        if (this.hasPerk('scatter_field')) {
          for (let si = 0; si < 8; si++) {
            const sAngle = (si / 8) * Math.PI * 2;
            const sDir = { x: Math.cos(sAngle), y: Math.sin(sAngle) };
            this.weapons.bullets.push({
              pos: { x: this.player.pos.x + sDir.x * 15, y: this.player.pos.y + sDir.y * 15 },
              vel: { x: sDir.x * 250, y: sDir.y * 250 },
              radius: 4, color: 0xcc33cc, damage: 3, life: 0.6, maxLife: 0.6,
              piercing: false, homing: false, bounces: 0, aoeRadius: 0,
              fromPlayer: true, hitSet: new Set(),
            });
          }
        }
        this.player.corruption = 0;
        break;
      }
      default:
        break;
    }
    // Set cooldown (tier-adjusted for some kits)
    let cd = kdef.cooldown;
    if (kitId === 'stim_pack' && tier >= 2) cd = 5; // T2: 8->5s
    // T3 mismatch penalty: double cooldown
    if (tier >= 3 && t3Choice) {
      const isClean = t3Choice === 'clean';
      if ((isClean && this.player.corruption >= 35) || (!isClean && this.player.corruption < 50)) {
        cd *= 2;
      }
    }
    this.kitCooldowns[kitId] = cd;
    this.hud.showMessage(kdef.name.toUpperCase() + ' USED', 1.5);
  }

  update(dt: number) {
    if (this.dead || this.complete || this.paused) return;
    this.elapsed += dt;

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

    // Speed multipliers: void surge + stim T3 clean
    let speedMult = 1.0;
    if (this.voidSurgeActive) speedMult *= 1.8;
    if (this.stimSpeedTimer > 0) { speedMult *= 1.2; this.stimSpeedTimer -= dt; }
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

    // HAL: Objective progress
    if (!this.halHalfSaid && this.targetCount >= Math.floor(this.targetTotal * 0.5) && this.targetTotal > 0 && this.halCooldown <= 0) {
      this.halHalfSaid = true;
      this.hud.showHalMessage(halSay(HAL_OBJECTIVE_HALF), 4);
      this.halCooldown = 6;
    } else if (!this.halNearSaid && this.targetCount >= Math.floor(this.targetTotal * 0.75) && this.targetTotal > 0 && this.halCooldown <= 0) {
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
      const d = v2dist(this.player.pos, e.pos);
      if (d < nearestDist && d < 400) {
        nearestDist = d;
        this.player.nearestEnemyPos = e.pos;
      }
    }
    if (nearestDist === Infinity) this.player.nearestEnemyPos = null;

    // Auto-fire when enemies in range
    if (this.player.nearestEnemyPos) {
      this.weapons.fire(this.player);
    }

    // Enemies update
    this.enemies.update(dt, this.player, this.map, this.decoys.map(d => ({ x: d.x, y: d.y })));

    // Enemy runtime: affixes + kit perks
    for (const e of this.enemies.enemies) {
      if (e.hp <= 0) continue;
      // Marked timer decay
      if (e.markedTimer > 0) e.markedTimer -= dt;
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

    // Ã¢ÂÂÃ¢ÂÂ Payload escort: enemies damage pod Ã¢ÂÂÃ¢ÂÂ
    if (this.contractType === 'payload_escort' && this.podHp > 0) {
      const podX = WORLD_W * this.podProgress;
      const podY = WORLD_H / 2;
      for (const e of this.enemies.enemies) {
        if (!e.isAggroed) continue;
        const distToPod = v2dist(e.pos, { x: podX, y: podY });
        if (distToPod < 60 + e.radius && e.meleeCooldown <= 0) {
          this.podHp -= e.meleeDmg;
          e.meleeCooldown = 1.5; // Shared cooldown with player melee
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

    // Bullet-enemy collision
    for (const bullet of this.weapons.bullets) {
      if (!bullet.fromPlayer) continue;
      for (const enemy of this.enemies.enemies) {
        const dmg = this.weapons.checkHit(bullet, enemy.id, enemy.pos, enemy.radius);
        if (dmg > 0) {
          let finalDmg = dmg;
          // Marked damage bonus
          if (enemy.markedTimer > 0) finalDmg = Math.floor(finalDmg * enemy.markedDmgBonus);
          // Affix: armored halves ranged damage
          if (enemy.affixes.includes('armored')) finalDmg = Math.max(1, Math.floor(finalDmg * 0.5));
          // Affix: shielded absorbs damage
          if (enemy.affixes.includes('shielded') && enemy.shieldHp > 0) {
            if (enemy.shieldHp >= finalDmg) { enemy.shieldHp -= finalDmg; finalDmg = 0; }
            else { finalDmg -= enemy.shieldHp; enemy.shieldHp = 0; }
          }
          // Execute threshold (sniper clean)
          if (this.weapons.executeThreshold > 0 && enemy.hp > 0 && (enemy.hp / enemy.maxHp) <= this.weapons.executeThreshold) {
            enemy.hp = 0;
          } else {
            enemy.hp -= finalDmg;
          }
          enemy.hitFlash = 0.1;
          enemy.isAggroed = true;
          this.damageDealt += dmg;
          // Cryo stun (flamethrower clean)
          if (this.weapons.cryoStun) enemy.stunTimer = 2.0;
          // Slow on hit (chain rifle void)
          if (this.weapons.slowOnHit && CREATURE_DEFS[enemy.name]) {
            enemy.speed = Math.max(20, CREATURE_DEFS[enemy.name].speed * 0.7);
          }
          // Lifesteal (baton void)
          if (this.weapons.lifesteal) {
            this.player.hp = Math.min(this.player.hp + 1, this.player.maxHp);
          }
          // Singularity on hit (lance void)
          if (this.weapons.singularityOnHit) {
            this.gravityWells.push({ x: bullet.pos.x, y: bullet.pos.y, radius: 200, life: 2, maxLife: 2, pullSpeed: 120 });
          }
          // Corruption on fire (flamethrower void)
          if (this.weapons.corruptionOnFire) {
            this.player.corruption = Math.min(100, this.player.corruption + 0.5);
          }
          // Conductor perk: ricochet off stunned enemies
          if (this.hasPerk('conductor') && enemy.stunTimer > 0 && !(bullet as unknown as { ricocheted?: boolean }).ricocheted) {
            let ricBest = 200; let ricTarget: Enemy | null = null;
            for (const other of this.enemies.enemies) {
              if (other === enemy || other.hp <= 0 || other.isAlly) continue;
              const rd = v2dist(enemy.pos, other.pos);
              if (rd < ricBest) { ricBest = rd; ricTarget = other; }
            }
            if (ricTarget) {
              const ricDir = v2norm(v2sub(ricTarget.pos, enemy.pos));
              this.weapons.bullets.push({
                pos: { x: enemy.pos.x, y: enemy.pos.y },
                vel: { x: ricDir.x * 350, y: ricDir.y * 350 },
                radius: bullet.radius, color: 0x33ccff,
                damage: Math.max(1, Math.floor(finalDmg * 0.5)),
                life: 0.4, maxLife: 0.4,
                piercing: false, homing: false, bounces: 0, aoeRadius: 0,
                fromPlayer: true, hitSet: new Set(),
              });
            }
          }
          // Spawn explosion visual for AOE bullets (grenade)
          if (bullet.aoeRadius > 0 && !bullet.hitSet.has(-999)) {
            bullet.hitSet.add(-999); // prevent duplicate explosions
            this.explosions.push({
              x: bullet.pos.x, y: bullet.pos.y,
              radius: 0, maxRadius: bullet.aoeRadius,
              life: 0.4, maxLife: 0.4,
            });
            // AOE: damage all enemies in radius
            for (const other of this.enemies.enemies) {
              if (other.id === enemy.id) continue;
              if (v2dist(bullet.pos, other.pos) < bullet.aoeRadius) {
                other.hp -= dmg;
                other.hitFlash = 0.1;
                other.isAggroed = true;
                this.damageDealt += dmg;
                if (other.hp <= 0) this.onEnemyKilled(other);
              }
            }
            bullet.life = 0; // consume bullet after explosion
          }
          if (enemy.hp <= 0) {
            this.onEnemyKilled(enemy);
          }
        }
      }
    }

    // Remove dead enemies
    this.enemies.enemies = this.enemies.enemies.filter(e => e.hp > 0);

    // Remove expired bullets — AOE bullets explode on expiry (grenade landing)
    for (const b of this.weapons.bullets) {
      if (b.life <= 0 && b.aoeRadius > 0 && !b.hitSet.has(-999)) {
        b.hitSet.add(-999);
        this.explosions.push({
          x: b.pos.x, y: b.pos.y,
          radius: 0, maxRadius: b.aoeRadius,
          life: 0.4, maxLife: 0.4,
        });
        // AOE damage at landing point
        for (const enemy of this.enemies.enemies) {
          if (v2dist(b.pos, enemy.pos) < b.aoeRadius) {
            enemy.hp -= b.damage;
            enemy.hitFlash = 0.1;
            enemy.isAggroed = true;
            this.damageDealt += b.damage;
            if (enemy.hp <= 0) this.onEnemyKilled(enemy);
          }
        }
      }
    }
    this.weapons.bullets = this.weapons.bullets.filter(b => b.life > 0);

    // Update explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.life -= dt;
      const progress = 1 - (ex.life / ex.maxLife);
      ex.radius = ex.maxRadius * progress;
      if (ex.life <= 0) this.explosions.splice(i, 1);
    }

    // Update turrets
    for (let i = this.turrets.length - 1; i >= 0; i--) {
      const t = this.turrets[i];
      t.life -= dt;
      if (t.life <= 0) {
        // Overheat perk: turret explodes on death
        if (this.hasPerk('overheat')) {
          this.explosions.push({ x: t.x, y: t.y, radius: 0, maxRadius: 70, life: 0.3, maxLife: 0.3 });
          for (const e of this.enemies.enemies) {
            if (e.hp > 0 && !e.isAlly && v2dist({ x: t.x, y: t.y }, e.pos) < 70) {
              e.hp -= 4; e.hitFlash = 0.3;
              if (e.hp <= 0) this.onEnemyKilled(e);
            }
          }
        }
        this.turrets.splice(i, 1); continue;
      }
      t.fireTimer -= dt;
      if (t.fireTimer <= 0) {
        // Find nearest enemy in range (target_priority: only recently hit enemies)
        let nearest: { pos: { x: number; y: number }; id: number } | null = null;
        let nearDist = t.range;
        for (const e of this.enemies.enemies) {
          if (e.isAlly || e.hp <= 0) continue;
          const d = v2dist({ x: t.x, y: t.y }, e.pos);
          if (d < nearDist) { nearest = e; nearDist = d; }
        }
        if (nearest) {
          t.fireTimer = t.fireRate;
          const dir = v2norm(v2sub(nearest.pos, { x: t.x, y: t.y }));
          const vel = v2mul(dir, 400);
          this.weapons.bullets.push({
            pos: { x: t.x, y: t.y },
            vel,
            radius: 5,
            color: 0x44ffaa,
            damage: t.damage,
            life: 0.8,
            maxLife: 0.8,
            piercing: false,
            homing: false,
            bounces: 0,
            aoeRadius: 0,
            fromPlayer: true,
            hitSet: new Set(),
          });
        }
      }
    }

    // Update decoys
    for (let i = this.decoys.length - 1; i >= 0; i--) {
      const dc = this.decoys[i];
      dc.life -= dt;
      if (dc.life <= 0 || dc.hp <= 0) {
        this.decoys.splice(i, 1);
        continue;
      }
      // Magnet Decoy perk: pull enemies within 120px
      if (this.hasPerk('magnet_decoy')) {
        for (const e of this.enemies.enemies) {
          if (e.hp <= 0 || e.isAlly) continue;
          const md = v2dist(e.pos, { x: dc.x, y: dc.y });
          if (md < 120 && md > 5) {
            const pd = v2norm(v2sub({ x: dc.x, y: dc.y }, e.pos));
            e.pos.x += pd.x * 40 * dt;
            e.pos.y += pd.y * 40 * dt;
          }
        }
      }
      // Copycat perk: decoy fires weapon every 3s
      if (this.hasPerk('copycat')) {
        dc.life; // use existing life as timer proxy
        const ccKey = `cc_${i}`;
        if (!this.kitCooldowns[ccKey] || this.kitCooldowns[ccKey] <= 0) {
          this.kitCooldowns[ccKey] = 3;
          let ccBest = 200; let ccTarget: Enemy | null = null;
          for (const e of this.enemies.enemies) {
            if (e.hp <= 0 || e.isAlly) continue;
            const d = v2dist({ x: dc.x, y: dc.y }, e.pos);
            if (d < ccBest) { ccBest = d; ccTarget = e; }
          }
          if (ccTarget) {
            const ccDir = v2norm(v2sub(ccTarget.pos, { x: dc.x, y: dc.y }));
            this.weapons.bullets.push({
              pos: { x: dc.x, y: dc.y }, vel: { x: ccDir.x * 300, y: ccDir.y * 300 },
              radius: 4, color: 0xcc88ff, damage: 2, life: 0.6, maxLife: 0.6,
              piercing: false, homing: false, bounces: 0, aoeRadius: 0,
              fromPlayer: true, hitSet: new Set(),
            });
          }
        } else {
          this.kitCooldowns[ccKey] -= dt;
        }
      }
    }

    // Update smoke zones
    for (let i = this.smokeZones.length - 1; i >= 0; i--) {
      this.smokeZones[i].life -= dt;
      if (this.smokeZones[i].life <= 0) {
        this.smokeZones.splice(i, 1);
        continue;
      }
      const sz = this.smokeZones[i];
      for (const e of this.enemies.enemies) {
        if (e.hp <= 0 || e.isAlly) continue;
        if (v2dist(e.pos, { x: sz.x, y: sz.y }) < sz.radius) {
          // De-aggro
          e.isAggroed = false;
          // T2: slow enemies 40%
          if (sz.slowing) e.speed = CREATURE_DEFS[e.name]?.speed * 0.6 || e.speed * 0.6;
          // T3 void: toxic damage
          if (sz.toxic) {
            e.hp -= Math.max(1, Math.round(dt));
            e.hitFlash = 0.05;
            if (e.hp <= 0) this.onEnemyKilled(e);
          }
        } else {
          // Restore speed when leaving smoke
          if (sz.slowing && CREATURE_DEFS[e.name]) {
            e.speed = CREATURE_DEFS[e.name].speed;
          }
        }
      }
    }

    // Update gravity wells
    for (let i = this.gravityWells.length - 1; i >= 0; i--) {
      this.gravityWells[i].life -= dt;
      if (this.gravityWells[i].life <= 0) {
        // T3 void: explode on end
        const gwEnd = this.gravityWells[i];
        if (gwEnd.explodeOnEnd) {
          const count = gwEnd.enemiesInside || 1;
          const explodeDmg = 3 * count;
          for (const e of this.enemies.enemies) {
            if (e.hp > 0 && !e.isAlly && v2dist(e.pos, { x: gwEnd.x, y: gwEnd.y }) < gwEnd.radius * 0.5) {
              e.hp -= explodeDmg;
              e.hitFlash = 0.3;
              if (e.hp <= 0) this.onEnemyKilled(e);
            }
          }
          this.explosions.push({ x: gwEnd.x, y: gwEnd.y, radius: 0, maxRadius: gwEnd.radius * 0.5, life: 0.3, maxLife: 0.3 });
        }
        this.gravityWells.splice(i, 1);
        continue;
      }
      const gw = this.gravityWells[i];
      let enemyCount = 0;
      for (const e of this.enemies.enemies) {
        if (e.hp <= 0 || e.isAlly) continue;
        const d = v2dist(e.pos, { x: gw.x, y: gw.y });
        if (d < gw.radius && d > 5) {
          const pullDir = v2norm(v2sub({ x: gw.x, y: gw.y }, e.pos));
          e.pos.x += pullDir.x * gw.pullSpeed * dt;
          e.pos.y += pullDir.y * gw.pullSpeed * dt;
          enemyCount++;
          // T3 clean: damage field
          if (gw.damageField) {
            e.hp -= Math.max(1, Math.round(dt));
            if (e.hp <= 0) this.onEnemyKilled(e);
          }
        }
      }
      gw.enemiesInside = Math.max(gw.enemiesInside || 0, enemyCount);
    }

    // Update drone
    if (this.droneActive) {
      const orbitAngle = this.elapsed * 2.0 % (Math.PI * 2);
      this.dronePos = { x: this.player.pos.x + Math.cos(orbitAngle) * 50, y: this.player.pos.y + Math.sin(orbitAngle) * 50 };
      this.droneInterceptTimer = Math.max(0, this.droneInterceptTimer - dt);
      // Drone attack
      this.droneFireTimer -= dt;
      if (this.droneFireTimer <= 0) {
        this.droneFireTimer = 2.5;
        let droneBestDist = 200;
        let droneBestEnemy: Enemy | null = null;
        for (const e of this.enemies.enemies) {
          if (e.hp <= 0 || e.isAlly) continue;
          const d = v2dist(this.dronePos, e.pos);
          if (d < droneBestDist) { droneBestDist = d; droneBestEnemy = e; }
        }
        if (droneBestEnemy) {
          droneBestEnemy.hp -= 2;
          droneBestEnemy.hitFlash = 0.15;
          if (droneBestEnemy.hp <= 0) this.onEnemyKilled(droneBestEnemy);
          this.explosions.push({ x: this.dronePos.x, y: this.dronePos.y, radius: 0, maxRadius: 8, life: 0.1, maxLife: 0.1 });
        }
      }
      // Drone intercept enemy bullets
      if (this.droneInterceptTimer <= 0) {
        for (let bi = this.enemies.enemyBullets.length - 1; bi >= 0; bi--) {
          const eb = this.enemies.enemyBullets[bi];
          if (v2dist(eb.pos, this.dronePos) < 100) {
            this.enemies.enemyBullets.splice(bi, 1);
            this.droneInterceptTimer = 4;
            // Intercept Link perk: explode on intercept
            if (this.hasPerk('intercept_link')) {
              this.explosions.push({ x: this.dronePos.x, y: this.dronePos.y, radius: 0, maxRadius: 20, life: 0.2, maxLife: 0.2 });
              for (const e of this.enemies.enemies) {
                if (e.hp > 0 && !e.isAlly && v2dist(this.dronePos, e.pos) < 20) {
                  e.hp -= 2; e.hitFlash = 0.15;
                  if (e.hp <= 0) this.onEnemyKilled(e);
                }
              }
            } else {
              this.explosions.push({ x: this.dronePos.x, y: this.dronePos.y, radius: 0, maxRadius: 15, life: 0.2, maxLife: 0.2 });
            }
            break;
          }
        }
      }
      // Leash Break perk: familiar explodes when hit by enemy bullet
      if (this.familiarActive && !this.familiarLeashUsed && this.hasPerk('leash_break')) {
        for (let bi = this.enemies.enemyBullets.length - 1; bi >= 0; bi--) {
          if (v2dist(this.enemies.enemyBullets[bi].pos, this.familiarPos) < 30) {
            this.familiarLeashUsed = true;
            this.familiarActive = false;
            this.enemies.enemyBullets.splice(bi, 1);
            this.explosions.push({ x: this.familiarPos.x, y: this.familiarPos.y, radius: 0, maxRadius: 80, life: 0.3, maxLife: 0.3 });
            for (const e of this.enemies.enemies) {
              if (e.hp > 0 && !e.isAlly && v2dist(this.familiarPos, e.pos) < 80) {
                e.hp -= 5; e.hitFlash = 0.3;
                if (e.hp <= 0) this.onEnemyKilled(e);
              }
            }
            this.hud.showMessage('LEASH BREAK!', 1.5);
            break;
          }
        }
      }
    }

    // Update familiar
    if (this.familiarActive) {
      const famOrbit = (this.elapsed * 1.5 + Math.PI) % (Math.PI * 2);
      this.familiarPos = { x: this.player.pos.x + Math.cos(famOrbit) * 55, y: this.player.pos.y + Math.sin(famOrbit) * 55 };
      // Spotter perk: mark highest-HP enemy for +30% damage
      if (this.hasPerk('spotter')) {
        let spotBestHp = 0; let spotBestEnemy: Enemy | null = null;
        for (const e of this.enemies.enemies) {
          if (e.hp > 0 && !e.isAlly && v2dist(this.familiarPos, e.pos) < 160 && e.hp > spotBestHp) {
            spotBestHp = e.hp; spotBestEnemy = e;
          }
        }
        if (spotBestEnemy) { spotBestEnemy.markedTimer = 0.5; spotBestEnemy.markedDmgBonus = 1.3; }
      }
      this.familiarAttackTimer -= dt;
      if (this.familiarAttackTimer <= 0) {
        this.familiarAttackTimer = 3;
        let famBestDist = 160;
        let famBestEnemy: Enemy | null = null;
        for (const e of this.enemies.enemies) {
          if (e.hp <= 0 || e.isAlly) continue;
          const d = v2dist(this.familiarPos, e.pos);
          if (d < famBestDist) { famBestDist = d; famBestEnemy = e; }
        }
        if (famBestEnemy) {
          famBestEnemy.hp -= 2;
          famBestEnemy.hitFlash = 0.15;
          if (famBestEnemy.hp <= 0) this.onEnemyKilled(famBestEnemy);
          this.explosions.push({ x: this.familiarPos.x, y: this.familiarPos.y, radius: 0, maxRadius: 20, life: 0.1, maxLife: 0.1 });
        }
      }
    }

    // Update void surge
    if (this.voidSurgeActive) {
      this.voidSurgeTimer -= dt;
      // Void Trail perk: drop corruption zones during surge
      if (this.hasPerk('void_trail')) {
        this.voidTrailDropTimer -= dt;
        if (this.voidTrailDropTimer <= 0) {
          this.voidTrailDropTimer = 0.3;
          this.smokeZones.push({ x: this.player.pos.x, y: this.player.pos.y, radius: 60, life: 3, maxLife: 3, toxic: true });
        }
      }
      // Phase Burst perk: push enemies at surge end
      if (this.voidSurgeTimer <= 0) {
        if (this.hasPerk('phase_burst')) {
          for (const e of this.enemies.enemies) {
            if (e.hp > 0 && !e.isAlly && v2dist(this.player.pos, e.pos) < 120) {
              const pd = v2norm(v2sub(e.pos, this.player.pos));
              e.pos.x += pd.x * 80;
              e.pos.y += pd.y * 80;
            }
          }
          this.explosions.push({ x: this.player.pos.x, y: this.player.pos.y, radius: 0, maxRadius: 120, life: 0.3, maxLife: 0.3 });
        }
        this.voidSurgeActive = false;
      }
    }

    // Sacrifice invincibility timer
    if (this.sacrificeInvincibleTimer > 0) this.sacrificeInvincibleTimer -= dt;
    this.player.invincibleTimer = this.sacrificeInvincibleTimer;
    // Withdrawal perk: set absorb flag
    this.player.absorbNextHit = this.stimWithdrawalActive && this.hasPerk('withdrawal');

    // Drain Aura perk: heal 1 HP/2s in rupture void pool (check gravity wells as proxy)
    // Actually this uses void pools from rupture - for now check if player near an explosion
    // Simplified: heal when standing in smoke zones marked toxic (from rupture)

    // Frenzy Aura perk: count allies for fire rate bonus (applied in getModDamageMult area)

    // Spotter perk: familiar marks highest-HP enemy (done in familiar update)

    // Adrenaline timer (for modifier)
    if (this.adrenalineTimer > 0) {
      this.adrenalineTimer -= dt;
      if (this.adrenalineTimer <= 0) this.adrenalineKills = 0;
    }

    // Ã¢ÂÂÃ¢ÂÂ Extraction: cache collection Ã¢ÂÂÃ¢ÂÂ
    if (this.contractType === 'extraction_run') {
      for (const cache of this.caches) {
        if (cache.collected) continue;
        if (v2dist(this.player.pos, cache.pos) < cache.radius + this.player.radius) {
          cache.collected = true;
          this.cachesCollected++;
          this.hud.showMessage(`CACHE ${this.cachesCollected}/${this.cacheCount}`, 1.5);
          // Grant bonus ingredient
          this.ingredients.push({ id: `cache_loot_${cache.id}`, name: 'Cache Contents' });
        }
      }
    }

    // Ã¢ÂÂÃ¢ÂÂ Boss Hunt: spawn apex after wave 2 Ã¢ÂÂÃ¢ÂÂ
    if (this.contractType === 'boss_hunt' && !this.apexSpawned && this.waveCount >= 2) {
      this.spawnApex();
    }

    // Elite spawn timer
    this.eliteTimer -= dt;
    if (this.eliteTimer <= 0 && !this.modifierPickPending) {
      this.spawnElite();
      this.eliteTimer = 45 + Math.random() * 25; // 45-70s between subsequent elites
    }

    // Waves
    this.waveTimer -= dt;
    if (this.waveTimer <= 0 && this.enemies.enemies.length < 100 && !this.modifierPickPending) {
      this.waveCount++;
      const count = 20 + this.waveCount * 6 + Math.floor(this.elapsed / 60) * 4;
      const prevLen = this.enemies.enemies.length;
      this.enemies.spawnWave(Math.min(count, 60), this.player.pos, this.map);
      // Time-based enemy scaling: +10% HP per 2min, +5% speed per 3min
      const hpScale = 1 + Math.floor(this.elapsed / 120) * 0.1;
      const spdScale = 1 + Math.floor(this.elapsed / 180) * 0.05;
      for (let ei = prevLen; ei < this.enemies.enemies.length; ei++) {
        const e = this.enemies.enemies[ei];
        e.hp = Math.floor(e.hp * hpScale);
        e.maxHp = e.hp;
        e.speed = Math.floor(e.speed * spdScale);
      }
      this.waveTimer = Math.max(8, 20 - this.waveCount * 1.5);
      this.hud.showMessage(`WAVE ${this.waveCount + 1}`, 1.5);
      if (this.halCooldown <= 0) {
        setTimeout(() => this.hud.showHalMessage(halSay(HAL_WAVE_INCOMING), 3), 600);
        this.halCooldown = 5;
      }

      // Wave-based upgrades removed — level ups from XP are the only trigger
      // (avoids double-stacking with XP level ups early game)
    }

    // Death check
    if (this.player.hp <= 0 && !this.dead) {
      this.dead = true;
      this.hud.showMessage('YOU DIED', 3);
      this.hud.showHalMessage(halSay(HAL_PLAYER_DIED), 4);
      setTimeout(() => this.finishHunt('FAILED'), 2000);
    }

    // Ã¢ÂÂÃ¢ÂÂ Contract completion checks Ã¢ÂÂÃ¢ÂÂ

    // VOID BREACH: sequential breach zones
    if (this.contractType === 'void_breach' && !this.complete && this.breaches.length > 0) {
      const activeBreach = this.breaches[this.activeBreachIdx];
      if (activeBreach && !activeBreach.sealed) {
        const distToBreach = v2dist(this.player.pos, activeBreach.pos);
        this.holdZoneActive = distToBreach < activeBreach.radius;
        if (this.holdZoneActive) {
          activeBreach.holdTimer += dt;
          this.player.corruption = Math.min(100, this.player.corruption + 2.5 * this.player.corruptionResistMult * dt);

          // Spawn enemies near the breach while holding
          this.breachEnemyTimer -= dt;
          if (this.breachEnemyTimer <= 0) {
            this.breachEnemyTimer = Math.max(3, 6 - this.breachesSealed * 1.5);
            const spawnCount = 3 + this.breachesSealed * 2;
            this.enemies.spawnWave(spawnCount, activeBreach.pos, this.map);
          }
        }

        // Breach sealed
        if (activeBreach.holdTimer >= activeBreach.holdTime) {
          activeBreach.sealed = true;
          this.breachesSealed++;

          // Burst of enemies after sealing
          const burstCount = 8 + this.breachesSealed * 4;
          this.enemies.spawnWave(burstCount, activeBreach.pos, this.map);

          if (this.breachesSealed >= this.breaches.length) {
            // All breaches sealed
            this.complete = true;
            this.hud.showMessage('ALL BREACHES SEALED', 2.5);
            this.hud.showHalMessage(halSay(HAL_CONTRACT_DONE), 5);
            setTimeout(() => this.finishHunt('COMPLETED'), 2000);
          } else {
            // Move to next breach
            this.activeBreachIdx = this.breaches.findIndex(b => !b.sealed);
            this.breachEnemyTimer = 4;
            this.hud.showMessage(`BREACH ${this.breachesSealed}/${this.breaches.length} SEALED`, 2);
            if (this.halCooldown <= 0) {
              setTimeout(() => this.hud.showHalMessage('Breach contained. Moving to next rift.', 4), 1000);
              this.halCooldown = 5;
            }
          }
        }
      }
    }

    // PAYLOAD ESCORT: pod moves toward exit
    if (this.contractType === 'payload_escort' && !this.complete) {
      const podX = WORLD_W * this.podProgress;
      const podY = WORLD_H / 2;
      const podSpeed = 40;
      const nearPlayer = v2dist(this.player.pos, { x: podX, y: podY }) < 250;
      if (nearPlayer && this.podHp > 0) {
        this.podProgress += (podSpeed / WORLD_W) * dt;
      }
      if (this.podProgress >= 1) {
        this.complete = true;
        this.hud.showMessage('POD DELIVERED', 2);
        this.hud.showHalMessage(halSay(HAL_CONTRACT_DONE), 5);
        setTimeout(() => this.finishHunt('COMPLETED'), 2000);
      }
      if (this.podHp <= 0 && !this.complete) {
        this.complete = true;
        this.hud.showMessage('POD DESTROYED', 2);
        setTimeout(() => this.finishHunt('FAILED'), 2000);
      }
    }

    // HUNT & BOSS HUNT: kill target count
    if (this.contractType === 'hunt' && this.targetCount >= this.targetTotal && !this.complete) {
      this.complete = true;
      this.hud.showMessage('CONTRACT COMPLETE', 2);
      this.hud.showHalMessage(halSay(HAL_CONTRACT_DONE), 5);
      setTimeout(() => this.finishHunt('COMPLETED'), 2000);
    }

    // BOSS HUNT: apex must be killed specifically
    if (this.contractType === 'boss_hunt' && this.apexSpawned && !this.complete) {
      const apexAlive = this.enemies.enemies.some(e => e.id === this.apexId);
      if (!apexAlive) {
        this.complete = true;
        this.apexKills++;
        this.hud.showMessage('APEX ELIMINATED', 2.5);
        this.hud.showHalMessage(halSay(HAL_CONTRACT_DONE), 5);
        setTimeout(() => this.finishHunt('COMPLETED'), 2000);
      }
    }

    // EXTRACTION RUN: collect all caches
    if (this.contractType === 'extraction_run' && this.cachesCollected >= this.cacheCount && this.cacheCount > 0 && !this.complete) {
      this.complete = true;
      this.hud.showMessage('ALL CACHES COLLECTED', 2);
      this.hud.showHalMessage(halSay(HAL_CONTRACT_DONE), 5);
      setTimeout(() => this.finishHunt('COMPLETED'), 2000);
    }

    // Dynamic map
    this.map.drawDynamic(this.dynamicGfx, this.elapsed);

    // Update sprites
    this.updateSprites();
    this.cleanupDeadSprites();

    // Draw entity overlays
    this.drawEntities();
    this.drawBullets();

    // Update camera on world layer
    this.worldLayer.x = -this.camera.x;
    this.worldLayer.y = -this.camera.y;

    // HUD
    this.hud.draw(this.player, dt, this.totalKills, this.elapsed, this.equippedKits, this.kitCooldowns);
  }

  private onEnemyKilled(enemy: Enemy) {
    // Sacrifice perk: ally death grants 2s invincibility
    if (enemy.isAlly && this.hasPerk('sacrifice')) {
      this.sacrificeInvincibleTimer = 2;
      this.hud.showMessage('SACRIFICE! 2s INVINCIBLE', 1.5);
    }

    // Chain Reaction perk: enemy killed in gravity well spawns corruption zone
    if (this.hasPerk('chain_reaction') && !enemy.isAlly) {
      for (const gw of this.gravityWells) {
        if (v2dist(enemy.pos, { x: gw.x, y: gw.y }) < gw.radius) {
          this.smokeZones.push({ x: enemy.pos.x, y: enemy.pos.y, radius: 40, life: 5, maxLife: 5, toxic: true });
          break;
        }
      }
    }

    // Multiplier affix: spawn 2 copies at 30% HP
    if (enemy.affixes.includes('multiplier') && !enemy.name.startsWith('Copy:')) {
      for (let mc = 0; mc < 2; mc++) {
        const copy = createEnemy('Void Leech', {
          x: enemy.pos.x + (Math.random() - 0.5) * 60,
          y: enemy.pos.y + (Math.random() - 0.5) * 60,
        }, true);
        copy.name = `Copy: ${enemy.name}`;
        copy.hp = Math.floor(enemy.maxHp * 0.3);
        copy.maxHp = copy.hp;
        copy.speed = enemy.speed;
        copy.radius = enemy.radius * 0.8;
        copy.color = enemy.color;
        copy.meleeDmg = enemy.meleeDmg;
        copy.isElite = false;
        this.enemies.enemies.push(copy);
      }
    }

    this.totalKills++;
    this.targetCount++;
    this.player.essenceCollected++;
    this.halKillsSinceStreak++;
    this.halKillStreakTimer = 4;

    // Modifier effects on kill
    const isVoidEnemy = enemy.voidType;
    if (this.hasMod('void_hunger') && isVoidEnemy) {
      this.player.hp = Math.min(this.player.hp + 1, this.player.maxHp);
    }
    if (this.hasMod('void_drain') && isVoidEnemy) {
      this.player.corruption = Math.max(0, this.player.corruption - 3);
    }
    if (this.hasMod('scavenger')) {
      this.player.essenceCollected++;
    }
    if (this.hasMod('vamp')) {
      this.killsSinceLastHeal++;
      if (this.killsSinceLastHeal >= 5) {
        this.killsSinceLastHeal = 0;
        this.player.hp = Math.min(this.player.hp + 1, this.player.maxHp);
      }
    }
    if (this.hasMod('adrenaline')) {
      this.adrenalineKills++;
      this.adrenalineTimer = 3;
      if (this.adrenalineKills >= 3) {
        this.adrenalineStacks++;
        this.adrenalineKills = 0;
      }
    }
    if (this.hasMod('momentum')) {
      this.momentumHits++;
    }

    // HAL: first kill
    if (this.totalKills === 1 && this.halCooldown <= 0) {
      this.hud.showHalMessage(halSay(HAL_FIRST_KILL), 3);
      this.halCooldown = 5;
    }
    if (enemy.isElite && this.halCooldown <= 0) {
      this.hud.showHalMessage(halSay(HAL_ELITE_SPAWNED), 3);
      this.halCooldown = 6;
    }
    if (enemy.isElite) {
      this.eliteKills++;
      // Stim T3 void: cooldown reset on elite kill
      if ((this.runKitTiers['stim_pack'] || 0) >= 3 && this.kitT3Choices['stim_pack'] === 'void') {
        this.kitCooldowns['stim_pack'] = 0;
      }
    }

    // Check level up
    if (this.player.level < MAX_LEVEL) {
      const threshold = XP_PER_LEVEL[this.player.level] ?? 999;
      if (this.player.essenceCollected >= threshold) {
        this.player.level++;
        this.player.essenceCollected -= threshold;
        this.hud.showMessage(`LEVEL ${this.player.level}!`, 1.5);
        setTimeout(() => this.hud.showHalMessage(halSay(HAL_LEVEL_UP), 4), 1000);
        this.player.maxHp += 1;
        this.player.hp = Math.min(this.player.hp + 1, this.player.maxHp);
        this.pendingLevelUpPicks++;
      }
    } else {
      // Post-cap stat drip: every POST_CAP_XP kills, grant one buff
      if (this.player.essenceCollected >= POST_CAP_XP) {
        this.player.essenceCollected -= POST_CAP_XP;
        this.postCapIndex = (this.postCapIndex + 1) % 4;
        switch (this.postCapIndex) {
          case 0: this.player.speed += 5; this.hud.showMessage('+SPEED', 1); break;
          case 1: this.weapons.fireRateBonus -= 0.02; this.hud.showMessage('+FIRE RATE', 1); break;
          case 2: this.weapons.bulletSpeedBonus += 15; this.hud.showMessage('+PROJ SPEED', 1); break;
          case 3: this.hud.showMessage('+RELOAD', 1); break; // reload bonus applied in weapon system
        }
      }
    }

    // Drop ingredient
    const def = CREATURE_DEFS[enemy.name];
    if (def && Math.random() < 0.3) {
      this.ingredients.push({ id: `ingredient_${def.ingredient.id}`, name: def.ingredient.name });
    }
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

    // Enemy sprites
    for (const e of this.enemies.enemies) {
      const spr = this.getOrCreateEnemySprite(e);
      if (!spr) continue;
      spr.x = e.pos.x;
      spr.y = e.pos.y;
      spr.visible = this.camera.isVisible(e.pos.x, e.pos.y, e.radius * 2);
      spr.tint = e.hitFlash > 0 ? 0xff4444 : 0xffffff;

      // Scale up apex enemy sprite
      if (e.id === this.apexId) {
        spr.scale.set(3.5);
        spr.tint = e.hitFlash > 0 ? 0xff4444 : 0xff8800;
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

  private drawEntities() {
    const g = this.entityGfx;
    g.clear();
    const px = this.player.pos.x, py = this.player.pos.y, pr = this.player.radius;
    const pAlpha = this.player.iFrames > 0 ? 0.4 : 1;
    const hit = this.player.hitFlash > 0;

    // Ã¢ÂÂÃ¢ÂÂ Payload escort pod rendering Ã¢ÂÂÃ¢ÂÂ
    if (this.contractType === 'payload_escort' && this.podHp > 0) {
      const podX = WORLD_W * this.podProgress;
      const podY = WORLD_H / 2;
      g.circle(podX, podY, 20).fill({ color: 0x4db3e6, alpha: 0.8 });
      g.circle(podX, podY, 20).stroke({ color: 0x88ddff, width: 2, alpha: 0.9 });
      g.circle(podX, podY, 30).stroke({ color: 0x4db3e6, width: 1, alpha: 0.3 + Math.sin(this.elapsed * 3) * 0.15 });
      // Pod HP bar
      const podHpFrac = this.podHp / this.podMaxHp;
      const bw = 50;
      g.rect(podX - bw / 2, podY - 35, bw, 4).fill({ color: 0x110000, alpha: 0.8 });
      g.rect(podX - bw / 2, podY - 35, bw * podHpFrac, 4).fill({ color: 0x4db3e6, alpha: 0.9 });
      // Proximity ring
      g.circle(podX, podY, 250).stroke({ color: 0x4db3e6, width: 1, alpha: 0.15 });
      // Off-screen arrow
      const camCx = this.camera.x + this.camera.viewW / 2;
      const camCy = this.camera.y + this.camera.viewH / 2;
      const dx = podX - camCx, dy = podY - camCy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > Math.max(this.camera.viewW, this.camera.viewH) * 0.4) {
        const angle = Math.atan2(dy, dx);
        const arrowDist = 120;
        const ax = px + Math.cos(angle) * arrowDist;
        const ay = py + Math.sin(angle) * arrowDist;
        const sz = 8;
        g.moveTo(ax + Math.cos(angle) * sz, ay + Math.sin(angle) * sz)
          .lineTo(ax + Math.cos(angle + 2.5) * sz, ay + Math.sin(angle + 2.5) * sz)
          .lineTo(ax + Math.cos(angle - 2.5) * sz, ay + Math.sin(angle - 2.5) * sz)
          .closePath().fill({ color: 0x4db3e6, alpha: 0.8 });
      }
    }

    // Ã¢ÂÂÃ¢ÂÂ Void breach zones rendering Ã¢ÂÂÃ¢ÂÂ
    if (this.contractType === 'void_breach') {
      for (const breach of this.breaches) {
        const bx = breach.pos.x, by = breach.pos.y;
        const isActive = !breach.sealed && breach.id === this.activeBreachIdx;
        const progress = Math.min(1, breach.holdTimer / breach.holdTime);

        if (breach.sealed) {
          // Sealed breach: dimmed, no pulse
          g.circle(bx, by, breach.radius).stroke({ color: 0xaa22ff, width: 1, alpha: 0.15 });
          g.circle(bx, by, 8).fill({ color: 0x44cc66, alpha: 0.4 });
          // Checkmark-ish cross
          g.circle(bx, by, breach.radius * 0.3).stroke({ color: 0x44cc66, width: 1, alpha: 0.2 });
        } else if (isActive) {
          // Active breach: pulsing, with progress bar
          const pulse = 0.3 + Math.sin(this.elapsed * 2) * 0.1;
          const innerPulse = 0.6 + Math.sin(this.elapsed * 4) * 0.2;
          g.circle(bx, by, breach.radius).stroke({ color: 0xaa22ff, width: 2, alpha: pulse });
          g.circle(bx, by, breach.radius).fill({ color: 0xaa22ff, alpha: 0.05 + progress * 0.03 });
          g.circle(bx, by, 8).fill({ color: 0xaa22ff, alpha: innerPulse });

          // Progress ring (arc around the breach)
          if (progress > 0) {
            const arcRadius = breach.radius + 8;
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + progress * Math.PI * 2;
            const steps = Math.max(8, Math.floor(progress * 40));
            for (let i = 0; i < steps; i++) {
              const a1 = startAngle + (i / steps) * (endAngle - startAngle);
              const a2 = startAngle + ((i + 1) / steps) * (endAngle - startAngle);
              if (i === 0) g.moveTo(bx + Math.cos(a1) * arcRadius, by + Math.sin(a1) * arcRadius);
              g.lineTo(bx + Math.cos(a2) * arcRadius, by + Math.sin(a2) * arcRadius);
            }
            g.stroke({ color: 0xcc44ff, width: 3, alpha: 0.8 });
          }

          // Progress bar below breach center
          const barW = 80, barH = 6;
          g.rect(bx - barW / 2, by + breach.radius + 15, barW, barH).fill({ color: 0x110011, alpha: 0.8 });
          g.rect(bx - barW / 2, by + breach.radius + 15, barW * progress, barH).fill({ color: 0xcc44ff, alpha: 0.9 });
          g.rect(bx - barW / 2, by + breach.radius + 15, barW, barH).stroke({ color: 0xaa22ff, width: 1, alpha: 0.5 });

          // Off-screen arrow to active breach
          const camCx = this.camera.x + this.camera.viewW / 2;
          const camCy = this.camera.y + this.camera.viewH / 2;
          const dx = bx - camCx, dy = by - camCy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > Math.max(this.camera.viewW, this.camera.viewH) * 0.4) {
            const angle = Math.atan2(dy, dx);
            const arrowDist = 120;
            const ax = px + Math.cos(angle) * arrowDist;
            const ay = py + Math.sin(angle) * arrowDist;
            const sz = 8;
            g.moveTo(ax + Math.cos(angle) * sz, ay + Math.sin(angle) * sz)
              .lineTo(ax + Math.cos(angle + 2.5) * sz, ay + Math.sin(angle + 2.5) * sz)
              .lineTo(ax + Math.cos(angle - 2.5) * sz, ay + Math.sin(angle - 2.5) * sz)
              .closePath().fill({ color: 0xaa22ff, alpha: 0.8 });
          }
        } else {
          // Future breach: faintly visible
          g.circle(bx, by, breach.radius).stroke({ color: 0xaa22ff, width: 1, alpha: 0.08 });
          g.circle(bx, by, 6).fill({ color: 0xaa22ff, alpha: 0.15 });
        }
      }
    }

    // Ã¢ÂÂÃ¢ÂÂ Extraction caches rendering Ã¢ÂÂÃ¢ÂÂ
    if (this.contractType === 'extraction_run') {
      for (const cache of this.caches) {
        if (cache.collected) continue;
        const cx = cache.pos.x, cy = cache.pos.y;
        // Pulsing green diamond
        const pulse = 1 + Math.sin(this.elapsed * 3 + cache.id) * 0.2;
        const r = cache.radius * pulse;
        g.moveTo(cx, cy - r).lineTo(cx + r * 0.7, cy).lineTo(cx, cy + r).lineTo(cx - r * 0.7, cy).closePath();
        g.fill({ color: 0x33e666, alpha: 0.6 });
        g.moveTo(cx, cy - r).lineTo(cx + r * 0.7, cy).lineTo(cx, cy + r).lineTo(cx - r * 0.7, cy).closePath();
        g.stroke({ color: 0x66ff99, width: 2, alpha: 0.9 });
        // Collection radius ring
        g.circle(cx, cy, cache.radius + this.player.radius).stroke({ color: 0x33e666, width: 1, alpha: 0.2 });

        // Off-screen arrow to each uncollected cache
        const camCx = this.camera.x + this.camera.viewW / 2;
        const camCy = this.camera.y + this.camera.viewH / 2;
        const dx = cx - camCx, dy = cy - camCy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > Math.max(this.camera.viewW, this.camera.viewH) * 0.4) {
          const angle = Math.atan2(dy, dx);
          const arrowDist = 100;
          const ax = px + Math.cos(angle) * arrowDist;
          const ay = py + Math.sin(angle) * arrowDist;
          const sz = 6;
          g.moveTo(ax + Math.cos(angle) * sz, ay + Math.sin(angle) * sz)
            .lineTo(ax + Math.cos(angle + 2.5) * sz, ay + Math.sin(angle + 2.5) * sz)
            .lineTo(ax + Math.cos(angle - 2.5) * sz, ay + Math.sin(angle - 2.5) * sz)
            .closePath().fill({ color: 0x33e666, alpha: 0.7 });
        }
      }
    }

    // Ã¢ÂÂÃ¢ÂÂ Boss Hunt apex indicator Ã¢ÂÂÃ¢ÂÂ
    if (this.contractType === 'boss_hunt' && this.apexSpawned) {
      const apex = this.enemies.enemies.find(e => e.id === this.apexId);
      if (apex) {
        // Skull/crown indicator above apex
        g.circle(apex.pos.x, apex.pos.y, apex.radius * 2.5).stroke({ color: 0xff8000, width: 2, alpha: 0.4 + Math.sin(this.elapsed * 2) * 0.2 });
        g.circle(apex.pos.x, apex.pos.y, apex.radius * 3.5).stroke({ color: 0xff8000, width: 1, alpha: 0.15 });
        // Off-screen arrow
        const camCx = this.camera.x + this.camera.viewW / 2;
        const camCy = this.camera.y + this.camera.viewH / 2;
        const dx = apex.pos.x - camCx, dy = apex.pos.y - camCy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > Math.max(this.camera.viewW, this.camera.viewH) * 0.4) {
          const angle = Math.atan2(dy, dx);
          const arrowDist = 120;
          const ax = px + Math.cos(angle) * arrowDist;
          const ay = py + Math.sin(angle) * arrowDist;
          const sz = 8;
          g.moveTo(ax + Math.cos(angle) * sz, ay + Math.sin(angle) * sz)
            .lineTo(ax + Math.cos(angle + 2.5) * sz, ay + Math.sin(angle + 2.5) * sz)
            .lineTo(ax + Math.cos(angle - 2.5) * sz, ay + Math.sin(angle - 2.5) * sz)
            .closePath().fill({ color: 0xff8000, alpha: 0.8 });
        }
      }
    }

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

    // Enemies
    for (const e of this.enemies.enemies) {
      if (!this.camera.isVisible(e.pos.x, e.pos.y, e.radius * 2)) continue;
      const ex = e.pos.x, ey = e.pos.y, er = e.radius * 1.5;
      const col = e.hitFlash > 0 ? 0xffffff : e.color;
      const isVoid = e.voidType;
      const hasSprite = this.spritePool.has(e.id);

      if (e.isAggroed) {
        g.circle(ex, ey, er * 1.6).stroke({ color: col, width: 0.5, alpha: 0.15 });
      }

      if (!hasSprite) {
        if (e.behavior === 'charge' || e.behavior === 'pack') {
          g.moveTo(ex, ey - er).lineTo(ex + er * 0.87, ey + er * 0.5).lineTo(ex - er * 0.87, ey + er * 0.5).closePath();
          g.fill({ color: col, alpha: 0.6 });
          g.moveTo(ex, ey - er).lineTo(ex + er * 0.87, ey + er * 0.5).lineTo(ex - er * 0.87, ey + er * 0.5).closePath();
          g.stroke({ color: col, width: 1.5, alpha: 0.9 });
        } else if (e.behavior === 'strafe' || e.behavior === 'patrol_river') {
          for (let i = 0; i < 6; i++) {
            const a1 = (i / 6) * Math.PI * 2 - Math.PI / 2;
            const a2 = ((i + 1) / 6) * Math.PI * 2 - Math.PI / 2;
            if (i === 0) g.moveTo(ex + Math.cos(a1) * er, ey + Math.sin(a1) * er);
            g.lineTo(ex + Math.cos(a2) * er, ey + Math.sin(a2) * er);
          }
          g.closePath().fill({ color: col, alpha: 0.4 });
          for (let i = 0; i < 6; i++) {
            const a1 = (i / 6) * Math.PI * 2 - Math.PI / 2;
            const a2 = ((i + 1) / 6) * Math.PI * 2 - Math.PI / 2;
            if (i === 0) g.moveTo(ex + Math.cos(a1) * er, ey + Math.sin(a1) * er);
            g.lineTo(ex + Math.cos(a2) * er, ey + Math.sin(a2) * er);
          }
          g.closePath().stroke({ color: col, width: 1.5, alpha: 0.8 });
        } else if (e.behavior === 'lurker') {
          g.moveTo(ex - er, ey - er).lineTo(ex + er, ey + er).stroke({ color: col, width: 3, alpha: 0.7 });
          g.moveTo(ex + er, ey - er).lineTo(ex - er, ey + er).stroke({ color: col, width: 3, alpha: 0.7 });
        } else {
          g.rect(ex - er * 0.7, ey - er * 0.7, er * 1.4, er * 1.4).fill({ color: col, alpha: 0.5 });
          g.rect(ex - er * 0.7, ey - er * 0.7, er * 1.4, er * 1.4).stroke({ color: col, width: 1.5, alpha: 0.8 });
        }
      }

      if (isVoid) {
        g.circle(ex, ey, er * 0.4).fill({ color: 0xff2200, alpha: 0.5 + Math.sin(this.elapsed * 4) * 0.2 });
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
  }

  private drawBullets() {
    const g = this.bulletGfx;
    g.clear();

    for (const b of this.weapons.bullets) {
      if (!this.camera.isVisible(b.pos.x, b.pos.y, b.radius * 3)) continue;
      g.circle(b.pos.x, b.pos.y, b.radius * 3).fill({ color: b.color, alpha: 0.1 });
      g.circle(b.pos.x, b.pos.y, b.radius * 1.5).fill({ color: b.color, alpha: 0.8 });
      g.circle(b.pos.x, b.pos.y, b.radius * 0.8).fill({ color: 0xffffff, alpha: 0.6 });
    }

    // Draw turrets
    for (const t of this.turrets) {
      if (!this.camera.isVisible(t.x, t.y, 20)) continue;
      const alpha = Math.min(t.life / 2, 1);
      // Base
      g.circle(t.x, t.y, 14).fill({ color: 0x112211, alpha: alpha * 0.9 });
      g.circle(t.x, t.y, 14).stroke({ color: 0x44ffaa, width: 2, alpha: alpha * 0.8 });
      // Barrel
      g.circle(t.x, t.y, 6).fill({ color: 0x44ffaa, alpha: alpha * 0.7 });
      g.circle(t.x, t.y, 3).fill({ color: 0xffffff, alpha: alpha * 0.6 });
      // Range indicator
      g.circle(t.x, t.y, t.range).stroke({ color: 0x44ffaa, width: 1, alpha: alpha * 0.08 });
      // Life bar above turret
      const barW = 20;
      const frac = t.life / t.maxLife;
      g.rect(t.x - barW / 2, t.y - 22, barW, 3).fill({ color: 0x111111, alpha: alpha * 0.7 });
      g.rect(t.x - barW / 2, t.y - 22, barW * frac, 3).fill({ color: 0x44ffaa, alpha: alpha * 0.9 });
    }

    // Draw decoys
    for (const dc of this.decoys) {
      if (!this.camera.isVisible(dc.x, dc.y, 18)) continue;
      const dcAlpha = Math.min(dc.life / 1, 1);
      g.circle(dc.x, dc.y, 16).fill({ color: PLAYER_COLOR, alpha: dcAlpha * 0.4 });
      g.circle(dc.x, dc.y, 16).stroke({ color: PLAYER_COLOR, width: 2, alpha: dcAlpha * 0.6 });
      g.circle(dc.x, dc.y, 8).fill({ color: 0xffffff, alpha: dcAlpha * 0.3 });
    }

    // Draw smoke zones
    for (const sz of this.smokeZones) {
      if (!this.camera.isVisible(sz.x, sz.y, sz.radius)) continue;
      const szAlpha = Math.min(sz.life / 2, 1) * 0.15;
      g.circle(sz.x, sz.y, sz.radius).fill({ color: 0x888888, alpha: szAlpha });
      g.circle(sz.x, sz.y, sz.radius).stroke({ color: 0xaaaaaa, width: 1, alpha: szAlpha * 2 });
    }

    // Draw gravity wells
    for (const gw of this.gravityWells) {
      if (!this.camera.isVisible(gw.x, gw.y, gw.radius)) continue;
      const gwAlpha = Math.min(gw.life / 1, 1) * 0.1;
      g.circle(gw.x, gw.y, gw.radius).stroke({ color: 0x6600cc, width: 2, alpha: gwAlpha * 3 });
      g.circle(gw.x, gw.y, gw.radius * 0.5).stroke({ color: 0x9933ff, width: 1, alpha: gwAlpha * 4 });
    }

    // Draw drone
    if (this.droneActive) {
      g.circle(this.dronePos.x, this.dronePos.y, 8).fill({ color: 0x33ccff, alpha: 0.8 });
      g.circle(this.dronePos.x, this.dronePos.y, 8).stroke({ color: 0x66ddff, width: 2, alpha: 0.6 });
      // Intercept range
      g.circle(this.dronePos.x, this.dronePos.y, 100).stroke({ color: 0x33ccff, width: 1, alpha: 0.06 });
    }

    // Draw familiar
    if (this.familiarActive) {
      g.circle(this.familiarPos.x, this.familiarPos.y, 10).fill({ color: 0x9933ff, alpha: 0.7 });
      g.circle(this.familiarPos.x, this.familiarPos.y, 10).stroke({ color: 0xcc66ff, width: 2, alpha: 0.5 });
    }

    // Draw explosions
    for (const ex of this.explosions) {
      if (!this.camera.isVisible(ex.x, ex.y, ex.maxRadius)) continue;
      const alpha = ex.life / ex.maxLife;
      g.circle(ex.x, ex.y, ex.radius).fill({ color: 0xffaa00, alpha: alpha * 0.15 });
      g.circle(ex.x, ex.y, ex.radius * 0.7).fill({ color: 0xff6600, alpha: alpha * 0.3 });
      g.circle(ex.x, ex.y, ex.radius * 0.3).fill({ color: 0xffffff, alpha: alpha * 0.5 });
      g.circle(ex.x, ex.y, ex.radius).stroke({ color: 0xff4400, width: 2, alpha: alpha * 0.6 });
    }

    for (const b of this.enemies.enemyBullets) {
      if (!this.camera.isVisible(b.pos.x, b.pos.y, b.radius * 3)) continue;
      g.circle(b.pos.x, b.pos.y, b.radius * 2.5).fill({ color: 0xff0000, alpha: 0.12 });
      g.circle(b.pos.x, b.pos.y, b.radius * 1.5).fill({ color: 0xff2200, alpha: 0.8 });
      g.circle(b.pos.x, b.pos.y, b.radius * 0.6).fill({ color: 0xff8866, alpha: 0.9 });
    }
  }

  /** Build current progression state snapshot for upgrade generation */
  private getProgressionState(): ProgressionState {
    return {
      weaponId: this.player.weaponId,
      weaponLevel: this.weaponLevel,
      weaponMutated: this.player.mutated !== '',
      weaponMutationType: this.player.mutated,
      corruption: this.player.corruption,
      equippedKits: this.equippedKits,
      kitTiers: { ...this.runKitTiers },
      kitPerksTaken: this.kitPerksTaken,
      masteryTaken: this.masteryTaken,
      resonanceTaken: this.resonanceTaken,
      modifiersTaken: this.activeModifiers,
      kitT3Pending: this.kitT3Pending,
    };
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
    switch (card.type) {
      case 'weapon_upgrade': {
        this.weaponLevel++;
        const wdef = WEAPON_DEFS[this.player.weaponId];
        // Apply perk effect
        if (card.perkEffect === 'damage' && typeof card.perkValue === 'number') {
          // Stored as bonus damage on active modifiers for getModDamageMult
          this.weapons.bonusDamage = (this.weapons.bonusDamage ?? 0) + card.perkValue;
        } else if (card.perkEffect === 'fire_rate' && typeof card.perkValue === 'number') {
          this.weapons.fireRateBonus = (this.weapons.fireRateBonus ?? 0) + card.perkValue;
        } else if (card.perkEffect === 'piercing') {
          this.weapons.piercingCount = (this.weapons.piercingCount ?? 0) + 1;
        } else if (card.perkEffect === 'fire_rate_mag') {
          this.weapons.fireRateBonus = (this.weapons.fireRateBonus ?? 0) - 0.18;
          this.player.magSize += 6;
        } else if (card.perkEffect === 'pellets') {
          this.weapons.extraPellets = (this.weapons.extraPellets ?? 0) + 1;
        } else if (card.perkEffect === 'pellets_rate') {
          this.weapons.extraPellets = (this.weapons.extraPellets ?? 0) + 2;
          this.weapons.fireRateBonus = (this.weapons.fireRateBonus ?? 0) - 0.24;
        } else if (card.perkEffect === 'bullet_speed' && typeof card.perkValue === 'number') {
          this.weapons.bulletSpeedBonus = (this.weapons.bulletSpeedBonus ?? 0) + card.perkValue;
        } else if (card.perkEffect === 'range_bonus' && typeof card.perkValue === 'number') {
          this.weapons.rangeBonus = (this.weapons.rangeBonus ?? 0) + card.perkValue;
        } else if (card.perkEffect === 'radius' && typeof card.perkValue === 'number') {
          this.weapons.radiusBonus = (this.weapons.radiusBonus ?? 0) + card.perkValue;
        } else if (card.perkEffect === 'bounce_extra' && typeof card.perkValue === 'number') {
          this.weapons.bounceExtra = (this.weapons.bounceExtra ?? 0) + card.perkValue;
        } else if (card.perkEffect === 'bounce_radius' && typeof card.perkValue === 'number') {
          this.weapons.bounceRadiusBonus = (this.weapons.bounceRadiusBonus ?? 0) + card.perkValue;
        } else if (card.perkEffect === 'sniper_range') {
          this.weapons.rangeBonus = (this.weapons.rangeBonus ?? 0) + 100;
          this.weapons.bulletSpeedBonus = (this.weapons.bulletSpeedBonus ?? 0) + 100;
        } else if (card.perkEffect === 'damage_knockback' && typeof card.perkValue === 'number') {
          this.weapons.bonusDamage = (this.weapons.bonusDamage ?? 0) + card.perkValue;
          this.weapons.knockback = true;
        }
        // Boolean perks stored as flags
        this.activeModifiers.push(card.id);
        this.hud.showMessage(`+ ${card.label}`, 2);
        break;
      }
      case 'mutation': {
        this.player.mutated = card.mutationType ?? 'clean';
        const mut = WEAPON_MUTATIONS[this.player.weaponId]?.[this.player.mutated];
        const wid = this.player.weaponId;
        const path = this.player.mutated;

        // Apply mutation stat changes per weapon
        if (wid === 'sidearm' && path === 'clean') {
          // Marksman Rifle: fire rate halved, damage x3, +50% range
          this.weapons.fireRateBonus += 0.225;
          this.weapons.bonusDamage += 4;
          this.weapons.rangeBonus += 110;
        } else if (wid === 'sidearm' && path === 'void') {
          // Entropy Gun: fragments on hit
          this.weapons.fragmentOnHit = true;
        } else if (wid === 'scatter' && path === 'clean') {
          // Flechette: tighter spread, pierce 2
          this.weapons.piercingCount += 2;
          this.weapons.bonusDamage += 1;
        } else if (wid === 'scatter' && path === 'void') {
          // Chaos Spray: extra pellets, slight homing
          this.weapons.extraPellets += 3;
        } else if (wid === 'lance' && path === 'clean') {
          // Null Spear: 2x fire rate, slow field on land
          this.weapons.fireRateBonus -= 0.8; // faster
          this.weapons.slowFieldOnLand = true;
        } else if (wid === 'lance' && path === 'void') {
          // Singularity: gravity on hit
          this.weapons.singularityOnHit = true;
        } else if (wid === 'baton' && path === 'clean') {
          // Arc Blade: wider cone, slow fields
          this.weapons.radiusBonus += 20;
          this.weapons.slowFieldOnLand = true;
        } else if (wid === 'baton' && path === 'void') {
          // Consuming Vortex: lifesteal
          this.weapons.lifesteal = true;
        } else if (wid === 'dart' && path === 'clean') {
          // Smart Missile: big slow missile, massive damage
          this.weapons.bonusDamage += 6;
          this.weapons.fireRateBonus += 1.0; // slower
          this.weapons.bulletSpeedBonus -= 60; // slower missile
        } else if (wid === 'dart' && path === 'void') {
          // Parasite Swarm: DOT on hit
          this.weapons.parasiteOnHit = true;
        } else if (wid === 'flamethrower' && path === 'clean') {
          // Cryo Flamer: stun instead of damage
          this.weapons.cryoStun = true;
        } else if (wid === 'flamethrower' && path === 'void') {
          // Corruption Spray: triple damage, player gains corruption
          this.weapons.bonusDamage += 2;
          this.weapons.corruptionOnFire = true;
        } else if (wid === 'grenade_launcher' && path === 'clean') {
          // Airburst: always explode at max range, bigger radius
          this.weapons.radiusBonus += 20;
          this.weapons.airburstOnExpiry = true;
        } else if (wid === 'grenade_launcher' && path === 'void') {
          // Void Grenade: leaves corruption zone
          this.weapons.corruptionZoneOnExplode = true;
        } else if (wid === 'entropy_cannon' && path === 'clean') {
          // Stabilized: flat 3x damage
          this.weapons.bonusDamage += 6;
        } else if (wid === 'entropy_cannon' && path === 'void') {
          // Resonance: corruption scaling triple
          this.weapons.corruptionScaling = true;
        } else if (wid === 'pulse_cannon' && path === 'clean') {
          // Overclock: +50% fire rate
          this.weapons.fireRateBonus -= 0.5;
        } else if (wid === 'pulse_cannon' && path === 'void') {
          // Void Chain: bounces add corruption to enemies
          this.weapons.voidBounce = true;
        } else if (wid === 'sniper_carbine' && path === 'clean') {
          // Killshot: execute enemies under 20% HP
          this.weapons.executeThreshold = 0.2;
        } else if (wid === 'sniper_carbine' && path === 'void') {
          // Void Slug: penetrates all, corruption trail
          this.weapons.piercingCount += 99;
        } else if (wid === 'chain_rifle' && path === 'clean') {
          // Precision Mode: fire rate halved, 4x damage
          this.weapons.fireRateBonus += 0.05; // slower
          this.weapons.bonusDamage += 3;
        } else if (wid === 'chain_rifle' && path === 'void') {
          // Suppressor: slow stacking on hit
          this.weapons.slowOnHit = true;
        }

        this.activeModifiers.push(card.id);
        this.hud.showMessage(`MUTATION: ${mut?.name ?? card.label}`, 3);
        break;
      }
      case 'mastery': {
        this.masteryTaken.push(card.id);
        this.activeModifiers.push(card.id);
        this.hud.showMessage(`MASTERY: ${card.label}`, 2);
        break;
      }
      case 'kit_tier': {
        const kitId = card.kitId!;
        const newTier = card.newTier ?? 2;
        this.runKitTiers[kitId] = newTier;
        this.player.maxHp += 1;
        this.player.hp = Math.min(this.player.hp + 1, this.player.maxHp);
        this.hud.showMessage(`${(KIT_DEFS[kitId]?.name ?? kitId).toUpperCase()} TIER ${newTier}`, 2);
        break;
      }
      case 'kit_perk': {
        this.kitPerksTaken.push(card.id);
        this.activeModifiers.push(card.id);
        this.hud.showMessage(`+ ${card.label}`, 2);
        break;
      }
      case 'resonance': {
        this.resonanceTaken.push(card.id);
        this.activeModifiers.push(card.id);
        this.hud.showMessage(`RESONANCE: ${card.label}`, 2);
        break;
      }
      case 'modifier': {
        this.activeModifiers.push(card.id);
        // Apply instant modifier effects
        if (card.id === 'tough') { this.player.maxHp += 3; this.player.hp = this.player.maxHp; }
        else if (card.id === 'speed') { this.player.baseSpeed += 25; }
        else if (card.id === 'magplus') { this.player.magSize += 4; }
        else if (card.id === 'dodge') { this.player.dodgeChance = 0.1; }
        else if (card.id === 'corruption_resist') { this.player.corruptionResistMult = 0.75; }
        else if (card.id === 'mastery_dmg') { this.weapons.bonusDamage = (this.weapons.bonusDamage ?? 0) + 2; }
        this.hud.showMessage(`+ ${card.label}`, 2);
        break;
      }
      case 'fallback': {
        if (card.id === 'hp_restore') {
          this.player.hp = Math.min(this.player.hp + 3, this.player.maxHp);
        } else if (card.id === 'corr_purge') {
          this.player.corruption = Math.max(0, this.player.corruption - 20);
        } else if (card.id === 'void_drain_f') {
          this.activeModifiers.push('void_drain');
        } else if (card.id === 'pack_hunter_f') {
          this.activeModifiers.push('pack_hunter');
        }
        this.hud.showMessage(`+ ${card.label}`, 2);
        break;
      }
    }
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
  getModSpeedMult(): number {
    let mult = 1;
    if (this.hasMod('last_stand') && this.player.hp < 3) mult *= 1.3;
    if (this.hasMod('adrenaline')) mult *= 1 + this.adrenalineStacks * 0.05;
    return mult;
  }

  finishHunt(status: 'COMPLETED' | 'FAILED' | 'ABANDONED') {
    const credits = Math.floor(this.totalKills * 5 + (status === 'COMPLETED' ? 50 : 10));
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
