import { type Vec2, v2lerp } from '../lib/math';
import { WORLD_W, WORLD_H } from './constants';

export class Camera {
  x = 0;
  y = 0;
  viewW: number;
  viewH: number;
  smoothing = 0.08;
  /** World bounds for clamping (updated when room changes) */
  worldW = WORLD_W;
  worldH = WORLD_H;

  constructor(viewW: number, viewH: number) {
    this.viewW = viewW;
    this.viewH = viewH;
  }

  follow(target: Vec2, dt: number) {
    const tx = target.x - this.viewW / 2;
    const ty = target.y - this.viewH / 2;
    const t = 1 - Math.pow(1 - this.smoothing, dt * 60);
    const next = v2lerp({ x: this.x, y: this.y }, { x: tx, y: ty }, t);
    this.x = Math.max(0, Math.min(Math.max(0, this.worldW - this.viewW), next.x));
    this.y = Math.max(0, Math.min(Math.max(0, this.worldH - this.viewH), next.y));
  }

  /** Convert world coords to screen coords */
  w2s(wx: number, wy: number): [number, number] {
    return [wx - this.x, wy - this.y];
  }

  /** Convert screen coords to world coords */
  s2w(sx: number, sy: number): [number, number] {
    return [sx + this.x, sy + this.y];
  }

  /** Check if a circle is visible on screen */
  isVisible(wx: number, wy: number, radius: number): boolean {
    const margin = radius + 50;
    return wx + margin > this.x && wx - margin < this.x + this.viewW &&
           wy + margin > this.y && wy - margin < this.y + this.viewH;
  }
}
