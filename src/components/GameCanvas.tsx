'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useSaveStore } from '../store/saveStore';
import { ModifierPicker, UpgradePicker, KitT3Choice } from './ModifierPicker';
import { ForkScreen } from './ForkScreen';
import type { ModifierDef } from '../data/modifiers';
import type { UpgradeCard } from '../data/upgrades';
import type { RunPath } from '../store/gameStore';
import { INGREDIENTS_BY_PLANET, INGREDIENTS } from '../data/ingredients';

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<import('../game/Game').Game | null>(null);
  const setScreen = useGameStore(s => s.setScreen);
  const setHuntResult = useGameStore(s => s.setHuntResult);
  const setRunPath = useGameStore(s => s.setRunPath);
  const applyMutation = useGameStore(s => s.applyMutation);
  const contract = useGameStore(s => s.currentContract);
  const weapon = useGameStore(s => s.startingWeapon);
  const kits = useSaveStore(s => s.equippedKits);
  const shipUpgrades = useSaveStore(s => s.shipUpgrades);

  // Legacy modifier picker state (kept for compat)
  const [modChoices, setModChoices] = useState<ModifierDef[] | null>(null);
  const modResolveRef = useRef<((m: ModifierDef) => void) | null>(null);

  // Weapon perk picker state (legacy)
  const [weaponPerks, setWeaponPerks] = useState<{ perks: string[]; weaponName: string } | null>(null);
  const weaponPerkResolveRef = useRef<((p: string) => void) | null>(null);

  // New upgrade picker state
  const [upgradeChoices, setUpgradeChoices] = useState<UpgradeCard[] | null>(null);
  const upgradeResolveRef = useRef<((card: UpgradeCard) => void) | null>(null);

  // Kit T3 path choice state
  const [kitT3, setKitT3] = useState<{ kitId: string; kitName: string } | null>(null);
  const kitT3ResolveRef = useRef<((path: 'clean' | 'void') => void) | null>(null);

  // Fork choice state (clean/void path selection after room 1)
  const [forkChoice, setForkChoice] = useState<{ weaponId: string } | null>(null);
  const forkChoiceResolveRef = useRef<((path: RunPath) => void) | null>(null);

  const finishHunt = useCallback((status: 'COMPLETED' | 'FAILED' | 'ABANDONED', result: Parameters<typeof setHuntResult>[0] extends infer R ? Omit<R, 'contractName' | 'huntStatus' | 'parTime'> : never) => {
    setHuntResult({
      contractName: contract?.name ?? 'Hunt',
      huntStatus: status,
      parTime: contract?.parTime ?? 300,
      ...result,
    });
    setScreen('results');
  }, [contract, setHuntResult, setScreen]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;

    (async () => {
      try {
      const PIXI = await import('pixi.js');
      const { Application } = PIXI;
      const { Game } = await import('../game/Game');

      // Global pixel-art settings — NEAREST neighbor, no smoothing
      PIXI.TextureSource.defaultOptions.scaleMode = 'nearest';
      PIXI.AbstractRenderer.defaultOptions.roundPixels = true;

      if (destroyed) return;

      const app = new Application();
      await app.init({
        width: container.clientWidth,
        height: container.clientHeight,
        backgroundColor: 0x0a0a14,
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

      const game = new Game(
        app,
        kits,
        contract?.type ?? 'hunt',
        contract?.targetTotal ?? 10,
        shipUpgrades,
        {
          onDeath: () => {},
          onComplete: () => {},
          onHuntResult: (r) => {
            const status = gameRef.current?.dead ? 'FAILED' : gameRef.current?.complete ? 'COMPLETED' : 'ABANDONED';
            const planetDrops: Array<{ id: string; name: string }> = [];
            if (status === 'COMPLETED') {
              const planet = contract?.planet ?? 'kepler';
              const table = INGREDIENTS_BY_PLANET[planet];
              if (table) {
                const count = 1 + Math.floor(Math.random() * 3);
                for (let i = 0; i < count; i++) {
                  const pool = Math.random() < 0.2 ? [...table.common, ...table.rare] : table.common;
                  const id = pool[Math.floor(Math.random() * pool.length)];
                  const ing = INGREDIENTS[id];
                  if (ing) {
                    planetDrops.push({ id, name: ing.name });
                    useSaveStore.getState().addIngredient(id, 1);
                  }
                }
              }
            }
            finishHunt(status, { ...r, ingredients: [...r.ingredients, ...planetDrops] });
          },
          onWeaponPerkPick: (perks, weaponName, resolve) => {
            setWeaponPerks({ perks, weaponName });
            weaponPerkResolveRef.current = resolve;
          },
          onModifierPick: (choices, resolve) => {
            setModChoices(choices);
            modResolveRef.current = resolve;
          },
          onUpgradePick: (choices, resolve) => {
            setUpgradeChoices(choices);
            upgradeResolveRef.current = resolve;
          },
          onKitT3Choice: (kitId, kitName, resolve) => {
            setKitT3({ kitId, kitName });
            kitT3ResolveRef.current = resolve;
          },
          onForkChoice: (weaponId, resolve) => {
            setForkChoice({ weaponId });
            forkChoiceResolveRef.current = resolve;
          },
          onMutationApplied: (path) => {
            applyMutation(path);
          },
        },
        {
          holdTime: contract?.holdTime,
          podHp: contract?.podHp,
          cacheCount: contract?.cacheCount,
          reward: contract?.reward ?? 0,
          parTime: contract?.parTime ?? 300,
          difficulty: contract?.difficulty ?? 1,
          planet: contract?.planet ?? 'kepler',
        }
      );

      game.player.weaponId = weapon;
      // Sync mag size with selected weapon (no mag upgrade in new system)
      const wDef = (await import('../data/weapons')).WEAPON_DEFS[weapon];
      if (wDef) {
        game.player.magSize = wDef.magSize;
        game.player.magAmmo = game.player.magSize;
      }

      gameRef.current = game;

      // Game loop
      app.ticker.add((ticker) => {
        if (!destroyed) game.update(ticker.deltaMS / 1000);
      });
      } catch (err) {
        console.error('[GameCanvas] Runtime error:', err);
      }
    })();

    return () => {
      destroyed = true;
      if (gameRef.current) {
        gameRef.current.destroy();
        gameRef.current = null;
      }
      // Remove canvas
      while (container.firstChild) container.removeChild(container.firstChild);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abandon = () => {
    if (gameRef.current) {
      gameRef.current.finishHunt('ABANDONED');
    } else {
      finishHunt('ABANDONED', {
        credits: 0, corruption: 0, timeSurvived: 0, totalKills: 0,
        eliteKills: 0, apexKills: 0, peakCorruption: 0,
        damageDealt: 0, damageTaken: 0, ingredients: [],
      });
    }
  };

  const handlePerkPick = (perk: string) => {
    setWeaponPerks(null);
    weaponPerkResolveRef.current?.(perk);
    weaponPerkResolveRef.current = null;
  };

  const handleModPick = (mod: ModifierDef) => {
    setModChoices(null);
    modResolveRef.current?.(mod);
    modResolveRef.current = null;
  };

  const handleUpgradePick = (card: UpgradeCard) => {
    setUpgradeChoices(null);
    upgradeResolveRef.current?.(card);
    upgradeResolveRef.current = null;
  };

  const handleKitT3Pick = (path: 'clean' | 'void') => {
    setKitT3(null);
    kitT3ResolveRef.current?.(path);
    kitT3ResolveRef.current = null;
  };

  const handleForkPick = (path: RunPath) => {
    setForkChoice(null);
    setRunPath(path);
    forkChoiceResolveRef.current?.(path);
    forkChoiceResolveRef.current = null;
  };

  return (
    <div className="h-full w-full relative">
      <div ref={containerRef} className="h-full w-full" />
      {/* Weapon perk picker overlay (legacy) */}
      {weaponPerks && (
        <div className="absolute inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(5,5,8,0.85)', backdropFilter: 'blur(4px)' }}>
          <div className="flex flex-col items-center gap-4 p-6 max-w-md w-full">
            <h2 className="text-sm tracking-[4px] text-[#ff8800] uppercase font-bold">{weaponPerks.weaponName} Upgrade</h2>
            <div className="flex flex-col gap-3 w-full">
              {weaponPerks.perks.map(perk => (
                <button key={perk} onClick={() => handlePerkPick(perk)}
                  className="w-full text-left p-3 border transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ borderColor: '#ff8800', background: 'rgba(40,20,0,0.9)', color: '#ffcc88' }}>
                  <div className="font-bold text-sm tracking-wide">{perk.replace(/_/g, ' ').toUpperCase()}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Fork choice overlay (shown after room 1 clear) */}
      {forkChoice && (
        <div className="absolute inset-0 z-50">
          <ForkScreen weaponId={forkChoice.weaponId} onSelect={handleForkPick} />
        </div>
      )}
      {/* New upgrade picker overlay */}
      {upgradeChoices && <UpgradePicker choices={upgradeChoices} onPick={handleUpgradePick} />}
      {/* Kit T3 path choice overlay */}
      {kitT3 && <KitT3Choice kitName={kitT3.kitName} onPick={handleKitT3Pick} />}
      {/* Legacy modifier picker overlay */}
      {modChoices && <ModifierPicker choices={modChoices} onPick={handleModPick} />}
      {/* Abandon overlay button */}
      <button
        className="absolute bottom-2 left-2 pixel-btn text-[10px] py-1 px-2 opacity-60 hover:opacity-100"
        style={{ borderColor: 'var(--color-accent-red)', color: 'var(--color-accent-red)', zIndex: 10 }}
        onClick={abandon}
      >
        ABANDON
      </button>
    </div>
  );
}
