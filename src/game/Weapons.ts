import { type Vec2, v2, v2add, v2mul, v2norm, v2sub, v2dist, v2len, v2fromAngle, randRange } from '../lib/math';
import { WEAPON_DEFS, type WeaponDef } from '../data/weapons';
import { BULLET_MAX_COUNT } from './constants';
import type { Player } from './Player';

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

  // Runtime state (updated each frame by Game)
  corruptionLevel = 0;

  fire(player: Player): Bullet[] {
    const def = WEAPON_DEFS[player.weaponId];
    if (!def) return [];
    if (player.fireCooldown > 0) return [];
    if (player.reloadTimer > 0) return [];
    if (player.magAmmo <= 0 && def.magSize < 999) {
      player.reloadTimer = def.reloadTime;
      return [];
    }

    player.fireCooldown = Math.max(0.02, def.fireRate + this.fireRateBonus);
    if (def.magSize < 999) player.magAmmo--;

    const newBullets = this.createBullets(player.pos, player.aimAngle, def);
    this.bullets.push(...newBullets);

    // Auto-reload on empty
    if (player.magAmmo <= 0 && def.magSize < 999) {
      player.reloadTimer = def.reloadTime;
    }

    // Cap bullet count
    while (this.bullets.length > BULLET_MAX_COUNT) this.bullets.shift();

    return newBullets;
  }

  private createBullets(pos: Vec2, angle: number, def: WeaponDef): Bullet[] {
    const speed = def.bulletSpeed + this.bulletSpeedBonus;
    const range = def.range + this.rangeBonus;
    const dmg = def.damage + this.bonusDamage;
    const rad = def.bulletRadius + this.radiusBonus;
    const makeBullet = (a: number, opts: Partial<Bullet> = {}): Bullet => ({
      pos: v2(pos.x, pos.y),
      vel: v2fromAngle(a, speed),
      radius: rad,
      color: def.color,
      damage: dmg,
      life: range / Math.max(speed, 1),
      maxLife: range / Math.max(speed, 1),
      piercing: this.piercingCount > 0,
      homing: false,
      bounces: this.bounceExtra,
      aoeRadius: 0,
      fromPlayer: true,
      hitSet: new Set(),
      ...opts,
    });

    switch (def.pattern) {
      case 'single': {
        // Entropy cannon: scale bullet radius with corruption (base 10, up to 16 at 90 corruption)
        const corrRadiusBonus = def.id === 'entropy_cannon'
          ? Math.floor((this.corruptionLevel / 90) * 6)
          : 0;
        return [makeBullet(angle, { radius: rad + corrRadiusBonus })];
      }

      case 'scatter': {
        const count = 5 + this.extraPellets;
        const spread = 0.4;
        return Array.from({ length: count }, (_, i) => {
          const a = angle - spread / 2 + (spread / (count - 1)) * i + randRange(-0.05, 0.05);
          return makeBullet(a);
        });
      }

      case 'piercing':
        return [makeBullet(angle, { piercing: true })];

      case 'melee_aoe': {
        // Arc wave: 6 slash projectiles fanned across ±70° (140° total) centered on aim
        const sharedHitSet = new Set<number>();
        const arcCount = 6;
        const arcHalfRad = (Math.PI * 70) / 180; // 70° each side = 140° arc
        const slashSpeed = 350;
        const slashLife = range / slashSpeed; // ~0.33s at base 115px range; scales with range upgrades
        return Array.from({ length: arcCount }, (_, i) => {
          const a = angle - arcHalfRad + (arcHalfRad * 2 / (arcCount - 1)) * i;
          return makeBullet(a, {
            vel: v2fromAngle(a, slashSpeed),
            life: slashLife,
            maxLife: slashLife,
            radius: rad,
            hitSet: sharedHitSet,
            piercing: true,
          });
        });
      }

      case 'homing':
        return [makeBullet(angle, { homing: true, life: 3.0, maxLife: 3.0 })];

      case 'cone_stream': {
        const particleLife = range / Math.max(speed, 1);
        return [0, 1, 2].map(() => {
          const a = angle + randRange(-0.22, 0.22);
          return makeBullet(a, { life: particleLife, maxLife: particleLife });
        });
      }

      case 'arc_aoe':
        return [makeBullet(angle, { aoeRadius: 80, life: def.range / def.bulletSpeed, radius: 4 })];

      case 'bounce':
        return [makeBullet(angle, { bounces: 3 })];

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
        const blend = v2norm(v2add(v2mul(currentDir, 0.8), v2mul(toTarget, 0.2)));
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
