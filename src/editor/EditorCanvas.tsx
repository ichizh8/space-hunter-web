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
  const appRef = useRef<import('pixi.js').Application | null>(null);
  const gfxRef = useRef<import('pixi.js').Graphics | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const store = useEditorStore();
  const storeRef = useRef(store);
  storeRef.current = store;

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

  // ---- draw -----------------------------------------------------------------
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
    const worldLeft = (0 - W / 2) / camera.zoom + camera.x;
    const worldTop  = (0 - H / 2) / camera.zoom + camera.y;
    const worldRight  = (W - W / 2) / camera.zoom + camera.x;
    const worldBottom = (H - H / 2) / camera.zoom + camera.y;

    const startGX = Math.floor(worldLeft / GRID_STEP) * GRID_STEP;
    const startGY = Math.floor(worldTop / GRID_STEP) * GRID_STEP;

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
    gfx
      .setStrokeStyle({ width: 2, color: 0x334455, alpha: 0.8 })
      .rect(bx1, by1, bx2 - bx1, by2 - by1)
      .stroke();

    // World-space drawing helpers
    const toS = (wx: number, wy: number) => worldToScreen(wx, wy, camera, W, H);
    const r2s = (r: number) => r * camera.zoom;

    // Selected wave highlight set
    const highlightedWaveId = selectedWaveId;

    // Entities
    for (const ent of entities) {
      const { sx, sy } = toS(ent.pos.x, ent.pos.y);
      const isSelected = ent.id === selectedEntityId;
      const isWaveHighlighted =
        highlightedWaveId != null && ent.waveId === highlightedWaveId;

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
          const w = r2s(ent.width ?? 64);
          const h = r2s(ent.height ?? 64);
          gfx.rect(sx - w / 2, sy - h / 2, w, h).fill({ color: COL_OBSTACLE, alpha: 0.9 });
          if (isSelected)
            gfx.rect(sx - w / 2 - 2, sy - h / 2 - 2, w + 4, h + 4).stroke({ width: 2, color: COL_SELECT });
          break;
        }
        case 'enemy_spawn': {
          const waveColor = waves.find((w) => w.id === ent.waveId)?.color;
          const col = waveColor
            ? parseInt(waveColor.replace('#', ''), 16)
            : COL_ENEMY_SPAWN;
          const rad = r2s(10);
          gfx.circle(sx, sy, rad).fill({ color: col, alpha: isWaveHighlighted ? 1.0 : 0.8 });
          if (isSelected || isWaveHighlighted)
            gfx.circle(sx, sy, rad + 3).stroke({ width: 2, color: COL_SELECT });
          // Count label
          const cnt = ent.count ?? 1;
          if (cnt > 1 || ent.isElite) {
            // small dot indicator
            gfx.circle(sx + rad, sy - rad, r2s(4)).fill({ color: ent.isElite ? 0xffcc00 : 0xffffff });
          }
          break;
        }
        case 'player_spawn': {
          const rad = r2s(14);
          gfx.circle(sx, sy, rad).fill({ color: COL_PLAYER_SPAWN, alpha: 0.9 });
          // Cross
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

    // Coordinates overlay at center
    // (omitted for performance -- add as HTML overlay if needed)
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
      app.canvas.style.width = '100%';
      app.canvas.style.height = '100%';
      app.canvas.style.touchAction = 'none';

      const gfx = new Graphics();
      app.stage.addChild(gfx);
      appRef.current = app;
      gfxRef.current = gfx;
      pixiGfx = gfx;

      // Resize observer
      const ro = new ResizeObserver(() => {
        if (!destroyed) {
          app.renderer.resize(container.clientWidth, container.clientHeight);
          draw();
        }
      });
      ro.observe(container);

      // Render loop - draw every frame so camera changes are instant
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

  // ---- hit test ------------------------------------------------------------
  const hitTest = useCallback(
    (wx: number, wy: number): EditorEntity | null => {
      const { entities } = storeRef.current;
      // iterate reversed so topmost (last drawn) wins
      for (let i = entities.length - 1; i >= 0; i--) {
        const e = entities[i];
        const dx = wx - e.pos.x;
        const dy = wy - e.pos.y;

        if (e.type === 'obstacle') {
          const hw = (e.width ?? 64) / 2;
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

  // ---- pointer events -------------------------------------------------------
  const getCanvasSize = () => {
    const app = appRef.current;
    if (!app) return { w: 1, h: 1 };
    return { w: app.renderer.width, h: app.renderer.height };
  };

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const { w, h } = getCanvasSize();
      const s = storeRef.current;
      const { wx, wy } = { wx: e.nativeEvent.offsetX, wy: e.nativeEvent.offsetY };
      // Use screenToWorld
      const { camera } = s;

      const wPos = (sx: number, sy: number) =>
        screenToWorld(sx, sy, camera, w, h);

      const { wx: wX, wy: wY } = wPos(wx, wy);

      // Middle-mouse or right-mouse: pan
      if (e.button === 1 || e.button === 2) {
        dragRef.current = {
          type: 'pan',
          startScreenX: wx,
          startScreenY: wy,
          startWorldX: wX,
          startWorldY: wY,
          startCamX: camera.x,
          startCamY: camera.y,
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
            startScreenX: wx,
            startScreenY: wy,
            startWorldX: wX,
            startWorldY: wY,
            entityId: hit.id,
            entityStartX: hit.pos.x,
            entityStartY: hit.pos.y,
          };
        } else {
          s.selectEntity(null);
        }
        return;
      }

      // Placement tools
      const snapped = { x: Math.round(wX), y: Math.round(wY) };

      const defaults: Record<ToolMode, Partial<EditorEntity>> = {
        select: {},
        cave:         { type: 'cave',         radius: 150 },
        void_pool:    { type: 'void_pool',     radius: 80 },
        obstacle:     { type: 'obstacle',      width: 64, height: 64 },
        enemy:        { type: 'enemy_spawn',   creature: 'Void Leech', count: 1, isElite: false },
        player_spawn: { type: 'player_spawn'  },
        zone:         { type: 'interaction_zone', radius: 80, label: 'Zone' },
      };

      if (tool === 'player_spawn') {
        // Only one allowed -- remove existing
        const existing = s.entities.find((en) => en.type === 'player_spawn');
        if (existing) s.deleteEntity(existing.id);
      }

      const typeMap: Record<ToolMode, EntityType | null> = {
        select: null,
        cave: 'cave',
        void_pool: 'void_pool',
        obstacle: 'obstacle',
        enemy: 'enemy_spawn',
        player_spawn: 'player_spawn',
        zone: 'interaction_zone',
      };

      const entType = typeMap[tool];
      if (!entType) return;

      const id = newEntityId();
      const newEnt: EditorEntity = {
        id,
        type: entType,
        pos: snapped,
        waveId: s.selectedWaveId ?? undefined,
        ...defaults[tool],
      } as EditorEntity;

      s.addEntity(newEnt);
      s.selectEntity(id);

      // For circle/rect drag-to-size
      const isDragTool =
        tool === 'cave' || tool === 'void_pool' || tool === 'obstacle' || tool === 'zone';
      if (isDragTool) {
        dragRef.current = {
          type: tool === 'obstacle' ? 'place_rect' : 'place_circle',
          startScreenX: wx,
          startScreenY: wy,
          startWorldX: wX,
          startWorldY: wY,
          entityId: id,
          entityStartX: snapped.x,
          entityStartY: snapped.y,
        };
      }
    },
    [hitTest, screenToWorld]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;

      const { w, h } = getCanvasSize();
      const s = storeRef.current;
      const sx = e.nativeEvent.offsetX;
      const sy = e.nativeEvent.offsetY;

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
          pos: {
            x: Math.round((drag.entityStartX ?? 0) + dx),
            y: Math.round((drag.entityStartY ?? 0) + dy),
          },
        });
        return;
      }

      if ((drag.type === 'place_circle') && drag.entityId) {
        const dx = wX - (drag.entityStartX ?? 0);
        const dy = wY - (drag.entityStartY ?? 0);
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
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const s = storeRef.current;
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(3, Math.max(0.05, s.camera.zoom * factor));
      s.setCamera({ zoom: newZoom });
    },
    []
  );

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // ---- coordinate HUD -------------------------------------------------------
  // (rendered as HTML overlay for clarity)
  const getHoverCoord = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const { w, h } = getCanvasSize();
      const s = storeRef.current;
      const { wx, wy } = screenToWorld(
        e.nativeEvent.offsetX,
        e.nativeEvent.offsetY,
        s.camera,
        w,
        h
      );
      return `${Math.round(wx)}, ${Math.round(wy)}`;
    },
    [screenToWorld]
  );

  const coordRef = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (coordRef.current) {
        coordRef.current.textContent = getHoverCoord(e);
      }
    },
    [getHoverCoord]
  );

  return (
    <div className="relative w-full h-full" style={{ background: '#0a0a14' }}>
      <div
        ref={containerRef}
        className="w-full h-full cursor-crosshair"
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
      {/* Zoom HUD */}
      <ZoomHUD />
    </div>
  );
}

function ZoomHUD() {
  const zoom = useEditorStore((s) => s.camera.zoom);
  return (
    <div
      className="absolute bottom-2 right-2 text-xs font-mono pointer-events-none"
      style={{ color: '#334466', userSelect: 'none' }}
    >
      {(zoom * 100).toFixed(0)}%
    </div>
  );
}
