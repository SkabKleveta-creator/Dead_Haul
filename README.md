# DEAD HAUL: Kettle Creek and The Island Line

An original single-player isometric zombie extraction game for the browser. You drive a recovery truck out of the Kettle Creek garage, a roadside shelter for a small community. Ten missions in two campaigns: five take you from one insulin run to an open ferry crossing, five more build a supply line between Kettle Creek and the Island Depot.

Build 3.0.0. One self-contained HTML file, vanilla JavaScript and Canvas 2D. No libraries, CDNs, fonts, network calls, accounts or backend.

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

## The Island Line (missions 6-10)

Unlocks after Last Crossing. Missions start from the Island Depot, Kettle Creek, or both shores, as the board shows.

| # | Mission | Primary | Optional | Changing situation | Decision |
|---|---|---|---|---|---|
| 6 | Landfall, Island Depot | Splice the gate motor, clear the depot yard, park the truck in the depot bay | Cal and Dee in the pier hut; jerry cans | Every gate cycle pulls the yard to the gate; a brute can smash it open from inside | Run the gate early and fight at it, or go in quietly through the side door |
| 7 | Saltworks, North Shore | Desalination membrane (heavy) from the pump hall | Keeper Hale on the lighthouse point; spare filters | High tide at 2:30 floods the low road and the causeway and wakes the sleepers in the pans | The low road before the tide, or the long cliff road past the brutes |
| 8 | Night Ferry, Harbor Street (night) | Light the beacon, hold the ramp until the ferry docks, three medicine crates, drive aboard | Whoever Last Crossing left on the quay | The ferry holds off while the dead stand on the ramp; docking sets off the klaxon | Wall the lanes with the truck, take the skiff out as an outboard decoy, or use the terminal PA |
| 9 | Quarry Road, island interior | Quarry generator, radio mast section (heavy) and relay cable from the pit | Pia and Sol in the weigh station; blasting caps | The crusher is the loudest machine on the island and shriekers answer it | Run the crusher to clear the haul road, or carry the mast up the conveyor gantry by hand |
| 10 | Long Haul, Kettle Creek to Harbor Street | Your truck aboard the ferry with garage equipment | Both trucks aboard; Rosa and Eli ride in the second truck | Open roads depend on earlier choices: Low Street is dry if you drained it in High Water, the Quarry Cut is clear if you ran the crusher; the Ridge Road is always open and watched | Split the generator, clinic cooler and water filters across two beds; pick the road; Marta, Nell or Tomas drives the second truck |

A second ending follows the Long Haul and reflects which trucks, people and equipment crossed.

**New threats.** Brutes (high HP, ignore the crowbar, smash doors, shove the truck), Sleepers (lie dormant in water, wake to splashes, sprinting nearby, close gunfire or damage), Shriekers (scream to call every corpse in range to them; interrupt by hitting them during the wind-up).

**New systems.** Truck fuel on the island missions (jerry cans, refuel at the truck, running dry stops the engine). An outboard skiff on open water (3 units of light cargo; its noise pulls the crowd to the nearest shore). A second truck in the convoy finale that follows your tracks and can be loaded at its tailgate. Night, rain and fog conditions. A weapon locker that keeps one found weapon between missions.

## Replays, modes and medals

- **Replays** of cleared missions can be played at night (x1.5 scrap) and with modifiers: No Truck (x1.5, salvage and on-foot missions only), Ironman (x1.6, no medical or repair kits), Pistol Only (x1.3), Loud World (x1.4). Multipliers stack up to x4. First clears always run as designed.
- **Medals** per mission: bronze for a clear; silver for two and gold for all three of: under par time, 50 damage or less, every optional job. Only better medals replace older ones.
- **Salvage Runs**: endless runs on any cleared map, with caches spread across reachable ground and waves that grow. Leave by road or on foot to bank the haul; die and it is lost. Best per map is kept.
- **Daily Haul**: one seed per date picks a cleared map, caches, conditions and maybe a modifier. Your best per day is kept (last 30 days).

Salvage Runs and the Daily Haul never change the campaign.

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

Island Line unlocks:

| Unlock | Earned by | Effect |
|---|---|---|
| Fuel Bladder | Clear Landfall | Fuel capacity +50% |
| Dock Crew (Cal & Dee) | Rescue the fuel pier workers | Heavy cargo loads in 0.5 s; refueling takes 1 s |
| Desal Plant | Clear Saltworks | Deploy with 1 extra medical kit |
| Lighthouse Watch (Hale) | Rescue Hale | Minimap shows crowds within 30 m for the first 60 s |
| Weapon Locker | Clear Night Ferry | One found weapon type carries over between missions |
| Crusher Gravel | Clear Quarry Road | Brute impacts do 25% less damage to the truck |

Island Line workshop upgrades: Cab Cage (70, clingers take twice as long to grab on), Long-Range Tank (60, fuel use -30%), Floodlight Bar (50, wider night headlights that also draw attention while idling).

## Controls

Unchanged from Level One. Keyboard: WASD move, mouse aim and fire, F crowbar, Shift sprint, R reload, Q swap, E interact (hold E for timed actions), 1 2 3 alternate prompts, X release heavy cargo, G noise maker, H medkit, C Follow/Wait, Tab map, Esc pause. Truck: W/S/A/D, Space handbrake, E exit, Enter depart, V recover. Touch: two sticks, USE, MELEE/DROP, RELOAD, SWAP, HEAL, NOISE, FOLLOW/WAIT; alternate prompts appear as tappable buttons above the controls.

## Saves

- Key `skab.deadhaul.v1`, format v3. A v2 save migrates on load with every field kept (new upgrades start uninstalled, locker, medals and records start empty); invalid v3 fields are dropped. A v1 (Level One) save migrates on first load: scrap, upgrades, settings and stats are kept; a v1 success marks Mission 1 complete, unlocks Mission 2 and queues the Mission 1 aftermath. A v1 run in progress still resumes. No reset is ever needed.
- Story progress (completions, milestones, outcomes, optional checks, aftermaths seen) is stored separately from scrap. Results commit once per run id.

## Source layout and build

`src/` modules are concatenated by `node build.js` into `dist/index.html` (and `dist/artifact.html`); copy `dist/index.html` to the repo root to publish. Level files: `l1.js` (Mercer Crossing), `l2.js` to `l10.js`. Campaign: `story.js` (cast, milestones, perks, aftermath, ending), `story2.js` (Island Line cast, unlocks, aftermath, second ending), `save.js` (v3 and migration), `garage.js` (garage scene), `map.js` (shared map kit). Systems: `fuel.js`, `boat.js` (skiff), `convoy.js` (second truck), `modes.js` (salvage, daily, modifiers, medals).

## Tests

```
node tests/logic.test.js           # Level One logic (72)
node tests/autopilot.js            # Level One primary-only bots
node tests/campaign.js all         # normal-input bots, all ten missions, every route and rescue variant
node tests/progression.js          # one save through missions 1-5 and another through 6-10: replay, night replay, failure, locker, migration, mid-run save/resume
node tests/island.test.js          # Island Line systems: new enemies, fuel, skiff, convoy, conditions, modifiers, medals, daily, salvage, locker, v3 saves
node tests/story.js                # briefing/radio length, outcome-aware aftermath and ending, bounded state
node tests/fuzz.js                 # random + directed input on all five maps
node tools/physreach.js            # every item, survivor, control and exit reachable under real collision
node tests/acceptance.js           # Level One browser acceptance
node tests/campaign-ui.js          # browser campaign flow, board to ending
node tests/campaign2-ui.js         # browser Island Line flow, second ending, night replay, salvage, daily, reload
node tests/mobile-c2.js            # Island Line interactions through touch emulation
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
