import { create } from 'zustand';
import type { Contract } from '../data/contracts';

export type GameScreen = 'hub' | 'contracts' | 'loadout' | 'hunt' | 'results';

export interface HuntResult {
  contractName: string;
  huntStatus: 'COMPLETED' | 'FAILED' | 'ABANDONED';
  credits: number;
  corruption: number;
  timeSurvived: number;
  totalKills: number;
  eliteKills: number;
  apexKills: number;
  peakCorruption: number;
  damageDealt: number;
  damageTaken: number;
  ingredients: Array<{ id: string; name: string }>;
  parTime: number;
}

export interface GameState {
  screen: GameScreen;
  currentContract: Contract | null;
  startingWeapon: string;
  huntResult: HuntResult | null;
  hubPlayerPos: { x: number; y: number } | null;
}

export interface GameActions {
  setScreen: (screen: GameScreen) => void;
  setContract: (contract: Contract) => void;
  setWeapon: (weapon: string) => void;
  setHuntResult: (result: HuntResult) => void;
  startHunt: () => void;
  setHubPlayerPos: (pos: { x: number; y: number } | null) => void;
}

export const useGameStore = create<GameState & GameActions>((set) => ({
  screen: 'hub',
  currentContract: null,
  startingWeapon: 'sidearm',
  huntResult: null,
  hubPlayerPos: null,

  setScreen: (screen) => set({ screen }),
  setContract: (contract) => set({ currentContract: contract }),
  setWeapon: (weapon) => set({ startingWeapon: weapon }),
  setHuntResult: (result) => set({ huntResult: result }),
  startHunt: () => set({ screen: 'hunt' }),
  setHubPlayerPos: (pos) => set({ hubPlayerPos: pos }),
}));
