'use client';

import { useRef, useEffect, useCallback } from 'react';
import {
  useEditorStore,
  type EditorEntity,
  type EntityType,
  newEntityId,
  type ToolMode,
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
const COL_PLAYER_SPAWN = 0x00ccff;
const COL_ENEMY_SPAWN  = 0xff4444;
const COL_INTERACTABLE = 0xffcc00;   // also used for legacy interaction_zone
const COL_SPAWN_ZONE   = 0xff6644;
const COL_TRIGGER_ZONE = 0xffaa44;
const COL_DOOR         = 0x44ccff;
const COL_SELECT       = 0x44aaff;
const COL_GRID_ALPHA   = 0.25;

// ---- Minimap ---------------------------------------------------------------
const MINI_SIZE   = 150;
const MINI_MARGIN = 8;
const MINI_SCALE  = MINI_SIZE / Math.max(WORLD_W, WORLD_H);

// ---- Types -----------------------------------------------------------------
interface DragState {
  type: 'pan' | 'move_entity' | 'place_circle' | 'place_rect' | 'minimap_pan';
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

// ---- PixiJS handles (module-level refs for the ticker closure) -------------
let pixiGfx: import('pixi.js').Graphics | null = null;

export function EditorCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef       = useRef<import('pixi.js').Application | null>(null);
  const gfxRef       = useRef<import('pixi.js').Graphics | null>(null);
  const dragRef      = useRef<DragState | null>(null);
  const spaceHeldRef = useRef(false);

  const store = useEditorStore();
  const storeRef = useRef(store);
  storeRef.current = store;

  // ---- world <-> screen conversions ----------------------------------------
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

  // ---- draw -----------------------------------------------------------------
  const draw = useCallback(() => {
    const app = appRef.current;
    const gfx = gfxRef.current;
    if (!app || !gfx) return;

    const { camera, entities, selectedEntityId, selectedWaveId, waves } = storeRef.current;
    const W = app.renderer.width;
    const H = app.renderer.height;

    gfx.clear();
    gfx.rect(0, 0, W, H).fill(COL_BG);

    // Grid
    const worldLeft   = (0 - W / 2) / camera.zoom + camera.x;
    const worldTop    = (0 - H / 2) / camera.zoom + camera.y;
    const worldRight  = (W - W / 2) / camera.zoom + camera.x;
    const worldBottom = (H - H / 2) / camera.zoom + camera.y;
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

    // Map border
    const { sx: bx1, sy: by1 } = worldToScreen(0, 0, camera, W, H);
    const { sx: bx2, sy: by2 } = worldToScreen(WORLD_W, WORLD_H, camera, W, H);
    gfx.setStrokeStyle({ width: 2, color: 0x334455, alpha: 0.8 })
       .rect(bx1, by1, bx2 - bx1, by2 - by1)
       .stroke();

    const toS = (wx: number, wy: number) => worldToScreen(wx, wy, camera, W, H);
    const r2s = (r: number) => r * camera.zoom;

    // Entities
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
          const w = r2s(ent.width  ?? 64);
          const h = r2s(ent.height ?? 64);
          gfx.rect(sx - w / 2, sy - h / 2, w, h).fill({ color: COL_OBSTACLE, alpha: 0.9 });
          if (isSelected)
            gfx.rect(sx - w / 2 - 2, sy - h / 2 - 2, w + 4, h + 4).stroke({ width: 2, color: COL_SELECT });
          break;
        }
        case 'enemy_spawn': {
          const waveColor = waves.find((w) => w.id === ent.waveId)?.color;
          const col = waveColor ? parseInt(waveColor.replace('#', ''), 16) : COL_ENEMY_SPAWN;
          const rad = r2s(10);
          gfx.circle(sx, sy, rad).fill({ color: col, alpha: isWaveHighlighted ? 1.0 : 0.8 });
          if (isSelected || isWaveHighlighted)
            gfx.circle(sx, sy, rad + 3).stroke({ width: 2, color: COL_SELECT });
          const cnt = ent.count ?? 1;
          if (cnt > 1 || ent.isElite)
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
          const w = r2s(ent.width  ?? 200);
          const h = r2s(ent.height ?? 200);
          // Dashed-look via stroke only
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
          break;
        }
      }
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

  // ---- init PixiJS ----------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let destroyed = false;

    (async () => {
      const PIXI = await import('pixi.js');
      const { Application, Graphics } = PIXI;

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
      appRef.current = app;
      gfxRef.current = gfx;
      pixiGfx = gfx;

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
      pixiGfx = null;
      appRef.current?.destroy(true);
      appRef.current = null;
      gfxRef.current = null;
      while (container.firstChild) container.removeChild(container.firstChild);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- keyboard shortcuts --------------------------------------------------
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const s = storeRef.current;

      if (e.code === 'Space') {
        e.preventDefault();
        spaceHeldRef.current = true;
        if (!dragRef.current) setCursor('grab');
        return;
      }

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
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [zoomBy, getFitCamera, setCursor]);

  // ---- hit test ------------------------------------------------------------
  const hitTest = useCallback(
    (wx: number, wy: number): EditorEntity | null => {
      const { entities } = storeRef.current;
      for (let i = entities.length - 1; i >= 0; i--) {
        const e  = entities[i];
        const dx = wx - e.pos.x;
        const dy = wy - e.pos.y;
        // Rect-based entities
        if (e.type === 'obstacle' || e.type === 'spawn_zone' || e.type === 'trigger_zone') {
          const hw = (e.width  ?? 64) / 2;
          const hh = (e.height ?? 64) / 2;
          if (Math.abs(dx) <= hw && Math.abs(dy) <= hh) return e;
        } else {
          const defaultR =
            e.type === 'enemy_spawn' || e.type === 'player_spawn'
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
        return;
      }

      if (e.button !== 0) return;

      const tool = s.activeTool;

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

      // Placement tools
      const snapped = { x: Math.round(wX), y: Math.round(wY) };

      const defaults: Record<ToolMode, Partial<EditorEntity>> = {
        select:       {},
        cave:         { type: 'cave',         radius: 150 },
        void_pool:    { type: 'void_pool',    radius: 80 },
        obstacle:     { type: 'obstacle',     width: 64, height: 64 },
        enemy:        { type: 'enemy_spawn',  creature: 'Void Leech', count: 1, isElite: false },
        player_spawn: { type: 'player_spawn' },
        interactable: { type: 'interactable', radius: 40, kind: '', prompt: '', action: '' },
        spawn_zone:   { type: 'spawn_zone',   width: 200, height: 200, poolTag: '', budget: 8 },
        trigger_zone: { type: 'trigger_zone', width: 200, height: 200, triggerOn: 'enter', triggerActions: [] },
        door:         { type: 'door',         radius: 40, rewardTag: 'mystery', requiresCleared: true },
      };

      if (tool === 'player_spawn') {
        const existing = s.entities.find((en) => en.type === 'player_spawn');
        if (existing) s.deleteEntity(existing.id);
      }

      const typeMap: Record<ToolMode, EntityType | null> = {
        select: null,
        cave: 'cave', void_pool: 'void_pool', obstacle: 'obstacle',
        enemy: 'enemy_spawn', player_spawn: 'player_spawn',
        interactable: 'interactable',
        spawn_zone: 'spawn_zone',
        trigger_zone: 'trigger_zone',
        door: 'door',
      };

      const entType = typeMap[tool];
      if (!entType) return;

      const id = newEntityId();
      const newEnt: EditorEntity = {
        id, type: entType, pos: snapped,
        waveId: s.selectedWaveId ?? undefined,
        ...defaults[tool],
      } as EditorEntity;

      s.addEntity(newEnt);
      s.selectEntity(id);

      const isCircleDrag = tool === 'cave' || tool === 'void_pool';
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
    [hitTest, screenToWorld, setCursor]
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
  }, [setCursor]);

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
      {/* Coordinate HUD */}
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
