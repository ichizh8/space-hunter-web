import { type Vec2, v2, v2add, v2mul, v2norm, v2sub, v2dist, v2len, v2fromAngle, randRange } from '../lib/math';
import { WEAPON_DEFS, type WeaponDef } from '../data/weapons';
import { BULLET_MAX_COUNT } from './constants';
import type { Player } from './Player';
import type { PlanetWeaponMod } from '../data/planets';

export interface Bullet {
  pos: Vec2;
  vel: Vec2;
  radius: number;
  color: number;
  damage: number;
  life: number;
  maxLife: number;
  piercing: boolean;
  homing: boolean;
  bounces: number;
  aoeRadius: number;
  fromPlayer: boolean;
  hitSet: Set<number>; // enemy IDs already hit
  tag?: string;       // optional identifier for special bullet types
  aimAngle?: number;  // aim angle at fire time (used for arc filtering)
  lineStart?: Vec2;   // line-slash endpoints (plasma_slash / laser_beam)
  lineEnd?: Vec2;
  pulseTimer?: number; // for pulse_cannon: time until next AOE pulse
  _wallBounced?: boolean; // swarm_chaos: tracks whether this pellet has already bounced off a wall
}

export class WeaponSystem {
  bullets: Bullet[] = [];

  // Upgrade bonuses (accumulated from weapon perks & mutations)
  bonusDamage = 0;
  fireRateBonus = 0;
  bulletSpeedBonus = 0;
  rangeBonus = 0;
  radiusBonus = 0;
  piercingCount = 0;
  extraPellets = 0;
  bounceExtra = 0;
  bounceRadiusBonus = 0;
  knockback = false;
  fragmentOnHit = false;
  // Mastery stat bonuses
  spreadBonus = 0;        // scatter tight_spread: narrows cone
  aoeRadiusBonus = 0;     // grenade wide_burst: bigger explosion
  missileTrackingMult = 1.0; // dart tracking_plus: stronger homing
  missileAoeOnHit = false;   // dart payload: missile explodes on impact
  parasiteDuration = 4;      // dart deep_parasite: 4s base, 6s with perk
  beamWidthMult = 1.0;       // entropy_cannon wide_lens: doubles beam hit radius

  // Mutation flags
  slowFieldOnLand = false;
  singularityOnHit = false;
  lifesteal = false;
  parasiteOnHit = false;
  cryoStun = false;
  corruptionOnFire = false;
  airburstOnExpiry = false;
  corruptionZoneOnExplode = false;
  corruptionScaling = false;
  voidBounce = false;
  executeThreshold = 0;
  slowOnHit = false;
  burnOnHit = false;
  deflect = false;

  // Planet physics (set by Game at hunt start)
  planetBulletSpeedMult = 1.0;
  planetBulletLifeMult = 1.0;
  planetFireRateMult = 1.0;
  planetWeaponMods: PlanetWeaponMod[] = [];

  // Runtime state (updated each frame by Game)
  corruptionLevel = 0;

  fire(player: Player): Bullet[] {
    const def = WEAPON_DEFS[player.weaponId];
    if (!def) return [];
    if (player.fireCooldown > 0) return [];
    if (player.reloadTimer > 0) return [];
    if (player.magAmmo <= 0 && def.magSize < 999) {
      player.reloadTimer = def.reloadTime * player.reloadTimeMult;
      return [];
    }

    player.fireCooldown = Math.max(0.02, (def.fireRate + this.fireRateBonus) * this.planetFireRateMult);
    if (def.magSize < 999) player.magAmmo--;

    const swingAngle = (def.pattern === 'melee_aoe' || def.pattern === 'laser') ? player.lastMoveAngle : player.aimAngle;
    const newBullets = this.createBullets(player.pos, swingAngle, def);
    this.bullets.push(...newBullets);

    // Auto-reload on empty
    if (player.magAmmo <= 0 && def.magSize < 999) {
      player.reloadTimer = def.reloadTime * player.reloadTimeMult;
    }

    // Cap bullet count
    while (this.bullets.length > BULLET_MAX_COUNT) this.bullets.shift();

    return newBullets;
  }

  private createBullets(pos: Vec2, angle: number, def: WeaponDef): Bullet[] {
    // Planet weapon-specific overrides
    const wmod = this.planetWeaponMods.find(m => m.weaponId === def.id);
    const speed = (def.bulletSpeed + this.bulletSpeedBonus) * this.planetBulletSpeedMult * (wmod?.speedMult ?? 1);
    const range = (def.range + this.rangeBonus) * this.planetBulletLifeMult * (wmod?.rangeMult ?? 1);
    const dmg = (def.damage + this.bonusDamage) * (wmod?.damageMult ?? 1);
    const rad = def.bulletRadius + this.radiusBonus;
    const planetPierceAdd = wmod?.piercingAdd ?? 0;
    const planetBounceAdd = wmod?.bouncesAdd ?? 0;
    const makeBullet = (a: number, opts: Partial<Bullet> = {}): Bullet => ({
      pos: v2(pos.x, pos.y),
      vel: v2fromAngle(a, speed),
      radius: rad,
      color: def.color,
      damage: dmg,
      life: range / Math.max(speed, 1),
      maxLife: range / Math.max(speed, 1),
      piercing: this.piercingCount > 0 || planetPierceAdd > 0,
      homing: false,
      bounces: Math.max(0, this.bounceExtra + planetBounceAdd),
      aoeRadius: 0,
      fromPlayer: true,
      hitSet: new Set(),
      ...opts,
    });

    switch (def.pattern) {
      case 'single':
        return [makeBullet(angle, def.id === 'sniper_carbine' ? { tag: 'sniper_trail' } : {})];

      case 'scatter': {
        const count = 5 + this.extraPellets;
        const spread = Math.max(0.05, 0.4 - this.spreadBonus) * (wmod?.spreadMult ?? 1);
        return Array.from({ length: count }, (_, i) => {
          const a = angle - spread / 2 + (spread / (count - 1)) * i + randRange(-0.05, 0.05);
          return makeBullet(a);
        });
      }

      case 'piercing':
        return [makeBullet(angle, { piercing: true })];

      case 'melee_aoe': {
        // Plasma Sword: blade extends from player center, sweeps from aimAngle-70° to aimAngle+70°
        const DEG70 = 70 * Math.PI / 180;
        const sweepStartAngle = angle - DEG70;
        const innerDist = 15;
        const outerDist = (110 + this.radiusBonus) * (wmod?.reachMult ?? 1);
        const lineStart = v2(pos.x + Math.cos(sweepStartAngle) * innerDist, pos.y + Math.sin(sweepStartAngle) * innerDist);
        const lineEnd   = v2(pos.x + Math.cos(sweepStartAngle) * outerDist, pos.y + Math.sin(sweepStartAngle) * outerDist);
        return [makeBullet(angle, {
          pos: v2(pos.x, pos.y),
          vel: v2(0, 0),
          radius: 4, // not used for collision; kept small
          life: 0.25,
          maxLife: 0.25,
          piercing: true,
          hitSet: new Set(),
          tag: 'plasma_slash',
          aimAngle: angle,
          lineStart,
          lineEnd,
        })];
      }

      case 'homing':
        return [makeBullet(angle, { homing: true, life: 3.0, maxLife: 3.0 })];

      case 'cone_stream': {
        const baseLife = range / Math.max(speed, 1);
        const count = Math.random() < 0.5 ? 4 : 5;
        return Array.from({ length: count }, () => {
          const a = angle + randRange(-0.35, 0.35);
          const spdMult = 1 + randRange(-0.2, 0.2);
          const lifeMult = 1 + randRange(-0.15, 0.15);
          const particleRad = 6 + Math.random() * 6; // 6–12
          const particleSpd = Math.max(speed * spdMult, 1);
          const particleLife = (range * lifeMult) / particleSpd;
          return makeBullet(a, {
            vel: v2fromAngle(a, particleSpd),
            radius: particleRad,
            life: particleLife,
            maxLife: particleLife,
          });
        });
      }

      case 'beam_stream': {
        // Continuous beam ray (like laser but sustained purple beam)
        const beamLife = 0.1;
        const beamRange = range * 1.2;
        const a = angle + randRange(-0.03, 0.03);
        return [makeBullet(a, {
          vel: v2(0, 0),
          life: beamLife,
          maxLife: beamLife,
          radius: 2,
          lineStart: v2(pos.x, pos.y),
          lineEnd: v2(pos.x + Math.cos(a) * beamRange, pos.y + Math.sin(a) * beamRange),
          tag: 'void_beam',
          piercing: true,
        })];
      }

      case 'laser': {
        const beamLife = 0.12;
        return [makeBullet(angle, {
          vel: v2(0, 0),
          life: beamLife,
          maxLife: beamLife,
          radius: 2,
          lineStart: v2(pos.x, pos.y),
          lineEnd: v2(pos.x + Math.cos(angle) * range, pos.y + Math.sin(angle) * range),
          tag: 'laser_beam',
          piercing: false,
        })];
      }

      case 'arc_aoe':
        return [makeBullet(angle, { aoeRadius: (80 + this.aoeRadiusBonus) * (wmod?.aoeMult ?? 1), life: range / Math.max(speed, 1), radius: 4 })];

      case 'bounce':
        return [makeBullet(angle, { bounces: Math.max(0, 3 + this.bounceExtra + planetBounceAdd), pulseTimer: 0.5 })];

      default:
        return [makeBullet(angle)];
    }
  }

  update(dt: number, enemies: Array<{ pos: Vec2; id: number }>) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      if (b.life <= 0) { this.bullets.splice(i, 1); continue; }

      // Homing
      if (b.homing && enemies.length > 0) {
        let nearest = enemies[0];
        let nearDist = v2dist(b.pos, nearest.pos);
        for (let e = 1; e < enemies.length; e++) {
          const d = v2dist(b.pos, enemies[e].pos);
          if (d < nearDist) { nearest = enemies[e]; nearDist = d; }
        }
        const toTarget = v2norm(v2sub(nearest.pos, b.pos));
        const speed = v2len(b.vel);
        const currentDir = v2norm(b.vel);
        // tracking_plus: +50% tracking weight (0.2 -> 0.3, capped at 0.95)
        // Planet trackingMult further scales tracking (e.g. Tidal 0.70, Furnace 1.40)
        const planetTrack = this.planetWeaponMods.find(m => m.weaponId === 'dart')?.trackingMult ?? 1;
        const trackW = Math.min(0.95, 0.2 * this.missileTrackingMult * planetTrack);
        const blend = v2norm(v2add(v2mul(currentDir, 1 - trackW), v2mul(toTarget, trackW)));
        b.vel = v2mul(blend, speed);
      }

      b.pos = v2add(b.pos, v2mul(b.vel, dt));
    }
  }

  /** Check bullet-enemy collision. Returns damage dealt, removes bullet if not piercing. */
  checkHit(bullet: Bullet, enemyId: number, enemyPos: Vec2, enemyRadius: number): number {
    if (bullet.hitSet.has(enemyId)) return 0;
    const dist = v2dist(bullet.pos, enemyPos);
    const hitRange = bullet.aoeRadius > 0 ? bullet.aoeRadius : bullet.radius + enemyRadius;
    if (dist > hitRange) return 0;

    bullet.hitSet.add(enemyId);
    if (!bullet.piercing && bullet.aoeRadius === 0) {
      if (bullet.bounces > 0) {
        bullet.bounces--;
        // Reflect in random direction
        const a = Math.atan2(bullet.vel.y, bullet.vel.x) + randRange(-1, 1);
        const spd = v2len(bullet.vel);
        bullet.vel = v2fromAngle(a, spd);
      } else {
        bullet.life = 0; // Mark for removal
      }
    }
    return bullet.damage;
  }

  clear() { this.bullets = []; }
}
