'use client';

import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useSaveStore } from '../store/saveStore';
import { generateContracts, type Contract } from '../data/contracts';
import { halSay, HAL_CONTRACT_TYPES } from '../data/hal';

export function ContractBoard() {
  const setScreen = useGameStore(s => s.setScreen);
  const setContract = useGameStore(s => s.setContract);
  const save = useSaveStore();

  const [contracts, setContracts] = useState<Contract[]>(() => generateContracts(3, save.reputation));

  const refresh = () => setContracts(generateContracts(3, save.reputation));

  const accept = (c: Contract) => {
    setContract(c);
    setScreen('loadout');
  };

  const active = contracts.filter(c => !c.locked);
  const locked = contracts.filter(c => c.locked);

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--color-bg-dark)' }}>
      <div className="px-5 pt-5">
        <h1 className="text-2xl font-bold tracking-[3px] text-[var(--color-hal-glow)]">MISSION BOARD</h1>
        <p className="text-sm tracking-[1px] text-[var(--color-text-secondary)] mt-1 uppercase">
          {save.totalCredits} cr &middot; {save.contractsCompleted} missions completed
        </p>
        <div className="h-[1px] bg-[var(--color-hal-dim)] mt-3" style={{ opacity: 0.4 }} />

        {active[0] && (
          <div className="mt-3 pixel-card" style={{ borderColor: 'var(--color-hal-dim)' }}>
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-[var(--color-hal-red)] mt-1 hal-pulse flex-shrink-0" />
              <p className="text-sm text-[var(--color-text-primary)] leading-6">
                {halSay(HAL_CONTRACT_TYPES[active[0].type] || ['I have contracts available.'])}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {active.map((c, i) => (
          <button key={i} className="pixel-card w-full text-left relative"
            style={{ borderLeftWidth: 4, borderLeftColor: '#' + c.iconColor.toString(16).padStart(6, '0') }}
            onClick={() => accept(c)}>
            <p className="text-xs uppercase tracking-[2px]" style={{ color: '#' + c.iconColor.toString(16).padStart(6, '0') }}>{c.label}</p>
            <p className="text-lg font-bold mt-1">{c.name}</p>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">{c.desc}</p>
            <div className="flex gap-2 mt-3">
              {Array.from({ length: 5 }).map((_, di) => (
                <div key={di} className="w-3 h-3" style={{ background: di < c.difficulty ? 'var(--color-accent-orange)' : 'var(--color-bg-light)' }} />
              ))}
            </div>
            <p className="text-base text-[var(--color-accent-gold)] font-bold mt-2">{c.reward} cr</p>
            {c.specialReward && <p className="text-xs text-[var(--color-accent-cyan)] mt-1">{c.specialReward}</p>}
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[var(--color-accent-green)] font-bold">ACCEPT →</span>
          </button>
        ))}

        {locked.length > 0 && (
          <>
            <p className="text-xs uppercase tracking-[2px] text-[var(--color-text-muted)] pt-2 opacity-60">Locked Contracts</p>
            {locked.map((c, i) => (
              <div key={`locked-${i}`} className="pixel-card w-full text-left opacity-35 cursor-not-allowed"
                style={{ borderLeftWidth: 4, borderLeftColor: '#' + c.iconColor.toString(16).padStart(6, '0') }}>
                <p className="text-xs uppercase tracking-[2px]" style={{ color: '#' + c.iconColor.toString(16).padStart(6, '0') }}>{c.label}</p>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">{c.desc}</p>
                <p className="text-xs mt-2" style={{ color: 'var(--color-accent-red)' }}>Requires Rep {c.requiredRep}</p>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="px-4 pb-4 flex gap-3">
        <button className="pixel-btn flex-1 text-sm" style={{ borderColor: 'var(--color-accent-cyan)', color: 'var(--color-accent-cyan)' }}
          onClick={refresh}>
          REFRESH
        </button>
        <button className="pixel-btn pixel-btn-ghost flex-1 text-sm" onClick={() => setScreen('hub')}>
          RETURN
        </button>
      </div>
    </div>
  );
}
