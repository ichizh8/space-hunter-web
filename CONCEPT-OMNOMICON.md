# OMNOMICON (working title) — Game Concept v1.1

**Working title:** OMNOMICON (store-checked candidate; "GORB" is occupied on App Store/Steam/GPlay). Protagonist stays **Gorb**.
**Other candidates:** GLUTTON: Bullet Buffet, ЖОР (ZHOR), Косможор, Bon Appocalypse.
**Date:** 2026-07-10. Status: concept v1.1 — post adversarial-critique revision. v1.0 flaws and their fixes are marked inline.
**Team:** solo dev + AI agents. **Platform:** web toy first (itch.io / bare link), then iOS via Capacitor 8 + PixiJS 8 + TypeScript. Portrait, one-thumb.
**Genre:** Vampire-Survivors-like / bullet heaven. A deliberate genre clone with one twist executed to the hilt.

## One-liner

Vampire Survivors, but you EAT the enemies — and you are what you eat: your diet is your build, and your body visibly mutates from what you devour.

## Elevator pitch

Gorb-42 is a bio-engineered garbage-disposal blob from a luxury space liner that developed *taste*, ate the buffet, and escaped. Now, under a court-ordered wellness program administered by KCAL-9000 (a passive-aggressive insurance-company nutritionist AI), Gorb reviews the galaxy one bite at a time. Enemies are food. Kill them, vacuum up the chunks, cook dishes on level-up, mutate from your diet, and when you overeat — release a disaster-classified BURP. Every run ends with a restaurant receipt: an itemized bill of everything you ate. That receipt is the share card.

**Press-kit positioning (per market critique): the differentiator is the presentation trio — the receipt share card, KCAL's incident-report voice, and the Category Burp disaster card. "Eat + mutate" mechanics may have neighbors at launch; nobody else has these three.**

---

## 1. Identity and tone

- **Protagonist: Gorb.** A mute round blob with one giant mouth and dot eyes — the cheapest rig where every diet mutation reads instantly. Never speaks; chews, burps, occasionally screams in font. Gorb is not hunting aliens — Gorb is *reviewing* them (every run ends with a star rating for the galaxy).
- **Ship AI: KCAL-9000 (ККАЛ-9000).** Court-appointed nutritionist installed after "the buffet incident." Wellness-app passive aggression, insurance-adjuster dread. Never yells, files everything: "Chewing detected. Chewing was not authorized."
- **Tone:** diet-culture parody meets cartoon splatter. Violence is culinary (sauce, never blood). Cruelty is verbal. The player is always the butt of the joke.
- **Guardrails (App Store 12+), tightened per critique:**
  - Sauce not blood; burps yes, vomit/fecal no.
  - Jokes punch at bureaucracy, insurance, wellness pseudoscience, fine-dining pretension, and Gorb — NEVER at real bodies, weights, or eating disorders.
  - **Medical Chart uses FICTIONAL diagnoses only** (Stage-4 Snackitis, Chronic Sauce Buildup, Acute Flavor Poisoning) — no real diseases (no "Diabetes"/"Gout").
  - **MEAT-tier flavor is absurd-object comedy** — Gorb becomes a slab, a sphere, a roast — the words "fat" / "получил ожирение" never appear in game or pitch copy. Pitch line is "you become a sphere," not "you get fat."
  - **Legal-safe names are the defaults, not contingencies:** Chef Rage (original catchphrase, no "IT'S RAW"), "Five-Star Hell" (no Michelin), KCAL-9000 (calorie pun, no literal HAL references anywhere, receipt header CHEZ KCAL). No real brands, alcohol, drugs, religion, politics.

## 2. Core loop (moment-to-moment)

One-thumb portrait. Floating joystick (spawns under thumb, dead zone 12px, max throw 80px). **Movement is the only continuous input** — attacks auto-fire, chunks auto-vacuum, level-ups are one tap.

The 3-second loop: steer into a lane → utensils shred enemies → chunks pop out → vacuum pickup (radius 90px, flat all run; JELLY T1 is the only pickup-radius growth) → gulp SFX + tick haptic → meters fill.

- Every common chunk = +1 fullness, +1 XP. **Heal +0.5 HP per chunk only while below 70% HP** (v1.1: prevents facetank-forever; the critic showed unconditional heal nullified all risk).
- Player base: 100 HP, 220 px/s, 20px hitbox, 1080x1920 logical canvas.
- **Fullness meter** (ring around Gorb — the ONLY fullness display, HUD bar deleted per critique): 0–100. Decay: 1/s while intake is healthy, drops to 0.5/s after 10s below 1 chunk/s, pauses entirely during overlays — **mid-run burp cadence never exceeds ~45s** (v1.1: kills the minute-2–5 burp drought).
- **Burp input (v1.1 respec — the old "tap anywhere" fought the joystick thumb):**
  - Default: auto-burp at 100.
  - **Manual (the skill layer): a SECOND touch anywhere fires the burp instantly** — other thumb or finger; the movement thumb is never interrupted, one-thumb purity holds because the second touch is optional. Holding a ready burp to chain into a pack = the opt-in "Gourmand" play.
  - Overflow buffers to 120, auto-releases at 120 (ticks the "Doctor's Warning Ignored" diagnosis).
- Burp: 0.25s windup (Gorb inflates 1.5x), **damage 80 + 8/min of run time** (v1.1: flat 80 stopped mattering by minute 6 vs compounding enemy HP), 350px radius, knockback 400px, 0.2s hit-stop.
- **Category Burp presentation is TIERED (v1.1 — at every-12s late-run cadence the full fanfare was pacing poison):** ordinary burps get a 0.3s micro-punch and a small floating category tag; the full disaster card (slow-mo, decibel meter, "CATEGORY 4 BURP — 47 casualties — felt on 3 moons", 1.5s screenshot pause) plays ONLY on a new personal-best category this run or Category 3+. The meme stays rare enough to screenshot.

## 3. Diet and mutation system (v1.1 — rescaled economy)

Every chunk carries one tag. **v1.0 flaw:** absolute thresholds (30/80/200) vs ~2,700 chunks eaten per run meant every axis triggered by accidental bycatch and all mutation drama ended by minute 3.

**v1.1 thresholds are a SHARE of intake with minimums:**
- **T1 = 20% of intake, min 30 chunks. T2 = 35%, min 150. T3 = 50%, min 300.**
- Bycatch can never trigger an axis you didn't commit to; a mono-diet crosses T3 around minute 6–7 as the run's climax; pivoting diets mid-run stays meaningful (your share shifts).
- Dish tag costs scale with level (base cost x (1 + level/10)) so cooking stays a real spend all run.

**Diet agency loop (v1.1 — auto-vacuum at 150 enemies made diet spawn-table-authored, not player-authored):**
- **Cooking a dish of tag X shifts the spawn table toward X-droppers for 60s ("the kitchen orders more meat")** — build chases diet AND diet chases build. This is the agency mechanism at full horde; steering stays relevant early.
- Rare and VOID chunks are NOT vacuumed — you must steer over them. High-value eating stays a choice.

| Axis | T1 (20%/30) | T2 (35%/150) | T3 (50%/300) |
|---|---|---|---|
| **MEAT** | +15% dmg, +10% size | +35% dmg, −10% speed, footstep thuds | +70% dmg, −20% speed, waddle contact dmg 10/s; a sweating roast with tiny legs |
| **SPICE** | attacks burn 2/s 3s; skin reddens | +20% atk speed, fire trail | burp = firestorm leaving burning ground; head on fire |
| **JELLY** | body wobbles, +10% pickup radius | projectiles bounce off screen edges; you bounce off walls | 25% chance to no-sell a hit ("boing", 0.5s i-frames); translucent body |
| **SUGAR** | +10% speed, sparkle trail | +15% crit; crits pop enemies into 2x chunks | every burp grants 3s x2 atk-speed sugar rush |
| **VOID** (risk) | see below | pierce +1, +15% dmg taken | double damage dealt AND received; eyes and tentacles |

**VOID specified precisely (v1.1 — old "3x fullness/XP" was either dominant or dead):** only VOID chunks give 3x fullness/XP; each pre-detonation Rotten Egg kill drops 4–6 VOID chunks; **VOID chunks bypass the heal and cost −1 HP each to eat.** The risk is real, the supply is farmable by skill (killing Eggs before detonation), neither reading degenerates.

Crossing a threshold plays a 2s **Final Form reveal** with a name card ("YOU HAVE BECOME: THE SPHERE") and KCAL recoiling. Diet vector maps to scale/wobble/tint/trail — dozens of silhouettes, no two clips alike.

## 4. Level-ups are DISHES; weapons are UTENSILS

- **Utensils** (permanent slots, max 4): Fork (starter stab), Cleaver (arc), Pepper Grinder (radial shotgun), Blender (orbitals), Skewer (pierce line), Ladle (lobbed AOE). 5 dish-driven levels each; **L5 gates on a diet tier** (Cleaver L5 "Butcher's Special" needs MEAT T2) — cross-referencing synergies, not flat stats.
- **Dishes** (level-up cards): XP level N costs 5+8N chunks (~25 levels/run). 3 cards slide into the bottom 50% (thumb zone), cooked FROM THIS RUN'S EATEN TAGS. Spending does NOT lower threshold shares (two ledgers — see HUD note). Offers weighted by actual diet. Mix: 60% utensil upgrades / 30% passives / 10% wild. **Zero-cost "Leftovers" tier always exists** (soggy card art, KCAL sighs) — never a dead level-up.
- **Two-ledger UI (v1.1):** the diet pie (top-right) shows SPENDABLE tags, with tiny pips on each slice marking lifetime threshold progress. Taught once by a scripted KCAL bark at the first tag-costed dish: "Your stomach remembers what your wallet spends. Unfortunately."
- Dish discovery = collection: first cook inscribes it in the Recipe Book forever (+ tiny permanent bonus).

## 5. Enemies (foods) and bosses (rival chefs)

Naming formula: food x sci-fi suffix. Launch 10: Snacklings (popcorn fodder), Meatoids (chargers), Gelatoids (bouncing splitters), Peppergeists (spicy ranged ghosts), Sugar Wisps (flee-bait orbiters), Angry Broccoli (tanky knockback-immune; "eat your vegetables"), Rotten Egg (telegraphed detonator; VOID source if killed pre-detonation — the priority-target skill check), Cheese Swarm (packs of 8, surround), Gravy Ooze (elite, damaging slick), The Ribeye (elite, charging meat wall; death rains 15 MEAT — deliberate build-warper).

Bosses: v1 ships 2 — **Chef Rage** (four arms, flying cleavers, screams an original catchphrase at your mutations, throws raw meat you can eat mid-dodge) and **Grandma Umami, the Eternal Broth** (sentient stockpot, ladle telegraphs; her chunks are the game's only balanced meal). Later: **Le Grand Gateau** (wedding-cake mimic, HP bar IS the cake layers) and **The Health Inspector** (final boss, only non-food entity; grades your run "F" pre-fight; drops a clipboard, "tastes like paperwork and disappointment").

## 6. Run structure and difficulty (v1.1 — scheduled middle)

- **8:00 standard run**, boss at 8:00, win = extraction, receipt prints. Concurrent: ~15 (min 1) → 60 (min 4) → 150 (min 8). HP +12%/min, count +25%/min.
- **The middle is scheduled content, not dead air (v1.1):** The Ribeye set-piece at 3:30 (guaranteed build-warper), "lunch rush" scripted surge with doubled chunk density at 4:30, Gravy Ooze at 5:00. With decay tapering, the burp cadence floor (~45s) holds through the middle. Mutation climax (mono-diet T3) lands minute 6–7 by design.
- **Scripted-generous first session:** first 3 kills drop 3 chunks each; first level-up by 0:20; elite chest at 1:30 gives a second utensil; first burp-wipe ~0:35; first T1 mutation ~1:00 (min-30 floor makes this reachable). Learn move/eat/cook/burp/mutate with zero tutorial screens.
- **First 60 seconds:** boot cold-opens into Run 1 (no title first launch). Ship crash → KCAL: "Supplies destroyed. Recommendation: eat the locals." → joystick hint under thumb → first kill at 10s bursts into glowing chunks → scripted level-up ~20s (2 cards, both good) → wave fills stomach → "SECOND FINGER TO BURP" hint once → wipe at ~35s → first mutation ~50s → KCAL: "That is... a choice."
- Push-notification permission: only after the first burp-wipe. Never at boot.

## 7. Meta: the diner IS the recipe book

- **The Greasy Nebula** — your diner at the end of the galaxy, the single between-runs scene. Discovered dishes physically appear on its menu board and tables. Collection front and center: "Menu: 23/60."
- **One currency: Grease (GRS).** Bill converts 1 GRS per 100 kcal (same rate win or lose). Sinks: 6 diner stations (Grill, Fryer, Freezer, Spice Rack, Bar, Jukebox), Lv1–5, fixed slot costs (100/250/600/1500/4000); levels 1–4 honest small bonuses, **every L5 a mechanic-bearing capstone** (Grill L5: burps leave 3s fire pools; Freezer L5: one dish carries into the next run; Jukebox L5: +20% hit-stop juice). 2 extra characters at 2k/6k GRS. Total sink ~32k; a run yields 300–600.
- **Meta power budget is arithmetic, not aspiration (v1.1 — v1.0's line items summed to +80%+ against a claimed +35% cap):** diagnoses average **+0.4–0.6% effective each, bucketed into non-stacking stat groups**; stations Lv1–4 total ≤12%; chores ≤5%. Hard cap +35% total; the budget sheet is written before content, content fits the sheet.
- **Medical Chart** (quest board): KCAL's patient file; 40 permanent fictional "diagnoses", every one a small forever-bonus. Stage-4 Snackitis (eat 100 sweets → +0.5% crit), Chronic Sauce Buildup (200 meat → +0.6% dmg), Iron Stomach (25 rotten chunks → rot immunity), Vitamin Deficiency (die 10 times → start with a free dish), Terminal Gluttony (eat 10,000 chunks → +1% everything, unlocks "KCAL Silent" toggle).
- **Health Code Violations** (post-win Ascension, 10 stacking named modifiers): Rats in the Kitchen (+25% count) → Expired Stock (chunks rot faster) → Understaffed (2 dish choices) → Health Inspector Visit (mid-run elite that EATS YOUR CHUNKS) → ... → **Five-Star Hell** (everything; gold-foil receipt). Each win stamps a framed notice on the diner wall.
- **Failure = Doggy Bag:** death loses nothing — full GRS conversion, all discoveries persist, dying advances its own diagnosis. No wasted runs.
- **Deliberately absent:** energy, forced ads, grind wall (Violation 5 beatable on week-2 meta), upgrade regret, streak punishment.
- Content: ~9–12 hours to 100%; Daily + leaderboards as the infinite tail; v1.1 content (+1 planet, +30 recipes) before the tail dries.

## 8. Screens and navigation

Depth rule: everything ≤2 taps from Title. Map: Title → {Run, Galley} → {Cookbook, Medical Chart, Daily, Leaderboard, Settings, Receipt}. Touch targets in bottom 55%; top 20% read-only; X-to-close bottom-left; swipe-down closes overlays; left-hand mirror mode.

1. **Boot** <2s; first launch cold-opens into Run 1.
2. **Title:** logo, mascot mid-chew, giant EAT button; Daily/Cookbook/Chart/Leaderboard arc; red dot + streak on Daily.
3. **Galley** (pre-run): character carousel, starting utensil, biome pick, bonus summary, START RUN; one KCAL bark per visit.
4. **Run:** floating joystick; top strip timer/HP/kcal; fullness ring on Gorb; diet pie (spendable + threshold pips) top-right; dish overlay in bottom 50%.
5. **Receipt** (results) — THE screenshot: thermal receipt prints line by line with sound+haptics. CHEZ KCAL — "WE SERVE WHAT YOU KILL"; itemized eats (max 12 lines then "...AND 6 MORE REGRETS"); dishes with star ratings; FINAL FORM line; burps + casualties; SUBTOTAL in kcal = score; "TIP: your corpse"; KCAL one-liner from a 40-line table; barcode encoding seed+score. SHARE / RETRY / Galley.
6. **Cookbook:** Dishes / Ingredients (bestiary as a menu with prices) / Mutations (body gallery); silhouettes + hints.
7. **Medical Chart:** claimable diagnosis cards, CLAIM ALL.
8. **Daily "Dish of the Day":** modifier card, one scored attempt (retries stamped "* REHEATED"), countdown; friend codes v1.1.
9. **Leaderboard:** Daily / All-time; your row pinned.
10. **Settings:** music, SFX, haptics, shake, damage numbers, reduced-splatter, colorblind palettes (flavor colors get icon shapes — gameplay-critical), joystick fixed/floating, left-hand, auto-burp/second-finger burp, language EN (RU at RU-launch), **cloud save row only if CloudKit KV plugin is actually built** (no promise-labels without infrastructure), reset (double confirm).

Haptic map (locked): chunk tick (light), dish commit (medium), threshold crossed (heavy+rumble), burp (heavy double), death (heavy), receipt TOTAL stamp (medium), daily rank reveal (light).

## 9. Virality systems

- **Receipt PNG:** offscreen canvas → 1080x1920 → `@capacitor/share`. Thermal font, torn edge. ~1 day, zero art dependencies.
- **Emoji line** (Wordle-style, spoiler-free): `OMNOMICON Daily #37 🍽️ 9:42` / `🍖🍖🍖🍖🌶️🌶️🍮💀 23,840 kcal` / `🤢 KCAL says: concerning`
- **Daily Special:** seed = hash(YYYYMMDD) → deterministic waves, fixed 12-dish menu (forces off-build play), modifier. Client-side. **Leaderboard integrity minimum (v1.1):** per-seed max-kcal plausibility cap derived from the seed + obfuscated submission signing; accept GC softness, or pull the Cloudflare Worker forward if the daily takes off.
- **Leaderboards v1: Game Center** (recurring daily kcal + all-time) — **plugin capability is a WEEK-1 spike, not a week-3 assumption (v1.1):** verify @openforge/capacitor-game-connect on Capacitor 8 actually submits to recurring leaderboard occurrences in sandbox; fallback is a ~100-line own Swift plugin (GKLeaderboard.submitScore + loadEntries).
- **Clip engines (3):** Category Burp (tiered); Final Form reveal; KCAL subtitle captions baked into gameplay (clips work with sound off). No in-game recorder.
- **Seeding (v1.1 — channels that actually cover mobile):** TouchArcade, Pocket Gamer, r/iosgaming launch post, mobile-roguelite YouTubers as the CORE; the 25 PC-centric VS creators get the WEB build link (they will never install TestFlight) as a bonus channel. 3 self-posted Shorts/week ("I made a game where..."). Share prompt fires exactly once, after first personal-best daily.
- **Game Center achievements (12, meme-named):** First Burp; Became A Sphere; Vegan Run; Perfectly Balanced; Ate 1,000; Ate 10,000; Died Of Natural Causes; Speed Eater; Picky Eater; Food Critic; Regular; KCAL Approved.

## 10. Go-to-market (v1.1 — restored web-first playbook)

- **Step 0: the web toy ships FIRST.** The week-1–2 vertical slice goes up as a web build (itch.io or a bare link; CrazyGames later if it travels). It proves the 3-second clip spreads and creators bite BEFORE App Store review, signing, and TestFlight cycles. PixiJS+TS makes this free; cutting it was ideology, not economics.
- **Money model decided before pre-production ends (open decision, two sane defaults):** (a) $2.99 premium, VS-precedent; (b) free + one "supporter pack" cosmetic IAP + optional rewarded revive, with written triggers (e.g. D7 > 8% → expand IAP). **Blocker to resolve NOW: Apple Developer account jurisdiction — an RF-registered account cannot receive payouts; if applicable, set up the account in another jurisdiction before any monetization planning.**
- **App Store:** Name: OMNOMICON (subtitle "Eat monsters. Mutate. Survive."). Keywords: survivor, roguelite, bullet heaven, horde, eat, food, mutant, arcade, offline. Description in-character by KCAL-9000 as a nutrition label. **Screenshots: Sphere transformation FIRST, receipt second, burp gameplay third; budget 2–3 days for a 15-second app preview video — the only place "you EAT them" is visible pre-install.** Featuring pitch 6 weeks pre-launch: "the one-thumb roguelite where your diet is your build."
- **Localization: EN-only through TestFlight; RU is a scheduled 3–4 day authored-comedy pass before public launch** (string architecture is JSON from day one, so this is content work, not engineering).
- Rating 12+: cartoon violence, crude humor.

## 11. Tech and architecture

- **Fresh private repo.** TypeScript + PixiJS 8 (`preference: 'webgl'`) + Capacitor 8, static bundle in binary.
- **Space Hunter is a code donor, not just a pattern donor (v1.1):** lift the joystick/touch module, sprite pooling, save-mirror pattern, and DamageFloaters wholesale — they are tested modules, reuse saves ~a week.
- Everything data-driven JSON: enemies, dishes, diagnoses, violations, barks, copy tables.
- **Performance: the BURP FRAME is the benchmark, not the steady-state horde (v1.1).** Week-1 architecture, not fallback: staggered kill queue (burp deaths spread over 3–4 frames — reads as a wave, hides the spike), live chunk cap ~200 with overflow merging into "pile" entities, preallocated pools sized to burst, spatial hash for enemy queries from day one. Target: locked 60fps on iPhone 12 during a Category 4 burp at minute 8.
- **Body composite: validate before committing art (v1.1).** 1-day paper + throwaway-scene prototype of the layering matrix; v0 scope is 2 axes x 3 tiers = 6 authored looks (scale + tint + one accessory); "wobble" is a cheap sinusoidal vertex scale, not a custom shader; JELLY T3 translucency deferred.
- Saves: Zustand persist + mirror every write to Capacitor Preferences; restore from native on boot. CloudKit KV plugin is its own scheduled task (2–3 days) or the iCloud settings row doesn't exist.
- SFX via native audio plugin from day one; music on Web Audio.
- **Store/DevOps in week 1:** App Store Connect record, provisioning, and one throwaway TestFlight build in the first 3 days — ship day is a rebuild, not a first encounter with code signing.

## 12. Schedule (v1.1 — honest relabeling)

**The 4-week calendar ships a 2-axis vertical slice on TestFlight, not v1. Full v1 is 8–10 weeks.**

- **Week 1 — the toy (and the web build):** repo, Capacitor scaffold, ASC record + throwaway TF build, lifted Space Hunter modules; arena, 3 enemies, Fork+Cleaver, chunks/vacuum/fullness, burp with staggered kill queue, XP/dish overlay with 10 dishes, MEAT+SPICE axes (6 authored looks). GC plugin spike. **Deliverable: the 3-second clip exists, and it is playable in a browser.**
- **Week 2 — the slice:** 6–8 enemies, elite + Chef Rage, 8-min curve with scheduled middle (Ribeye 3:30 / lunch rush 4:30), receipt screen + share, doggy bag, first-60-seconds script, device perf gate (burp frame @ iPhone 12). **Deliverable: TestFlight slice + web build to PC creators.**
- **Weeks 3–4 — the game:** remaining axes + utensils + enemies, boss 2, diner scene, Recipe Book (launch target 20 dishes), Medical Chart (12 diagnoses), Grease + 3 stations, Daily Special, Game Center, settings, haptics map, 40 KCAL barks (EN), Category Burp tiered presentation, Final Form cards.
- **Weeks 5–8 — to v1:** content fill (60 dishes / 40 diagnoses / 6 stations / 10 Violations / boss 3–4 / 100+ barks), RU authored pass, app preview video, store assets, featuring pitch, creator seeding, launch.
- **Cut from v1 (explicit):** friend table codes (v1.1), weekly modifiers, ghost runs, clip recorder, localization beyond EN+RU, Android port, IAP beyond the chosen model.

## 13. Open decisions (owner input needed)

1. **Title.** OMNOMICON recommended (distinctive, self-describing, searchable); GORB is occupied. Trademark/store check this week.
2. **Money model.** Premium $2.99 vs free+supporter-pack. Depends on №3.
3. **Apple Developer account jurisdiction** — resolves payout viability; blocks monetization planning.
4. **RU timing** — EN-first is the plan; RU authored pass scheduled pre-public-launch or v1.1?
5. **Web toy distribution** — bare link for creators only, or public itch.io page from week 2?

## 14. Critique log (v1.0 → v1.1)

Three adversarial reviews (fun/coherence, scope/feasibility, market/store) produced: threshold economy rescaled to diet-share (bycatch bug, minute-3 climax bug); spawn-table feedback loop for diet agency; burp respec to second-touch; VOID made genuinely risky (−1 HP/chunk, no heal, farmable via Rotten Eggs); heal tapered below 70% HP; Category Burp fanfare tiered; mid-run scheduled (Ribeye/lunch rush/decay taper); two-ledger HUD resolved (ring + pie with pips); meta power budget made arithmetic (+0.4–0.6% per diagnosis, bucketed); schedule relabeled (4 weeks = slice, v1 = 8–10 weeks); Space Hunter modules lifted as code; burp-frame perf architecture moved to week 1; GC plugin spike moved to week 1; iCloud promise removed unless built; content targets cut for slice (20/12/3/40 EN); web-first restored; seeding rebuilt around mobile channels; fictional diagnoses; absurd-object MEAT comedy; legal-safe names as defaults; GORB renamed (store collisions); store assets reordered + preview video budgeted; daily leaderboard integrity minimum added.
