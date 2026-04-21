import { Graphics } from 'pixi.js';
import { v2dist, v2sub, v2norm } from '../lib/math';
import { createEnemy, type Enemy } from './Enemies';
import { halSay, HAL_CONTRACT_DONE, HAL_PLAYER_DIED } from '../data/hal';
import type { Game } from './Game';

export class ContractObjectives {
  /** Check objective progress, update breach/escort/extraction state, complete contract. */
  update(dt: number, game: Game): void {
    // Ã¢ÂÂÃ¢ÂÂ Extraction: cache collection Ã¢ÂÂÃ¢ÂÂ
    if (game.contractType === 'extraction_run') {
      for (const cache of game.caches) {
        if (cache.collected) continue;
        if (v2dist(game.player.pos, cache.pos) < cache.radius + game.player.radius) {
          cache.collected = true;
          game.cachesCollected++;
          game.hud.showMessage(`CACHE ${game.cachesCollected}/${game.cacheCount}`, 1.5);
          // Grant bonus ingredient
          game.ingredients.push({ id: `cache_loot_${cache.id}`, name: 'Cache Contents' });
        }
      }
    }

    // Spawn timers: waves, elites, apex
    game.spawnManager.update(dt, game);
    // Boss Hunt: run apex boss behavior (separate from spawning)
    if (game.contractType === 'boss_hunt' && game.apexSpawned) {
      game.updateApexBoss(dt);
    }
    // Final Hunt: run Hollow Boss behavior + instability zones
    if (game.contractType === 'final_hunt' && game.hollowPhase > 0) {
      game.updateHollowBoss(dt);
      // Update instability zones: damage + corruption inside
      for (let i = game.instabilityZones.length - 1; i >= 0; i--) {
        const iz = game.instabilityZones[i];
        iz.timer -= dt;
        if (iz.timer <= 0) { game.instabilityZones.splice(i, 1); continue; }
        if (v2dist(game.player.pos, { x: iz.x, y: iz.y }) < iz.radius) {
          game.player.hp -= 1.5 * dt;
          game.player.corruption = Math.min(100, game.player.corruption + 3 * dt);
        }
      }
    }

    // ── Dash update ──
    if (game.dashActive) {
      game.dashTimer -= dt;
      game.player.pos.x += game.dashVelX * dt;
      game.player.pos.y += game.dashVelY * dt;
      game.player.iFrames = Math.max(game.player.iFrames, game.dashTimer + 0.01);
      if (game.dashTimer <= 0) game.dashActive = false;
    }
    if (game.dashCooldown > 0) {
      game.dashCooldown -= dt;
      if (game.dashCooldown <= 0 && game.dashCharges < game.dashMaxCharges) {
        game.dashCharges++;
        if (game.dashCharges < game.dashMaxCharges) game.dashCooldown = game.dashMaxCooldown;
      }
    }

    // ── Active drop effect timers ──
    if (game.damageBurstTimer > 0) game.damageBurstTimer -= dt;
    if (game.speedBoostTimer > 0) game.speedBoostTimer -= dt;

    // ── Ally drone update ──
    for (let i = game.allyDrones.length - 1; i >= 0; i--) {
      const d = game.allyDrones[i];
      d.life -= dt;
      if (d.life <= 0 || d.hp <= 0) { game.allyDrones.splice(i, 1); continue; }
      // Orbit player
      const orbitAngle = (game.elapsed * 2.5 + i * Math.PI) % (Math.PI * 2);
      d.x = game.player.pos.x + Math.cos(orbitAngle) * 60;
      d.y = game.player.pos.y + Math.sin(orbitAngle) * 60;
      // Fire at nearest enemy
      d.fireTimer -= dt;
      if (d.fireTimer <= 0) {
        d.fireTimer = 1.2;
        let bestDist = 250; let bestEnemy: Enemy | null = null;
        for (const e of game.enemies.enemies) {
          if (e.hp <= 0 || e.isAlly) continue;
          const ed = v2dist({ x: d.x, y: d.y }, e.pos);
          if (ed < bestDist) { bestDist = ed; bestEnemy = e; }
        }
        if (bestEnemy) {
          bestEnemy.hp -= 4;
          bestEnemy.hitFlash = 0.15;
          if (bestEnemy.hp <= 0) game.onEnemyKilled(bestEnemy);
          game.explosions.push({ x: d.x, y: d.y, radius: 0, maxRadius: 8, life: 0.1, maxLife: 0.1 });
        }
      }
    }

    // ── Drop capsule update ──
    game.dropSystem.update(dt, game);

    // Death check
    if (game.player.hp <= 0 && !game.dead) {
      // Emergency Protocol: revive once with 3 HP
      if ((game.shipUpgrades.emergency_protocol ?? 0) >= 1 && !game.emergencyProtocolUsed) {
        game.emergencyProtocolUsed = true;
        game.player.hp = 3;
        game.player.iFrames = 2.0;
        game.hud.showMessage('EMERGENCY PROTOCOL!', 2.5);
        game.screenFlash = 0.6;
      } else {
        game.dead = true;
        game.hud.showMessage('YOU DIED', 3);
        game.hud.showHalMessage(halSay(HAL_PLAYER_DIED), 4);
        setTimeout(() => game.finishHunt('FAILED'), 2000);
      }
    }

    // Ã¢ÂÂÃ¢ÂÂ Contract completion checks Ã¢ÂÂÃ¢ÂÂ

    // VOID BREACH: sequential breach zones
    if (game.contractType === 'void_breach' && !game.complete && game.breaches.length > 0) {
      const activeBreach = game.breaches[game.activeBreachIdx];
      if (activeBreach && !activeBreach.sealed) {
        const distToBreach = v2dist(game.player.pos, activeBreach.pos);
        game.holdZoneActive = distToBreach < activeBreach.radius;

        // Breach gravity pull: 30px/s toward center for player and enemies
        const GRAVITY_PULL = 30;
        const GRAVITY_RANGE = activeBreach.radius * 1.5;
        if (distToBreach < GRAVITY_RANGE && distToBreach > 5) {
          const pullDir = v2norm(v2sub(activeBreach.pos, game.player.pos));
          game.player.pos.x += pullDir.x * GRAVITY_PULL * dt;
          game.player.pos.y += pullDir.y * GRAVITY_PULL * dt;
        }
        for (const e of game.enemies.enemies) {
          if (e.hp <= 0 || e.isAlly) continue;
          const ed = v2dist(e.pos, activeBreach.pos);
          if (ed < GRAVITY_RANGE && ed > 5) {
            const pullDir = v2norm(v2sub(activeBreach.pos, e.pos));
            e.pos.x += pullDir.x * GRAVITY_PULL * dt;
            e.pos.y += pullDir.y * GRAVITY_PULL * dt;
          }
        }

        if (game.holdZoneActive) {
          activeBreach.holdTimer += dt;
          game.player.corruption = Math.min(100, game.player.corruption + 2.5 * game.player.corruptionResistMult * dt);

          // Spawn enemies near the breach while holding
          game.breachEnemyTimer -= dt;
          if (game.breachEnemyTimer <= 0) {
            game.breachEnemyTimer = Math.max(3, 6 - game.breachesSealed * 1.5);
            const spawnCount = 3 + game.breachesSealed * 2;
            game.enemies.spawnWave(spawnCount, activeBreach.pos, game.map);
          }

          // Breach swarms: 5-8 small fast weak enemies every 15s
          game.breachSwarmTimer -= dt;
          if (game.breachSwarmTimer <= 0) {
            game.breachSwarmTimer = 15;
            const swarmCount = 5 + Math.floor(Math.random() * 4);
            for (let si = 0; si < swarmCount; si++) {
              const angle = Math.random() * Math.PI * 2;
              const spawnDist = activeBreach.radius * (0.3 + Math.random() * 0.4);
              const spawnPos = {
                x: activeBreach.pos.x + Math.cos(angle) * spawnDist,
                y: activeBreach.pos.y + Math.sin(angle) * spawnDist,
              };
              const swarm = createEnemy('Void Leech', spawnPos, false);
              swarm.hp = Math.max(1, Math.floor(swarm.maxHp * 0.3));
              swarm.maxHp = swarm.hp;
              swarm.speed = Math.floor(swarm.speed * 1.5);
              swarm.radius = Math.floor(swarm.radius * 0.7);
              game.enemies.enemies.push(swarm);
            }
          }

          // Breach elite: one every 45s (accelerated vs normal 45-70s)
          game.breachEliteTimer -= dt;
          if (game.breachEliteTimer <= 0) {
            game.breachEliteTimer = 45;
            game.spawnManager.spawnElite(game);
          }
        }

        // Instability zones: spawn every 10s near active breach, 4s duration
        game.instabilityTimer -= dt;
        if (game.instabilityTimer <= 0) {
          game.instabilityTimer = 10;
          const angle = Math.random() * Math.PI * 2;
          const dist = activeBreach.radius * (0.4 + Math.random() * 0.5);
          game.instabilityZones.push({
            x: activeBreach.pos.x + Math.cos(angle) * dist,
            y: activeBreach.pos.y + Math.sin(angle) * dist,
            timer: 4,
            maxTimer: 4,
            radius: 80 + Math.random() * 40,
          });
        }

        // Update instability zones: damage + corruption + slow player inside
        for (let i = game.instabilityZones.length - 1; i >= 0; i--) {
          const iz = game.instabilityZones[i];
          iz.timer -= dt;
          if (iz.timer <= 0) { game.instabilityZones.splice(i, 1); continue; }
          if (v2dist(game.player.pos, { x: iz.x, y: iz.y }) < iz.radius) {
            game.player.hp -= 1 * dt;
            game.player.corruption = Math.min(100, game.player.corruption + 2 * dt);
            if (game.player.hp <= 0 && !game.dead) {
              game.dead = true;
              game.hud.showMessage('YOU DIED', 3);
              game.hud.showHalMessage(halSay(HAL_PLAYER_DIED), 4);
              setTimeout(() => game.finishHunt('FAILED'), 2000);
            }
          }
        }

        // Breach sealed
        if (activeBreach.holdTimer >= activeBreach.holdTime) {
          activeBreach.sealed = true;
          game.breachesSealed++;

          // Burst of enemies after sealing
          const burstCount = 8 + game.breachesSealed * 4;
          game.enemies.spawnWave(burstCount, activeBreach.pos, game.map);

          if (game.breachesSealed >= game.breaches.length) {
            // All breaches sealed
            game.complete = true;
            game.hud.showMessage('ALL BREACHES SEALED', 2.5);
            game.hud.showHalMessage(halSay(HAL_CONTRACT_DONE), 5);
            setTimeout(() => game.finishHunt('COMPLETED'), 2000);
          } else {
            // Move to next breach
            game.activeBreachIdx = game.breaches.findIndex(b => !b.sealed);
            game.breachEnemyTimer = 4;
            game.breachSwarmTimer = 15;
            game.instabilityTimer = 10;
            game.breachEliteTimer = 45;
            game.hud.showMessage(`BREACH ${game.breachesSealed}/${game.breaches.length} SEALED`, 2);
            if (game.halCooldown <= 0) {
              setTimeout(() => game.hud.showHalMessage('Breach contained. Moving to next rift.', 4), 1000);
              game.halCooldown = 5;
            }
          }
        }
      }
    }

    // PAYLOAD ESCORT: pod moves along winding path toward exit
    if (game.contractType === 'payload_escort' && !game.complete) {
      const podPos = game.getPodPos();

      // Slow zones: spawn every 20s near pod, 5s duration, slow pod 50%
      game.podSlowZoneTimer -= dt;
      if (game.podSlowZoneTimer <= 0) {
        game.podSlowZoneTimer = 20;
        game.podSlowZones.push({
          x: podPos.x + (Math.random() - 0.5) * 300,
          y: podPos.y + (Math.random() - 0.5) * 300,
          timer: 5,
          radius: 100,
        });
      }
      for (let i = game.podSlowZones.length - 1; i >= 0; i--) {
        game.podSlowZones[i].timer -= dt;
        if (game.podSlowZones[i].timer <= 0) game.podSlowZones.splice(i, 1);
      }

      // Pod base speed 32 (20% slower than original 40), halved by slow zones
      let podSpeed = 32;
      for (const sz of game.podSlowZones) {
        if (v2dist(podPos, { x: sz.x, y: sz.y }) < sz.radius) { podSpeed *= 0.5; break; }
      }

      const nearPlayer = v2dist(game.player.pos, podPos) < 250;
      if (nearPlayer && game.podHp > 0) {
        const segments = Math.max(1, game.podPath.length - 1);
        game.podPathProgress = Math.min(segments, game.podPathProgress + (podSpeed / 800) * dt);
        game.podProgress = game.podPathProgress / segments;
      }

      if (game.podProgress >= 1) {
        game.complete = true;
        game.hud.showMessage('POD DELIVERED', 2);
        game.hud.showHalMessage(halSay(HAL_CONTRACT_DONE), 5);
        setTimeout(() => game.finishHunt('COMPLETED'), 2000);
      }
      if (game.podHp <= 0 && !game.complete) {
        game.complete = true;
        game.hud.showMessage('POD DESTROYED', 2);
        setTimeout(() => game.finishHunt('FAILED'), 2000);
      }
    }

    // Room-based contracts: completion happens via extraction door in transitionToRoom
    if (game.currentRoom) return;

    // HUNT: elite kills only count toward objective
    if (game.contractType === 'hunt' && game.eliteKillsForContract >= game.targetTotal && !game.complete) {
      game.complete = true;
      game.hud.showMessage('CONTRACT COMPLETE', 2);
      game.hud.showHalMessage(halSay(HAL_CONTRACT_DONE), 5);
      setTimeout(() => game.finishHunt('COMPLETED'), 2000);
    }

    // BOSS HUNT: apex must be killed specifically
    if (game.contractType === 'boss_hunt' && game.apexSpawned && !game.complete) {
      const apexAlive = game.enemies.enemies.some(e => e.id === game.apexId);
      if (!apexAlive) {
        game.complete = true;
        game.apexKills++;
        game.hud.showMessage('APEX ELIMINATED', 2.5);
        game.hud.showHalMessage(halSay(HAL_CONTRACT_DONE), 5);
        setTimeout(() => game.finishHunt('COMPLETED'), 2000);
      }
    }

    // EXTRACTION RUN: collect all caches
    if (game.contractType === 'extraction_run' && game.cachesCollected >= game.cacheCount && game.cacheCount > 0 && !game.complete) {
      game.complete = true;
      game.hud.showMessage('ALL CACHES COLLECTED', 2);
      game.hud.showHalMessage(halSay(HAL_CONTRACT_DONE), 5);
      setTimeout(() => game.finishHunt('COMPLETED'), 2000);
    }

    // FINAL HUNT: Hollow Boss must be killed
    if (game.contractType === 'final_hunt' && game.hollowBossId >= 0 && !game.complete) {
      const bossAlive = game.enemies.enemies.some(e => e.id === game.hollowBossId && e.hp > 0);
      if (!bossAlive && game.hollowPhase >= 4) {
        game.complete = true;
        game.apexKills++;
        game.hud.showMessage('THE HOLLOW HEART IS SILENCED', 3);
        game.hud.showHalMessage('It\'s... quiet now. The void is fading. Let\'s get out of here.', 6);
        game.shakeTimer = 1.0;
        game.shakeAmt = 12;
        game.screenFlash = 1.0;
        setTimeout(() => game.finishHunt('COMPLETED'), 3000);
      }
    }
  }

  /** Draw contract-specific world overlays (pod, breaches, caches, apex). */
  draw(g: Graphics, game: Game, px: number, py: number): void {
    // ── Payload escort pod rendering ──
    if (game.contractType === 'payload_escort' && game.podHp > 0) {
      const { x: podX, y: podY } = game.getPodPos();

      // Draw winding path line
      if (game.podPath.length >= 2) {
        const seg = Math.max(1, game.podPath.length - 1);
        const curSegIdx = Math.min(seg - 1, Math.floor(game.podPathProgress));
        for (let pi = curSegIdx; pi < game.podPath.length - 1; pi++) {
          const a = game.podPath[pi], b = game.podPath[pi + 1];
          g.moveTo(a.x, a.y).lineTo(b.x, b.y);
          g.stroke({ color: 0x4db3e6, width: 1, alpha: 0.2 });
        }
      }

      // Draw slow zones (yellow hazard circles)
      for (const sz of game.podSlowZones) {
        const fadeIn = Math.min(1, (5 - sz.timer) / 0.5);
        g.circle(sz.x, sz.y, sz.radius).fill({ color: 0xffcc00, alpha: 0.08 * fadeIn });
        g.circle(sz.x, sz.y, sz.radius).stroke({ color: 0xffcc00, width: 1.5, alpha: 0.35 * fadeIn });
      }

      g.circle(podX, podY, 20).fill({ color: 0x4db3e6, alpha: 0.8 });
      g.circle(podX, podY, 20).stroke({ color: 0x88ddff, width: 2, alpha: 0.9 });
      g.circle(podX, podY, 30).stroke({ color: 0x4db3e6, width: 1, alpha: 0.3 + Math.sin(game.elapsed * 3) * 0.15 });
      // Pod HP bar
      const podHpFrac = game.podHp / game.podMaxHp;
      const bw = 50;
      g.rect(podX - bw / 2, podY - 35, bw, 4).fill({ color: 0x110000, alpha: 0.8 });
      g.rect(podX - bw / 2, podY - 35, bw * podHpFrac, 4).fill({ color: 0x4db3e6, alpha: 0.9 });
      // Proximity ring
      g.circle(podX, podY, 250).stroke({ color: 0x4db3e6, width: 1, alpha: 0.15 });
      // Off-screen arrow
      const camCx = game.camera.x + game.camera.viewW / 2;
      const camCy = game.camera.y + game.camera.viewH / 2;
      const dx = podX - camCx, dy = podY - camCy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > Math.max(game.camera.viewW, game.camera.viewH) * 0.4) {
        const angle = Math.atan2(dy, dx);
        const arrowDist = 120;
        const ax = px + Math.cos(angle) * arrowDist;
        const ay = py + Math.sin(angle) * arrowDist;
        const sz2 = 8;
        g.moveTo(ax + Math.cos(angle) * sz2, ay + Math.sin(angle) * sz2)
          .lineTo(ax + Math.cos(angle + 2.5) * sz2, ay + Math.sin(angle + 2.5) * sz2)
          .lineTo(ax + Math.cos(angle - 2.5) * sz2, ay + Math.sin(angle - 2.5) * sz2)
          .closePath().fill({ color: 0x4db3e6, alpha: 0.8 });
      }
    }

    // Ã¢ÂÂÃ¢ÂÂ Void breach zones rendering Ã¢ÂÂÃ¢ÂÂ
    if (game.contractType === 'void_breach') {
      for (const breach of game.breaches) {
        const bx = breach.pos.x, by = breach.pos.y;
        const isActive = !breach.sealed && breach.id === game.activeBreachIdx;
        const progress = Math.min(1, breach.holdTimer / breach.holdTime);

        if (breach.sealed) {
          // Sealed breach: dimmed, no pulse
          g.circle(bx, by, breach.radius).stroke({ color: 0xaa22ff, width: 1, alpha: 0.15 });
          g.circle(bx, by, 8).fill({ color: 0x44cc66, alpha: 0.4 });
          // Checkmark-ish cross
          g.circle(bx, by, breach.radius * 0.3).stroke({ color: 0x44cc66, width: 1, alpha: 0.2 });
        } else if (isActive) {
          // Active breach: pulsing, with progress bar
          const pulse = 0.3 + Math.sin(game.elapsed * 2) * 0.1;
          const innerPulse = 0.6 + Math.sin(game.elapsed * 4) * 0.2;
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
          const camCx = game.camera.x + game.camera.viewW / 2;
          const camCy = game.camera.y + game.camera.viewH / 2;
          const dx = bx - camCx, dy = by - camCy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > Math.max(game.camera.viewW, game.camera.viewH) * 0.4) {
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

      // Instability zones: pulsing purple hazard circles
      for (const iz of game.instabilityZones) {
        const lifeFrac = iz.timer / iz.maxTimer;
        const pulse = 0.5 + Math.sin(game.elapsed * 6) * 0.2;
        g.circle(iz.x, iz.y, iz.radius).fill({ color: 0x660088, alpha: 0.12 * lifeFrac });
        g.circle(iz.x, iz.y, iz.radius).stroke({ color: 0xcc00ff, width: 2, alpha: pulse * lifeFrac });
        g.circle(iz.x, iz.y, iz.radius * 0.3).fill({ color: 0xcc00ff, alpha: 0.2 * lifeFrac });
      }
    }

    // Ã¢ÂÂÃ¢ÂÂ Extraction caches rendering Ã¢ÂÂÃ¢ÂÂ Ã¢ÂÂÃ¢ÂÂ
    if (game.contractType === 'extraction_run') {
      for (const cache of game.caches) {
        if (cache.collected) continue;
        const cx = cache.pos.x, cy = cache.pos.y;
        // Pulsing green diamond
        const pulse = 1 + Math.sin(game.elapsed * 3 + cache.id) * 0.2;
        const r = cache.radius * pulse;
        g.moveTo(cx, cy - r).lineTo(cx + r * 0.7, cy).lineTo(cx, cy + r).lineTo(cx - r * 0.7, cy).closePath();
        g.fill({ color: 0x33e666, alpha: 0.6 });
        g.moveTo(cx, cy - r).lineTo(cx + r * 0.7, cy).lineTo(cx, cy + r).lineTo(cx - r * 0.7, cy).closePath();
        g.stroke({ color: 0x66ff99, width: 2, alpha: 0.9 });
        // Collection radius ring
        g.circle(cx, cy, cache.radius + game.player.radius).stroke({ color: 0x33e666, width: 1, alpha: 0.2 });

        // Off-screen arrow to each uncollected cache
        const camCx = game.camera.x + game.camera.viewW / 2;
        const camCy = game.camera.y + game.camera.viewH / 2;
        const dx = cx - camCx, dy = cy - camCy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > Math.max(game.camera.viewW, game.camera.viewH) * 0.4) {
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
    if (game.contractType === 'boss_hunt' && game.apexSpawned) {
      const apex = game.enemies.enemies.find(e => e.id === game.apexId);
      if (apex) {
        // Skull/crown indicator above apex
        g.circle(apex.pos.x, apex.pos.y, apex.radius * 2.5).stroke({ color: 0xff8000, width: 2, alpha: 0.4 + Math.sin(game.elapsed * 2) * 0.2 });
        g.circle(apex.pos.x, apex.pos.y, apex.radius * 3.5).stroke({ color: 0xff8000, width: 1, alpha: 0.15 });
        // Off-screen arrow
        const camCx = game.camera.x + game.camera.viewW / 2;
        const camCy = game.camera.y + game.camera.viewH / 2;
        const dx = apex.pos.x - camCx, dy = apex.pos.y - camCy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > Math.max(game.camera.viewW, game.camera.viewH) * 0.4) {
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

    // Final Hunt: Hollow Boss arena + boss indicator
    if (game.contractType === 'final_hunt') {
      // Arena boundary ring (pulsing, red/dark)
      if (game.hollowArenaRadius > 0) {
        const cx = game.hollowArenaCenter.x;
        const cy = game.hollowArenaCenter.y;
        const pulse = 0.3 + Math.sin(game.elapsed * 1.5) * 0.1;
        g.circle(cx, cy, game.hollowArenaRadius).stroke({ color: 0xff0044, width: 3, alpha: pulse });
        // Inner warning ring
        g.circle(cx, cy, game.hollowArenaRadius - 30).stroke({ color: 0xff0044, width: 1, alpha: 0.1 });
        // Shrinking visual: fill outside arena faintly
        if (game.hollowPhase >= 3) {
          const outerR = Math.max(game.hollowArenaRadius + 500, 3000);
          g.circle(cx, cy, outerR).fill({ color: 0x050008, alpha: 0.15 });
        }
      }

      const boss = game.enemies.enemies.find(e => e.id === game.hollowBossId);
      if (boss && boss.hp > 0) {
        // Phase indicator ring
        const phaseColors = [0, 0xff0044, 0xff0044, 0xcc00ff, 0xffffff];
        const color = phaseColors[game.hollowPhase] ?? 0xff0044;
        const ringPulse = 1.0 + Math.sin(game.elapsed * 3) * 0.3;

        // Shield glow in phase 1
        if (game.hollowPhase === 1) {
          g.circle(boss.pos.x, boss.pos.y, boss.radius * 3).fill({ color: 0xff0044, alpha: 0.08 + Math.sin(game.elapsed * 2) * 0.04 });
          g.circle(boss.pos.x, boss.pos.y, boss.radius * 2.5).stroke({ color: 0xff0044, width: 3, alpha: 0.4 });
          g.circle(boss.pos.x, boss.pos.y, boss.radius * 3.5).stroke({ color: 0xff0044, width: 1, alpha: 0.15 });
        } else {
          // Active boss indicator
          g.circle(boss.pos.x, boss.pos.y, boss.radius * 2.5 * ringPulse).stroke({ color, width: 2, alpha: 0.5 });
          g.circle(boss.pos.x, boss.pos.y, boss.radius * 4).stroke({ color, width: 1, alpha: 0.12 });
        }

        // Boss HP bar (large, centered above boss)
        const hpFrac = boss.hp / boss.maxHp;
        const barW = 120;
        const barH = 8;
        const barX = boss.pos.x - barW / 2;
        const barY = boss.pos.y - boss.radius - 25;
        g.rect(barX, barY, barW, barH).fill({ color: 0x110000, alpha: 0.9 });
        g.rect(barX, barY, barW * hpFrac, barH).fill({ color, alpha: 0.9 });
        g.rect(barX, barY, barW, barH).stroke({ color: 0xff0044, width: 1, alpha: 0.6 });

        // Phase tick marks on HP bar
        const thresholds = [0.75, 0.45, 0.20];
        for (const t of thresholds) {
          const tx = barX + barW * t;
          g.moveTo(tx, barY).lineTo(tx, barY + barH);
          g.stroke({ color: 0xffffff, width: 1, alpha: 0.4 });
        }

        // Off-screen arrow
        const camCx = game.camera.x + game.camera.viewW / 2;
        const camCy = game.camera.y + game.camera.viewH / 2;
        const dx = boss.pos.x - camCx, dy = boss.pos.y - camCy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > Math.max(game.camera.viewW, game.camera.viewH) * 0.4) {
          const angle = Math.atan2(dy, dx);
          const arrowDist = 120;
          const ax = px + Math.cos(angle) * arrowDist;
          const ay = py + Math.sin(angle) * arrowDist;
          const sz = 10;
          g.moveTo(ax + Math.cos(angle) * sz, ay + Math.sin(angle) * sz)
            .lineTo(ax + Math.cos(angle + 2.5) * sz, ay + Math.sin(angle + 2.5) * sz)
            .lineTo(ax + Math.cos(angle - 2.5) * sz, ay + Math.sin(angle - 2.5) * sz)
            .closePath().fill({ color: 0xff0044, alpha: 0.9 });
        }
      }

      // Instability zones (void hazard circles)
      for (const iz of game.instabilityZones) {
        const lifeFrac = iz.timer / iz.maxTimer;
        const pulse = 0.5 + Math.sin(game.elapsed * 6) * 0.2;
        g.circle(iz.x, iz.y, iz.radius).fill({ color: 0x660022, alpha: 0.15 * lifeFrac });
        g.circle(iz.x, iz.y, iz.radius).stroke({ color: 0xff0044, width: 2, alpha: pulse * lifeFrac });
        g.circle(iz.x, iz.y, iz.radius * 0.3).fill({ color: 0xff0044, alpha: 0.25 * lifeFrac });
      }
    }
  }
}
