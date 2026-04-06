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

/** Ray vs circle: returns first hit distance t ≥ 0, or -1 if no intersection.
 *  origin = ray start, dir = unit direction, c = circle center, r = radius. */
export function rayVsCircleT(origin: Vec2, dir: Vec2, c: Vec2, r: number): number {
  const ex = origin.x - c.x, ey = origin.y - c.y;
  const b = ex * dir.x + ey * dir.y;
  const disc = b * b - (ex * ex + ey * ey - r * r);
  if (disc < 0) return -1;
  const sq = Math.sqrt(disc);
  const t0 = -b - sq;
  if (t0 >= 0) return t0;
  const t1 = -b + sq;
  return t1 >= 0 ? t1 : -1;
}

/** Ray vs axis-aligned rect [x0,x1]×[y0,y1]: returns hit distance t ≥ 0, or -1 if no intersection. */
export function rayVsRectT(origin: Vec2, dir: Vec2, x0: number, y0: number, x1: number, y1: number): number {
  const invDx = Math.abs(dir.x) > 1e-9 ? 1 / dir.x : (dir.x >= 0 ? 1e9 : -1e9);
  const invDy = Math.abs(dir.y) > 1e-9 ? 1 / dir.y : (dir.y >= 0 ? 1e9 : -1e9);
  let tx0 = (x0 - origin.x) * invDx, tx1 = (x1 - origin.x) * invDx;
  if (tx0 > tx1) { const t = tx0; tx0 = tx1; tx1 = t; }
  let ty0 = (y0 - origin.y) * invDy, ty1 = (y1 - origin.y) * invDy;
  if (ty0 > ty1) { const t = ty0; ty0 = ty1; ty1 = t; }
  const tmin = Math.max(tx0, ty0), tmax = Math.min(tx1, ty1);
  if (tmax < 0 || tmin > tmax) return -1;
  const t = tmin >= 0 ? tmin : tmax;
  return t >= 0 ? t : -1;
}

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const randRange = (min: number, max: number) => min + Math.random() * (max - min);
export const randInt = (min: number, max: number) => Math.floor(randRange(min, max + 1));
export const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
