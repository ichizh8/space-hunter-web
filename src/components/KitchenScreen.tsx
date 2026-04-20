'use client';

import { useState } from 'react';
import { useSaveStore } from '../store/saveStore';
import { KITCHEN_RECIPES, canCook, type KitchenRecipe } from '../data/recipes';
import { INGREDIENTS } from '../data/ingredients';
import { CookingMinigame } from './CookingMinigame';

const TIER_TO_STATION: Record<string, string> = {
  common: 'basic',
  standard: 'prep',
  exotic: 'exotic',
  legendary: 'forge',
};

const STATION_ORDER = ['basic', 'prep', 'exotic', 'forge'] as const;
type StationId = (typeof STATION_ORDER)[number];

const STATION_LABEL: Record<StationId, string> = {
  basic: 'BASIC',
  prep: 'PREP',
  exotic: 'EXOTIC',
  forge: 'FORGE',
};

const STATION_COST: Record<StationId, number | null> = {
  basic: null, // default unlocked
  prep: 500,
  exotic: 1500,
  forge: 3000,
};

const TIER_COLOR: Record<string, string> = {
  common: 'var(--color-text-secondary)',
  standard: 'var(--color-accent-cyan)',
  exotic: 'var(--color-accent-purple)',
  legendary: 'var(--color-accent-gold)',
};

type CookResult = { name: string; credits: number; rep: number; grade: 'PERFECT' | 'SUCCESS' | 'FAILED' };

export function KitchenScreen() {
  const save = useSaveStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cooking, setCooking] = useState(false);
  const [lastResult, setLastResult] = useState<CookResult | null>(null);

  const inv = save.ingredientInventory;
  const stations = save.kitchenStations;

  const allRecipes = Object.values(KITCHEN_RECIPES);
  const visibleRecipes = allRecipes
    .filter(r => (stations[TIER_TO_STATION[r.tier]] ?? 0) >= 1)
    .sort((a, b) => {
      const aC = canCook(a, inv) ? 0 : 1;
      const bC = canCook(b, inv) ? 0 : 1;
      return aC - bC;
    });

  const selected = visibleRecipes.find(r => r.id === selectedId) ?? null;

  function handleCookComplete(success: boolean, perfect: boolean) {
    if (!selected) return;
    setCooking(false);

    if (!success) {
      save.removeIngredients(selected.ingredients);
      setLastResult({ name: selected.name, credits: 0, rep: 0, grade: 'FAILED' });
      setSelectedId(null);
      return;
    }

    const mult = perfect ? 1.5 : 1;
    const credits = Math.round(selected.creditReward * mult);
    const rep = Math.round(selected.repReward * mult);

    save.removeIngredients(selected.ingredients);
    save.addCredits(credits);
    save.addReputation(rep);
    setLastResult({ name: selected.name, credits, rep, grade: perfect ? 'PERFECT' : 'SUCCESS' });
    setSelectedId(null);
  }

  if (cooking && selected) {
    return (
      <CookingMinigame
        recipe={selected}
        onComplete={handleCookComplete}
        onCancel={() => setCooking(false)}
      />
    );
  }

  const resultBorderColor =
    lastResult?.grade === 'PERFECT'
      ? 'var(--color-accent-gold)'
      : lastResult?.grade === 'SUCCESS'
        ? 'var(--color-accent-green)'
        : 'var(--color-accent-red)';

  return (
    <div style={{ fontFamily: 'var(--font-pixel)' }} className="space-y-4">
      {/* Last cook result */}
      {lastResult && (
        <div className="pixel-card text-center" style={{ borderColor: resultBorderColor }}>
          <div
            className="text-xs tracking-[2px] mb-1"
            style={{ color: resultBorderColor }}
          >
            {lastResult.grade}
          </div>
          <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
            {lastResult.grade === 'FAILED'
              ? `${lastResult.name} -- ingredients lost`
              : `${lastResult.name}  +${lastResult.credits}cr  +${lastResult.rep}rep`}
          </div>
        </div>
      )}

      {/* Station grid */}
      <div>
        <div
          className="text-xs tracking-[2px] mb-2"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          STATIONS
        </div>
        <div className="flex gap-2">
          {STATION_ORDER.map(id => {
            const unlocked = (stations[id] ?? 0) >= 1;
            const cost = STATION_COST[id];
            const canAfford = cost !== null && save.totalCredits >= cost;
            return (
              <div
                key={id}
                className="pixel-card flex-1 text-center"
                style={{
                  padding: '8px 4px',
                  borderColor: unlocked ? 'var(--color-border-light)' : 'var(--color-border)',
                }}
              >
                <div
                  className="text-xs tracking-[1px] mb-1"
                  style={{ color: unlocked ? 'var(--color-accent-green)' : 'var(--color-text-muted)' }}
                >
                  {STATION_LABEL[id]}
                </div>
                {unlocked ? (
                  <div className="text-xs" style={{ color: 'var(--color-accent-green)' }}>
                    ON
                  </div>
                ) : cost !== null ? (
                  <button
                    className="pixel-btn"
                    style={{ minHeight: 'unset', padding: '3px 6px', fontSize: 10 }}
                    disabled={!canAfford}
                    onClick={() => save.buyKitchenStation(id, cost)}
                  >
                    {cost}cr
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Ingredient inventory */}
      <div>
        <div
          className="text-xs tracking-[2px] mb-2"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          PANTRY
        </div>
        {Object.keys(inv).length === 0 || Object.values(inv).every(q => q === 0) ? (
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            No ingredients -- complete hunts to gather materials
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Object.entries(inv)
              .filter(([, qty]) => qty > 0)
              .map(([id, qty]) => {
                const ingr = INGREDIENTS[id];
                if (!ingr) return null;
                const hex = '#' + ingr.color.toString(16).padStart(6, '0');
                return (
                  <div
                    key={id}
                    className="pixel-card text-center"
                    style={{ padding: '5px 9px', borderColor: hex + '55', minWidth: 68 }}
                    title={ingr.name}
                  >
                    <div
                      className="text-xs"
                      style={{
                        color: hex,
                        maxWidth: 70,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {ingr.name}
                    </div>
                    <div
                      className="font-bold"
                      style={{ fontSize: 13, color: 'var(--color-text-primary)' }}
                    >
                      x{qty}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Recipe list */}
      <div>
        <div
          className="text-xs tracking-[2px] mb-2"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          RECIPES
        </div>
        {visibleRecipes.length === 0 ? (
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            No stations online -- unlock a station above
          </div>
        ) : (
          <div className="space-y-2">
            {visibleRecipes.map(recipe => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                inv={inv}
                selected={selectedId === recipe.id}
                onSelect={() => setSelectedId(selectedId === recipe.id ? null : recipe.id)}
                onCook={() => setCooking(true)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RecipeCard({
  recipe,
  inv,
  selected,
  onSelect,
  onCook,
}: {
  recipe: KitchenRecipe;
  inv: Record<string, number>;
  selected: boolean;
  onSelect: () => void;
  onCook: () => void;
}) {
  const cookable = canCook(recipe, inv);
  const tierColor = TIER_COLOR[recipe.tier] ?? 'var(--color-text-secondary)';

  return (
    <div
      className="pixel-card"
      style={{
        padding: '10px 14px',
        borderColor: selected
          ? 'var(--color-hal-red)'
          : cookable
            ? 'var(--color-border-light)'
            : 'var(--color-border)',
        opacity: cookable ? 1 : 0.55,
        cursor: 'pointer',
      }}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm tracking-[1px]" style={{ color: 'var(--color-text-primary)' }}>
          {recipe.name}
        </span>
        <span className="text-xs" style={{ color: tierColor }}>
          {recipe.tier.toUpperCase()}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-2">
        {Object.entries(recipe.ingredients).map(([id, qty]) => {
          const have = inv[id] ?? 0;
          const ok = have >= qty;
          const ingr = INGREDIENTS[id];
          return (
            <span
              key={id}
              style={{ color: ok ? 'var(--color-accent-green)' : 'var(--color-accent-red)' }}
            >
              {ingr?.name ?? id} {have}/{qty}
            </span>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: 'var(--color-accent-gold)' }}>
          +{recipe.creditReward}cr  +{recipe.repReward}rep
        </span>
        {selected && cookable && (
          <button
            className="pixel-btn pixel-btn-primary"
            style={{ minHeight: 'unset', padding: '5px 14px', fontSize: 12 }}
            onClick={e => {
              e.stopPropagation();
              onCook();
            }}
          >
            COOK
          </button>
        )}
      </div>
    </div>
  );
}
