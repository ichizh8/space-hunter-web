'use client';

import { useRef, useEffect, useCallback } from 'react';
import {
  useEditorStore,
  type EditorEntity,
  type EntityType,
  newEntityId,
  type ToolMode,
  OBSTACLE_CATALOG,
  CAVE_PRESETS,
  VOID_POOL_PRESETS,
  SURFACE_TILE,
  SURFACE_COLS,
  SURFACE_ROWS,
  SURFACE_TYPES,
  getObstacleSize,
} from './editorStore';
import {
  WORLD_W,
  WORLD_H,
  GRID_STEP,
  COL_BG,
  COL_GRID,
  COL_CAVE,
  COL_VOID_POOL,
  COL_OBSTACLE,
} from '../game/constants';

// ---- Colors ----------------------------------------------------------------
const COL_PLAYER_SPAWN  = 0x00ccff;
const COL_ENEMY_SPAWN   = 0xff4444;
const COL_INTERACTABLE  = 0xffcc00;   // also used for legacy interaction_zone
const COL_SPAWN_ZONE    = 0xff6644;
const COL_TRIGGER_ZONE  = 0xffaa44;
const COL_DOOR          = 0x44ccff;
const COL_SELECT        = 0x44aaff;
const COL_ENTRANCE      = 0x22cc66;
const COL_EXIT          = 0xff3333;
const COL_NPC           = 0x4488ff;
const COL_LOOT          = 0xffcc00;
const COL_TRIGGER       = 0x44ff88;
const COL_NO_SPAWN      = 0xff4444;
const COL_GRID_ALPHA    = 0.25;

// ---- Minimap ---------------------------------------------------------------
const MINI_SIZE   = 150;
const MINI_MARGIN = 8;
const MINI_SCALE  = MINI_SIZE / Math.max(WORLD_W, WORLD_H);

// ---- Types -----------------------------------------------------------------
interface DragState {
  type: 'pan' | 'move_entity' | 'place_circle' | 'place_rect' | 'minimap_pan' | 'surface_paint';
  startScreenX: number;
  startScreenY: number;
  startWorldX: number;
  startWorldY: number;
  startCamX?: number;
  startCamY?: number;
  entityId?: string;
  entityStartX?: number;
  entityStartY?: number;
}

export function EditorCanvas() {
  const containerRef  = useRef<HTMLDivElement>(null);
  const appRef        = useRef<import('pixi.js').Application | null>(null);
  const gfxRef        = useRef<import('pixi.js').Graphics | null>(null);
  const pixiRef       = useRef<typeof import('pixi.js') | null>(null);
  const labelsRef     = useRef<import('pixi.js').Container | null>(null);
  const textPoolRef   = useRef<import('pixi.js').Text[]>([]);
  const dragRef       = useRef<DragState | null>(null);
  const spaceHeldRef  = useRef(false);

  const store = useEditorStore();
  const storeRef = useRef(store);
  storeRef.current = store;

  // ---- world <-> screen ----------------------------------------------------
  const worldToScreen = useCallback(
    (wx: number, wy: number, cam: { x: number; y: number; zoom: number }, w: number, h: number) => {
      return { sx: (wx - cam.x) * cam.zoom + w / 2, sy: (wy - cam.y) * cam.zoom + h / 2 };
    },
    []
  );

  const screenToWorld = useCallback(
    (sx: number, sy: number, cam: { x: number; y: number; zoom: number }, w: number, h: number) => {
      return { wx: (sx - w / 2) / cam.zoom + cam.x, wy: (sy - h / 2) / cam.zoom + cam.y };
    },
    []
  );

  // ---- helpers -------------------------------------------------------------
  const getCanvasSize = () => {
    const app = appRef.current;
    if (!app) return { w: 1, h: 1 };
    return { w: app.renderer.width, h: app.renderer.height };
  };

  const setCursor = useCallback((c: string) => {
    if (containerRef.current) containerRef.current.style.cursor = c;
  }, []);

  // updateCursor: state-driven cursor (from reverent-almeida)
  const updateCursor = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (dragRef.current?.type === 'pan') {
      el.style.cursor = 'grabbing';
    } else if (spaceHeldRef.current) {
      el.style.cursor = 'grab';
    } else {
      el.style.cursor = 'crosshair';
    }
  }, []);

  const getFitCamera = useCallback(() => {
    const { w, h } = getCanvasSize();
    const zoom = Math.min(w / WORLD_W, h / WORLD_H) * 0.9;
    return { x: WORLD_W / 2, y: WORLD_H / 2, zoom };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoomBy = useCallback(
    (factor: number, screenX: number | null, screenY: number | null) => {
      const s = storeRef.current;
      const { w, h } = getCanvasSize();
      const mx = screenX ?? w / 2;
      const my = screenY ?? h / 2;
      const { wx: worldX, wy: worldY } = screenToWorld(mx, my, s.camera, w, h);
      const newZoom = Math.min(5, Math.max(0.05, s.camera.zoom * factor));
      s.setCamera({
        zoom: newZoom,
        x: worldX - (mx - w / 2) / newZoom,
        y: worldY - (my - h / 2) / newZoom,
      });
    },
    [screenToWorld]
  );

  // zoomAtPoint: zoom-to-mouse helper (from reverent-almeida)
  const zoomAtPoint = useCallback((screenX: number, screenY: number, factor: number) => {
    const s = storeRef.current;
    const { w: W, h: H } = getCanvasSize();
    const oldZoom = s.camera.zoom;
    const newZoom = Math.min(5, Math.max(0.05, oldZoom * factor));
    const wx = (screenX - W / 2) / oldZoom + s.camera.x;
    const wy = (screenY - H / 2) / oldZoom + s.camera.y;
    const newCamX = wx - (screenX - W / 2) / newZoom;
    const newCamY = wy - (screenY - H / 2) / newZoom;
    s.setCamera({ zoom: newZoom, x: newCamX, y: newCamY });
  }, []);

  // fitToMap: fit-view helper (from reverent-almeida)
  const fitToMap = useCallback(() => {
    const { w: W, h: H } = getCanvasSize();
    const zoom = Math.min(W / WORLD_W, H / WORLD_H) * 0.9;
    storeRef.current.setCamera({ x: WORLD_W / 2, y: WORLD_H / 2, zoom });
  }, []);

  // ---- draw -----------------------------------------------------------------
  const draw = useCallback(() => {
    const app  = appRef.current;
    const gfx  = gfxRef.current;
    const PIXI = pixiRef.current;
    if (!app || !gfx) return;

    const s = storeRef.current;
    const { camera, entities, selectedEntityId, selectedWaveId, waves, surfaceGrid } = s;
    const W = app.renderer.width;
    const H = app.renderer.height;

    gfx.clear();
    gfx.rect(0, 0, W, H).fill(COL_BG);

    // Viewport in world space
    const worldLeft   = (0     - W / 2) / camera.zoom + camera.x;
    const worldTop    = (0     - H / 2) / camera.zoom + camera.y;
    const worldRight  = (W     - W / 2) / camera.zoom + camera.x;
    const worldBottom = (H     - H / 2) / camera.zoom + camera.y;

    // ---- Surface tiles (drawn before everything) ---------------------------
    const hasSurface = surfaceGrid.some((v) => v !== 0);
    if (hasSurface) {
      const tileS      = SURFACE_TILE * camera.zoom;
      const tileLeft   = Math.max(0, Math.floor(worldLeft   / SURFACE_TILE));
      const tileTop    = Math.max(0, Math.floor(worldTop    / SURFACE_TILE));
      const tileRight  = Math.min(SURFACE_COLS - 1, Math.ceil(worldRight  / SURFACE_TILE));
      const tileBottom = Math.min(SURFACE_ROWS - 1, Math.ceil(worldBottom / SURFACE_TILE));

      for (let row = tileTop; row <= tileBottom; row++) {
        for (let col = tileLeft; col <= tileRight; col++) {
          const tileType = surfaceGrid[row * SURFACE_COLS + col];
          if (tileType === 0) continue;
          const st = SURFACE_TYPES.find((x) => x.id === tileType);
          if (!st?.color) continue;
          const color = parseInt(st.color.replace('#', ''), 16);
          const { sx: tsx, sy: tsy } = worldToScreen(col * SURFACE_TILE, row * SURFACE_TILE, camera, W, H);
          gfx.rect(tsx, tsy, tileS + 0.5, tileS + 0.5).fill({ color, alpha: 1 });
        }
      }
    }

    // ---- Grid ----------------------------------------------------------------
    const startGX = Math.floor(worldLeft  / GRID_STEP) * GRID_STEP;
    const startGY = Math.floor(worldTop   / GRID_STEP) * GRID_STEP;

    gfx.setStrokeStyle({ width: 1 / camera.zoom, color: COL_GRID, alpha: COL_GRID_ALPHA });
    for (let gx = startGX; gx <= worldRight; gx += GRID_STEP) {
      const { sx } = worldToScreen(gx, 0, camera, W, H);
      gfx.moveTo(sx, 0).lineTo(sx, H).stroke();
    }
    for (let gy = startGY; gy <= worldBottom; gy += GRID_STEP) {
      const { sy } = worldToScreen(0, gy, camera, W, H);
      gfx.moveTo(0, sy).lineTo(W, sy).stroke();
    }

    // ---- Map border ----------------------------------------------------------
    const { sx: bx1, sy: by1 } = worldToScreen(0, 0, camera, W, H);
    const { sx: bx2, sy: by2 } = worldToScreen(WORLD_W, WORLD_H, camera, W, H);
    gfx.setStrokeStyle({ width: 2, color: 0x334455, alpha: 0.8 })
       .rect(bx1, by1, bx2 - bx1, by2 - by1)
       .stroke();

    const toS = (wx: number, wy: number) => worldToScreen(wx, wy, camera, W, H);
    const r2s = (r: number) => r * camera.zoom;

    // ---- Entities ------------------------------------------------------------
    let labelIdx = 0;

    for (const ent of entities) {
      const { sx, sy } = toS(ent.pos.x, ent.pos.y);
      const isSelected        = ent.id === selectedEntityId;
      const isWaveHighlighted = selectedWaveId != null && ent.waveId === selectedWaveId;

      switch (ent.type) {
        case 'cave': {
          const rad = r2s(ent.radius ?? 150);
          gfx.circle(sx, sy, rad).fill({ color: COL_CAVE, alpha: 0.85 });
          if (isSelected) gfx.circle(sx, sy, rad + 3).stroke({ width: 2, color: COL_SELECT });
          break;
        }
        case 'void_pool': {
          const rad = r2s(ent.radius ?? 80);
          gfx.circle(sx, sy, rad).fill({ color: COL_VOID_POOL, alpha: 0.85 });
          if (isSelected) gfx.circle(sx, sy, rad + 3).stroke({ width: 2, color: COL_SELECT });
          break;
        }
        case 'obstacle': {
          const { w: ow, h: oh } = ent.variant ? getObstacleSize(ent.variant) : { w: ent.width ?? 64, h: ent.height ?? 64 };
          const ws = r2s(ow);
          const hs = r2s(oh);
          gfx.rect(sx - ws / 2, sy - hs / 2, ws, hs).fill({ color: COL_OBSTACLE, alpha: 0.9 });
          if (isSelected)
            gfx.rect(sx - ws / 2 - 2, sy - hs / 2 - 2, ws + 4, hs + 4).stroke({ width: 2, color: COL_SELECT });

          // Variant label at zoom > 0.3
          if (PIXI && labelsRef.current && camera.zoom > 0.3 && ent.variant) {
            const pool = textPoolRef.current;
            let t = pool[labelIdx];
            if (!t) {
              t = new PIXI.Text({ text: '', style: { fontSize: 9, fill: 0xaabbcc, fontFamily: 'monospace' } });
              labelsRef.current.addChild(t);
              pool.push(t);
            }
            t.text = ent.variant;
            t.x = sx + ws / 2 + 2;
            t.y = sy - 5;
            t.visible = true;
            labelIdx++;
          }
          break;
        }
        case 'enemy_spawn': {
          const waveColor = waves.find((w) => w.id === ent.waveId)?.color;
          const col = waveColor ? parseInt(waveColor.replace('#', ''), 16) : COL_ENEMY_SPAWN;
          const rad = r2s(10);
          gfx.circle(sx, sy, rad).fill({ color: col, alpha: isWaveHighlighted ? 1.0 : 0.8 });
          if (isSelected || isWaveHighlighted)
            gfx.circle(sx, sy, rad + 3).stroke({ width: 2, color: COL_SELECT });
          if ((ent.count ?? 1) > 1 || ent.isElite)
            gfx.circle(sx + rad, sy - rad, r2s(4)).fill({ color: ent.isElite ? 0xffcc00 : 0xffffff });
          break;
        }
        case 'player_spawn': {
          const rad = r2s(14);
          gfx.circle(sx, sy, rad).fill({ color: COL_PLAYER_SPAWN, alpha: 0.9 });
          gfx.setStrokeStyle({ width: 2, color: 0xffffff })
             .moveTo(sx - rad, sy).lineTo(sx + rad, sy).stroke()
             .moveTo(sx, sy - rad).lineTo(sx, sy + rad).stroke();
          if (isSelected) gfx.circle(sx, sy, rad + 3).stroke({ width: 2, color: COL_SELECT });
          break;
        }
        case 'interaction_zone':
        case 'interactable': {
          const rad = r2s(ent.radius ?? 40);
          gfx.circle(sx, sy, rad).fill({ color: COL_INTERACTABLE, alpha: 0.3 });
          gfx.circle(sx, sy, rad).stroke({ width: 1.5, color: COL_INTERACTABLE, alpha: 0.9 });
          // Inner dot to distinguish from plain zones
          gfx.circle(sx, sy, r2s(5)).fill({ color: COL_INTERACTABLE, alpha: 1 });
          if (isSelected) gfx.circle(sx, sy, rad + 3).stroke({ width: 2, color: COL_SELECT });
          break;
        }
        case 'door': {
          const rad = r2s(ent.radius ?? 40);
          // Diamond shape
          gfx
            .moveTo(sx, sy - rad)
            .lineTo(sx + rad, sy)
            .lineTo(sx, sy + rad)
            .lineTo(sx - rad, sy)
            .closePath()
            .fill({ color: COL_DOOR, alpha: 0.4 })
            .stroke({ width: 1.5, color: COL_DOOR, alpha: 0.95 });
          if (isSelected) gfx.circle(sx, sy, rad + 5).stroke({ width: 2, color: COL_SELECT });
          break;
        }
        case 'spawn_zone': {
          const w = r2s(ent.width  ?? 200);
          const h = r2s(ent.height ?? 200);
          gfx
            .rect(sx - w / 2, sy - h / 2, w, h)
            .fill({ color: COL_SPAWN_ZONE, alpha: 0.15 })
            .stroke({ width: 1.5, color: COL_SPAWN_ZONE, alpha: 0.85 });
          // Corner marker
          const markR = Math.min(r2s(8), 10);
          gfx.circle(sx - w / 2 + markR, sy - h / 2 + markR, markR).fill({ color: COL_SPAWN_ZONE, alpha: 0.9 });
          if (isSelected)
            gfx.rect(sx - w / 2 - 2, sy - h / 2 - 2, w + 4, h + 4).stroke({ width: 2, color: COL_SELECT });
          break;
        }
        case 'trigger_zone': {
          // If it has width/height render as rect (RoomJSON style), else as circle (legacy style)
          if (ent.width !== undefined || ent.height !== undefined) {
            const w = r2s(ent.width  ?? 200);
            const h = r2s(ent.height ?? 200);
            gfx
              .rect(sx - w / 2, sy - h / 2, w, h)
              .fill({ color: COL_TRIGGER_ZONE, alpha: 0.08 })
              .stroke({ width: 1.5, color: COL_TRIGGER_ZONE, alpha: 0.8 });
            // Cross marker in center
            const cr = Math.min(r2s(10), 14);
            gfx
              .moveTo(sx - cr, sy).lineTo(sx + cr, sy)
              .stroke({ width: 1, color: COL_TRIGGER_ZONE, alpha: 0.9 })
              .moveTo(sx, sy - cr).lineTo(sx, sy + cr)
              .stroke({ width: 1, color: COL_TRIGGER_ZONE, alpha: 0.9 });
            if (isSelected)
              gfx.rect(sx - w / 2 - 2, sy - h / 2 - 2, w + 4, h + 4).stroke({ width: 2, color: COL_SELECT });
          } else {
            const rad = r2s(ent.radius ?? 80);
            gfx.circle(sx, sy, rad).fill({ color: COL_TRIGGER, alpha: 0.1 });
            gfx.circle(sx, sy, rad).stroke({ width: 1, color: COL_TRIGGER, alpha: 0.7 });
            // Inner dot
            gfx.circle(sx, sy, r2s(5)).fill({ color: COL_TRIGGER, alpha: 0.8 });
            if (isSelected) gfx.circle(sx, sy, rad + 3).stroke({ width: 2, color: COL_SELECT });
          }
          break;
        }
        case 'entrance': {
          const rad = r2s(16);
          gfx.circle(sx, sy, rad).fill({ color: COL_ENTRANCE, alpha: 0.85 });
          // Arrow pointing inward (downward by default)
          const dir = ent.spawnDirection ?? 'south';
          const [adx, ady] = dir === 'north' ? [0, 1] : dir === 'south' ? [0, -1] : dir === 'east' ? [-1, 0] : [1, 0];
          const as = r2s(10);
          gfx.setStrokeStyle({ width: 2, color: 0xffffff })
             .moveTo(sx - adx * as, sy - ady * as)
             .lineTo(sx + adx * as, sy + ady * as).stroke();
          // Arrow head
          const perp = r2s(5);
          gfx.moveTo(sx + adx * as, sy + ady * as)
             .lineTo(sx + adx * as - ady * perp - adx * perp * 0.6, sy + ady * as + adx * perp - ady * perp * 0.6).stroke()
             .moveTo(sx + adx * as, sy + ady * as)
             .lineTo(sx + adx * as + ady * perp - adx * perp * 0.6, sy + ady * as - adx * perp - ady * perp * 0.6).stroke();
          if (isSelected) gfx.circle(sx, sy, rad + 3).stroke({ width: 2, color: COL_SELECT });
          break;
        }
        case 'exit': {
          const rad = r2s(16);
          gfx.circle(sx, sy, rad).fill({ color: COL_EXIT, alpha: 0.85 });
          // Arrow pointing outward (upward by default)
          const as = r2s(10);
          gfx.setStrokeStyle({ width: 2, color: 0xffffff })
             .moveTo(sx, sy + as).lineTo(sx, sy - as).stroke();
          const perp = r2s(5);
          gfx.moveTo(sx, sy - as)
             .lineTo(sx - perp, sy - as + perp * 0.8).stroke()
             .moveTo(sx, sy - as)
             .lineTo(sx + perp, sy - as + perp * 0.8).stroke();
          if (isSelected) gfx.circle(sx, sy, rad + 3).stroke({ width: 2, color: COL_SELECT });
          break;
        }
        case 'npc': {
          // Blue diamond
          const ds = r2s(14);
          gfx.moveTo(sx, sy - ds).lineTo(sx + ds, sy).lineTo(sx, sy + ds).lineTo(sx - ds, sy).closePath()
             .fill({ color: COL_NPC, alpha: 0.85 });
          if (isSelected)
            gfx.moveTo(sx, sy - ds - 3).lineTo(sx + ds + 3, sy).lineTo(sx, sy + ds + 3).lineTo(sx - ds - 3, sy).closePath()
               .stroke({ width: 2, color: COL_SELECT });
          break;
        }
        case 'loot_cache': {
          const ls = r2s(12);
          gfx.rect(sx - ls, sy - ls, ls * 2, ls * 2).fill({ color: COL_LOOT, alpha: 0.85 });
          gfx.rect(sx - ls, sy - ls, ls * 2, ls * 2).stroke({ width: 1, color: 0xffffff, alpha: 0.6 });
          if (isSelected)
            gfx.rect(sx - ls - 2, sy - ls - 2, ls * 2 + 4, ls * 2 + 4).stroke({ width: 2, color: COL_SELECT });
          break;
        }
        case 'no_spawn': {
          const rad = r2s(ent.radius ?? 80);
          gfx.circle(sx, sy, rad).fill({ color: COL_NO_SPAWN, alpha: 0.12 });
          gfx.circle(sx, sy, rad).stroke({ width: 1, color: COL_NO_SPAWN, alpha: 0.5 });
          // X mark
          const xs = r2s(8);
          gfx.setStrokeStyle({ width: 2, color: COL_NO_SPAWN, alpha: 0.8 })
             .moveTo(sx - xs, sy - xs).lineTo(sx + xs, sy + xs).stroke()
             .moveTo(sx + xs, sy - xs).lineTo(sx - xs, sy + xs).stroke();
          if (isSelected) gfx.circle(sx, sy, rad + 3).stroke({ width: 2, color: COL_SELECT });
          break;
        }
      }
    }

    // Hide unused label text objects
    const pool = textPoolRef.current;
    for (let i = labelIdx; i < pool.length; i++) {
      pool[i].visible = false;
    }

    // ---- Minimap -----------------------------------------------------------
    const mX0 = W - MINI_SIZE - MINI_MARGIN;
    const mY0 = H - MINI_SIZE - MINI_MARGIN;

    gfx.rect(mX0, mY0, MINI_SIZE, MINI_SIZE).fill({ color: 0x06060f, alpha: 0.93 });
    gfx.rect(mX0, mY0, MINI_SIZE, MINI_SIZE).stroke({ width: 1, color: 0x334455 });

    for (const ent of entities) {
      const ex = mX0 + ent.pos.x * MINI_SCALE;
      const ey = mY0 + ent.pos.y * MINI_SCALE;
      let col = 0xaabbcc;
      switch (ent.type) {
        case 'cave':             col = COL_CAVE;         break;
        case 'void_pool':        col = COL_VOID_POOL;    break;
        case 'obstacle':         col = COL_OBSTACLE;     break;
        case 'player_spawn':     col = COL_PLAYER_SPAWN; break;
        case 'interaction_zone':
        case 'interactable':     col = COL_INTERACTABLE; break;
        case 'door':             col = COL_DOOR;         break;
        case 'spawn_zone':       col = COL_SPAWN_ZONE;   break;
        case 'trigger_zone':     col = COL_TRIGGER_ZONE; break;
        case 'entrance':         col = COL_ENTRANCE;     break;
        case 'exit':             col = COL_EXIT;         break;
        case 'npc':              col = COL_NPC;          break;
        case 'loot_cache':       col = COL_LOOT;         break;
        case 'no_spawn':         col = COL_NO_SPAWN;     break;
        case 'enemy_spawn': {
          const wc = waves.find((w) => w.id === ent.waveId)?.color;
          col = wc ? parseInt(wc.replace('#', ''), 16) : COL_ENEMY_SPAWN;
          break;
        }
      }
      gfx.circle(ex, ey, 2).fill({ color: col, alpha: 0.9 });
    }

    // Viewport rectangle
    const vpLeft = camera.x - (W / 2) / camera.zoom;
    const vpTop  = camera.y - (H / 2) / camera.zoom;
    const vpW    = (W / camera.zoom) * MINI_SCALE;
    const vpH    = (H / camera.zoom) * MINI_SCALE;
    gfx.rect(
      mX0 + vpLeft * MINI_SCALE,
      mY0 + vpTop  * MINI_SCALE,
      vpW, vpH,
    ).stroke({ width: 1, color: 0xffffff, alpha: 0.65 });
  }, [worldToScreen]);

  // ---- init PixiJS ---------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let destroyed = false;

    (async () => {
      const PIXI = await import('pixi.js');
      const { Application, Graphics, Container } = PIXI;

      PIXI.TextureSource.defaultOptions.scaleMode = 'nearest';
      PIXI.AbstractRenderer.defaultOptions.roundPixels = true;

      if (destroyed) return;

      const app = new Application();
      await app.init({
        width: container.clientWidth,
        height: container.clientHeight,
        backgroundColor: COL_BG,
        antialias: false,
        roundPixels: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (destroyed) { app.destroy(true); return; }

      container.appendChild(app.canvas);
      app.canvas.style.width  = '100%';
      app.canvas.style.height = '100%';
      app.canvas.style.touchAction = 'none';

      const gfx = new Graphics();
      app.stage.addChild(gfx);

      const labelsContainer = new Container();
      app.stage.addChild(labelsContainer);

      appRef.current       = app;
      gfxRef.current       = gfx;
      pixiRef.current      = PIXI;
      labelsRef.current    = labelsContainer;
      textPoolRef.current  = [];

      const ro = new ResizeObserver(() => {
        if (!destroyed) {
          app.renderer.resize(container.clientWidth, container.clientHeight);
          draw();
        }
      });
      ro.observe(container);

      app.ticker.add(() => { if (!destroyed) draw(); });
      draw();
    })();

    return () => {
      destroyed = true;
      appRef.current?.destroy(true);
      appRef.current    = null;
      gfxRef.current    = null;
      pixiRef.current   = null;
      labelsRef.current = null;
      textPoolRef.current = [];
      while (container.firstChild) container.removeChild(container.firstChild);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- keyboard shortcuts --------------------------------------------------
  useEffect(() => {
    const isInputFocused = () => {
      const el = document.activeElement;
      return (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const s = storeRef.current;

      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) {
          spaceHeldRef.current = true;
          if (!dragRef.current) setCursor('grab');
          updateCursor();
        }
        return;
      }

      if (isInputFocused()) return;

      switch (e.key) {
        case 'z': case 'Z': case '=': case '+':
          e.preventDefault();
          zoomBy(1.2, null, null);
          break;
        case 'x': case 'X': case '-': case '_':
          e.preventDefault();
          zoomBy(1 / 1.2, null, null);
          break;
        case 'Home': case '0':
          e.preventDefault();
          s.setCamera(getFitCamera());
          break;
        case '1':
          e.preventDefault();
          s.setCamera({ zoom: 1 });
          break;
        case 'Delete': case 'Backspace':
          if (s.selectedEntityId) {
            e.preventDefault();
            s.deleteEntity(s.selectedEntityId);
          }
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeldRef.current = false;
        if (dragRef.current?.type !== 'pan') setCursor('crosshair');
        updateCursor();
      }
    };

    // Lose space if window loses focus (from reverent-almeida)
    const onBlur = () => {
      spaceHeldRef.current = false;
      updateCursor();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [zoomBy, getFitCamera, setCursor, updateCursor]);

  // ---- hit test ------------------------------------------------------------
  const hitTest = useCallback(
    (wx: number, wy: number): EditorEntity | null => {
      const { entities } = storeRef.current;
      for (let i = entities.length - 1; i >= 0; i--) {
        const e  = entities[i];
        const dx = wx - e.pos.x;
        const dy = wy - e.pos.y;
        // Rect-based entities
        if (e.type === 'obstacle') {
          const { w, h } = e.variant ? getObstacleSize(e.variant) : { w: e.width ?? 64, h: e.height ?? 64 };
          if (Math.abs(dx) <= w / 2 && Math.abs(dy) <= h / 2) return e;
        } else if (e.type === 'spawn_zone' || (e.type === 'trigger_zone' && (e.width !== undefined || e.height !== undefined))) {
          const hw = (e.width  ?? 64) / 2;
          const hh = (e.height ?? 64) / 2;
          if (Math.abs(dx) <= hw && Math.abs(dy) <= hh) return e;
        } else {
          const defaultR =
            e.type === 'enemy_spawn' || e.type === 'player_spawn'
              ? 14
              : e.type === 'entrance' || e.type === 'exit'
                ? 16
                : e.type === 'npc' || e.type === 'loot_cache'
                  ? 14
                  : e.type === 'door' || e.type === 'interactable'
                    ? 40
                    : 60;
          const r = e.radius ?? defaultR;
          if (dx * dx + dy * dy <= r * r) return e;
        }
      }
      return null;
    },
    []
  );

  // ---- pointer events -------------------------------------------------------
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const { w, h } = getCanvasSize();
      const s  = storeRef.current;
      const cx = e.nativeEvent.offsetX;
      const cy = e.nativeEvent.offsetY;

      // ---- Minimap hit ----
      const mX0 = w - MINI_SIZE - MINI_MARGIN;
      const mY0 = h - MINI_SIZE - MINI_MARGIN;
      if (e.button === 0 && cx >= mX0 && cx <= mX0 + MINI_SIZE && cy >= mY0 && cy <= mY0 + MINI_SIZE) {
        const worldX = (cx - mX0) / MINI_SCALE;
        const worldY = (cy - mY0) / MINI_SCALE;
        s.setCamera({ x: worldX, y: worldY });
        dragRef.current = {
          type: 'minimap_pan',
          startScreenX: cx, startScreenY: cy,
          startWorldX: worldX, startWorldY: worldY,
        };
        return;
      }

      const { camera } = s;
      const { wx: wX, wy: wY } = screenToWorld(cx, cy, camera, w, h);

      // Middle or right mouse: pan
      if (e.button === 1 || e.button === 2) {
        dragRef.current = {
          type: 'pan',
          startScreenX: cx, startScreenY: cy,
          startWorldX: wX, startWorldY: wY,
          startCamX: camera.x, startCamY: camera.y,
        };
        updateCursor();
        return;
      }

      // Space + left mouse: pan
      if (e.button === 0 && spaceHeldRef.current) {
        setCursor('grabbing');
        dragRef.current = {
          type: 'pan',
          startScreenX: cx, startScreenY: cy,
          startWorldX: wX, startWorldY: wY,
          startCamX: camera.x, startCamY: camera.y,
        };
        updateCursor();
        return;
      }
      if (e.button !== 0) return;

      const tool = s.activeTool;

      // ---- Surface paint ---------------------------------------------------
      if (tool === 'surface') {
        const col = Math.floor(wX / SURFACE_TILE);
        const row = Math.floor(wY / SURFACE_TILE);
        if (s.fillMode) {
          s.floodFillSurface(col, row);
        } else {
          s.paintSurface(col, row);
          dragRef.current = {
            type: 'surface_paint',
            startScreenX: cx, startScreenY: cy,
            startWorldX: wX, startWorldY: wY,
          };
        }
        return;
      }

      // ---- Select ----------------------------------------------------------
      if (tool === 'select') {
        const hit = hitTest(wX, wY);
        if (hit) {
          s.selectEntity(hit.id);
          dragRef.current = {
            type: 'move_entity',
            startScreenX: cx, startScreenY: cy,
            startWorldX: wX, startWorldY: wY,
            entityId: hit.id,
            entityStartX: hit.pos.x, entityStartY: hit.pos.y,
          };
        } else {
          s.selectEntity(null);
        }
        return;
      }

      // ---- Placement -------------------------------------------------------
      const snapped = { x: Math.round(wX), y: Math.round(wY) };

      const defaults: Record<ToolMode, Partial<EditorEntity>> = {
        select:       {},
        surface:      {},
        cave:         { type: 'cave',         radius: 150 },
        void_pool:    { type: 'void_pool',    radius: 80 },
        obstacle:     { type: 'obstacle',     width: 64, height: 64 },
        enemy:        { type: 'enemy_spawn',  creature: 'Void Leech', count: 1, isElite: false },
        player_spawn: { type: 'player_spawn' },
        interactable: { type: 'interactable', radius: 40, kind: '', prompt: '', action: '' },
        spawn_zone:   { type: 'spawn_zone',   width: 200, height: 200, poolTag: '', budget: 8 },
        trigger_zone: { type: 'trigger_zone', width: 200, height: 200, triggerOn: 'enter', triggerActions: [] },
        door:         { type: 'door',         radius: 40, rewardTag: 'mystery', requiresCleared: true },
        zone:         { type: 'interaction_zone', radius: 80 },
        entrance:     { type: 'entrance',     spawnDirection: 'south' },
        exit:         { type: 'exit',         targetMap: '', interactionPrompt: 'Exit' },
        npc:          { type: 'npc',          npcId: '', dialogue: '' },
        loot_cache:   { type: 'loot_cache',   lootTable: 'default' },
        no_spawn:     { type: 'no_spawn',     radius: 150 },
      };

      if (tool === 'player_spawn') {
        const existing = s.entities.find((en) => en.type === 'player_spawn');
        if (existing) s.deleteEntity(existing.id);
      }

      const typeMap: Record<ToolMode, EntityType | null> = {
        select:       null,
        surface:      null,
        cave:         'cave',
        void_pool:    'void_pool',
        obstacle:     'obstacle',
        enemy:        'enemy_spawn',
        player_spawn: 'player_spawn',
        interactable: 'interactable',
        spawn_zone:   'spawn_zone',
        trigger_zone: 'trigger_zone',
        door:         'door',
        zone:         'interaction_zone',
        entrance:     'entrance',
        exit:         'exit',
        npc:          'npc',
        loot_cache:   'loot_cache',
        no_spawn:     'no_spawn',
      };

      const entType = typeMap[tool];
      if (!entType) return;

      // Build entity with tool-specific defaults
      const id = newEntityId();

      // Apply cave/void_pool/obstacle presets
      let toolDefaults = { ...defaults[tool] };
      if (tool === 'cave') {
        const preset = CAVE_PRESETS.find((p) => p.label === s.activeCaveSize) ?? CAVE_PRESETS[1];
        toolDefaults = { ...toolDefaults, radius: preset.radius };
      } else if (tool === 'void_pool') {
        const preset = VOID_POOL_PRESETS.find((p) => p.label === s.activeVoidPoolSize) ?? VOID_POOL_PRESETS[1];
        toolDefaults = { ...toolDefaults, radius: preset.radius };
      } else if (tool === 'obstacle') {
        const { w, h } = getObstacleSize(s.activeObstacleVariant);
        toolDefaults = { ...toolDefaults, variant: s.activeObstacleVariant, width: w, height: h };
      } else if (tool === 'enemy') {
        toolDefaults = { ...toolDefaults, waveId: s.selectedWaveId ?? undefined };
      }

      const newEnt: EditorEntity = {
        id, type: entType, pos: snapped,
        ...toolDefaults,
      } as EditorEntity;

      s.addEntity(newEnt);
      s.selectEntity(id);

      const isCircleDrag = tool === 'cave' || tool === 'void_pool' || tool === 'no_spawn';
      const isRectDrag   = tool === 'obstacle' || tool === 'spawn_zone' || tool === 'trigger_zone';
      if (isCircleDrag || isRectDrag) {
        dragRef.current = {
          type: isRectDrag ? 'place_rect' : 'place_circle',
          startScreenX: cx, startScreenY: cy,
          startWorldX: wX, startWorldY: wY,
          entityId: id, entityStartX: snapped.x, entityStartY: snapped.y,
        };
      }
    },
    [hitTest, screenToWorld, setCursor, updateCursor]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;

      const { w, h } = getCanvasSize();
      const s  = storeRef.current;
      const sx = e.nativeEvent.offsetX;
      const sy = e.nativeEvent.offsetY;

      if (drag.type === 'minimap_pan') {
        const mX0 = w - MINI_SIZE - MINI_MARGIN;
        const mY0 = h - MINI_SIZE - MINI_MARGIN;
        s.setCamera({ x: (sx - mX0) / MINI_SCALE, y: (sy - mY0) / MINI_SCALE });
        return;
      }

      if (drag.type === 'pan') {
        const dx = (sx - drag.startScreenX) / s.camera.zoom;
        const dy = (sy - drag.startScreenY) / s.camera.zoom;
        s.setCamera({ x: (drag.startCamX ?? s.camera.x) - dx, y: (drag.startCamY ?? s.camera.y) - dy });
        return;
      }

      const { wx: wX, wy: wY } = screenToWorld(sx, sy, s.camera, w, h);

      if (drag.type === 'surface_paint') {
        const col = Math.floor(wX / SURFACE_TILE);
        const row = Math.floor(wY / SURFACE_TILE);
        s.paintSurface(col, row);
        return;
      }

      if (drag.type === 'move_entity' && drag.entityId) {
        const dx = wX - drag.startWorldX;
        const dy = wY - drag.startWorldY;
        s.updateEntity(drag.entityId, {
          pos: { x: Math.round((drag.entityStartX ?? 0) + dx), y: Math.round((drag.entityStartY ?? 0) + dy) },
        });
        return;
      }

      if (drag.type === 'place_circle' && drag.entityId) {
        const dx = wX - (drag.entityStartX ?? 0);
        const dy = wY - (drag.entityStartY ?? 0);
        s.updateEntity(drag.entityId, { radius: Math.max(10, Math.round(Math.sqrt(dx * dx + dy * dy))) });
        return;
      }

      if (drag.type === 'place_rect' && drag.entityId) {
        const dx = wX - (drag.entityStartX ?? 0);
        const dy = wY - (drag.entityStartY ?? 0);
        s.updateEntity(drag.entityId, { width: Math.max(8, Math.abs(Math.round(dx))), height: Math.max(8, Math.abs(Math.round(dy))) });
        return;
      }
    },
    [screenToWorld]
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    setCursor(spaceHeldRef.current ? 'grab' : 'crosshair');
    updateCursor();
  }, [setCursor, updateCursor]);

  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      zoomBy(factor, e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    },
    [zoomBy]
  );

  const onContextMenu = useCallback((e: React.MouseEvent) => { e.preventDefault(); }, []);

  // ---- coordinate HUD -------------------------------------------------------
  const coordRef = useRef<HTMLDivElement>(null);
  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (coordRef.current) {
        const { w, h } = getCanvasSize();
        const { wx, wy } = screenToWorld(e.nativeEvent.offsetX, e.nativeEvent.offsetY, storeRef.current.camera, w, h);
        coordRef.current.textContent = `${Math.round(wx)}, ${Math.round(wy)}`;
      }
    },
    [screenToWorld]
  );

  return (
    <div className="relative w-full h-full" style={{ background: '#0a0a14' }}>
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ cursor: 'crosshair' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        onContextMenu={onContextMenu}
        onMouseMove={onMouseMove}
      />
      <div
        ref={coordRef}
        className="absolute bottom-2 left-2 text-xs font-mono pointer-events-none"
        style={{ color: '#334466', userSelect: 'none' }}
      >
        0, 0
      </div>
      {/* Zoom controls - positioned above minimap */}
      <ZoomHUD
        onFit={() => storeRef.current.setCamera(getFitCamera())}
        onZoomIn={() => zoomBy(1.2, null, null)}
        onZoomOut={() => zoomBy(1 / 1.2, null, null)}
      />
    </div>
  );
}

// ---- Zoom HUD ---------------------------------------------------------------
function ZoomHUD({
  onFit,
  onZoomIn,
  onZoomOut,
}: {
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  const zoom = useEditorStore((s) => s.camera.zoom);

  const btn: React.CSSProperties = {
    borderColor: '#223344',
    color: '#778899',
    background: '#08080fcc',
    cursor: 'pointer',
  };

  return (
    <div
      className="absolute flex items-center gap-1"
      style={{
        bottom: MINI_SIZE + MINI_MARGIN * 2 + 4,
        right: MINI_MARGIN,
        userSelect: 'none',
      }}
    >
      <button
        onClick={onZoomOut}
        className="w-6 h-6 flex items-center justify-center text-sm border hover:opacity-80 transition-opacity"
        style={btn}
        title="Zoom out (X or -)"
      >
        -
      </button>
      <button
        onClick={onFit}
        className="px-2 h-6 flex items-center justify-center text-[11px] font-mono border hover:opacity-80 transition-opacity"
        style={{ ...btn, minWidth: 52 }}
        title="Fit map in view (Home or 0)"
      >
        {(zoom * 100).toFixed(0)}%
      </button>
      <button
        onClick={onZoomIn}
        className="w-6 h-6 flex items-center justify-center text-sm border hover:opacity-80 transition-opacity"
        style={btn}
        title="Zoom in (Z or =)"
      >
        +
      </button>
      <button
        onClick={onFit}
        className="px-2 h-6 flex items-center justify-center text-[10px] border hover:opacity-80 transition-opacity"
        style={btn}
        title="Fit map in view (Home or 0)"
      >
        FIT
      </button>
    </div>
  );
}
