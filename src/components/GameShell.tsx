'use client';

import { useGameStore } from '../store/gameStore';
import { useSaveStore } from '../store/saveStore';
import { useEffect, lazy, Suspense } from 'react';
import { HubRoomScreen } from './HubRoomScreen';
import { ContractBoard } from './ContractBoard';
import { LoadoutScreen } from './LoadoutScreen';
import { ResultsScreen } from './ResultsScreen';
import { IntroOverlay } from './IntroOverlay';

const GameCanvas = lazy(() => import('./GameCanvas').then(m => ({ default: m.GameCanvas })));

export function GameShell() {
  const screen = useGameStore(s => s.screen);
  const introSeen = useSaveStore(s => s.introSeen);
  const contractsCompleted = useSaveStore(s => s.contractsCompleted);
  const endowProgress = useSaveStore(s => s.endowProgress);

  useEffect(() => {
    endowProgress();
  }, [endowProgress]);

  const showIntro = !introSeen && contractsCompleted === 0 && screen === 'hub';

  return (
    <div className="h-screen w-full max-w-[540px] mx-auto relative overflow-hidden" style={{ fontFamily: 'var(--font-pixel)' }}>
      {screen === 'hub' && <HubRoomScreen />}
      {screen === 'contracts' && <ContractBoard />}
      {screen === 'loadout' && <LoadoutScreen />}
      {screen === 'hunt' && (
        <Suspense fallback={<div className="h-full flex items-center justify-center text-[var(--color-accent-cyan)]">Loading...</div>}>
          <GameCanvas />
        </Suspense>
      )}
      {screen === 'results' && <ResultsScreen />}
      {showIntro && <IntroOverlay />}
    </div>
  );
}
