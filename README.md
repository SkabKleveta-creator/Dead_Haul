# DEAD HAUL: The Kettle Creek Campaign

An original single-player isometric zombie extraction game for the browser. You drive a recovery truck out of the Kettle Creek garage, a roadside shelter for a small community. Five missions take you from one insulin run to an open ferry crossing.

Build 2.0.0. One self-contained HTML file, vanilla JavaScript and Canvas 2D. No libraries, CDNs, fonts, network calls, accounts or backend.

## Launch

- Open `index.html` in a browser (tested from disk in Chromium 141), or serve the folder (`python3 -m http.server 8080`) for other browsers and GitHub Pages. No other files are needed at runtime.

## The campaign

| # | Mission | Primary | Optional | Changing situation | Decision |
|---|---|---|---|---|---|
| 1 | Mercer Crossing (unchanged) | Medical case from the pharmacy | Nell (survivor), generator | Engine noise, alarm, horde | Truck or foot, how much to carry |
| 2 | Cold Chain, Route 9 Distribution | Refrigeration unit (heavy) + medical stock | Tomas, trapped in Freezer 2; dispatch records | Bay power wakes the compressors; their racket pulls the warehouse crowd toward the machine | Bay power and the near shutters, or the quiet, tight service door |
| 3 | High Water, Low Flats | Restart the pumps + filtration unit (heavy) | Ada and two household supplies on flooded Willow Street | Priming drains one low crossing and floods the other; sump noise draws yard groups into the street | Drain Low Street (A) or Canal Lane (B); signs, map overlay and the console preview which changes |
| 4 | Dead Air, Hollis Ridge | Generator, relay module, call the waterfront | Wes, barricaded in the Dish Hut | The relay restart trips the old automated evac broadcast | Loud switchback road or quiet cable trench; three loudspeaker points; shut the broadcast off or route it downhill to pull the dead off your return |
| 5 | Last Crossing, Harbor Street terminal | Power pack to the ramp house, lower the ramp, open a lane into staging, drive aboard | Ines, Ray, Bo to the staging pen; four supply crates | The ramp klaxon draws the terminal toward the loading lanes, telegraphed by the alarm and June on the radio | Quay Road (direct, exposed) or Shed Row and Gate C (long, sheltered); one passenger seat, so rescues are sequential |

Story runs through short radio lines, environmental notes and a garage aftermath after each first clear. Recurring cast: Marta (garage coordinator), Nell (if rescued), Wes (radio operator, whose situation develops from a distant voice to a rescue or a holdout), Tomas, Ada and June. If Nell was not rescued, Marta carries the depot lead. Optional rescues are never required. The ending shows the truck boarding the ferry and reflects the people, equipment and supplies you brought home; the crossing is a foothold, not the end of the outbreak.

## Mission board

The garage screen is the mission board: current story objective, the people at the garage, all five missions with status, optional checks and best time, Deploy or Replay, and Debrief (replays a mission's aftermath). Missions unlock by primary completion. Failure and retry never touch completed missions, people or equipment. Replays pay scrap and still count anyone you have not rescued yet; first-time story events and unlocks never repeat.

## Rewards

Scrap and the three original workshop upgrades are unchanged. New one-time unlocks, each tied to a story milestone:

| Unlock | Earned by | Effect |
|---|---|---|
| Pallet Jack | Clear Cold Chain | Haul heavy cargo at 70% walking speed instead of 55% |
| Loading Crew (Tomas) | Rescue Tomas | Heavy cargo loads 40% faster |
| Recovery Winch | Clear High Water | Truck repair 2.5 s; stuck recovery reaches farther |
| Garage Medic (Ada) | Rescue Ada | Deploy with 3 medical kits |
| Ridge Relay | Clear Dead Air | Horde warnings 3 s earlier |
| Wes on the Radio | Rescue Wes | Crowd call-outs; deploy with 1 extra noise maker |

New scrap values: medical stock 15, refrigeration unit 40, filtration unit 35, supplies 10 each, power pack 30, pumps 20, relay 60, crossing 60, survivors 25.

## Controls

Unchanged from Level One. Keyboard: WASD move, mouse aim and fire, F crowbar, Shift sprint, R reload, Q swap, E interact (hold E for timed actions), 1 2 3 alternate prompts, X release heavy cargo, G noise maker, H medkit, C Follow/Wait, Tab map, Esc pause. Truck: W/S/A/D, Space handbrake, E exit, Enter depart, V recover. Touch: two sticks, USE, MELEE/DROP, RELOAD, SWAP, HEAL, NOISE, FOLLOW/WAIT; alternate prompts appear as tappable buttons above the controls.

## Saves

- Key `skab.deadhaul.v1`, format v2. A v1 (Level One) save migrates on first load: scrap, upgrades, settings and stats are kept; a v1 success marks Mission 1 complete, unlocks Mission 2 and queues the Mission 1 aftermath. A v1 run in progress still resumes. No reset is ever needed.
- Story progress (completions, milestones, outcomes, optional checks, aftermaths seen) is stored separately from scrap. Results commit once per run id.

## Source layout and build

`src/` modules are concatenated by `node build.js` into `dist/index.html` (and `dist/artifact.html`). Level files: `l1.js` (Mercer Crossing), `l2.js` to `l5.js`. Campaign: `story.js` (cast, milestones, perks, aftermath, ending), `save.js` (v2 and migration), `garage.js` (garage scene), `map.js` (shared map kit: buildings, gates, flood channels, machines).

## Tests

```
node tests/logic.test.js           # Level One logic (72)
node tests/autopilot.js            # Level One primary-only bots
node tests/campaign.js all         # normal-input bots, all five missions, every route and rescue variant
node tests/progression.js          # one save through missions 1-5, replay, failure, v1 migration, mid-run save/resume
node tests/story.js                # briefing/radio length, outcome-aware aftermath and ending, bounded state
node tests/fuzz.js                 # random + directed input on all five maps
node tools/physreach.js            # every item, survivor, control and exit reachable under real collision
node tests/acceptance.js           # Level One browser acceptance
node tests/campaign-ui.js          # browser campaign flow, board to ending
node tests/mobile.js               # touch layout and multi-touch
node tests/mobile-levels.js        # every new-mission interaction through touch emulation
node tests/perf.js                 # frame timing on every map, cache bounds
```

## Asset license

All art, sound and code are original and procedural. No third-party assets, fonts or libraries.

## Install on phones (offline web app)

`manifest.webmanifest`, `sw.js` and `icons/` make the game installable and playable offline. Host the repo root (or `dist/` after `node build.js`) on any HTTPS site, e.g. GitHub Pages, then:

- iPhone/iPad: open the page in Safari, Share, Add to Home Screen.
- Android: open the page in Chrome, menu, Install app (or Add to Home screen).

After the first visit the game runs with no connection. When shipping a new build, bump `CACHE` in `sw.js` so installed copies update.
