'use client';

import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useSaveStore } from '../store/saveStore';
import { generateContractsForPlanet, type Contract } from '../data/contracts';
import { PLANETS, PLANET_ORDER, type PlanetId } from '../data/planets';
import { halSay, HAL_CONTRACT_TYPES } from '../data/hal';

function toHex(n: number) {
  return '#' + n.toString(16).padStart(6, '0');
}

function initBoard(
  planetClearance: Record<string, number>,
  getPlanetUnlocked: (id: string) => boolean,
): Record<PlanetId, Contract[]> {
  const board: Partial<Record<PlanetId, Contract[]>> = {};
  for (const id of PLANET_ORDER) {
    const clearance = planetClearance[id] ?? 0;
    board[id] = getPlanetUnlocked(id)
      ? generateContractsForPlanet(PLANETS[id], 2, clearance)
      : [];
  }
  return board as Record<PlanetId, Contract[]>;
}

export function ContractBoard() {
  const setScreen = useGameStore(s => s.setScreen);
  const setContract = useGameStore(s => s.setContract);
  const save = useSaveStore();

  const [activePlanet, setActivePlanet] = useState<PlanetId>('kepler');
  const [board, setBoard] = useState<Record<PlanetId, Contract[]>>(() =>
    initBoard(save.planetClearance, save.getPlanetUnlocked)
  );

  const unlocked = (id: PlanetId) => save.getPlanetUnlocked(id);
  const planet = PLANETS[activePlanet];
  const contracts = board[activePlanet] ?? [];
  const accentHex = toHex(planet.palette.accent);

  const accept = (c: Contract) => {
    setContract(c);
    setScreen('loadout');
  };

  const refresh = () => {
    const clearance = save.planetClearance[activePlanet] ?? 0;
    setBoard(prev => ({
      ...prev,
      [activePlanet]: generateContractsForPlanet(PLANETS[activePlanet], 2, clearance),
    }));
  };

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--color-bg-dark)' }}>
      {/* Header */}
      <div className="px-5 pt-5">
        <h1 className="text-2xl font-bold tracking-[3px] text-[var(--color-hal-glow)]">MISSION BOARD</h1>
        <p className="text-sm tracking-[1px] text-[var(--color-text-secondary)] mt-1 uppercase">
          {save.totalCredits} cr &middot; {save.contractsCompleted} missions completed
        </p>
        <div className="h-[1px] bg-[var(--color-hal-dim)] mt-3" style={{ opacity: 0.4 }} />
      </div>

      {/* Planet tabs */}
      <div className="flex gap-2 px-4 pt-3 pb-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {PLANET_ORDER.map(id => {
          const p = PLANETS[id];
          const isActive = id === activePlanet;
          const isUnlocked = unlocked(id);
          return (
            <button
              key={id}
              onClick={() => setActivePlanet(id)}
              className="pixel-btn flex-shrink-0 text-xs px-3 py-1.5 uppercase tracking-widest"
              style={{
                borderColor: isUnlocked ? toHex(p.palette.accent) : 'var(--color-border)',
                color: isActive
                  ? toHex(p.palette.accent)
                  : isUnlocked
                    ? 'var(--color-text-secondary)'
                    : 'var(--color-text-muted)',
                background: isActive ? `${toHex(p.palette.accent)}1a` : 'transparent',
                opacity: isUnlocked ? 1 : 0.45,
              }}
            >
              {p.name}
              {!isUnlocked && <span className="ml-1 opacity-60">&#x1F512;</span>}
            </button>
          );
        })}
      </div>

      {/* HAL quip */}
      {contracts[0] && unlocked(activePlanet) && (
        <div className="px-5 pt-2 pb-1">
          <div className="pixel-card" style={{ borderColor: 'var(--color-hal-dim)' }}>
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-[var(--color-hal-red)] mt-1 hal-pulse flex-shrink-0" />
              <p className="text-sm text-[var(--color-text-primary)] leading-6">
                {halSay(HAL_CONTRACT_TYPES[contracts[0].type] || ['I have contracts available.'])}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Contract list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {unlocked(activePlanet) ? (
          contracts.map((c, i) => {
            const typeColor = toHex(c.iconColor);
            return (
              <button
                key={i}
                className="pixel-card w-full text-left relative"
                style={{ borderLeftWidth: 4, borderLeftColor: typeColor }}
                onClick={() => accept(c)}
              >
                {/* Planet + type tag row */}
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span
                    className="text-[10px] uppercase tracking-widest px-1.5 py-0.5"
                    style={{
                      color: accentHex,
                      border: `1px solid ${accentHex}55`,
                      background: `${accentHex}15`,
                    }}
                  >
                    {planet.name}
                  </span>
                  <span className="text-xs uppercase tracking-[2px]" style={{ color: typeColor }}>
                    {c.label}
                  </span>
                </div>

                <p className="text-lg font-bold pr-20">{c.name}</p>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1 pr-20">{c.desc}</p>

                {/* Difficulty pips + room count */}
                <div className="flex items-center gap-2 mt-2">
                  {Array.from({ length: 6 }).map((_, di) => (
                    <div
                      key={di}
                      className="w-2.5 h-2.5"
                      style={{
                        background: di < c.difficulty
                          ? 'var(--color-accent-orange)'
                          : 'var(--color-bg-light)',
                      }}
                    />
                  ))}
                  <span className="text-xs text-[var(--color-text-secondary)] ml-1">
                    {c.roomCount} rooms
                  </span>
                </div>

                {/* Reward + drops */}
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  <span className="text-base text-[var(--color-accent-gold)] font-bold">
                    {c.reward} cr
                  </span>
                  {c.specialReward && (
                    <span className="text-xs text-[var(--color-accent-cyan)]">
                      {c.specialReward}
                    </span>
                  )}
                </div>

                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[var(--color-accent-green)] font-bold">
                  ACCEPT →
                </span>
              </button>
            );
          })
        ) : (
          <div className="pixel-card opacity-40 py-8 text-center">
            <p className="text-lg uppercase tracking-widest text-[var(--color-text-secondary)] mb-3">
              LOCKED
            </p>
            {planet.unlockCondition && (() => {
              const cond = planet.unlockCondition!;
              const src = PLANETS[cond.planet];
              const current = save.planetClearance[cond.planet] ?? 0;
              return (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Complete {cond.clears} {src.name} contracts ({current}/{cond.clears})
                </p>
              );
            })()}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 flex gap-3">
        <button
          className="pixel-btn flex-1 text-sm"
          style={{ borderColor: 'var(--color-accent-cyan)', color: 'var(--color-accent-cyan)' }}
          onClick={refresh}
          disabled={!unlocked(activePlanet)}
        >
          REFRESH
        </button>
        <button className="pixel-btn pixel-btn-ghost flex-1 text-sm" onClick={() => setScreen('hub')}>
          RETURN
        </button>
      </div>
    </div>
  );
}
