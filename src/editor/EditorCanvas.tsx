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
const COL_ZONE         = 0xffcc00;
const COL_SELECT       = 0x44aaff;
const COL_GRID_ALPHA   = 0.25;

// ---- Minimap ---------------------------------------------------------------
const MINI_SIZE  = 150;
const MINI_PAD   = 8;
const MINI_SCALE = MINI_SIZE / WORLD_W; // world px -> minimap px (square map)

// ---- Types -----------------------------------------------------------------
interface DragState {
  type: 'pan' | 'move_entity' | 'place_circle' | 'place_rect';
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

  // ---- canvas size helper ---------------------------------------------------
  const getCanvasSize = () => {
    const app = appRef.current;
    if (!app) return { w: 1, h: 1 };
    return { w: app.renderer.width, h: app.renderer.height };
  };

  // ---- cursor management ---------------------------------------------------
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

  // ---- world <-> screen conversions ----------------------------------------
  const worldToScreen = useCallback(
    (wx: number, wy: number, cam: { x: number; y: number; zoom: number }, w: number, h: number) => {
      const sx = (wx - cam.x) * cam.zoom + w / 2;
      const sy = (wy - cam.y) * cam.zoom + h / 2;
      return { sx, sy };
    },
    []
  );

  const screenToWorld = useCallback(
    (sx: number, sy: number, cam: { x: number; y: number; zoom: number }, w: number, h: number) => {
      const wx = (sx - w / 2) / cam.zoom + cam.x;
      const wy = (sy - h / 2) / cam.zoom + cam.y;
      return { wx, wy };
    },
    []
  );

  // ---- zoom helpers --------------------------------------------------------
  const zoomAtPoint = useCallback((screenX: number, screenY: number, factor: number) => {
    const s = storeRef.current;
    const { w: W, h: H } = getCanvasSize();
    const oldZoom = s.camera.zoom;
    const newZoom = Math.min(4, Math.max(0.05, oldZoom * factor));
    // Keep the world point under the cursor fixed after zoom
    const wx = (screenX - W / 2) / oldZoom + s.camera.x;
    const wy = (screenY - H / 2) / oldZoom + s.camera.y;
    const newCamX = wx - (screenX - W / 2) / newZoom;
    const newCamY = wy - (screenY - H / 2) / newZoom;
    s.setCamera({ zoom: newZoom, x: newCamX, y: newCamY });
  }, []);

  const fitToMap = useCallback(() => {
    const { w: W, h: H } = getCanvasSize();
    const zoom = Math.min(W / WORLD_W, H / WORLD_H) * 0.9;
    storeRef.current.setCamera({ x: WORLD_W / 2, y: WORLD_H / 2, zoom });
  }, []);

  // ---- draw ----------------------------------------------------------------
  const draw = useCallback(() => {
    const app = appRef.current;
    const gfx = gfxRef.current;
    if (!app || !gfx) return;

    const { camera, entities, selectedEntityId, selectedWaveId, waves } = storeRef.current;
    const W = app.renderer.width;
    const H = app.renderer.height;

    gfx.clear();

    // Background
    gfx.rect(0, 0, W, H).fill(COL_BG);

    // Grid
    const worldLeft   = (0     - W / 2) / camera.zoom + camera.x;
    const worldTop    = (0     - H / 2) / camera.zoom + camera.y;
    const worldRight  = (W     - W / 2) / camera.zoom + camera.x;
    const worldBottom = (H     - H / 2) / camera.zoom + camera.y;

    const startGX = Math.floor(worldLeft / GRID_STEP) * GRID_STEP;
    const startGY = Math.floor(worldTop  / GRID_STEP) * GRID_STEP;

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
    const { sx: bx1, sy: by1 } = worldToScreen(0,      0,      camera, W, H);
    const { sx: bx2, sy: by2 } = worldToScreen(WORLD_W, WORLD_H, camera, W, H);
    gfx
      .setStrokeStyle({ width: 2, color: 0x334455, alpha: 0.8 })
      .rect(bx1, by1, bx2 - bx1, by2 - by1)
      .stroke();

    // World-space drawing helpers
    const toS = (wx: number, wy: number) => worldToScreen(wx, wy, camera, W, H);
    const r2s = (r: number) => r * camera.zoom;

    const highlightedWaveId = selectedWaveId;

    // Entities
    for (const ent of entities) {
      const { sx, sy } = toS(ent.pos.x, ent.pos.y);
      const isSelected       = ent.id === selectedEntityId;
      const isWaveHighlighted = highlightedWaveId != null && ent.waveId === highlightedWaveId;

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
          if (cnt > 1 || ent.isElite) {
            gfx.circle(sx + rad, sy - rad, r2s(4)).fill({ color: ent.isElite ? 0xffcc00 : 0xffffff });
          }
          break;
        }
        case 'player_spawn': {
          const rad = r2s(14);
          gfx.circle(sx, sy, rad).fill({ color: COL_PLAYER_SPAWN, alpha: 0.9 });
          gfx
            .setStrokeStyle({ width: 2, color: 0xffffff })
            .moveTo(sx - rad, sy).lineTo(sx + rad, sy).stroke()
            .moveTo(sx, sy - rad).lineTo(sx, sy + rad).stroke();
          if (isSelected) gfx.circle(sx, sy, rad + 3).stroke({ width: 2, color: COL_SELECT });
          break;
        }
        case 'interaction_zone':
        case 'door': {
          const rad = r2s(ent.radius ?? 60);
          gfx.circle(sx, sy, rad).fill({ color: COL_ZONE, alpha: 0.25 });
          gfx.circle(sx, sy, rad).stroke({ width: 1, color: COL_ZONE, alpha: 0.8 });
          if (isSelected) gfx.circle(sx, sy, rad + 3).stroke({ width: 2, color: COL_SELECT });
          break;
        }
      }
    }

    // ---- Minimap -----------------------------------------------------------
    {
      const mx = W - MINI_SIZE - MINI_PAD;
      const my = H - MINI_SIZE - MINI_PAD;
      const ms = MINI_SCALE;

      // Background
      gfx.rect(mx, my, MINI_SIZE, MINI_SIZE).fill({ color: 0x080810, alpha: 0.92 });
      gfx.rect(mx, my, MINI_SIZE, MINI_SIZE).stroke({ width: 1, color: 0x334455, alpha: 0.9 });

      // Entity dots
      for (const ent of entities) {
        const ex = mx + ent.pos.x * ms;
        const ey = my + ent.pos.y * ms;
        let col = 0x556677;
        if (ent.type === 'enemy_spawn') {
          const wc = waves.find((w) => w.id === ent.waveId)?.color;
          col = wc ? parseInt(wc.replace('#', ''), 16) : COL_ENEMY_SPAWN;
        } else if (ent.type === 'player_spawn')    col = COL_PLAYER_SPAWN;
        else if (ent.type === 'cave')              col = 0x445566;
        else if (ent.type === 'void_pool')         col = 0x9933cc;
        else if (ent.type === 'obstacle')          col = 0x445566;
        else if (ent.type === 'interaction_zone' || ent.type === 'door') col = COL_ZONE;
        gfx.circle(ex, ey, 2).fill({ color: col, alpha: 0.9 });
      }

      // Viewport rect (clamped to minimap bounds)
      const vpWorldW    = W / camera.zoom;
      const vpWorldH    = H / camera.zoom;
      const vpWorldLeft = camera.x - vpWorldW / 2;
      const vpWorldTop  = camera.y - vpWorldH / 2;
      const vpX = mx + vpWorldLeft * ms;
      const vpY = my + vpWorldTop  * ms;
      const vpW = vpWorldW * ms;
      const vpH = vpWorldH * ms;
      // Clamp so it doesn't bleed outside the minimap box
      const cx1 = Math.max(mx, Math.min(mx + MINI_SIZE, vpX));
      const cy1 = Math.max(my, Math.min(my + MINI_SIZE, vpY));
      const cx2 = Math.max(mx, Math.min(mx + MINI_SIZE, vpX + vpW));
      const cy2 = Math.max(my, Math.min(my + MINI_SIZE, vpY + vpH));
      if (cx2 - cx1 > 0 && cy2 - cy1 > 0) {
        gfx.rect(cx1, cy1, cx2 - cx1, cy2 - cy1).stroke({ width: 1, color: 0xffffff, alpha: 0.55 });
      }
    }
  }, [worldToScreen]);

  // ---- init PixiJS ---------------------------------------------------------
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
        width:           container.clientWidth,
        height:          container.clientHeight,
        backgroundColor: COL_BG,
        antialias:       false,
        roundPixels:     true,
        resolution:      window.devicePixelRatio || 1,
        autoDensity:     true,
      });

      if (destroyed) { app.destroy(true); return; }

      container.appendChild(app.canvas);
      app.canvas.style.width      = '100%';
      app.canvas.style.height     = '100%';
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
    const isInputFocused = () => {
      const el = document.activeElement;
      return (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Space: pan mode (never when typing)
      if (e.code === 'Space') {
        if (!isInputFocused()) {
          e.preventDefault();
          if (!e.repeat) {
            spaceHeldRef.current = true;
            updateCursor();
          }
        }
        return;
      }

      if (isInputFocused()) return;

      const { w: W, h: H } = getCanvasSize();

      // Zoom in: Z or =
      if (e.code === 'KeyZ' || e.code === 'Equal') {
        e.preventDefault();
        zoomAtPoint(W / 2, H / 2, 1.2);
      }
      // Zoom out: X or -
      else if (e.code === 'KeyX' || e.code === 'Minus') {
        e.preventDefault();
        zoomAtPoint(W / 2, H / 2, 1 / 1.2);
      }
      // Fit to map: Home or 0
      else if (e.code === 'Home' || e.code === 'Digit0') {
        e.preventDefault();
        fitToMap();
      }
      // 100%: 1
      else if (e.code === 'Digit1') {
        e.preventDefault();
        storeRef.current.setCamera({ zoom: 1 });
      }
      // Delete selected entity: Delete or Backspace
      else if (e.code === 'Delete' || e.code === 'Backspace') {
        const s = storeRef.current;
        if (s.selectedEntityId) {
          e.preventDefault();
          s.deleteEntity(s.selectedEntityId);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeldRef.current = false;
        updateCursor();
      }
    };

    // Lose space if window loses focus
    const onBlur = () => {
      spaceHeldRef.current = false;
      updateCursor();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    window.addEventListener('blur',    onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
      window.removeEventListener('blur',    onBlur);
    };
  }, [zoomAtPoint, fitToMap, updateCursor]);

  // ---- hit test ------------------------------------------------------------
  const hitTest = useCallback(
    (wx: number, wy: number): EditorEntity | null => {
      const { entities } = storeRef.current;
      for (let i = entities.length - 1; i >= 0; i--) {
        const e = entities[i];
        const dx = wx - e.pos.x;
        const dy = wy - e.pos.y;
        if (e.type === 'obstacle') {
          const hw = (e.width  ?? 64) / 2;
          const hh = (e.height ?? 64) / 2;
          if (Math.abs(dx) <= hw && Math.abs(dy) <= hh) return e;
        } else {
          const r = e.radius ?? (e.type === 'enemy_spawn' || e.type === 'player_spawn' ? 14 : 60);
          if (dx * dx + dy * dy <= r * r) return e;
        }
      }
      return null;
    },
    []
  );

  // ---- pointer events ------------------------------------------------------
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const { w, h } = getCanvasSize();
      const s        = storeRef.current;
      const sx       = e.nativeEvent.offsetX;
      const sy       = e.nativeEvent.offsetY;
      const { camera } = s;
      const { wx: wX, wy: wY } = screenToWorld(sx, sy, camera, w, h);

      // ---- Minimap click: jump camera (left button only) -------------------
      if (e.button === 0) {
        const miniLeft = w - MINI_SIZE - MINI_PAD;
        const miniTop  = h - MINI_SIZE - MINI_PAD;
        if (sx >= miniLeft && sx <= miniLeft + MINI_SIZE &&
            sy >= miniTop  && sy <= miniTop  + MINI_SIZE) {
          const worldX = (sx - miniLeft) / MINI_SCALE;
          const worldY = (sy - miniTop)  / MINI_SCALE;
          s.setCamera({ x: worldX, y: worldY });
          return;
        }
      }

      // ---- Pan: middle-mouse, right-mouse, or Space+left -------------------
      const isPanIntent =
        e.button === 1 ||
        e.button === 2 ||
        (e.button === 0 && spaceHeldRef.current);

      if (isPanIntent) {
        dragRef.current = {
          type:        'pan',
          startScreenX: sx,
          startScreenY: sy,
          startWorldX:  wX,
          startWorldY:  wY,
          startCamX:    camera.x,
          startCamY:    camera.y,
        };
        updateCursor();
        return;
      }

      if (e.button !== 0) return;

      const tool = s.activeTool;

      if (tool === 'select') {
        const hit = hitTest(wX, wY);
        if (hit) {
          s.selectEntity(hit.id);
          dragRef.current = {
            type:         'move_entity',
            startScreenX:  sx,
            startScreenY:  sy,
            startWorldX:   wX,
            startWorldY:   wY,
            entityId:      hit.id,
            entityStartX:  hit.pos.x,
            entityStartY:  hit.pos.y,
          };
        } else {
          s.selectEntity(null);
        }
        return;
      }

      // ---- Placement tools -------------------------------------------------
      const snapped = { x: Math.round(wX), y: Math.round(wY) };

      const defaults: Record<ToolMode, Partial<EditorEntity>> = {
        select:       {},
        cave:         { type: 'cave',              radius: 150 },
        void_pool:    { type: 'void_pool',          radius: 80  },
        obstacle:     { type: 'obstacle',           width: 64, height: 64 },
        enemy:        { type: 'enemy_spawn',        creature: 'Void Leech', count: 1, isElite: false },
        player_spawn: { type: 'player_spawn' },
        zone:         { type: 'interaction_zone',   radius: 80, label: 'Zone' },
      };

      if (tool === 'player_spawn') {
        const existing = s.entities.find((en) => en.type === 'player_spawn');
        if (existing) s.deleteEntity(existing.id);
      }

      const typeMap: Record<ToolMode, EntityType | null> = {
        select:       null,
        cave:         'cave',
        void_pool:    'void_pool',
        obstacle:     'obstacle',
        enemy:        'enemy_spawn',
        player_spawn: 'player_spawn',
        zone:         'interaction_zone',
      };

      const entType = typeMap[tool];
      if (!entType) return;

      const id = newEntityId();
      const newEnt: EditorEntity = {
        id,
        type:   entType,
        pos:    snapped,
        waveId: s.selectedWaveId ?? undefined,
        ...defaults[tool],
      } as EditorEntity;

      s.addEntity(newEnt);
      s.selectEntity(id);

      const isDragTool =
        tool === 'cave' || tool === 'void_pool' || tool === 'obstacle' || tool === 'zone';
      if (isDragTool) {
        dragRef.current = {
          type:         tool === 'obstacle' ? 'place_rect' : 'place_circle',
          startScreenX:  sx,
          startScreenY:  sy,
          startWorldX:   wX,
          startWorldY:   wY,
          entityId:      id,
          entityStartX:  snapped.x,
          entityStartY:  snapped.y,
        };
      }
    },
    [hitTest, screenToWorld, updateCursor]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;

      const { w, h } = getCanvasSize();
      const s  = storeRef.current;
      const sx = e.nativeEvent.offsetX;
      const sy = e.nativeEvent.offsetY;

      if (drag.type === 'pan') {
        const dx = (sx - drag.startScreenX) / s.camera.zoom;
        const dy = (sy - drag.startScreenY) / s.camera.zoom;
        s.setCamera({
          x: (drag.startCamX ?? s.camera.x) - dx,
          y: (drag.startCamY ?? s.camera.y) - dy,
        });
        return;
      }

      const { wx: wX, wy: wY } = screenToWorld(sx, sy, s.camera, w, h);

      if (drag.type === 'move_entity' && drag.entityId) {
        const dx = wX - drag.startWorldX;
        const dy = wY - drag.startWorldY;
        s.updateEntity(drag.entityId, {
          pos: {
            x: Math.round((drag.entityStartX ?? 0) + dx),
            y: Math.round((drag.entityStartY ?? 0) + dy),
          },
        });
        return;
      }

      if (drag.type === 'place_circle' && drag.entityId) {
        const dx     = wX - (drag.entityStartX ?? 0);
        const dy     = wY - (drag.entityStartY ?? 0);
        const radius = Math.max(10, Math.round(Math.sqrt(dx * dx + dy * dy)));
        s.updateEntity(drag.entityId, { radius });
        return;
      }

      if (drag.type === 'place_rect' && drag.entityId) {
        const dx = wX - (drag.entityStartX ?? 0);
        const dy = wY - (drag.entityStartY ?? 0);
        const w2 = Math.max(8, Math.abs(Math.round(dx)));
        const h2 = Math.max(8, Math.abs(Math.round(dy)));
        s.updateEntity(drag.entityId, { width: w2, height: h2 });
        return;
      }
    },
    [screenToWorld]
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    updateCursor();
  }, [updateCursor]);

  // ---- scroll-wheel zoom (cursor-centered) ---------------------------------
  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.06 : 1 / 1.06;
      zoomAtPoint(e.nativeEvent.offsetX, e.nativeEvent.offsetY, factor);
    },
    [zoomAtPoint]
  );

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // ---- coordinate HUD ------------------------------------------------------
  const coordRef = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!coordRef.current) return;
      const { w, h } = getCanvasSize();
      const s        = storeRef.current;
      const { wx, wy } = screenToWorld(
        e.nativeEvent.offsetX,
        e.nativeEvent.offsetY,
        s.camera,
        w,
        h
      );
      coordRef.current.textContent = `${Math.round(wx)}, ${Math.round(wy)}`;
    },
    [screenToWorld]
  );

  // ---- zoom control callbacks (passed to ZoomControls) ---------------------
  const handleZoomIn = useCallback(() => {
    const { w, h } = getCanvasSize();
    zoomAtPoint(w / 2, h / 2, 1.2);
  }, [zoomAtPoint]);

  const handleZoomOut = useCallback(() => {
    const { w, h } = getCanvasSize();
    zoomAtPoint(w / 2, h / 2, 1 / 1.2);
  }, [zoomAtPoint]);

  const handleReset100 = useCallback(() => {
    storeRef.current.setCamera({ zoom: 1 });
  }, []);

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

      {/* Coordinate HUD - bottom left */}
      <div
        ref={coordRef}
        className="absolute bottom-2 left-2 text-xs font-mono pointer-events-none"
        style={{ color: '#334466', userSelect: 'none' }}
      >
        0, 0
      </div>

      {/* Zoom Controls - above minimap, bottom right */}
      <ZoomControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFit={fitToMap}
        onReset100={handleReset100}
      />
    </div>
  );
}

// ---- Zoom Controls ---------------------------------------------------------
function ZoomControls({
  onZoomIn,
  onZoomOut,
  onFit,
  onReset100,
}: {
  onZoomIn:   () => void;
  onZoomOut:  () => void;
  onFit:      () => void;
  onReset100: () => void;
}) {
  const zoom = useEditorStore((s) => s.camera.zoom);

  const btnStyle: React.CSSProperties = {
    borderColor: '#223344',
    color:       '#778899',
    background:  '#0a0a14',
  };

  return (
    <div
      className="absolute flex items-center gap-1"
      style={{
        bottom: MINI_SIZE + MINI_PAD + 10,
        right:  MINI_PAD,
        zIndex: 10,
      }}
    >
      <button
        onClick={onZoomOut}
        className="w-6 h-6 flex items-center justify-center text-sm border transition-all hover:opacity-80"
        style={btnStyle}
        title="Zoom Out (X / -)"
      >
        −
      </button>
      <button
        onClick={onReset100}
        className="h-6 px-2 text-[10px] font-mono border transition-all hover:opacity-80"
        style={{ ...btnStyle, minWidth: 52 }}
        title="Reset to 100% (1)"
      >
        {(zoom * 100).toFixed(0)}%
      </button>
      <button
        onClick={onZoomIn}
        className="w-6 h-6 flex items-center justify-center text-sm border transition-all hover:opacity-80"
        style={btnStyle}
        title="Zoom In (Z / =)"
      >
        +
      </button>
      <button
        onClick={onFit}
        className="h-6 px-2 text-[10px] font-mono border transition-all hover:opacity-80 ml-1"
        style={btnStyle}
        title="Fit Map in View (Home / 0)"
      >
        FIT
      </button>
    </div>
  );
}
