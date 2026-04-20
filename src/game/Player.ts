import { type Vec2, v2, v2norm, v2len, v2sub, v2add, v2mul, clamp } from '../lib/math';
import { PLAYER_BASE_SPEED, PLAYER_RADIUS, PLAYER_BASE_HP, WORLD_W, WORLD_H, JOY_MAX_DIST, JOY_DEADZONE } from './constants';
import type { GameMap } from './Map';

export class Player {
  pos: Vec2;
  vel: Vec2 = v2(0, 0);
  radius = PLAYER_RADIUS;
  hp: number;
  maxHp: number;
  speed: number;
  corruption = 0;

  // Joystick
  joyActive = false;
  joyBase: Vec2 = v2(0, 0);
  joyKnob: Vec2 = v2(0, 0);
  joyDir: Vec2 = v2(0, 0);

  // Keyboard
  keys: Record<string, boolean> = {};

  // Weapon state
  weaponId = 'sidearm';
  magAmmo = 12;
  magSize = 12;
  reloadTimer = 0;
  fireCooldown = 0;
  weaponLevel = 1;
  mutated = '';
  justReloaded = false;    // true for one shot after reload (for Precision modifier)
  baseSpeed: number;

  // Aim
  aimAngle = 0;
  nearestEnemyPos: Vec2 | null = null;

  // Last non-zero movement direction (used for melee swing angle)
  lastMoveAngle = Math.PI / 2; // default south

  // Invincibility frames
  iFrames = 0;
  hitFlash = 0;

  // External speed multiplier (set by game systems like void surge)
  externalSpeedMult = 1.0;

  /** Planet inertia: 0 = instant direction change, 1 = ice */
  inertia = 0;

  constructor(x: number, y: number, maxHp: number, magSize: number) {
    this.pos = v2(x, y);
    this.hp = maxHp;
    this.maxHp = maxHp;
    this.speed = PLAYER_BASE_SPEED;
    this.baseSpeed = PLAYER_BASE_SPEED;
    this.magSize = magSize;
    this.magAmmo = magSize;
  }

  update(dt: number, map: GameMap) {
    // Input direction
    let dir = v2(0, 0);

    // Keyboard
    if (this.keys['w'] || this.keys['arrowup']) dir.y -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) dir.y += 1;
    if (this.keys['a'] || this.keys['arrowleft']) dir.x -= 1;
    if (this.keys['d'] || this.keys['arrowright']) dir.x += 1;

    // Joystick overrides keyboard
    if (this.joyActive && v2len(this.joyDir) > 0.1) {
      dir = this.joyDir;
    }

    // Normalize
    if (v2len(dir) > 1) dir = v2norm(dir);

    // Corruption speed modifier
    let speedMod = 1.0;
    if (this.corruption < 15) speedMod = 1.15;
    else if (this.corruption >= 36) speedMod = 1.20;

    // River slowdown
    if (map.isInRiver(this.pos.x, this.pos.y)) speedMod *= 0.6;

    // External speed multiplier (void surge etc.)
    speedMod *= this.externalSpeedMult;

    // Track last movement direction for melee swing
    if (v2len(dir) > 0.1) {
      this.lastMoveAngle = Math.atan2(dir.y, dir.x);
    }

    // Apply velocity (with planet inertia)
    const targetVel = v2mul(dir, this.speed * speedMod);
    if (this.inertia > 0) {
      const blend = 1 - Math.pow(this.inertia, dt * 60);
      this.vel.x += (targetVel.x - this.vel.x) * blend;
      this.vel.y += (targetVel.y - this.vel.y) * blend;
    } else {
      this.vel = targetVel;
    }
    const newX = this.pos.x + this.vel.x * dt;
    const newY = this.pos.y + this.vel.y * dt;

    // Collision with obstacles
    if (!map.isBlocked(newX, this.pos.y, this.radius)) this.pos.x = newX;
    if (!map.isBlocked(this.pos.x, newY, this.radius)) this.pos.y = newY;

    // World bounds
    this.pos.x = clamp(this.pos.x, this.radius, WORLD_W - this.radius);
    this.pos.y = clamp(this.pos.y, this.radius, WORLD_H - this.radius);

    // Void corruption (with resist modifier)
    const voidCorr = map.getVoidCorruption(this.pos.x, this.pos.y);
    if (voidCorr > 0) this.corruption = Math.min(100, this.corruption + voidCorr * this.corruptionResistMult * dt);

    // Reload
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.magAmmo = this.magSize;
        this.reloadTimer = 0;
        this.justReloaded = true;
      }
    }

    // Fire cooldown
    if (this.fireCooldown > 0) this.fireCooldown -= dt;

    // I-frames
    if (this.iFrames > 0) this.iFrames -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;

    // Aim at nearest enemy
    if (this.nearestEnemyPos) {
      this.aimAngle = Math.atan2(this.nearestEnemyPos.y - this.pos.y, this.nearestEnemyPos.x - this.pos.x);
    }
  }

  /** dodgeChance is set by Game when 'dodge' modifier is active */
  dodgeChance = 0;
  /** corruptionResist multiplier (0.75 when modifier active) */
  corruptionResistMult = 1.0;

  // External damage absorption (set by Game for withdrawal/sacrifice perks)
  reloadTimeMult = 1.0;
  absorbNextHit = false;
  invincibleTimer = 0;
  /** Shield hits remaining from familiar SHIELD buff (absorbs N hits) */
  shieldHits = 0;

  takeDamage(amount: number): boolean {
    if (this.iFrames > 0) return false;
    // Dodge check
    if (this.dodgeChance > 0 && Math.random() < this.dodgeChance) return false;
    // Sacrifice invincibility
    if (this.invincibleTimer > 0) return false;
    // Familiar shield absorption (multi-hit)
    if (this.shieldHits > 0) {
      this.shieldHits--;
      this.iFrames = 0.3;
      return false;
    }
    // Withdrawal absorption
    if (this.absorbNextHit) {
      this.absorbNextHit = false;
      this.iFrames = 0.3;
      return false;
    }
    this.hp -= amount;
    this.iFrames = 0.3;
    this.hitFlash = 0.15;
    return this.hp <= 0;
  }

  heal(amount: number) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  // Touch handlers
  onTouchStart(sx: number, sy: number) {
    this.joyActive = true;
    this.joyBase = v2(sx, sy);
    this.joyKnob = v2(sx, sy);
    this.joyDir = v2(0, 0);
  }

  onTouchMove(sx: number, sy: number) {
    if (!this.joyActive) return;
    this.joyKnob = v2(sx, sy);
    const delta = v2sub(this.joyKnob, this.joyBase);
    const dist = v2len(delta);
    if (dist < JOY_DEADZONE) {
      this.joyDir = v2(0, 0);
      return;
    }
    const clamped = Math.min(dist, JOY_MAX_DIST);
    const norm = v2norm(delta);
    this.joyKnob = v2add(this.joyBase, v2mul(norm, clamped));
    this.joyDir = v2mul(norm, clamped / JOY_MAX_DIST);
  }

  onTouchEnd() {
    this.joyActive = false;
    this.joyDir = v2(0, 0);
  }

  // Keyboard handlers
  onKeyDown(key: string) { this.keys[key.toLowerCase()] = true; }
  onKeyUp(key: string) { this.keys[key.toLowerCase()] = false; }
}
