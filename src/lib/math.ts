export interface Vec2 {
  x: number;
  y: number;
}

export const v2 = (x: number, y: number): Vec2 => ({ x, y });
export const v2zero = (): Vec2 => ({ x: 0, y: 0 });

export const v2add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const v2sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const v2mul = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const v2len = (a: Vec2): number => Math.sqrt(a.x * a.x + a.y * a.y);
export const v2dist = (a: Vec2, b: Vec2): number => v2len(v2sub(a, b));
export const v2norm = (a: Vec2): Vec2 => {
  const l = v2len(a);
  return l > 0 ? v2mul(a, 1 / l) : v2zero();
};
export const v2lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
export const v2angle = (a: Vec2, b: Vec2): number => Math.atan2(b.y - a.y, b.x - a.x);
export const v2fromAngle = (angle: number, len = 1): Vec2 => ({
  x: Math.cos(angle) * len,
  y: Math.sin(angle) * len,
});

/** Distance from point p to line segment (a→b), clamped to the segment. */
export function pointToSegDist(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x, aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return v2dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2));
  return v2dist(p, { x: a.x + t * abx, y: a.y + t * aby });
}

/** Returns true if line segment (a→b) intersects a circle at center c with given radius. */
export const lineSegHitsCircle = (a: Vec2, b: Vec2, c: Vec2, radius: number): boolean =>
  pointToSegDist(c, a, b) <= radius;

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const randRange = (min: number, max: number) => min + Math.random() * (max - min);
export const randInt = (min: number, max: number) => Math.floor(randRange(min, max + 1));
export const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
