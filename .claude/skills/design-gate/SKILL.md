---
name: design-gate
description: "Design review gate before implementing new game features. Use when the user wants to add a new system, mechanic, enemy type, weapon, perk, game mode, or any significant feature. Also trigger on 'I want to add', 'new feature', 'what if we', 'I'm thinking about', or any brainstorming that's about to become code. The point is to think before coding -- avoid building something that needs to be ripped out later."
---

# Design Gate

A lightweight design review to run before writing any code for a new feature. The goal: spend 10 minutes thinking to save 2 hours of rework.

The biggest source of spaghetti code is not bad coding -- it's jumping into implementation before understanding how a feature connects to the rest of the game. This gate catches that.

## When To Use

- Any new system (crafting, minimap, damage floaters, etc.)
- Any new content type (weapon, enemy, perk, contract type)
- Any change to core loop flow (new screens, new phases)
- Any change to progression (XP, levels, unlocks)
- Anything the user describes as "I was thinking we could..."

## The Five Questions

Before writing a single line of code, answer these:

### 1. What does the player experience?
Describe the feature from the player's perspective. Not the implementation -- the experience. What do they see, do, and feel?

*Example:* "Player sees floating numbers when they deal damage. Big hits show bigger, more dramatic numbers. Crits flash red. Numbers drift upward and fade."

### 2. Where does this live in the codebase?
Identify the exact files and modules this touches. If the answer is "Game.ts, plus maybe some other stuff," STOP. That's spaghetti waiting to happen. The answer should name specific modules with clear responsibilities.

*Good:* "New file: `src/game/DamageFloaters.ts`. Called from `Game.ts:handleHit()`. Renders via its own PixiJS container added to the game stage."

*Bad:* "We'll add it to the draw loop in Game.ts somewhere around line 3000."

### 3. What existing systems does this interact with?
List every system that gives data to or receives data from the new feature. For each interaction, state the interface: what data flows, in which direction.

*Example:*
- **Damage system → Floaters**: damage amount, position, isCrit (read-only)
- **Camera → Floaters**: viewport offset for screen positioning (read-only)
- **Game loop → Floaters**: calls update() and draw() each frame

Flag any interaction where the new feature needs to WRITE to an existing system. Those are coupling risks.

### 4. What's the smallest version that works?
Define the MVP. Strip away nice-to-haves until you have the minimum implementation that delivers the core player experience.

Then define what you'll add in a second pass. This prevents scope creep and keeps individual commits clean.

*Example:*
- **MVP**: White numbers float up and fade. One size. Appear at damage position.
- **V2**: Size scales with damage. Crit color. Slight random drift.
- **V3**: Number stacking (multiple hits combine). Kill streak counter.

### 5. How do we know it works?
Define 2-3 concrete test scenarios:

*Example:*
1. Shoot a basic enemy -- number appears at enemy position, shows correct damage value, fades within 1 second
2. Crit hit -- number is visually distinct (bigger/colored)
3. Kill an enemy -- final number still appears, doesn't glitch when enemy despawns

## Review Output

After answering the five questions, produce a summary block:

```
FEATURE: [name]
MODULE: [new file path]
TOUCHES: [list of existing files modified]
COUPLING: [Low/Medium/High]
MVP SCOPE: [1-2 sentences]
RISK: [what could go wrong]
```

If COUPLING is High, discuss whether the feature can be restructured to reduce it before coding starts.

## Rules

- This is NOT a design document. It's a 5-minute sanity check. Keep answers brief.
- If the feature requires modifying Game.ts by more than 20 lines, run /refactor-check first to see if the relevant code should be extracted before adding more.
- Never skip the "smallest version" question. Scope creep is the #1 cause of abandoned features.
- The test scenarios from question 5 become your post-implementation verification. Refer back to them.
- If you can't clearly answer question 2 (where does this live?), the feature needs more design time before any code is written.

## Space Hunter Context

Current feature gaps that will likely trigger this gate:
- Damage floaters
- Minimap
- Recipe/crafting system
- Biome vignettes (PixiJS v8 compatible)
- Resonance combos (10 planned)
- Mastery perk effects (88 perks designed, need implementation)

Each of these has non-trivial interactions with existing systems. Running this gate first will prevent them from becoming more Game.ts spaghetti.
