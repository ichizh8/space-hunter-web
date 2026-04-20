---
name: pre-deploy-qa
description: "Pre-deploy QA checklist and smoke test for Space Hunter. Use before any deploy to GitHub Pages, after merging feature branches, or when the user says 'deploy', 'push', 'ship it', 'go live', 'is it ready?'. Also trigger when the user asks to 'test', 'check', 'verify', or 'smoke test' the game. Proactively suggest running this when you see a deploy command about to be executed."
---

# Pre-Deploy QA

A structured checklist to run before every Space Hunter deploy. Catches the bugs that sneak in during fast iteration -- the ones where the build passes but the game is broken.

## Quick Smoke Test (Run Every Deploy)

These are the non-negotiables. If any fail, do not deploy.

### 1. Build Check
```bash
npm run build
```
Must complete with zero errors. Warnings are OK but note them.

### 2. Core Loop Walkthrough

Mentally (or actually) trace through the full game loop. Every screen transition must work:

```
Landing page loads
  → Start button works
    → ShipHub renders (upgrades visible, credits shown)
      → ContractBoard shows 3 random contracts
        → Loadout screen shows weapons + kits
          → Hunt starts (enemies spawn, weapons fire, HUD shows)
            → Player dies OR contract complete
              → Results screen shows score, XP, loot
                → Back to ShipHub (progress saved)
```

If any screen is blank, crashes, or shows stale data, STOP.

### 3. Save System
- Start a new run, earn some XP/credits
- Refresh the page (F5)
- Verify progress persists (level, credits, unlocks)
- Verify no save corruption (NaN values, missing fields)

### 4. Console Check
Open browser console during a full run. Flag:
- Any red errors (not warnings)
- Rapid repeated warnings (usually a broken animation loop)
- Memory warnings
- Failed network requests (404s for assets)

## Feature-Specific Tests

Run these when the deploy includes changes to the relevant system:

### Weapons
- Fire each changed weapon
- Verify damage registers (enemies lose HP)
- Check mutation fork if modified (clean vs void)
- Verify reload timing feels right
- Check ammo display updates correctly

### Enemies
- Play through 3+ waves
- Verify new/changed enemy types spawn
- Check elite behavior (charge attack, teleporter entrance)
- Verify pack enemies surround correctly (groups 3-5)
- Boss fight: verify all phases trigger, HP transitions work

### Kits & Perks
- Equip changed kit, verify perk activates
- Check perk effect is visible/measurable in gameplay
- Verify kit prerequisites still enforce correctly
- Check familiar companion if kit-related

### UI / HUD
- HUD elements positioned correctly (HP, ammo, score, wave counter)
- No overlapping text at different resolutions
- Contract objectives display and update live

### Map & Biomes
- Pan camera to verify biome transitions
- Check rivers, bridges, caves render
- Void pools visible and functional
- No visual glitches at biome boundaries

### Progression
- XP bar fills correctly
- Level up triggers at right thresholds
- Ship Workbench upgrades apply correctly
- Credits spend/display correctly

## Deploy Checklist

After tests pass:

```
[ ] npm run build succeeds
[ ] Core loop walkthrough complete
[ ] Save system verified
[ ] Console clean (no red errors during gameplay)
[ ] Feature-specific tests for changed systems
[ ] Git: all changes committed, pushed to main
[ ] Deploy command: gh workflow run pages.yml -R ichizh8/space-hunter-web
[ ] Verify live site loads after deploy (wait ~2 min for Pages rebuild)
[ ] Hard refresh (Cmd+Shift+R) to bust cache
[ ] Quick play on live site to confirm
```

## Post-Deploy Verification

After the GitHub Pages build completes:
1. Open https://ichizh8.github.io/space-hunter/
2. Hard refresh (Cmd+Shift+R)
3. Open console, play one full contract
4. If anything is wrong, check if the deploy actually landed (check the Pages build log)

## Common Gotchas

- **Browser cache**: Always Cmd+Shift+R after deploy. Old JS bundles cause ghost errors.
- **PixiJS alpha**: Alpha values accumulate. If you see full-screen overlays, check .cut() API order.
- **Zustand persistence**: If save shape changed, old localStorage can crash. Clear localStorage and retry.
- **GitHub Pages delay**: Takes 1-3 minutes. Don't panic if the old version shows up immediately.
- **Asset paths**: GitHub Pages serves from /space-hunter/ not /. Relative paths can break.
