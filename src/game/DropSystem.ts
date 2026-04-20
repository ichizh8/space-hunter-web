import { Graphics } from 'pixi.js';
import { v2dist } from '../lib/math';
import type { Enemy } from './Enemies';
import type { Game } from './Game';

export type DropType = 'medkit' | 'void_purge' | 'damage_burst' | 'emp_pulse' | 'ally_drone' | 'speed_boost' | 'shield';

export interface DropCapsule {
  id: number;
  pos: { x: number; y: number };
  type: DropType;
  life: number;
  maxLife: number;
}

export const DROP_COLORS: Record<DropType, number> = {
  medkit: 0x44ff66,
  void_purge: 0xaa44ff,
  damage_burst: 0xff2222,
  emp_pulse: 0x22aaff,
  ally_drone: 0xffdd00,
  speed_boost: 0xffffff,
  shield: 0x00ffee,
};

let nextDropId = 1;

export class DropSystem {
  capsules: DropCapsule[] = [];

  onKill(enemy: Enemy, game: Game): void {
    this.rollDropCapsule(enemy, game);
  }

  update(dt: number, game: Game): void {
    for (let i = this.capsules.length - 1; i >= 0; i--) {
      const cap = this.capsules[i];
      cap.life -= dt;
      if (cap.life <= 0) { this.capsules.splice(i, 1); continue; }
      if (v2dist(game.player.pos, cap.pos) < game.player.radius + 14) {
        this.applyDropEffect(cap.type, game);
        this.capsules.splice(i, 1);
      }
    }
  }

  draw(g: Graphics, game: Game): void {
    for (const cap of this.capsules) {
      if (!game.camera.isVisible(cap.pos.x, cap.pos.y, 30)) continue;
      const cx = cap.pos.x, cy = cap.pos.y;
      const col = DROP_COLORS[cap.type];
      const pulse = 0.7 + Math.sin(game.elapsed * 4 + cap.id) * 0.3;
      const r = 10 + Math.sin(game.elapsed * 3 + cap.id) * 2;
      let alpha = 1;
      if (cap.life < 6) {
        alpha = 0.4 + Math.abs(Math.sin(game.elapsed * 8)) * 0.6;
      }
      g.circle(cx, cy, r * 1.6).fill({ color: col, alpha: 0.12 * alpha });
      g.circle(cx, cy, r).fill({ color: col, alpha: 0.8 * alpha * pulse });
      g.circle(cx, cy, r).stroke({ color: 0xffffff, width: 1, alpha: 0.5 * alpha });
      g.circle(cx, cy, 4).fill({ color: 0xffffff, alpha: 0.9 * alpha });
    }
  }

  private rollDropCapsule(enemy: Enemy, game: Game): void {
    const salvage = game.shipUpgrades.salvage_module ?? 0;
    const dropMult = salvage >= 2 ? 1.6 : salvage >= 1 ? 1.3 : 1.0;
    const isApex = enemy.isTarget;
    const isNormal = !enemy.isElite;

    const table: [DropType, number, number][] = [
      ['medkit',       0.05, 0.20],
      ['void_purge',   0.03, 0.15],
      ['damage_burst', 0.02, 0.02],
      ['emp_pulse',    0.01, 0.01],
      ['ally_drone',   isApex ? 1.0 : 0.01, isApex ? 1.0 : 0.01],
      ['speed_boost',  0.03, 0.03],
      ['shield',       0.02, 0.02],
    ];

    for (const [type, normalPct, elitePct] of table) {
      let chance = isNormal ? normalPct : elitePct;
      chance *= dropMult;
      if (Math.random() < chance) {
        const maxLife = 30 + Math.random() * 10;
        this.capsules.push({
          id: nextDropId++,
          pos: { x: enemy.pos.x + (Math.random() - 0.5) * 30, y: enemy.pos.y + (Math.random() - 0.5) * 30 },
          type,
          life: maxLife,
          maxLife,
        });
      }
    }
  }

  private applyDropEffect(type: DropType, game: Game): void {
    switch (type) {
      case 'medkit':
        game.player.heal(3);
        game.hud.showMessage('+3 HP', 1.5);
        break;
      case 'void_purge':
        game.player.corruption = Math.max(0, game.player.corruption - 15);
        game.hud.showMessage('-15 CORRUPTION', 1.5);
        break;
      case 'damage_burst':
        game.damageBurstTimer = 8;
        game.hud.showMessage('+50% DAMAGE 8s', 2);
        break;
      case 'emp_pulse': {
        const camLeft = game.camera.x, camRight = game.camera.x + game.camera.viewW;
        const camTop = game.camera.y, camBottom = game.camera.y + game.camera.viewH;
        let empKills = 0;
        for (const e of game.enemies.enemies) {
          if (e.hp <= 0 || e.isAlly) continue;
          if (e.pos.x >= camLeft && e.pos.x <= camRight && e.pos.y >= camTop && e.pos.y <= camBottom) {
            e.hp -= 15;
            e.hitFlash = 0.4;
            if (e.hp <= 0) { game.onEnemyKilled(e); empKills++; }
          }
        }
        game.screenFlash = 0.5;
        game.hud.showMessage(`EMP! ${empKills} HITS`, 1.5);
        break;
      }
      case 'ally_drone':
        game.allyDrones.push({ x: game.player.pos.x, y: game.player.pos.y, hp: 30, maxHp: 30, life: 20, fireTimer: 0.5 });
        game.hud.showMessage('ALLY DRONE DEPLOYED', 2);
        break;
      case 'speed_boost':
        game.speedBoostTimer = 10;
        game.hud.showMessage('+40% SPEED 10s', 1.5);
        break;
      case 'shield':
        game.player.shieldHits = Math.max(game.player.shieldHits, 5);
        game.hud.showMessage('SHIELD x5', 1.5);
        break;
    }
  }
}
