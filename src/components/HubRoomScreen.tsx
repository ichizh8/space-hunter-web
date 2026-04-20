'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useSaveStore } from '../store/saveStore';
import { HalMessage, UpgradesTab, KitsTab, HubScreen } from './HubScreen';
import { KitchenScreen } from './KitchenScreen';
import {
  halSay,
  HAL_FIRST_VISIT,
  HAL_POST_HUNT_SUCCESS,
  HAL_POST_HUNT_FAIL,
  HAL_IDLE,
  HAL_PRE_CONTRACT,
} from '../data/hal';
import hubRoomJson from '../data/rooms/hub/base_station.json';
import { registerAction } from '../game/rooms/ActionRegistry';
import {
  createRoomRuntime,
  type RoomRuntimeHandle,
} from '../game/rooms/RoomRuntime';
import type { RoomJSON } from '../editor/editorStore';

type ModalKind = 'workbench' | 'kits' | 'hal' | 'kitchen' | 'launch_blocked' | 'fullmenu' | null;

const HUB_JSON = hubRoomJson as unknown as RoomJSON;

export function HubRoomScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const huntResult = useGameStore((s) => s.huntResult);
  const save = useSaveStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<RoomRuntimeHandle | null>(null);

  // Read persisted hub pos once on mount so the player resumes where they left off.
  // We intentionally don't subscribe so React doesn't re-render when we write back.
  const initialPlayerPos = useGameStore.getState().hubPlayerPos;

  const [prompt, setPrompt] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);

  // Register action handlers for hub interactables.
  // ActionRegistry is module-scoped, so re-registration overwrites cleanly
  // each mount. No unregister needed — these only fire on hub interactable press.
  useEffect(() => {
    registerAction('open_contract_board', () => setScreen('contracts'));
    registerAction('open_workbench', () => setModal('workbench'));
    registerAction('open_kit_locker', () => setModal('kits'));
    registerAction('open_hal_console', () => setModal('hal'));
    registerAction('open_kitchen', () => setModal('kitchen'));
    registerAction('open_launch', () => {
      const contract = useGameStore.getState().currentContract;
      if (contract) {
        setScreen('loadout');
      } else {
        setModal('launch_blocked');
      }
    });
  }, [setScreen]);

  // Boot the room runtime once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    (async () => {
      try {
        const handle = await createRoomRuntime(container, HUB_JSON, {
          zoom: 0.6,
          initialPlayerPos: initialPlayerPos ?? undefined,
          onPromptChange: setPrompt,
        });
        if (cancelled) {
          handle.destroy();
          return;
        }
        runtimeRef.current = handle;
      } catch (e) {
        console.error('[hub] runtime init failed', e);
      }
    })();

    return () => {
      cancelled = true;
      // Persist current player pos so the next mount resumes in place.
      const r = runtimeRef.current;
      if (r) {
        const p = r.getPlayerPos();
        useGameStore.getState().setHubPlayerPos({ x: p.x, y: p.y });
      }
      r?.destroy();
      runtimeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pause the runtime while a modal is up, resume on close.
  useEffect(() => {
    runtimeRef.current?.setPaused(modal !== null);
  }, [modal]);

  // ESC closes any modal
  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModal(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  const halMsg = useMemo(() => {
    if (save.contractsCompleted === 0 && !huntResult) return halSay(HAL_FIRST_VISIT);
    if (huntResult) {
      return huntResult.huntStatus === 'COMPLETED'
        ? halSay(HAL_POST_HUNT_SUCCESS)
        : halSay(HAL_POST_HUNT_FAIL);
    }
    return Math.random() < 0.6 ? halSay(HAL_PRE_CONTRACT) : halSay(HAL_IDLE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save.contractsCompleted, !!huntResult, modal === 'hal']);

  return (
    <div
      className="h-full flex flex-col"
      style={{ background: 'var(--color-bg-dark)', fontFamily: 'var(--font-pixel)' }}
    >
      {/* HUD top */}
      <div
        className="flex items-center justify-between px-3 py-2 text-xs shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-[var(--color-hal-glow)] font-bold tracking-[2px]">BASE</span>
          <span className="text-[var(--color-text-secondary)]">{save.totalCredits}cr</span>
          <span className="text-[var(--color-text-secondary)]">
            {save.contractsCompleted} m
          </span>
        </div>
        <button
          className="pixel-btn text-xs py-1 px-3"
          onClick={() => setModal('fullmenu')}
          title="Full station menu"
        >
          MENU
        </button>
      </div>

      {/* Canvas fills rest */}
      <div className="flex-1 min-h-0 relative">
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

        {/* Interaction prompt — tappable on mobile */}
        {prompt && !modal && (
          <button
            className="absolute left-1/2 bottom-6 -translate-x-1/2 px-4 py-2 text-sm tracking-[1px] active:brightness-125"
            style={{
              border: '1px solid #ffcc00',
              color: '#ffcc00',
              background: 'rgba(13,13,26,0.85)',
              cursor: 'pointer',
              fontFamily: 'var(--font-pixel)',
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              runtimeRef.current?.triggerInteraction();
            }}
          >
            {prompt}
          </button>
        )}

        {/* Movement hint */}
        <div
          className="absolute top-2 right-2 text-[10px] pointer-events-none"
          style={{ color: 'var(--color-text-muted)' }}
        >
          TOUCH / WASD
        </div>
      </div>

      {/* Modals */}
      {modal === 'workbench' && (
        <Modal title="WORKBENCH" onClose={() => setModal(null)}>
          <UpgradesTab save={save} />
        </Modal>
      )}
      {modal === 'kits' && (
        <Modal title="KIT LOCKER" onClose={() => setModal(null)}>
          <KitsTab save={save} />
        </Modal>
      )}
      {modal === 'hal' && (
        <Modal title="HAL 9000" onClose={() => setModal(null)}>
          <HalMessage message={halMsg} />
          {huntResult && (
            <div
              className="pixel-card mt-3"
              style={{ borderColor: 'var(--color-hal-dim)' }}
            >
              <p className="text-xs tracking-[1px] text-[var(--color-hal-dim)] mb-2 uppercase">
                Mission Report
              </p>
              <p className="text-sm text-[var(--color-text-primary)] text-center">
                +{huntResult.credits}cr · {huntResult.totalKills} kills
                {huntResult.ingredients.length > 0
                  ? ` · +${huntResult.ingredients.length} ingredients`
                  : ''}
              </p>
            </div>
          )}
        </Modal>
      )}
      {modal === 'kitchen' && (
        <Modal title="KITCHEN" onClose={() => setModal(null)}>
          <KitchenScreen />
        </Modal>
      )}
      {modal === 'launch_blocked' && (
        <Modal title="DEPLOY" onClose={() => setModal(null)}>
          <p className="text-sm text-[var(--color-text-secondary)] text-center tracking-[1px]">
            Select a contract first
          </p>
        </Modal>
      )}
      {modal === 'fullmenu' && (
        <div
          className="absolute inset-0 z-50 flex flex-col"
          style={{ background: 'var(--color-bg-dark)' }}
        >
          <div
            className="flex items-center justify-between px-3 py-2 shrink-0"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <span className="text-xs tracking-[2px] text-[var(--color-text-secondary)]">
              STATION
            </span>
            <button
              onClick={() => setModal(null)}
              className="pixel-btn text-xs py-1 px-3"
              title="ESC"
            >
              CLOSE
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <HubScreen />
          </div>
        </div>
      )}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(5,5,8,0.96)', fontFamily: 'var(--font-pixel)' }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <span className="text-sm font-bold tracking-[2px] text-[var(--color-hal-glow)]">
          {title}
        </span>
        <button
          onClick={onClose}
          className="pixel-btn text-xs py-1 px-3"
          title="ESC"
        >
          CLOSE
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">{children}</div>
    </div>
  );
}
