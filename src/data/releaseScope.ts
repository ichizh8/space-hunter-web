// Lite release scope. Everything outside these allowlists is PARKED, not
// deleted: content stays in the repo as ready-made post-release updates.
// Flip RELEASE_SCOPE to false to restore the full game instantly.

export const RELEASE_SCOPE = true;

export const SCOPE_WEAPONS = ['sidearm', 'scatter', 'baton', 'flamethrower'];
export const SCOPE_KITS = ['stim_pack', 'flash_trap', 'blink_kit', 'turret_kit'];
export const SCOPE_CONTRACT_TYPES = ['hunt', 'boss_hunt'];
export const SCOPE_PLANETS = ['kepler'];

export function inScopeWeapon(id: string): boolean {
  return !RELEASE_SCOPE || SCOPE_WEAPONS.includes(id);
}

export function inScopeKit(id: string): boolean {
  return !RELEASE_SCOPE || SCOPE_KITS.includes(id);
}

export function inScopeContractType(type: string): boolean {
  return !RELEASE_SCOPE || SCOPE_CONTRACT_TYPES.includes(type);
}

export function inScopePlanet(id: string): boolean {
  return !RELEASE_SCOPE || SCOPE_PLANETS.includes(id);
}

/** Lite mode drops the kit tree prerequisites: 4 kits need no gating. */
export const SCOPE_SKIP_KIT_PREREQS = RELEASE_SCOPE;
