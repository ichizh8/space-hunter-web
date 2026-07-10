# GORB: Eat the Galaxy — Game Concept v1.0

**Working title:** GORB: Eat the Galaxy (RU: ГОРБ: Сожри галактику)
**Alt titles considered:** GLUTTON: Bullet Buffet, ЖОР (ZHOR), Косможор, OMNOMICON
**Date:** 2026-07-10. Status: concept, pre-production.
**Team:** solo dev + AI agents. **Platform:** iOS first (Capacitor 8 + PixiJS 8 + TypeScript), portrait, one-thumb.
**Genre:** Vampire-Survivors-like / bullet heaven. A deliberate genre clone with one twist executed to the hilt.

## One-liner

Vampire Survivors, but you EAT the enemies — and you are what you eat: your diet is your build, and your body visibly mutates from what you devour.

## Elevator pitch

GORB-42 is a bio-engineered garbage-disposal blob from a luxury space liner that developed *taste*, ate the buffet, and escaped. Now, under a court-ordered wellness program administered by KCAL-9000 (a passive-aggressive insurance-company nutritionist AI), GORB reviews the galaxy one bite at a time. Enemies are food. Kill them, vacuum up the chunks, cook dishes on level-up, mutate from your diet, and when you overeat — release a disaster-classified BURP that deletes half the screen. Every run ends with a restaurant receipt: an itemized bill of everything you ate. That receipt is the share card.

---

## 1. Identity and tone

- **Protagonist: GORB (ГОРБ).** A mute round blob with one giant mouth and dot eyes. The cheapest possible rig where every diet mutation reads instantly. Never speaks; chews, burps, occasionally screams in font. GORB is not hunting aliens — GORB is *reviewing* them (every run ends with a star rating for the galaxy).
- **Ship AI: KCAL-9000 (ККАЛ-9000).** Court-appointed nutritionist installed after "the buffet incident." Wellness-app passive aggression, insurance-adjuster dread. Never yells, files everything. Delivers clinical understatement: "Chewing detected. Chewing was not authorized."
- **Tone:** diet-culture parody meets cartoon splatter. Violence is culinary (enemies burst into sauce and ingredients, never blood). Cruelty is verbal (KCAL). The player is always the butt of the joke.
- **Guardrails (App Store 12+):** sauce not blood; burps yes, vomit/fecal no; jokes punch at bureaucracy, insurance, wellness pseudoscience, fine-dining pretension, and GORB — NEVER at real bodies, weights, or eating disorders. "You're uninsurable" is the register, "you're disgusting" is banned. No real brands, no alcohol/drugs/religion/politics.

## 2. Core loop (moment-to-moment)

One-thumb portrait. Floating joystick (spawns under thumb, dead zone 12px, max throw 80px). **Movement is the only continuous input** — attacks auto-fire, chunks auto-vacuum, level-ups are one tap.

The 3-second loop: steer into a lane → utensils shred enemies → chunks pop out (squash-and-stretch hop) → vacuum pickup (radius 90px, chunks accelerate 900 px/s to the mouth) → gulp SFX + tick haptic → meters fill. **Every chunk = +1 fullness, +1 XP, +0.5 HP.** One pickup feeds three meters — eating IS the reward loop, VS gem-hoovering but wetter and louder.

- Player base: 100 HP, 220 px/s, 20px hitbox, 1080x1920 logical canvas.
- **Fullness meter** (ring around GORB): 0–100, decays 1/s. At 100 the burp is READY (ring flashes; fullness buffers to 120 overflow). **Tap anywhere to release the BURP**: 0.25s windup (GORB inflates 1.5x), 80 dmg in 350px, knockback 400px, 0.2s hit-stop, shake. At 120 it auto-releases (and ticks the "Doctor's Warning Ignored" quest). Auto-burp toggle in settings for accessibility. Deliberately holding a ready burp to chain it into a pack is the core skill expression. Late-run cadence: a burp every ~12s.
- **THE CATEGORY BURP (the one engineered meme):** every burp is treated as a natural disaster — slow-mo, camera punch-in, decibel meter, official classification card ("CATEGORY 4 BURP — 47 casualties — felt on 3 moons") pausing 1.5s for screenshots. Burp VFX derives from dominant diet (meat = grease wave, spice = firestorm, jelly = bouncing pink blobs). Audible, 3-second readable, player-authored, self-captioning.

## 3. Diet and mutation system

Every chunk carries one tag. Per-run counters shown as a small stomach pie chart. Thresholds per axis at **30 / 80 / 200 eaten (T1/T2/T3)**; effects stack across axes; the body composites visually (base + fat layer + tint + particles + accessories) — top-2 axes drive the look, T3 dominates.

| Axis | T1 (30) | T2 (80) | T3 (200) |
|---|---|---|---|
| **MEAT** | +15% dmg, +10% size | +35% dmg, −10% speed, visibly fat, footstep thuds | +70% dmg, −20% speed, waddle contact dmg 10/s; a sweating slab with tiny legs |
| **SPICE** | attacks burn 2/s 3s; skin reddens | +20% atk speed, fire trail behind you | burp = firestorm leaving burning ground; head on fire |
| **JELLY** | body wobbles, +10% pickup radius | projectiles bounce off screen edges; you bounce off walls | 25% chance to no-sell a hit ("boing", 0.5s i-frames); translucent body, eaten enemies visible inside |
| **SUGAR** | +10% speed, sparkle trail | +15% crit; crits pop enemies into 2x chunks | every burp grants 3s x2 attack-speed sugar rush; full-face pupils |
| **VOID** (risk) | 3x fullness/XP per chunk, −10 max HP | pierce +1, +15% dmg taken | double damage dealt AND received; eyes and tentacles |

Crossing a threshold plays a 2s on-the-spot **Final Form reveal** with a name card ("YOU HAVE BECOME: THE SPHERE") and KCAL recoiling. Diet vector maps to scale/wobble-shader/tint/trail — combinatorially dozens of silhouettes, so no two clips look alike.

## 4. Level-ups are DISHES; weapons are UTENSILS

- **Utensils** (permanent weapon slots, max 4): Fork (starter stab), Cleaver (arc), Pepper Grinder (radial shotgun), Blender (orbitals), Skewer (pierce line), Ladle (lobbed AOE). Persistent recognizable patterns = genre legibility; 5 dish-driven levels each; **L5 gates on a diet tier** (Cleaver L5 "Butcher's Special" needs MEAT T2) — cross-referencing synergies, not flat stats.
- **Dishes** (level-up cards): XP level N costs 5+8N chunks (~25 levels in an 8-min run). On level-up: 3 dish cards slide up from the bottom (thumb zone), each cooked FROM THIS RUN'S EATEN CHUNKS — cards cost tags (e.g. "Dragon Skewer: 20 SPICE — Skewer +1 pierce, applies burn"). Spending does NOT lower mutation thresholds (thresholds count lifetime-this-run). Offers are weighted by what you actually ate — the build chases your diet, Balatro-style commitment. Mix: 60% utensil upgrades / 30% passives / 10% wild. **Zero-cost "Leftovers" tier always exists** (+3 dmg / +5% speed / heal 25) with visibly sad soggy card art — never a dead level-up.
- Dish discovery = collection: first cook of any dish inscribes it in the Recipe Book forever (+ tiny permanent bonus).

## 5. Enemies (foods) and bosses (rival chefs)

Naming formula: food x sci-fi suffix — the name tells you the drop. Launch 10:
Snacklings (popcorn swarm fodder), Meatoids (beefy chargers), Gelatoids (bouncing splitters), Peppergeists (spicy ranged ghosts), Sugar Wisps (fast flee-bait orbiters), Angry Broccoli (tanky knockback-immune walker; "eat your vegetables"), Rotten Egg (telegraphed detonator; drops VOID only if killed pre-detonation — priority target), Cheese Swarm (packs of 8, surround), Gravy Ooze (elite, damaging slick), The Ribeye (elite, charging meat wall; death rains 15 MEAT — a deliberate build-warper).

Bosses (v1 ships 2, then +2): **Chef Ramzai the Flayed** (four arms, flying cleavers, screams "IT'S RAW" at your mutations, throws raw meat you can eat mid-dodge); **Grandma Umami, the Eternal Broth** (sentient stockpot, ladle telegraphs; her chunks are the game's only balanced meal); later **Le Grand Gateau** (wedding-cake mimic whose HP bar IS the cake layers you eat off) and **The Health Inspector** (final boss, only non-food entity; grades your run "F" pre-fight; drops a clipboard, "tastes like paperwork and disappointment").

## 6. Run structure and difficulty

- **8:00 standard run**, boss at 8:00, win = extraction, receipt prints. Concurrent enemies: ~15 (min 1) → 60 (min 4) → 150 (min 8). HP +12%/min, count +25%/min.
- **Scripted-generous first session:** first 3 kills drop 3 chunks each; first level-up by 0:20; elite chest at 1:30 always gives a second utensil; first burp-wipe at ~0:35; first mutation by 1:00. Player learns move/eat/cook/burp/mutate with zero tutorial screens.
- **First 60 seconds beat-by-beat:** boot cold-opens into Run 1 (no title on first launch). Ship crash → KCAL: "Supplies destroyed. Recommendation: eat the locals." → joystick hint pulses under thumb → 3 slow enemies → first kill at 10s bursts into glowing chunks → crunch+haptic → scripted level-up at ~20s (2 cards, both good) → wave fills stomach → "TAP TO BURP" once → wipe at ~35s → first mutation ~50s → KCAL: "That is... a choice."
- Push-notification permission: only after the first burp-wipe great moment. Never at boot.

## 7. Meta: the diner IS the recipe book

- **The Greasy Nebula** — your diner at the end of the galaxy, the single between-runs scene. Discovered dishes physically appear on its menu board and tables; regulars show up to eat them. Collection front and center: "Menu: 23/60."
- **One currency: Grease (GRS).** Bill converts 1 GRS per 100 kcal (same rate win or lose). Sinks: 6 diner stations (Grill, Fryer, Freezer, Spice Rack, Bar, Jukebox), Lv1–5, fixed slot costs (100/250/600/1500/4000), levels 1–4 honest small bonuses, **every L5 a mechanic-bearing capstone** (Grill L5: burps leave 3s fire pools; Freezer L5: one dish per run carries into the next run; Jukebox L5: +20% hit-stop juice). Plus 2 extra characters ("Regulars") at 2k/6k. Total sink ~32k GRS; a run yields 300–600.
- **Medical Chart** (quest board): KCAL's patient file; 40 permanent "diagnoses" at v1, every one a small forever-bonus. Diabetes (eat 100 sweets → +2% crit), Gout (200 meat → +3% dmg), Iron Stomach (25 rotten chunks → rot immunity), Vitamin Deficiency (die 10 times → start with a free dish), Terminal Gluttony (eat 10,000 chunks → +5% everything and unlocks "KCAL Silent" toggle)...
- **Health Code Violations** (post-win Ascension, 10 stacking named modifiers): Rats in the Kitchen (+25% count) → Expired Stock (chunks rot faster) → Understaffed (2 dish choices) → Health Inspector Visit (mid-run elite that EATS YOUR CHUNKS) → ... → Michelin Hell (everything; wins print a gold-foil receipt). Each win stamps a framed violation notice on the diner wall.
- **Failure = Doggy Bag:** death loses nothing — full GRS conversion, all discoveries and chart progress persist, and dying advances its own quest. There is no wasted run.
- **Deliberately absent:** energy, forced ads, IAP at launch, grind wall (Violation 5 beatable on week-2 meta; total meta power capped ~+35% so skill stays dominant), upgrade regret (fixed slot costs), streak punishment.
- Content: ~9–12 hours to 100% (60 dishes, 40 diagnoses, 6 stations, 3 characters, 10 violations); Daily + leaderboards are the infinite tail; v1.1 (+1 planet, +30 recipes) before the tail runs dry.

## 8. Screens and navigation

Depth rule: everything ≤2 taps from Title. Map: Title → {Run, Galley} → {Cookbook, Medical Chart, Daily, Leaderboard, Settings, Receipt}. Touch targets in bottom 55%; top 20% read-only HUD; X-to-close bottom-left; swipe-down closes overlays; left-hand mirror mode.

1. **Boot** <2s; first launch cold-opens into Run 1.
2. **Title:** logo, mascot mid-chew, giant EAT button; Daily/Cookbook/Chart/Leaderboard arc (fade in after run 1); red dot + streak on Daily.
3. **Galley** (pre-run): character carousel, starting utensil, biome pick, "Chores done: +7%" summary, START RUN; one KCAL bark per visit.
4. **Run:** floating joystick; top strip timer/HP/kcal; stomach bar under timer; tiny diet pie top-right; dish overlay slides into bottom 50%.
5. **Receipt** (results) — THE screenshot: thermal receipt prints line by line with sound+haptics. Header CHEZ KCAL — "WE SERVE WHAT YOU KILL"; itemized eats (max 12 lines then "...AND 6 MORE REGRETS"); dishes with KCAL star ratings; FINAL FORM line; burp count + casualties; SUBTOTAL in kcal = score; "TIP: your corpse"; KCAL's one-line review from a 40-line table; fake barcode encoding seed+score. Buttons: SHARE / RETRY / Galley.
6. **Cookbook:** Dishes / Ingredients (bestiary as a menu with market prices) / Mutations (body gallery); silhouettes + hints for undiscovered.
7. **Medical Chart:** grid of claimable diagnosis cards, CLAIM ALL.
8. **Daily "Dish of the Day":** today's modifier card, one scored attempt (retries stamped "* REHEATED" on the receipt — social shame, not hard locks), countdown, friend codes (v1.1).
9. **Leaderboard:** Daily / All-time; your row pinned.
10. **Settings:** music, SFX, haptics, shake 0/50/100, damage numbers, reduced-splatter mode, colorblind palettes (flavor colors get icon shapes as backup — diet colors are gameplay-critical), joystick fixed/floating, left-hand mode, auto-burp, RU/EN runtime switch, iCloud save status, reset (double confirm).

Haptic map (locked): chunk tick (light), dish commit (medium), threshold crossed (heavy+rumble), burp (heavy double), death (heavy), receipt TOTAL stamp (medium), daily rank reveal (light).

## 9. Virality systems

- **Receipt PNG:** offscreen HTML5 canvas → 1080x1920 → `@capacitor/share`. Monospace thermal font, torn edge. ~1 day of work, zero art dependencies.
- **Emoji line** (Wordle-style, spoiler-free — never names the daily's twist):
  `GORB Daily #37 🍽️ 9:42` / `🍖🍖🍖🍖🌶️🌶️🍮💀 23,840 kcal` / `🤢 KCAL says: concerning`
- **Daily Special:** seed = hash(YYYYMMDD) → mulberry32 → waves, dish menu (fixed 12-dish menu forces off-build play), modifier ("all enemies are jelly today"). Fully client-side, zero backend.
- **Leaderboards v1: Game Center only** (recurring daily kcal + all-time). Friend "table codes" via Cloudflare Worker deferred to v1.1 — the emoji line in group chats IS the friend leaderboard at launch.
- **Clip engines (3):** Category Burp; Final Form reveal; KCAL subtitle captions baked into gameplay (clips carry the joke with sound off). No in-game recorder — iOS screen recording is one swipe away.
- **$0 seeding:** 25 personalized TestFlight invites to mid-tier VS-like creators ("Vampire Survivors, but you eat the enemies and get fat"), press-kit folder with 3 pre-cut 15s verticals; 3 self-posted Shorts/week ("I made a game where..."); devlogs in r/IndieDev, r/roguelites, launch in r/iosgaming. Share prompt fires exactly once, after first personal-best daily.
- **Game Center achievements (12, meme-named):** First Burp; Became A Sphere; Vegan Run; Perfectly Balanced; Ate 1,000; Ate 10,000; Died Of Natural Causes (survive 20:00); Speed Eater; Picky Eater; Food Critic; Regular; KCAL Approved.

## 10. App Store

- **Name:** GORB: Eat the Galaxy (RU: ГОРБ: Сожри галактику). Subtitle: "Eat monsters. Mutate. Survive." / RU: "Ты — то, что ты ешь. Увы."
- Keywords: survivor, roguelite, bullet heaven, horde, eat, food, mutant, arcade, offline, monster, casual.
- **Description written in-character by KCAL-9000** as a nutrition label / incident report: "NUTRITION FACTS. Serving size: one (1) galaxy. Servings per container: you'll finish it, we both know you will."
- Screenshots: receipt card first, Sphere transformation second, gameplay third.
- Featuring pitch (6 weeks pre-launch): "the one-thumb roguelite where your diet is your build" — portrait one-handed, haptics, Game Center, <10-min sessions, free, no IAP.
- Rating 12+: cartoon violence, crude humor (burps). Free at launch, no IAP, no ads.

## 11. Tech and architecture

- **Fresh repo** (private). TypeScript + PixiJS 8 (pinned `preference: 'webgl'`) + Capacitor 8, static bundle in the binary. Space Hunter Web is the donor: reuse hard-won knowledge (webview constraints, save mirroring to native storage, touch/joystick code patterns, spawn-distance/i-frame conventions, damage floaters approach), NOT the codebase.
- Everything data-driven JSON: enemies, dishes, diagnoses, violations, barks, screens copy (RU/EN runtime switch).
- Performance targets: 150 concurrent enemies + chunks at locked 60fps in WKWebView — sprite pooling, ParticleContainer for hordes, no per-frame allocations in the hot loop.
- Saves: Zustand persist to localStorage + mirror every write to Capacitor Preferences; restore from native on boot (iOS evicts webview storage).
- SFX через native audio plugin from day one (Web Audio latency 500–1000ms in webview); music can stay Web Audio.
- Daily seed and receipts fully client-side; Game Center via @openforge/capacitor-game-connect; haptics via @capacitor/haptics.

## 12. Scope to first TestFlight (target: 4 weeks of focused work)

- **Week 1 — the toy:** arena, joystick, 3 enemies, Fork+Cleaver, chunks/vacuum/fullness, burp, XP/dish overlay with 10 dishes, MEAT+SPICE axes with visible mutation. Goal: the 3-second clip exists.
- **Week 2 — the game:** all 5 axes, 6 utensils, 10 enemies, elite + boss 1 (Ramzai), 8-min curve, receipt screen, death/doggy bag, first-60-seconds script.
- **Week 3 — the meta:** diner scene, Recipe Book (60 dishes), Medical Chart (40), Grease + 6 stations, Daily Special, Game Center, settings, RU/EN.
- **Week 4 — the polish:** haptics map, KCAL bark table (100+ lines), Category Burp presentation, Final Form cards, onboarding tuning, TestFlight build via Xcode Cloud, 25 creator invites.
- **Cut from v1 (explicitly):** friend table codes (v1.1), boss 3-4, planet 3+, weekly modifiers, ghost runs, clip recorder, localization beyond RU/EN, Android/web ports, IAP/monetization.

## 13. Open risks

- VS-clone market saturation → the twist must be visible in the FIRST screenshot (mutated GORB + receipt).
- WKWebView perf at 150 enemies + chunk storm → week-1 device test gate; degrade gracefully (cap chunk entities, merge to piles).
- Parody adjacency (Ramzai/Ramsay, KCAL-9000/HAL-9000, "Michelin") → keep parody generic-enough; legal-safe renames ready (Chef Rage, MEAL-9000, "star ratings").
- Eating/diet humor near real-world eating disorders → guardrails section 1 is a hard rule, reviewed every content drop.
- Solo-dev burnout → week-1 deliverable is a playable toy, not infrastructure; fun floor first, meta second.
