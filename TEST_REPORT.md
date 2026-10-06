# DEAD HAUL Campaign Test Report

Build 2.0.0, tested 5 Oct 2026.

## Environment

Chromium 141 headless via Playwright 1.56 on Linux (CPU canvas, no GPU); desktop 1366x768 keyboard and mouse; phone emulation 844x390 and 932x430 with CDP multi-touch; Node 22 running the game modules without rendering. Not available: physical phones, Firefox, Safari, GPU browsers, audio output, human playtesters.

**Input classes used below.** *Normal input*: the bot only sets the same input intent a player produces (move, aim, fire, interact press/hold, alternate prompts, drive, command); standard loadout, normal damage, no teleports. *State change*: the test edits game state directly (forced death, teleports, injected saves); each such step is marked [state] in the test source.

## Summary

| Suite | Result | Input class |
|---|---|---|
| Campaign bots `tests/campaign.js` (14 route/rescue variants x 5 seeds, fresh save each, no perks) | 70 / 70 complete | Normal input |
| Progression `tests/progression.js` (one save, missions 1-5, replay, failure, v1 migration, mid-run resume) | 51 / 51 | Normal input, plus one forced death [state] |
| Browser campaign flow `tests/campaign-ui.js` (title, board, briefing, play, results, aftermath, ferry cinematic, ending, replay, failure, reload) | 10 / 10, 0 page errors | Clicks + normal-input bot in the page; forced deaths [state] |
| Touch on new missions `tests/mobile-levels.js` (844x390) | 31 / 31 | Real CDP touch on USE, alternate prompt buttons, DROP, FOLLOW/WAIT; positioning by [state] teleports |
| Story and boundedness `tests/story.js` | 32 / 32 | Node |
| Fuzz `tests/fuzz.js` (5 maps x 8 seeds x 4 simulated min, random + directed input) | 0 crashes, 0 invariant violations, peak 48 zombies | Random input, teleports [state] |
| Physics reachability `tools/physreach.js` | Every item, survivor, labelled control, door and exit reachable on all five maps | Static |
| Level One logic / autopilot / acceptance / mobile | 72/72, 10/10, 19/19 browser checks, 3/3 viewports | As in v1 report |
| Performance `tests/perf.js` | Measured (below) | State setup |

## Bot completions (normal input, 5 seeds each)

| Mission | Variant | Result | Time | Exit | Rescued |
|---|---|---|---|---|---|
| 1 | case only, truck | 5/5 | 90-106 s | truck | |
| 1 | case + Nell + generator | 5/5 | 167-199 s | truck | Nell |
| 2 | bay power route | 5/5 | 99-103 s | truck | |
| 2 | service door route | 5/5 | 153-158 s | truck | |
| 2 | power + Tomas | 5/5 | 142-145 s | truck | Tomas |
| 3 | drain A (Low Street) | 5/5 | 124-143 s | truck | |
| 3 | drain B (Canal Lane) | 5/5 | 122-131 s | truck | |
| 3 | Ada + supplies, then A | 5/5 | 155-171 s | truck | Ada |
| 4 | cable trench on foot, broadcast routed | 5/5 | 99-101 s | foot | |
| 4 | switchback road by truck, broadcast off | 5/5 | 204-212 s | truck | |
| 4 | trench + Wes | 5/5 | 137-139 s | foot | Wes |
| 5 | Quay Road + gatehouse | 5/5 | 123-136 s | ferry | |
| 5 | Shed Row + Gate C | 5/5 | 112-124 s | ferry | |
| 5 | Bo by truck, Ines on foot, to the staging pen | 5/5 | 226-243 s | ferry | Ines, Bo |

Bots aim perfectly and know the route, so these prove achievability, not difficulty or pacing.

## Acceptance criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Original level and latest adjustments still work | PASS | Level One logic 72/72, autopilot 10/10, browser acceptance 19/19, mobile 3/3. Acceptance check 3 updated for one intended change: after a first clear the board's main Deploy points at Cold Chain; Mercer is replayed from its card. |
| 2 | Four new, distinct levels playable | PASS | Separate hand-built maps (depot, flooded flats + pump station, hillside relay, ferry terminal); bots complete each by every route. Screenshots `screenshots/ui-m*-start.png`, `m2_cold_wing.png` to `m5_terminal.png`. |
| 3 | Primary, optional, changing encounter, extraction per level | PASS | Bot variants cover each primary, each optional rescue and each route; machine and flood encounters trigger in those runs. Extraction by truck, foot and ferry all exercised. |
| 4 | Full campaign completable in order | PASS | `progression.js` (Node) and `campaign-ui.js` (browser UI, board to ending) both complete 1 to 5 in one save. |
| 5 | Each level completable without optional rescues or earlier optional gear | PASS | Every `campaign.js` run starts from an empty save (no perks); primary-only variants succeed on all five maps. |
| 6 | Unlocks, replay, failure, retry, garage transitions | PASS | Unlock only by primary clear; replay banks scrap without new milestones; forced death leaves completions, milestones and scrap unchanged and Retry returns to the same briefing; results, aftermath and board transitions driven by clicks. |
| 7 | Story acknowledgments reflect outcomes | PASS | `story.js`: aftermath differs with outcomes; generator lit bay vs battery workaround; Marta delivers the depot lead without Nell; nobody unrescued speaks at the garage; ending names only people actually brought home and lists stranded rescues and supplies. Browser run showed outcome-specific lines (for example "You drained Low Street"). |
| 8 | Replays do not duplicate milestones or rewards | PASS | Replay added no milestones, log entries or first-clear changes; a duplicate commit of a finished run id is ignored; Tomas is not respawned once at the garage. |
| 9 | Existing saves migrate | PASS | Fixtures `tests/fixtures/v1-*.json` were produced by the v1 build's own save code (the completed-save fixture uses a synthetic success result passed through v1's commit path). Migrated: scrap and stats kept, Mission 1 complete, Mission 2 unlocked, aftermath queued, written back as v2; a v1 mid-run snapshot restores (Nell mapped) and plays 30 s. |
| 10 | New mission state saves and resumes | PASS | Missions 2-5 saved mid-run through the save path, reloaded in a fresh context: flags, flood gates, items, doors, survivors and machines identical; flood cells rebuilt; play continues. |
| 11 | Nothing can permanently block mandatory completion | PASS (automated scope) | Physics reachability on every map; pump switch refuses to flood a channel the truck stands in and a pedestrian footbridge always exists; heavy cargo can be dropped and re-hauled; locked gates have panels or pry points. Fuzz with directed interaction found no stuck invariant. Exhaustive state-space coverage was not attempted. |
| 12 | Required interactions on keyboard/mouse and phone touch | PASS (emulated) | Keyboard/mouse via the browser campaign flow and Level One acceptance; touch: 31 interactions across missions 2-5 including timed holds, alternate prompts, heavy cargo, loading, rescues and commands. Physical phones not tested. |
| 13 | Rendering, wall fading, aiming, depth sorting readable on every map | PASS (visual review) | Interior and exterior screenshots of every map reviewed: roofs fade over the player, walls cut away, dark cold wing lit by flashlight and emergency lights, ferry depth during boarding. Automated wall-occlusion check exists for Level One only; other maps rely on the shared visibility code and visual review. |
| 14 | Populations, effects and caches bounded across missions and retries | PASS | 25 consecutive runs cycling all maps: no listener growth, one cached world per map, zombies at most 80, messages capped. Browser: 10 map cycles kept particles and decals bounded, sprite cache under its 1400 LRU cap, ground chunks under 40, JS heap 36-43 MB. |
| 15 | One self-contained index.html | PASS | `index.html` 589 KB; no external URLs, scripts or stylesheets. |

## Performance (CPU canvas, 26 zombies awake and chasing)

| Map | 1366x768 render | est. fps | 844x390 @3x render | est. fps |
|---|---|---|---|---|
| Mercer Crossing (42 zombies) | 22.9 ms | 42 | 26.4 ms | 37 |
| Cold Chain | 17.4 ms | 55 | 20.6 ms | 47 |
| High Water | 19.3 ms | 51 | 23.2 ms | 42 |
| Dead Air | 20.0 ms | 49 | 23.4 ms | 42 |
| Last Crossing | 17.7 ms | 55 | 20.1 ms | 48 |

Simulation costs under 1 ms per frame. The first frames on a newly loaded map spike to 160-350 ms while ground chunks and sprites are cached. GPU browsers were not measured.

## Bugs found by testing and fixed

- Contextual alternate prompts (for example "Route the broadcast", the second pump setting, "Recruit Bo") could not be tapped on phones: the aim touch zone sat on top of them. The prompt layer now sits above the touch zones. (Also affected Level One's Repair alternative.)
- A prompt button or number key could run a different action than the one shown when the candidate list reordered between frames (one press entered the truck and exited it again). Presses now carry the id of the prompt that was displayed.
- The "Board the ferry?" dialog stayed on screen over the boarding cinematic.
- The results screen's Title button shared an id with the results heading and did nothing (present since v1).
- Thin props (racks, pipes) were invisible to the navigation grid, so people and zombies pathed into them; a pump-house pipe sealed the control room approach. Thin props now block their tiles; the pipe was shortened.
- Two drums narrowed the only truck lane at the pump station; moved to the wall.
- Long radio line in Last Crossing shortened to under 140 characters.

## Not tested or not proven

- Pacing: the 8-15 minute first-play target is unverified. Bots finish missions in 1.5-4 minutes with perfect routing; human exploration will be slower but was not measured.
- Enjoyment, control feel, difficulty balance and readability for a real player: no human playtest.
- Firefox, Safari, physical phones and tablets, GPU frame rates, audio mix.
- Automated wall-occlusion checks on the four new maps (visual review only).
- Every possible ordering of switches, gates and rescues (covered by representative bot routes and fuzzing, not exhaustively).
