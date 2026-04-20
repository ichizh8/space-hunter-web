import { v2, v2dist, randRange } from '../lib/math';
import { createEnemy } from './Enemies';
import { WORLD_W, WORLD_H } from './constants';
import { ELITE_TYPES, APEX_TYPES, ELITE_OVERRIDES, ELITE_EPITHETS, rollAffixes } from '../data/elites';
import { halSay, HAL_ELITE_SPAWNED, HAL_WAVE_INCOMING } from '../data/hal';
import type { Game } from './Game';

export class SpawnManager {
  /** Called each frame; handles wave, elite, and apex spawn timers. */
  update(dt: number, game: Game): void {
    // Boss Hunt: spawn apex after wave 2
    if (game.contractType === 'boss_hunt' && !game.apexSpawned && game.waveCount >= 2) {
      this.spawnApex(game);
    }

    // Elite spawn timer (60s fixed for hunt; 45-70s for others)
    game.eliteTimer -= dt;
    if (game.eliteTimer <= 0 && !game.modifierPickPending) {
      this.spawnElite(game);
      game.eliteTimer = game.contractType === 'hunt' ? 60 : 45 + Math.random() * 25;
    }

    // Waves
    game.waveTimer -= dt;
    if (game.waveTimer <= 0 && game.enemies.enemies.length < 100 && !game.modifierPickPending) {
      game.waveCount++;
      const count = 20 + game.waveCount * 6 + Math.floor(game.elapsed / 60) * 4;
      const prevLen = game.enemies.enemies.length;
      game.enemies.spawnWave(Math.min(count, 60), game.player.pos, game.map);
      // Time-based enemy scaling: +10% HP per 2min, +5% speed per 3min
      const hpScale = 1 + Math.floor(game.elapsed / 120) * 0.1;
      const spdScale = 1 + Math.floor(game.elapsed / 180) * 0.05;
      for (let ei = prevLen; ei < game.enemies.enemies.length; ei++) {
        const e = game.enemies.enemies[ei];
        e.hp = Math.floor(e.hp * hpScale);
        e.maxHp = e.hp;
        e.speed = Math.floor(e.speed * spdScale);
      }
      game.waveTimer = Math.max(6, 18 - game.waveCount * 1.5);
      game.hud.showMessage(`WAVE ${game.waveCount + 1}`, 1.5);
      if (game.halCooldown <= 0) {
        setTimeout(() => game.hud.showHalMessage(halSay(HAL_WAVE_INCOMING), 3), 600);
        game.halCooldown = 5;
      }

      // Payload escort: extra spawn wave near the pod (double threat near cargo)
      if (game.contractType === 'payload_escort' && game.podHp > 0) {
        const podPos = game.getPodPos();
        const extraCount = Math.max(3, Math.floor(count * 0.5));
        game.enemies.spawnWave(extraCount, podPos, game.map);
      }
    }
  }

  spawnElite(game: Game): void {
    game.eliteSpawnedCount++;
    // Cycle through elite types, 30% chance random instead
    let eliteIdx = (game.eliteSpawnedCount - 1) % ELITE_TYPES.length;
    if (Math.random() < 0.3) eliteIdx = Math.floor(Math.random() * ELITE_TYPES.length);
    const eliteType = ELITE_TYPES[eliteIdx];
    const epithet = ELITE_EPITHETS[Math.floor(Math.random() * ELITE_EPITHETS.length)];
    const displayName = `${eliteType} ${epithet}`;

    // Spawn far from player; elite will use long-range charge to close in
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnDist = 600 + Math.random() * 300;
    const pos = {
      x: Math.max(100, Math.min(WORLD_W - 100, game.player.pos.x + Math.cos(spawnAngle) * spawnDist)),
      y: Math.max(100, Math.min(WORLD_H - 100, game.player.pos.y + Math.sin(spawnAngle) * spawnDist)),
    };

    // Base stats scaled by time
    const depth = Math.min(3, Math.ceil(game.targetTotal / 10));
    const hpScale = 1.0 + (depth - 1) * 0.5 + game.eliteSpawnedCount * 0.2;
    const overrides = ELITE_OVERRIDES[eliteType] || {};
    const baseHp = Math.floor((overrides.hp || 20) * hpScale);
    const baseSpeed = overrides.speed ?? (55 + depth * 10);
    const baseRadius = overrides.radius ?? 20;
    const baseDmg = overrides.meleeDmg ?? (2 + depth);

    const elite = createEnemy('Void Leech', v2(pos.x, pos.y), true);
    elite.name = eliteType;
    elite.hp = baseHp;
    elite.maxHp = baseHp;
    elite.speed = baseSpeed;
    elite.radius = baseRadius;
    elite.meleeDmg = baseDmg;
    elite.color = overrides.color ?? 0xffdd11;
    elite.detection = 9999;
    elite.leash = 99999;
    elite.isElite = true;
    elite.behavior = 'elite';
    elite.eliteChargeTimer = 0;
    elite.eliteAttackTimer = randRange(4, 8);

    // Roll affixes
    let affixCount = 1;
    if (game.elapsed > 600) affixCount = 2 + Math.floor(Math.random() * 2);
    else if (game.elapsed > 300) affixCount = 1 + Math.floor(Math.random() * 2);
    const affixes = rollAffixes(affixCount);
    elite.affixes = affixes;

    for (const affix of affixes) {
      switch (affix) {
        case 'extra_fast': elite.speed *= 1.5; break;
        case 'shielded': elite.shieldHp = Math.floor(elite.maxHp * 0.3); break;
        case 'teleporter': elite.tpTimer = 8; break;
        case 'magnetic': elite.magneticTimer = 5; break;
        case 'armored': break;
        case 'berserker': break;
        default: break;
      }
    }

    game.enemies.enemies.push(elite);
    game.hud.showMessage(`ELITE: ${displayName}`, 2.5);
    if (game.halCooldown <= 0) {
      setTimeout(() => game.hud.showHalMessage(halSay(HAL_ELITE_SPAWNED), 4), 1000);
      game.halCooldown = 6;
    }
  }

  spawnApex(game: Game): void {
    if (game.apexSpawned) return;
    game.apexSpawned = true;

    let pos: { x: number; y: number };
    let attempts = 0;
    do {
      pos = {
        x: randRange(200, WORLD_W - 200),
        y: randRange(200, WORLD_H - 200),
      };
      attempts++;
    } while (v2dist(pos, game.player.pos) < 800 && attempts < 30);

    const apexType = APEX_TYPES[Math.floor(Math.random() * APEX_TYPES.length)];
    game.apexName = apexType;

    const apex = createEnemy('Cave Lurker', pos, true);
    apex.name = apexType;
    apex.hp = 300 + game.contractDifficulty * 50;
    apex.maxHp = apex.hp;
    apex.speed = 110;
    apex.meleeDmg = 6;
    apex.radius = 40;
    apex.detection = 9999;
    apex.behavior = 'elite';
    apex.isElite = true;
    apex.isTarget = true;
    apex.leash = 9999;
    apex.eliteAttackTimer = 1.5;
    apex.eliteAttackCycle = 0;
    apex.eliteChargeTimer = 0;
    game.apexId = apex.id;
    game.apexPhase = 1;
    game.apexAttackTimer = 3;
    game.apexPackTimer = 25;
    game.apexShieldTimer = 30;
    game.apexInstabilityTimer = 8;
    game.enemies.enemies.push(apex);

    game.hud.showMessage(`${apexType.toUpperCase()} DETECTED`, 3);
    game.shakeTimer = 0.4;
    game.shakeAmt = 6;
    if (game.halCooldown <= 0) {
      setTimeout(() => game.hud.showHalMessage(halSay(HAL_ELITE_SPAWNED), 4), 1500);
      game.halCooldown = 6;
    }
  }

  spawnBreaches(game: Game): void {
    const BREACH_COUNT = 3;
    const perBreachTime = game.holdTime;
    game.breaches = [];
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
        (v2dist(pos, game.player.pos) < 500 ||
          game.breaches.some(b => v2dist(pos, b.pos) < 600)) &&
        attempts < 30
      );
      game.breaches.push({
        id: i,
        pos,
        sealed: false,
        holdTimer: 0,
        holdTime: perBreachTime,
        radius: 250,
      });
    }
    game.activeBreachIdx = 0;
    game.breachesSealed = 0;
    game.hud.showMessage(`BREACH 1/${BREACH_COUNT} DETECTED`, 2);
  }

  spawnCaches(game: Game): void {
    game.caches = [];
    for (let i = 0; i < game.cacheCount; i++) {
      let pos: { x: number; y: number };
      let attempts = 0;
      do {
        pos = {
          x: randRange(300, WORLD_W - 300),
          y: randRange(300, WORLD_H - 300),
        };
        attempts++;
      } while (
        (v2dist(pos, game.player.pos) < 950 ||
          game.caches.some(c => v2dist(pos, c.pos) < 700)) &&
        attempts < 60
      );
      game.caches.push({
        id: game.nextCacheId++,
        pos,
        collected: false,
        radius: 30,
      });
    }
  }

  spawnPodPath(game: Game): void {
    const WAYPOINTS = 5 + Math.floor(Math.random() * 3);
    const start = { x: 150, y: WORLD_H / 2 };
    const end   = { x: WORLD_W - 150, y: WORLD_H / 2 };
    game.podPath = [start];
    for (let i = 1; i < WAYPOINTS; i++) {
      const t = i / WAYPOINTS;
      const baseX = start.x + (end.x - start.x) * t;
      const baseY = start.y + (end.y - start.y) * t;
      game.podPath.push({
        x: Math.max(200, Math.min(WORLD_W - 200, baseX + (Math.random() - 0.5) * 400)),
        y: Math.max(200, Math.min(WORLD_H - 200, baseY + (Math.random() - 0.5) * 400)),
      });
    }
    game.podPath.push(end);
    game.podPathProgress = 0;
    game.podProgress = 0;
  }
}
