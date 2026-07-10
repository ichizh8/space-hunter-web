import { Container, Text, TextStyle } from 'pixi.js';

// Damage numbers that float up from enemies when they take damage.
// Integration is a single point: update() scans enemy HP deltas each frame,
// so every damage source (bullets, kits, DoTs, drops) is covered without
// touching any damage-dealing code. Rapid ticks (flamer, beams) accumulate
// into one number per enemy over a short window instead of spamming.

interface FloaterEnemy {
  id: number;
  hp: number;
  isAlly: boolean;
  pos: { x: number; y: number };
}

interface Floater {
  text: Text;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  baseScale: number;
}

interface Bucket {
  sum: number;
  x: number;
  y: number;
  timer: number;
}

const FLUSH_DELAY = 0.15; // accumulate ticks per enemy for this long, then show one number
const FLOATER_LIFE = 0.7;
const MAX_FLOATERS = 40;
const BIG_HIT = 8; // damage at or above this renders in the "big hit" color

const styleNormal = new TextStyle({
  fontFamily: 'PixelOperator, monospace',
  fontSize: 16,
  fill: 0xffffff,
  stroke: { color: 0x000000, width: 3 },
});
const styleBig = new TextStyle({
  fontFamily: 'PixelOperator, monospace',
  fontSize: 16,
  fill: 0xffcc33,
  stroke: { color: 0x000000, width: 3 },
});

export class DamageFloaters {
  container = new Container();

  private lastHp = new Map<number, number>();
  private buckets = new Map<number, Bucket>();
  private floaters: Floater[] = [];
  private pool: Text[] = [];

  update(dt: number, enemies: FloaterEnemy[]) {
    // Scan HP deltas
    const seen = new Set<number>();
    for (const e of enemies) {
      if (e.isAlly) continue;
      seen.add(e.id);
      const prev = this.lastHp.get(e.id);
      if (prev !== undefined && e.hp < prev - 1e-6) {
        const delta = prev - e.hp;
        const b = this.buckets.get(e.id);
        if (b) {
          b.sum += delta;
          b.x = e.pos.x;
          b.y = e.pos.y;
        } else {
          this.buckets.set(e.id, { sum: delta, x: e.pos.x, y: e.pos.y, timer: FLUSH_DELAY });
        }
      }
      this.lastHp.set(e.id, e.hp);
    }
    // Forget enemies that left the array (room transition, cleanup)
    for (const id of this.lastHp.keys()) {
      if (!seen.has(id)) this.lastHp.delete(id);
    }

    // Flush buckets
    for (const [id, b] of this.buckets) {
      b.timer -= dt;
      if (b.timer <= 0) {
        this.spawn(b.x, b.y, b.sum);
        this.buckets.delete(id);
      }
    }

    // Animate floaters
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.recycle(i);
        continue;
      }
      f.text.x += f.vx * dt;
      f.text.y += f.vy * dt;
      f.vy += 30 * dt; // slight deceleration of the rise
      const t = f.life / f.maxLife;
      f.text.alpha = Math.min(1, t * 2);
      // Pop-in: overshoot scale during the first 0.1s
      const age = f.maxLife - f.life;
      f.text.scale.set(f.baseScale * (age < 0.1 ? 1.3 - 3 * age : 1));
    }
  }

  private spawn(x: number, y: number, amount: number) {
    const shown = Math.max(1, Math.round(amount));
    if (this.floaters.length >= MAX_FLOATERS) this.recycle(0);

    const text = this.pool.pop() ?? new Text({ text: '', style: styleNormal });
    text.text = String(shown);
    text.style = shown >= BIG_HIT ? styleBig : styleNormal;
    // Bigger numbers render bigger (via scale so shared styles stay untouched)
    const baseScale = Math.min(1.9, (14 + shown * 1.5) / 16);
    text.anchor.set(0.5, 1);
    text.x = x + (Math.random() - 0.5) * 20;
    text.y = y - 14;
    text.alpha = 1;
    text.scale.set(baseScale);
    this.container.addChild(text);

    this.floaters.push({
      text,
      vx: (Math.random() - 0.5) * 20,
      vy: -60,
      life: FLOATER_LIFE,
      maxLife: FLOATER_LIFE,
      baseScale,
    });
  }

  private recycle(index: number) {
    const f = this.floaters[index];
    this.container.removeChild(f.text);
    if (this.pool.length < MAX_FLOATERS) this.pool.push(f.text);
    else f.text.destroy();
    this.floaters.splice(index, 1);
  }

  /** Reset tracking (call on room transition if desired; stale ids also age out naturally) */
  clear() {
    this.lastHp.clear();
    this.buckets.clear();
    while (this.floaters.length) this.recycle(0);
  }
}
