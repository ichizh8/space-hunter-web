'use client';

import type { RunPath } from '../store/gameStore';
import { WEAPON_MUTATIONS } from '../data/weapons';

interface Props {
  weaponId: string;
  onSelect: (path: RunPath) => void;
}

export function ForkScreen({ weaponId, onSelect }: Props) {
  const mutations = WEAPON_MUTATIONS[weaponId];
  const cleanName = mutations?.clean?.name ?? 'Clean Variant';
  const voidName  = mutations?.void?.name  ?? 'Void Variant';

  return (
    <div
      className="h-full flex flex-col"
      style={{ background: 'var(--color-bg-dark)' }}
    >
      <div className="px-5 pt-5 text-center">
        <h1 className="text-2xl font-bold tracking-[3px] text-[var(--color-accent-gold)]">
          WEAPON MUTATION
        </h1>
        <p className="text-sm text-[var(--color-text-dim)] mt-1 tracking-widest">
          ROOM 1 CLEARED — CHOOSE YOUR PATH
        </p>
      </div>

      <div className="h-[1px] mx-4 mt-3 bg-[var(--color-border)]" />

      <div className="flex-1 flex gap-4 px-4 py-5">
        {/* CLEAN */}
        <div
          className="flex-1 flex flex-col rounded border-2 p-5"
          style={{
            borderColor: '#44aaff',
            background: 'rgba(68,170,255,0.06)',
          }}
        >
          <div className="text-center mb-4">
            <div className="text-xs tracking-[3px] font-bold mb-1" style={{ color: '#44aaff' }}>
              CLEAN PATH
            </div>
            <div className="text-lg font-bold" style={{ color: '#e0f4ff' }}>
              {cleanName}
            </div>
            <div className="text-xs mt-1" style={{ color: 'rgba(68,170,255,0.7)' }}>
              Precision. Control. Corruption drains between rooms.
            </div>
          </div>

          <div className="h-[1px] mb-4" style={{ background: 'rgba(68,170,255,0.3)' }} />

          <ul className="flex-1 space-y-2 text-sm" style={{ color: '#b0d8ff' }}>
            <li className="flex gap-2">
              <span style={{ color: '#44aaff' }}>--</span>
              Corruption decreases by 3 per room cleared
            </li>
            <li className="flex gap-2">
              <span style={{ color: '#44aaff' }}>--</span>
              Precision perks: range, accuracy, control effects
            </li>
            <li className="flex gap-2">
              <span style={{ color: '#44aaff' }}>--</span>
              Stable, predictable damage output
            </li>
          </ul>

          <button
            className="pixel-btn mt-5 py-4 text-base font-bold w-full"
            style={{
              borderColor: '#44aaff',
              background: 'rgba(68,170,255,0.15)',
              color: '#44aaff',
            }}
            onClick={() => onSelect('clean')}
          >
            SELECT CLEAN
          </button>
        </div>

        {/* VOID */}
        <div
          className="flex-1 flex flex-col rounded border-2 p-5"
          style={{
            borderColor: '#aa44ff',
            background: 'rgba(170,68,255,0.06)',
          }}
        >
          <div className="text-center mb-4">
            <div className="text-xs tracking-[3px] font-bold mb-1" style={{ color: '#aa44ff' }}>
              VOID PATH
            </div>
            <div className="text-lg font-bold" style={{ color: '#f0e0ff' }}>
              {voidName}
            </div>
            <div className="text-xs mt-1" style={{ color: 'rgba(170,68,255,0.7)' }}>
              Power. Corruption scaling. Risk and reward.
            </div>
          </div>

          <div className="h-[1px] mb-4" style={{ background: 'rgba(170,68,255,0.3)' }} />

          <ul className="flex-1 space-y-2 text-sm" style={{ color: '#d4b0ff' }}>
            <li className="flex gap-2">
              <span style={{ color: '#aa44ff' }}>--</span>
              Corruption increases by 5 per room cleared
            </li>
            <li className="flex gap-2">
              <span style={{ color: '#aa44ff' }}>--</span>
              Void perks: chaos, corruption, escalating power
            </li>
            <li className="flex gap-2">
              <span style={{ color: '#aa44ff' }}>--</span>
              High risk: damage scales with corruption level
            </li>
          </ul>

          <button
            className="pixel-btn mt-5 py-4 text-base font-bold w-full"
            style={{
              borderColor: '#aa44ff',
              background: 'rgba(170,68,255,0.15)',
              color: '#aa44ff',
            }}
            onClick={() => onSelect('void')}
          >
            SELECT VOID
          </button>
        </div>
      </div>
    </div>
  );
}
