'use client';

import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { useSaveStore } from '../store/saveStore';

const CORR_NAMES = ['CLEAN', 'VALLEY', 'CORRUPT', 'VOID'];
const CORR_COLORS = ['#44ff66', '#e6cc33', '#e64d33', '#ff1919'];

export function ResultsScreen() {
  const result = useGameStore(s => s.huntResult);
  const setScreen = useGameStore(s => s.setScreen);
  const save = useSaveStore();

  useEffect(() => {
    if (result) {
      save.completeContract(result.credits, result.corruption);
      if (result.ingredients.length > 0) save.addIngredients(result.ingredients);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!result) return <div className="h-full flex items-center justify-center">No results</div>;

  const peakC = result.peakCorruption;
  const peakIdx = peakC >= 70 ? 3 : peakC >= 36 ? 2 : peakC >= 16 ? 1 : 0;
  const statusColor = result.huntStatus === 'COMPLETED' ? 'var(--color-accent-green)' : result.huntStatus === 'FAILED' ? 'var(--color-accent-red)' : 'var(--color-text-secondary)';

  const baseScore = result.totalKills * 10;
  const eliteBonus = result.eliteKills * 150;
  const apexBonus = result.apexKills * 500;
  const contractBonus = result.huntStatus === 'COMPLETED' ? 500 : 0;
  const overParTime = result.parTime > 0 && result.timeSurvived > result.parTime;
  const timeBonus = result.timeSurvived > 0 && !overParTime ? Math.floor(baseScore * 0.2) : 0;
  let corrBonus = 0;
  let corrDesc = '';
  if (peakC < 16) { corrBonus = Math.floor(baseScore * 0.3); corrDesc = 'Never left CLEAN (+30%)'; }
  else if (peakC >= 70 && result.huntStatus === 'COMPLETED') { corrBonus = Math.floor(baseScore * 0.25); corrDesc = 'VOID survivor (+25%)'; }
  let total = baseScore + eliteBonus + apexBonus + contractBonus + timeBonus + corrBonus;
  if (result.huntStatus === 'ABANDONED') total = Math.floor(total * 0.5);

  const mins = Math.floor(result.timeSurvived / 60);
  const secs = Math.floor(result.timeSurvived % 60);

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--color-bg-dark)' }}>
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        <p className="text-sm text-[var(--color-text-secondary)] uppercase tracking-[2px]">{result.contractName}</p>
        <p className="text-3xl font-bold" style={{ color: statusColor }}>{result.huntStatus}</p>

        <div className="h-[2px] bg-[var(--color-border)]" />

        <h3 className="text-base font-bold text-[var(--color-accent-cyan)] tracking-[2px]">STATS</h3>
        <StatRow label="Time survived" value={`${mins}:${secs.toString().padStart(2, '0')}`} />
        <StatRow label="Enemies killed" value={String(result.totalKills)} />
        <StatRow label="Elite kills" value={String(result.eliteKills)} />
        <StatRow label="Apex kills" value={String(result.apexKills)} />
        <StatRow label="Peak corruption" value={`${CORR_NAMES[peakIdx]} (${Math.floor(peakC)})`} valueColor={CORR_COLORS[peakIdx]} />
        <StatRow label="Damage dealt" value={String(result.damageDealt)} />
        <StatRow label="Damage taken" value={String(result.damageTaken)} />

        <div className="h-[2px] bg-[var(--color-border)]" />

        <h3 className="text-base font-bold text-[var(--color-accent-gold)] tracking-[2px]">SCORE</h3>
        <ScoreRow label="Base (kills x10)" value={baseScore} />
        <ScoreRow label="Elite bonus (x150)" value={eliteBonus} />
        <ScoreRow label="Apex bonus (x500)" value={apexBonus} />
        <ScoreRow label="Contract bonus" value={contractBonus} />
        <ScoreRow label={overParTime ? 'Over par time (reward halved)' : 'Time bonus (+20%)'} value={timeBonus} />
        {overParTime && <p className="text-xs text-[var(--color-accent-red)]">Par time exceeded — contract reward halved</p>}
        <ScoreRow label={corrDesc || 'Corruption bonus'} value={corrBonus} />

        <div className="flex justify-between text-lg font-bold text-[var(--color-accent-gold)] pt-2">
          <span>TOTAL</span><span>{total}</span>
        </div>

        <div className="h-[2px] bg-[var(--color-border)]" />

        {result.ingredients.length > 0 && (
          <>
            <h3 className="text-base font-bold text-[var(--color-accent-orange)] tracking-[2px]">LOOT</h3>
            {Object.entries(result.ingredients.reduce((a, i) => ({ ...a, [i.name]: (a[i.name] ?? 0) + 1 }), {} as Record<string, number>)).map(([name, count]) => (
              <StatRow key={name} label={name} value={`x${count}`} />
            ))}
          </>
        )}

        <p className="text-base font-bold text-[var(--color-accent-gold)]">Credits earned: {result.credits}</p>
      </div>

      <div className="px-4 pb-4 flex gap-3">
        <button className="pixel-btn flex-1 text-sm" style={{ borderColor: 'var(--color-accent-green)', color: 'var(--color-accent-green)' }}
          onClick={() => setScreen('hub')}>
          Cook & Upgrade
        </button>
        <button className="pixel-btn flex-1 text-sm" style={{ borderColor: 'var(--color-accent-cyan)', color: 'var(--color-accent-cyan)' }}
          onClick={() => setScreen('contracts')}>
          New Contract
        </button>
      </div>
    </div>
  );
}

function StatRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-[var(--color-text-secondary)]">{label}</span>
      <span style={{ color: valueColor ?? 'var(--color-text-primary)' }}>{value}</span>
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span style={{ color: value > 0 ? 'var(--color-accent-gold)' : 'var(--color-text-muted)' }}>{value > 0 ? `+${value}` : '0'}</span>
    </div>
  );
}
