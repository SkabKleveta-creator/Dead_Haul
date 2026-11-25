# DEAD HAUL Expansion Plan

Base: build 2.0.0 (Kettle Creek Campaign, five missions). This plan takes the game from that build to a second campaign, more replay value and store releases. Each phase ships on its own and keeps the game playable.

## Implementation status (build 3.0.0)

| Phase | Status |
|---|---|
| Phase 0: release and playtest | Deferred. Offline/installable files (manifest, service worker, icons) are in place; publishing, feedback form and device pass not started. |
| Phase 1: systems | Done. Brute, Sleeper, Shrieker; truck fuel and jerry cans; night, rain and fog; outboard skiff; second truck (convoy); weapon locker; two bases; save v3 with v2 migration. |
| Phase 2: The Island Line | Done. Missions 6-10 (Landfall, Saltworks, Night Ferry, Quarry Road, Long Haul), aftermath scenes, second ending, six unlocks, three workshop upgrades. |
| Phase 3: replay modes | Done. Night replays, four modifiers, medals, Salvage Runs, Daily Haul. |
| Phase 4: store releases | Not started. |

Decisions taken while building: Campaign 2 is the island continuation; fuel applies only on the Island Line missions; release model (free or paid) is still open.

## Where the game stood before this expansion

- Five hand-built missions, from the Mercer Crossing insulin run to the Harbor Street ferry. The ending says the crossing is "a foothold, not the end", which leaves room for a sequel campaign.
- Systems in place: noise-driven AI with four enemy types (drifter, runner, howler, clinger); truck driving, clingers and recovery; 6-unit backpack and truck bed; heavy cargo; survivors who follow or wait; machines and flood channels; a mission board, aftermath scenes, scrap, three workshop upgrades and six story unlocks.
- Weapons: pistol, shotgun, SMG and lever rifle. Weapons found on a mission stay on that mission.
- Proven by automated tests (bots, fuzzing, reachability, migration, touch emulation). **Not yet proven:** pacing, difficulty, how the controls feel to a person, Safari, physical phones and the audio mix. There has been no human playtest.
- Technical: one self-contained `index.html` (589 KB); 17-23 ms per frame on a CPU canvas; 160-350 ms stalls on the first frames of a newly loaded map.

## Phase 0: Release and playtest (do first)

Goal: real players on the current build before adding content, so new missions are tuned against real data.

| Task | Detail |
|---|---|
| Publish | GitHub Pages from `main` (installable web app is already wired). itch.io HTML upload: mobile friendly, landscape, fullscreen button. |
| Playtest feedback | Short form linked from the results screen and the itch.io page: mission, time, deaths, "where did you get stuck", device. |
| Local run stats | Store per-run time, deaths, retries, route chosen, rescues and exit type in the save (no network). Add an "Export stats" button in Settings that copies a JSON blob for testers to paste into the form. |
| Device pass | iPhone Safari (installed and in the browser), one mid-range Android phone, iPad. Check audio unlock, safe areas, touch zones and save persistence after the app is closed. |
| First-frame stall | Pre-cache ground chunks and sprites behind the briefing screen so the 160-350 ms spike happens before play starts. |

Exit criteria: at least 10 outside playthroughs of missions 1-5; median first-play time recorded per mission; top 5 friction points fixed.

## Phase 1: Systems for new content

New missions need a few new tools so they don't repeat missions 1-5.

### New enemy types (added to `DH.ZTYPES`)

| Type | Behavior | Counter |
|---|---|---|
| Brute | Slow, high HP, breaks barricades and doors in one hit, knocks the truck off line on impact. | Avoid, or several rifle shots; can't be staggered by the crowbar. |
| Sleeper | Lies dormant in water or debris; it wakes from nearby splashes and sprinting, not from distant gunfire. | Walk, don't run; the noise meter shows the splash threshold. |
| Shrieker | Variant of the howler that calls a crowd to a fixed point after the alarm. Pairs with the existing horde system. | Kill before its wind-up ends, or use a noise maker to pull the crowd elsewhere. |

### New mechanics

| Mechanic | Detail |
|---|---|
| Fuel | The truck uses fuel while moving and idling. Jerry cans are 1 unit of cargo. Running dry leaves the truck where it stopped. It doesn't apply to missions 1-5. |
| Time of day | Dusk and night variants: shorter sight lines, flashlight cone (cold-wing lighting code already exists), louder ambient groans. Night replays pay 1.5x scrap. |
| Fog and rain | Rain masks footsteps (noise radii x0.7) and also hides groan cues. Fog cuts the minimap to the area nearby. |
| Boat | Small outboard for the island campaign: drives like the truck on flood-channel water; cargo 3 units; outboard noise equals the truck's idle noise. |
| Weapon locker | Unlock that lets one found weapon type carry over between missions (ammo still resets to the standard kit). |
| Two bases | Kettle Creek garage and the Island Depot. Each mission starts from one of them; both show on the mission board. |

### Save format v3

- Add `campaign2` beside the existing campaign state: completions, milestones, outcomes, bases and the weapon locker.
- Migrate v2 saves automatically, keeping every v2 field. Mission 6 unlocks only after the ferry ending has been seen.
- Extend `tests/progression.js` with v2 to v3 migration and a mid-run resume on each new map.

## Phase 2: Campaign 2, "The Island Line" (missions 6-10)

Setting: the island the ferry reached. June's waterfront crew holds the Island Depot. The supply line back to Kettle Creek has to be built mission by mission. Cast carries over: Marta, Nell, Tomas, Ada, Wes and June, plus whoever was rescued at Harbor Street (Ines, Ray, Bo). Outcomes from missions 1-5 change briefings and aftermaths (for example, if Wes was rescued he runs island radio; otherwise June does).

| # | Mission | Primary | Optional | Changing situation | Decision |
|---|---|---|---|---|---|
| 6 | Landfall, Island Depot | Clear the depot yard, restore the gate motor, park the truck inside | Two dockworkers on the fuel pier; fuel drums (introduces fuel) | The gate motor is loud; every cycle pulls the yard crowd to the gate | Hold the gate open for the truck (loud) or bring cargo in on foot through the side door |
| 7 | Saltworks, North Shore | Desalination membrane (heavy) from the saltworks | Keeper Hale in the lighthouse; spare filters | Tide timer floods the lower works partway through the mission; Sleepers wake in the water | Go early through the lower works, or late along the cliff road (longer, exposed to Brutes) |
| 8 | Night Ferry, both shores | Escort the ferry's second run: hold the Harbor Street ramp until it docks, then load medical stock from Kettle Creek | Return run for anyone left on the quay in mission 5 | Night mission; the ramp klaxon repeats every docking cycle | Defend the ramp with the truck as a wall, or lead the crowd away with the boat's outboard |
| 9 | Quarry Road, island interior | Power the quarry's crusher plant and recover the radio mast parts | A family barricaded in the weigh station; blasting caps | Crusher noise is the biggest noise source in the game; Shriekers call crowds to it | Run the crusher to clear the road (loud, fast) or haul the parts out by hand along the conveyor gantry (slow, quiet) |
| 10 | Long Haul, mainland convoy | Drive a two-truck convoy from Kettle Creek to the ferry with the garage's equipment; at least one truck boards | Everyone at Kettle Creek who chose to stay | Route events depend on choices in missions 6-9 (drained roads, relay status, quarry road open or not) | Who drives the second truck, what each truck carries, which route |

Ending 2: Kettle Creek and the Island Depot are linked by a working supply line. The final lines reflect which people and equipment are on each side of the water.

### New unlocks

| Unlock | Earned by | Effect |
|---|---|---|
| Fuel Bladder | Clear Landfall | Truck fuel capacity +50% |
| Dock Crew | Rescue the fuel pier workers | Cargo transfer to the truck bed is instant |
| Desal Plant | Clear Saltworks | Deploy with 1 extra medical kit from either base |
| Lighthouse Watch (Hale) | Rescue Hale | Minimap shows crowds within 30 m for the first 60 s |
| Crusher Gravel | Clear Quarry Road | Truck takes 25% less damage from Brute impacts |
| Weapon Locker | Clear Night Ferry | One found weapon type carries between missions |

### New workshop upgrades

| Upgrade | Cost | Effect |
|---|---|---|
| Cab Cage | 70 | Clingers take twice as long to reach the cab |
| Long-Range Tank | 60 | Fuel use -30% |
| Floodlight Bar | 50 | Night missions: wider light cone from the truck; light also draws attention (noise-like pull at idle) |

## Phase 3: Replay modes

| Mode | Detail |
|---|---|
| Salvage Runs | Endless mode on any cleared map using the existing seeded RNG (`DH.RNG`): random cargo spots, survivor and horde timing; bank scrap or lose the haul. |
| Daily Haul | One seed per date for everyone, with a local best score. No server needed; a shared seed gives the same run. |
| Modifiers | Toggle at the board: No Truck, Ironman (one life per mission), Pistol Only, Loud World (all noise x1.5). Each adds a scrap multiplier. |
| Mission medals | Bronze/silver/gold per mission for time, damage taken and optional jobs. Shown on the mission board. |

## Phase 4: Store releases

| Step | Detail |
|---|---|
| Android | Wrap with Capacitor; Play Console (one-time $25); internal testing track first, then open testing; APK also offered on itch.io. |
| iOS | Capacitor + Xcode on a Mac, or a cloud build service (Codemagic). Apple Developer Program ($99 per year); TestFlight beta, then App Store review. |
| Store assets | Icon set from `icons/`, 5-8 screenshots per platform from `screenshots/`, a 30-second gameplay trailer, privacy policy (the game collects no data). |
| Native extras | Haptics on hits and truck impacts, locked landscape orientation, keep-screen-awake during missions, save backup to device storage. |

## Technical plan

- **Files:** `src/l6.js` to `src/l10.js` (maps), `src/story2.js` (campaign 2 cast, milestones, aftermath, ending 2), `src/fuel.js`, `src/boat.js`; add them to `ORDER` in `build.js`.
- **Shared map kit:** extend `map.js` with tide water, cliff paths, piers and conveyor gantries.
- **Size budget:** keep `index.html` under 1.2 MB. All art stays procedural. If maps push past the budget, load campaign 2 levels as a separate cached file through the service worker.
- **Performance budget:** at most 25 ms per frame at 844x390 on a CPU canvas with 30 awake zombies; no first-frame stall over 100 ms after the Phase 0 pre-cache.
- **Tests per new mission**, matching the current suites:
  - campaign bots for every route and rescue variant (5 seeds each)
  - reachability check (`tools/physreach.js`)
  - fuzz run
  - touch emulation of every new interaction
  - save and resume mid-run
  - story test for each outcome branch
- **Service worker:** bump `CACHE` in `sw.js` with every release.

## Sequence and size

| Order | Work | Size |
|---|---|---|
| 1 | Phase 0: publish, feedback form, local stats, device pass, first-frame stall | S |
| 2 | Phase 1 systems: Brute, Sleeper, Shrieker, fuel, save v3 | M |
| 3 | Missions 6 and 7 + their unlocks; release as an update | L |
| 4 | Time of day, weather, boat | M |
| 5 | Missions 8-10, ending 2, workshop upgrades; release | L |
| 6 | Phase 3 replay modes | M |
| 7 | Phase 4 Android, then iOS | M |

S = days, M = 1-2 weeks, L = 3-5 weeks of focused work.

## Decisions needed

1. Campaign 2 setting: the island continuation above, or a different direction.
2. Fuel: required in every new mission, or only in specific ones.
3. Free update or paid expansion, which affects the store setup in Phase 4.
