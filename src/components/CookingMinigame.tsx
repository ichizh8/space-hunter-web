'use client';

import { useEffect, useRef, useState } from 'react';
import type { KitchenRecipe } from '../data/recipes';

interface Props {
  recipe: KitchenRecipe;
  onComplete: (success: boolean, perfect: boolean) => void;
  onCancel: () => void;
}

const ROUNDS = 3;
const ZONE_WIDTH = 0.22;
const PERFECT_WIDTH = 0.09;
const SPEED = 0.6; // bar-widths per second

type HitResult = 'perfect' | 'hit' | 'miss';
type Phase = 'countdown' | 'playing' | 'feedback';

export function CookingMinigame({ recipe, onComplete, onCancel }: Props) {
  const [phase, setPhase] = useState<Phase>('countdown');
  const [roundIndex, setRoundIndex] = useState(0);
  const [hits, setHits] = useState<HitResult[]>([]);
  const [feedbackText, setFeedbackText] = useState('');
  const [zoneStart, setZoneStart] = useState(0.3);
  const [indicatorPos, setIndicatorPos] = useState(0);

  const posRef = useRef(0);
  const dirRef = useRef(1);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const phaseRef = useRef<Phase>('countdown');
  const zoneStartRef = useRef(0.3);
  const roundIndexRef = useRef(0);
  const hitsRef = useRef<HitResult[]>([]);

  phaseRef.current = phase;
  zoneStartRef.current = zoneStart;
  roundIndexRef.current = roundIndex;
  hitsRef.current = hits;

  function beginRound() {
    const start = 0.08 + Math.random() * 0.58;
    setZoneStart(start);
    zoneStartRef.current = start;
    posRef.current = 0;
    dirRef.current = 1;
    lastTsRef.current = 0;
    setIndicatorPos(0);
    setPhase('playing');
    phaseRef.current = 'playing';
  }

  useEffect(() => {
    const t = setTimeout(beginRound, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'playing') {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    function tick(ts: number) {
      if (lastTsRef.current === 0) lastTsRef.current = ts;
      const dt = Math.min((ts - lastTsRef.current) / 1000, 0.05);
      lastTsRef.current = ts;

      let pos = posRef.current + dirRef.current * SPEED * dt;
      if (pos >= 1) { pos = 1; dirRef.current = -1; }
      if (pos <= 0) { pos = 0; dirRef.current = 1; }
      posRef.current = pos;
      setIndicatorPos(pos);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase]);

  function handleTap() {
    if (phaseRef.current !== 'playing') return;
    cancelAnimationFrame(rafRef.current);

    const pos = posRef.current;
    const zStart = zoneStartRef.current;
    const zEnd = zStart + ZONE_WIDTH;
    const pStart = zStart + (ZONE_WIDTH - PERFECT_WIDTH) / 2;
    const pEnd = pStart + PERFECT_WIDTH;

    let result: HitResult = 'miss';
    if (pos >= zStart && pos <= zEnd) {
      result = pos >= pStart && pos <= pEnd ? 'perfect' : 'hit';
    }

    const newHits = [...hitsRef.current, result];
    setHits(newHits);
    hitsRef.current = newHits;

    setFeedbackText(result === 'perfect' ? 'PERFECT!' : result === 'hit' ? 'HIT!' : 'MISS');
    setPhase('feedback');
    phaseRef.current = 'feedback';

    setTimeout(() => {
      const nextRound = roundIndexRef.current + 1;
      if (nextRound >= ROUNDS) {
        const hitCount = newHits.filter(h => h !== 'miss').length;
        onComplete(hitCount > 0, newHits.every(h => h === 'perfect'));
      } else {
        setRoundIndex(nextRound);
        roundIndexRef.current = nextRound;
        beginRound();
      }
    }, 700);
  }

  const pStart = zoneStart + (ZONE_WIDTH - PERFECT_WIDTH) / 2;
  const lastHit = hits[hits.length - 1];

  const indicatorColor =
    phase === 'feedback'
      ? lastHit === 'miss'
        ? 'var(--color-accent-red)'
        : lastHit === 'perfect'
          ? 'var(--color-accent-gold)'
          : 'var(--color-accent-green)'
      : 'var(--color-hal-glow)';

  const feedbackColor =
    phase === 'feedback'
      ? lastHit === 'miss'
        ? 'var(--color-accent-red)'
        : lastHit === 'perfect'
          ? 'var(--color-accent-gold)'
          : 'var(--color-accent-green)'
      : 'var(--color-text-muted)';

  return (
    <div style={{ fontFamily: 'var(--font-pixel)' }}>
      <div className="text-center mb-4">
        <div
          className="text-xs tracking-[2px] mb-1"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          PROCESSING
        </div>
        <div className="text-sm tracking-[1px]" style={{ color: 'var(--color-text-primary)' }}>
          {recipe.name}
        </div>
      </div>

      {/* Round indicator dots */}
      <div className="flex justify-center gap-3 mb-5">
        {Array.from({ length: ROUNDS }).map((_, i) => {
          const h = hits[i];
          const active = i === roundIndex && phase === 'playing';
          return (
            <div
              key={i}
              style={{
                width: 18,
                height: 18,
                border: '1px solid',
                borderColor: active
                  ? 'var(--color-hal-glow)'
                  : h === 'perfect'
                    ? 'var(--color-accent-gold)'
                    : h === 'hit'
                      ? 'var(--color-accent-green)'
                      : h === 'miss'
                        ? 'var(--color-accent-red)'
                        : 'var(--color-border)',
                background:
                  h === 'perfect'
                    ? 'rgba(255,170,0,0.25)'
                    : h === 'hit'
                      ? 'rgba(51,204,68,0.2)'
                      : h === 'miss'
                        ? 'rgba(255,34,0,0.2)'
                        : 'transparent',
                transition: 'all 0.2s',
              }}
            />
          );
        })}
      </div>

      {/* Timing bar */}
      <button
        style={{
          display: 'block',
          width: '100%',
          height: 48,
          position: 'relative',
          background: 'var(--color-bg-medium)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
          cursor: phase === 'playing' ? 'pointer' : 'default',
          padding: 0,
          marginBottom: 14,
          touchAction: 'none',
        }}
        onPointerDown={handleTap}
        aria-label="Tap when indicator is in the green zone"
      >
        {/* Hit zone */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${zoneStart * 100}%`,
            width: `${ZONE_WIDTH * 100}%`,
            background: 'rgba(51,204,68,0.15)',
            borderLeft: '1px solid rgba(51,204,68,0.6)',
            borderRight: '1px solid rgba(51,204,68,0.6)',
          }}
        />
        {/* Perfect zone */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${pStart * 100}%`,
            width: `${PERFECT_WIDTH * 100}%`,
            background: 'rgba(255,170,0,0.3)',
          }}
        />
        {/* Moving indicator */}
        <div
          style={{
            position: 'absolute',
            top: 3,
            bottom: 3,
            width: 3,
            left: `calc(${indicatorPos * 100}% - 1.5px)`,
            background: indicatorColor,
            boxShadow: `0 0 8px ${indicatorColor}`,
          }}
        />
      </button>

      {/* Status text */}
      <div
        className="text-center text-xs tracking-[2px] mb-5"
        style={{ color: feedbackColor, minHeight: 18 }}
      >
        {phase === 'countdown'
          ? '...'
          : phase === 'playing'
            ? 'TAP WHEN IN ZONE'
            : feedbackText}
      </div>

      <div className="text-center">
        <button
          className="pixel-btn pixel-btn-ghost text-xs"
          style={{ minHeight: 'unset', padding: '6px 18px', fontSize: 11 }}
          onPointerDown={e => {
            e.stopPropagation();
            onCancel();
          }}
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}
