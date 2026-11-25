// Campaign progression, persistence and migration.
// Section A plays missions 1-5 in ONE save with the normal-input bots (tests/campaign.js), including a replay and a failure.
// Section B loads genuine v1 save blobs (tests/fixtures, produced by the v1 build) and checks the migration.
// Section C snapshots every new mission mid-run, writes it through Save, reloads it in a fresh context and keeps playing.
// Section D plays the Island Line (missions 6-10) in one save; section E snapshots each Island Line map mid-run.
// Lines marked [state] use a direct state change (documented); everything else is normal input only.
const fs = require('fs');
const { load, blankInput } = require('./harness');
const C = require('./campaign');
let pass = 0, fail = 0;
const rows = [];
const ok = (cond, name) => { if (cond) pass++; else { fail++; console.log('FAIL', name); } rows.push([cond ? 'PASS' : 'FAIL', name]); };

// ---------------- A. one save, five missions ----------------
{
  const store = {};
  const ctx = load({ store, seedMath: 11 }); const DH = ctx.DH, G = DH.G; DH.Save.load();
  const st = () => DH.Save.data.campaign.story;
  ok(DH.Story.current(st()) === 1 && !DH.Save.unlocked(st(), 2), 'fresh save: mission 1 current, mission 2 locked');
  ok(/insulin/i.test(DH.Story.objective(st())), 'fresh save: story objective names the clinic insulin');

  const play = (level, variant, seed) => { const r = C.runLevel(ctx, level, C.S[level][variant], { seed, variant }); return Object.assign(r, { result: G.lastResult }); };

  const r1 = play(1, 'full', 1);
  ok(r1.status === 'success', 'M1 Mercer Crossing completed with case + Nell + generator (bot, normal input)');
  ok(st().completed[1] && DH.Save.unlocked(st(), 2) && !DH.Save.unlocked(st(), 3), 'M1 clear unlocks M2 only');
  ok(st().milestones.nell && st().milestones.generator, 'M1 milestones recorded: Nell at the garage, generator');
  ok(st().seen[1] === false, 'M1 aftermath queued (seen=false)');
  const af1 = DH.Story.aftermath(1, st());
  ok(af1.lines.some((l) => /generator/i.test(l.text) && /running/i.test(l.text)) && af1.lines.some((l) => l.who === 'nell') && af1.next === 2, 'M1 aftermath acknowledges the generator, Nell delivers the depot lead, points to M2');
  st().seen[1] = true; DH.Save.write(); // [state] the aftermath screen sets this flag when dismissed

  const scrap1 = DH.Save.data.campaign.scrap;
  const r2 = play(2, 'rescue', 2);
  ok(r2.status === 'success' && r2.survivorsOut.indexOf('tomas') >= 0, 'M2 Cold Chain completed with Tomas rescued');
  ok(st().milestones.tomas && st().milestones.refrigeration && DH.Save.unlocked(st(), 3), 'M2 milestones (tomas, refrigeration) and M3 unlocked');
  const pk = DH.Story.perks(st());
  ok(pk.jack && pk.crew && !pk.winch, 'perks after M2: Pallet Jack + Loading Crew only');
  ok(DH.Save.data.campaign.scrap > scrap1, 'M2 scrap banked');

  // replay M2: rewards bank again, narrative does not duplicate
  const logLen = st().log.length, ms = JSON.stringify(st().milestones), first = st().firstClear[2], scrap2 = DH.Save.data.campaign.scrap;
  const r2b = play(2, 'power', 3);
  ok(r2b.status === 'success', 'M2 replay (power route) succeeds');
  ok(JSON.stringify(st().milestones) === ms && st().log.length === logLen && st().firstClear[2] === first, 'replay adds no milestones, log entries or first-clear changes');
  ok(DH.Save.data.campaign.scrap > scrap2, 'replay still banks scrap (replay reward)');
  ok(!G.lastRun.survivors.some((s) => s.id === 'tomas'), 'replay: Tomas (already at the garage) is not respawned at the depot');
  ok(r2b.result && !r2b.result.duplicate, 'replay result committed once');
  // committing the same run id twice is a no-op
  const before = DH.Save.data.campaign.scrap;
  ok(DH.Save.commitResult(r2b.result.runId || G.lastRun.id, r2b.result) === false && DH.Save.data.campaign.scrap === before, 'duplicate commit of a finished run id is ignored');

  const r3 = play(3, 'rescue', 4);
  ok(r3.status === 'success' && r3.survivorsOut.indexOf('ada') >= 0, 'M3 High Water completed with Ada and the supplies');
  ok(st().milestones.water && st().milestones.ada && DH.Save.unlocked(st(), 4), 'M3 milestones and M4 unlocked');
  ok(st().optional[3] && st().optional[3].ada && st().optional[3].supplies, 'M3 optional checks recorded on the mission board data');

  // failure: progress is untouched
  const snapBefore = JSON.stringify({ c: st().completed, m: st().milestones, s: DH.Save.data.campaign.scrap });
  G.state = 'play'; G.newRun(9, {}, 4);
  const run4 = G.run;
  ok(run4.player.medkits === 3 && run4.perks.medic, 'Ada perk applied on the next deployment: 3 medical kits');
  run4.player.hp = 0; // [state] force a death to test failure handling
  let fres = null; const onF = (r) => { fres = r; }; DH.bus.on('runEnded', onF);
  for (let i = 0; i < 10 && !fres; i++) G.update(DH.DT, blankInput());
  ok(fres && fres.status === 'failed', 'forced death ends M4 as failed');
  ok(JSON.stringify({ c: st().completed, m: st().milestones, s: DH.Save.data.campaign.scrap }) === snapBefore, 'failure keeps completed missions, milestones and scrap');
  ok(DH.Save.unlocked(st(), 4) && DH.Story.current(st()) === 4, 'after failure M4 is still the current, unlocked mission (retry available)');

  const r4 = play(4, 'rescue', 5);
  ok(r4.status === 'success' && r4.survivorsOut.indexOf('wes') >= 0, 'M4 Dead Air retry completed with Wes (on foot via the trench)');
  ok(st().milestones.relay && st().milestones.wes && DH.Save.unlocked(st(), 5), 'M4 milestones and M5 unlocked');
  ok(st().outcomes[4] && st().outcomes[4].broadcast === 'routed', 'M4 broadcast choice stored for later dialogue');
  const af4 = DH.Story.aftermath(4, st());
  ok(af4.lines.some((l) => l.who === 'wes' && !l.radio), 'M4 aftermath: rescued Wes speaks in person (dialogue changes)');

  const r5 = play(5, 'rescue', 6);
  ok(r5.status === 'success' && r5.mode === 'ferry', 'M5 Last Crossing: truck drove aboard the ferry');
  ok(r5.survivorsOut.indexOf('bo') >= 0 && r5.survivorsOut.indexOf('ines') >= 0, 'M5 sequential rescue: Bo (truck seat) and Ines (on foot) both reached the staging pen');
  ok(st().completed[5] && st().milestones.crossing, 'M5 completes the campaign');
  const end = DH.Story.ending(st(), G.lastResult);
  ok(end.some((l) => /foothold/i.test(l)) && end.some((l) => /Nell|Tomas|Ada|Wes/.test(l)), 'ending: foothold framing, names the people you brought home');
  ok(/landfall|island depot/i.test(DH.Story.objective(st())) && DH.Save.unlocked(st(), 6), 'after the crossing the objective moves to the Island Line (Landfall unlocked)');

  // the whole save survives a reload from storage
  const ctx2 = load({ store }); ctx2.DH.Save.load();
  const s2 = ctx2.DH.Save.data.campaign.story;
  ok(ctx2.DH.Save.status === 'ok' && [1, 2, 3, 4, 5].every((l) => s2.completed[l]) && s2.milestones.wes, 'reloaded save keeps all five completions and milestones');
  const counts = {}; for (const k of s2.log) counts[k] = (counts[k] || 0) + 1;
  ok(Object.values(counts).every((n) => n === 1), 'story log has no duplicated milestones after replay + retry');
}

// ---------------- B. v1 save migration ----------------
{
  const blob = fs.readFileSync(__dirname + '/fixtures/v1-save-complete.json', 'utf8');
  const store = { 'skab.deadhaul.v1': blob };
  const ctx = load({ store }); const DH = ctx.DH; DH.Save.load();
  const d = DH.Save.data, st = d.campaign.story;
  ok(DH.Save.status === 'ok' && DH.Save.migrated, 'v1 completed save loads and is flagged migrated');
  ok(d.campaign.scrap === 40 && d.campaign.best.successes === 1, 'v1 scrap and stats preserved');
  ok(st.completed[1] && DH.Save.unlocked(st, 2) && st.seen[1] === false, 'v1 success marks M1 complete, unlocks M2 and queues the M1 aftermath');
  ok(JSON.parse(store['skab.deadhaul.v1']).v === 3, 'migrated save written back as v3');
  const ctx2 = load({ store }); ctx2.DH.Save.load();
  ok(!ctx2.DH.Save.migrated && ctx2.DH.Save.data.campaign.story.completed[1], 'second load of migrated save needs no migration and keeps progress');
  const af = DH.Story.aftermath(1, st);
  ok(af.lines.length >= 4 && af.next === 2, 'migrated save gets a valid M1 aftermath');

  const blobA = fs.readFileSync(__dirname + '/fixtures/v1-save-active.json', 'utf8');
  const storeA = { 'skab.deadhaul.v1': blobA };
  const c3 = load({ store: storeA, seedMath: 5 }); const D3 = c3.DH, G3 = D3.G; D3.Save.load();
  ok(D3.Save.status === 'ok' && D3.Save.hasRun(), 'v1 save with a run in progress keeps the active run');
  let err = null;
  try { G3.restore(D3.Save.data.active); G3.state = 'play'; for (let f = 0; f < 60 * 30 && G3.run; f++) { const i = blankInput(); i.move = { x: Math.sin(f / 40), y: Math.cos(f / 55) }; G3.update(D3.DT, i); } } catch (e) { err = e; }
  ok(!err && G3.run && G3.run.level === 1 && Array.isArray(G3.run.survivors) && G3.run.survivors[0].id === 'nell', 'v1 mid-run snapshot restores into v2 (Nell mapped) and plays 30 s' + (err ? ' ERR ' + err.message : ''));
}

// ---------------- C. mid-mission save/restore on the new maps ----------------
for (const [level, variant, at] of [[2, 'power', 55], [3, 'A', 60], [4, 'road', 70], [5, 'sheltered', 60]]) {
  const store = {};
  const ctx = load({ store, seedMath: level }); const DH = ctx.DH, G = DH.G; DH.Save.load();
  C.runLevel(ctx, level, C.S[level][variant], { seed: level, variant, limit: at });
  const run = G.run;
  const sig = (r) => JSON.stringify({ flags: r.flags, gates: r.gates, items: Object.fromEntries(Object.entries(r.items).map(([k, v]) => [k, v.loc])), doors: r.doors.map((d) => [!!d.open, !!d.locked]), surv: r.survivors.map((s) => [s.id, s.recruited, s.boarded]), emit: (r.emitters || []).map((e) => e.id), t: Math.round(r.time) });
  const s1 = sig(run);
  DH.Save.saveRun(G.snapshot());
  const ctx2 = load({ store, seedMath: 99 }); const D2 = ctx2.DH, G2 = D2.G; D2.Save.load();
  let err = null, s2 = null;
  let gatesOk = false, ended = null;
  try {
    G2.restore(D2.Save.data.active); s2 = sig(G2.run);
    gatesOk = G2.W.gates.every((g) => { const on = G2.run.gates[g.id].on; for (const i of g.cells) if (g.kind === 'flood' && (!!G2.W.truckWall[i]) !== on) return false; return true; });
    G2.state = 'play'; D2.bus.on('runEnded', (r) => { ended = r.status; });
    for (let f = 0; f < 60 * 20 && G2.run; f++) G2.update(D2.DT, blankInput());
  } catch (e) { err = e; }
  ok(!err && s1 === s2, 'M' + level + ' mid-run save at ' + at + ' s restores identical mission state (flags, gates, items, doors, survivors, machines)' + (err ? ' ERR ' + err.message : ''));
  ok(!err && gatesOk, 'M' + level + ' restored gates rebuild their water/blocking cells; 20 s of idle play after resume ran without errors' + (ended ? ' (idle player was overrun: ' + ended + ')' : ''));
}

// ---------------- D. the Island Line in one save: missions 6-10, perks between missions, replay at night, failure, locker ----------------
{
  const store = {};
  const ctx = load({ store, seedMath: 21 }); const DH = ctx.DH, G = DH.G; DH.Save.load();
  const st = () => DH.Save.data.campaign.story;
  for (let l = 1; l <= 5; l++) { st().completed[l] = true; st().seen[l] = true; } // [state] a finished Kettle Creek campaign
  Object.assign(st().milestones, { nell: true, tomas: true, ada: true, wes: true, relay: true, water: true, refrigeration: true, crossing: true });
  st().outcomes[5] = { stranded: 2 }; DH.Save.write();
  const play = (level, variant, seed) => { const r = C.runLevel(ctx, level, C.S[level][variant], { seed, variant }); return Object.assign(r, { result: G.lastResult }); };
  ok(DH.Story.current(st()) === 6 && DH.Save.unlocked(st(), 6) && !DH.Save.unlocked(st(), 7), 'Island Line: Landfall current and unlocked, Saltworks locked');
  const r6 = play(6, 'rescue', 3);
  ok(r6.status === 'success' && st().completed[6] && st().milestones.depot && st().milestones.dockers, 'M6 Landfall: depot secured, Cal and Dee rescued');
  ok(r6.result.medal && DH.Save.data.campaign.medals[6] === r6.result.medal, 'M6 earns and records a medal (' + r6.result.medal + ')');
  G.newRun(1, {}, 7); const fc = G.run.truck.fuelCap;
  ok(fc === 150 && G.run.truck.fuel === Math.round(55 * 1.5), 'Fuel Bladder applies on the next island deployment (cap 150)');
  const r7 = play(7, 'rescue', 2);
  ok(r7.status === 'success' && st().milestones.desal && st().milestones.hale && DH.Save.unlocked(st(), 8), 'M7 Saltworks: membrane home, Hale rescued, Night Ferry unlocked');
  // replay M7 at night with a modifier: pays more, no new story
  const logLen = st().log.length, scrapA = DH.Save.data.campaign.scrap;
  G.newRun(5, Object.assign({}, DH.Save.data.campaign.upgrades), 7, { cond: { night: true }, nightBonus: true, mods: { loud: true } });
  const rr = C.runLevel(ctx, 7, C.S[7].early, { seed: 5, useCurrent: true });
  ok(rr.status === 'success' && G.lastResult.mult === 2.1 && G.lastResult.cond.night, 'M7 night replay with Loud World succeeds at x2.1 scrap');
  ok(st().log.length === logLen && DH.Save.data.campaign.scrap > scrapA, 'the replay banks scrap without new milestones');
  // a failure on the Night Ferry changes nothing
  G.newRun(9, {}, 8); G.state = 'play';
  const before = JSON.stringify({ c: st().completed, m: st().milestones, s: DH.Save.data.campaign.scrap });
  ok(G.run.player.medkits === 4, 'Ada + Desal Plant: deploy with 4 medical kits');
  G.run.player.hp = 0; for (let i = 0; i < 5 && G.run; i++) G.update(DH.DT, blankInput()); // [state] forced death
  ok(JSON.stringify({ c: st().completed, m: st().milestones, s: DH.Save.data.campaign.scrap }) === before, 'a death on the Night Ferry keeps everything');
  const r8 = play(8, 'rescue', 3);
  ok(r8.status === 'success' && r8.mode === 'ferry' && st().milestones.ferryrun && st().milestones.quay && DH.Story.perks(st()).locker, 'M8 Night Ferry: medicine across, Bo back, Weapon Locker unlocked');
  const r9 = play(9, 'rescue', 2);
  ok(r9.status === 'success' && st().milestones.quarry && st().milestones.family, 'M9 Quarry Road: mast home, Pia and Sol rescued');
  ok(r9.result.weapon ? DH.Save.data.campaign.locker === r9.result.weapon : true, 'the found weapon carried out of the quarry goes on the rack (' + (r9.result.weapon || 'none carried') + ')');
  const wt = DH.Save.data.campaign.locker;
  const r10 = play(10, 'rescue', 4);
  ok(!wt || G.lastRun.player.weapons.some((w) => w.type === wt) || G.lastRun.lockerWeapon === wt, 'the racked weapon deployed with you on the Long Haul');
  ok(r10.status === 'success' && r10.mode === 'ferry' && st().completed[10] && st().milestones.island && st().milestones.holdouts, 'M10 Long Haul: both campaigns complete, holdouts aboard' + (r10.status !== 'success' || !st().milestones.holdouts ? ' [' + r10.status + ' ' + r10.stuckAt + ' ' + JSON.stringify(r10.pos) + ' ' + r10.steps.slice(-300) + ' out=' + r10.survivorsOut + ']' : ''));
  const end2 = DH.Story.ending(st(), G.lastResult);
  ok(end2.some((l) => /trucks? chained/i.test(l)) && end2.some((l) => /Island Depot/.test(l)), 'second ending reflects the convoy and the island');
  const ctx2 = load({ store }); ctx2.DH.Save.load();
  const s2 = ctx2.DH.Save.data.campaign.story;
  ok(ctx2.DH.Save.status === 'ok' && DH.Save.LEVELS.every((l) => s2.completed[l]) && Object.keys(ctx2.DH.Save.data.campaign.medals).length >= 5, 'reloaded v3 save keeps ten completions and the medals');
  const counts = {}; for (const k of s2.log) counts[k] = (counts[k] || 0) + 1;
  ok(Object.values(counts).every((n) => n === 1), 'no duplicated milestones after replay and failure');
}

// ---------------- E. mid-mission save/restore on the Island Line maps (fuel, skiff, convoy state) ----------------
for (const [level, variant, at] of [[6, 'side', 40], [7, 'cliff', 45], [8, 'boat', 120], [9, 'crusher', 45], [10, 'ridge', 85]]) {
  const store = {};
  const ctx = load({ store, seedMath: level }); const DH = ctx.DH, G = DH.G; DH.Save.load();
  C.runLevel(ctx, level, C.S[level][variant], { seed: level, variant, limit: at });
  const run = G.run;
  const sig = (r) => JSON.stringify({ flags: r.flags, gates: r.gates, items: Object.fromEntries(Object.entries(r.items).map(([k, v]) => [k, v.loc])), doors: r.doors.map((d) => [!!d.open, !!d.locked]), surv: r.survivors.map((s) => [s.id, s.recruited, s.boarded, !!s.inConvoy]), fuel: r.truck.fuel != null ? Math.round(r.truck.fuel * 10) : null, boat: r.boat ? [Math.round(r.boat.x), Math.round(r.boat.y), !!r.player.inBoat] : null, convoy: r.convoy ? [Math.round(r.convoy.x), Math.round(r.convoy.y), r.convoy.rolling, r.convoy.driver, Math.round(r.convoy.dur), r.convoy.crumbs.length] : null, ferry: r.ferryOff, t: Math.round(r.time) });
  const s1 = sig(run);
  DH.Save.saveRun(G.snapshot());
  const ctx2 = load({ store, seedMath: 99 }); const D2 = ctx2.DH, G2 = D2.G; D2.Save.load();
  let err = null, s2 = null;
  try {
    G2.restore(D2.Save.data.active); s2 = sig(G2.run);
    G2.state = 'play';
    for (let f = 0; f < 60 * 20 && G2.run; f++) G2.update(D2.DT, blankInput());
  } catch (e) { err = e; }
  ok(!err && s1 === s2, 'M' + level + ' mid-run save at ' + at + ' s restores identical state, including fuel, skiff, convoy and ferry' + (err ? ' ERR ' + err.message : s1 !== s2 ? ' ' + s1 + ' vs ' + s2 : ''));
}

console.log(pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(__dirname + '/progression-results.json', JSON.stringify({ pass, fail, rows }, null, 1));
process.exitCode = fail ? 1 : 0;
