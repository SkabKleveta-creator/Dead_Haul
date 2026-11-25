// Island Line systems: new enemy types, fuel, skiff, convoy, conditions, modifiers, medals, Daily Haul, Salvage
// Runs, weapon locker, save v2 -> v3 migration and the campaign 2 story. Node, no rendering.
const { load, blankInput } = require('./harness');
let pass = 0, fail = 0;
const ok = (c, name, info) => { if (c) pass++; else { fail++; console.log('FAIL', name, info !== undefined ? JSON.stringify(info) : ''); } };
const section = (n) => console.log('--', n);
const fresh = (opts) => { const ctx = load(Object.assign({ seedMath: 7 }, opts || {})); ctx.DH.Save.load(); ctx.DH.G.state = 'play'; return ctx; };
const step = (DH, n, inp) => { for (let k = 0; k < n; k++) DH.G.update(DH.DT, inp ? inp() : blankInput()); };
const quiet = (DH) => { for (const z of DH.G.run.zombies) { z.dead = true; z.deathT = 0; } DH.G.run.reserve.remaining = 0; };

// ---------------------------------------------------------------- enemies
section('brute');
{
  const { DH } = fresh(); const G = DH.G; G.newRun(1, {}, 6); quiet(DH);
  const run = G.run, p = run.player; p.x = 30; p.y = 60; p.inTruck = false;
  const z = DH.Z.make(run, 'brute', 31.2, 60, null); run.zombies.push(z);
  DH.Z.stagger(z, 0.35, p.x, p.y, true);
  ok(z.state !== 'stagger', 'crowbar does not stagger a brute');
  DH.Z.stagger(z, 0.2, p.x, p.y, false);
  ok(z.state !== 'stagger', 'light hits do not stagger a brute');
  DH.Z.stagger(z, 0.6, p.x, p.y, false);
  ok(z.state === 'stagger', 'a heavy impact does');
  ok(DH.ZTYPES.brute.hp >= 250 && DH.ZTYPES.brute.doorDmg >= 90, 'brute: high HP, breaks a standard door in one hit', DH.ZTYPES.brute);
  // ordinary door: one hit; the gatehouse yard door (steel): several
  const W = G.W, gi = W.doors.findIndex((d) => d.label === 'Gatehouse Door'), yi = W.doors.findIndex((d) => d.label === 'Yard Door');
  DH.World.damageBlocker({ kind: 'door', idx: gi }, DH.ZTYPES.brute.doorDmg, z);
  ok(run.doors[gi].broken, 'a standard door gives way to one brute hit');
  DH.World.damageBlocker({ kind: 'door', idx: yi }, DH.ZTYPES.brute.doorDmg, z);
  ok(!run.doors[yi].broken && run.doors[yi].hp > 0, 'the steel yard door holds a first hit');
  // shoving the truck
  const t = run.truck; t.x = 50; t.y = 38.5; t.ang = 0; t.speed = 6; const d0 = t.dur;
  DH.Truck.bruteHit(z);
  ok(t.dur === d0 - DH.ZTYPES.brute.truckDmg && t.speed < 3, 'a brute strike costs durability and stops the truck', { dur: t.dur, sp: t.speed });
  run.perks.gravel = true; const d1 = t.dur; DH.Truck.bruteHit(z);
  ok(Math.abs((d1 - t.dur) - DH.ZTYPES.brute.truckDmg * 0.75) < 1e-6, 'Crusher Gravel takes 25% off brute impacts', d1 - t.dur);
}
section('sleeper');
{
  const { DH } = fresh(); const G = DH.G; G.newRun(1, {}, 7); quiet(DH);
  const run = G.run, p = run.player; p.inTruck = false; p.x = 20; p.y = 66;
  const z = DH.Z.make(run, 'sleeper', 26, 66, null); run.zombies.push(z);
  ok(z.dormant === true, 'sleepers start dormant');
  G.emitNoise(40, 66, DH.T.noise.pistol, 'gun', 0.5);
  step(DH, 30);
  ok(z.dormant, 'distant gunfire (14 m) does not wake a sleeper');
  G.noise.length = 0;
  G.emitNoise(23, 66, DH.T.noise.walk, 'step', 0.3);
  step(DH, 30);
  ok(z.dormant, 'quiet walking nearby does not wake it');
  G.noise.length = 0;
  G.emitNoise(24, 66, DH.T.noise.splash, 'step', 0.3);
  step(DH, 30);
  ok(!z.dormant && (z.state === 'chase' || z.state === 'investigate'), 'a splash within range wakes it and it moves', z.state);
  const z2 = DH.Z.make(run, 'sleeper', 30, 70, null); run.zombies.push(z2);
  DH.Z.damage(z2, 5, p.x, p.y, 'gun');
  ok(!z2.dormant && z2.state === 'chase', 'damage wakes a sleeper and it comes for you');
  // dormant sleepers are hard to see
  G.run.player.x = 26; G.run.player.y = 72; const z3 = DH.Z.make(run, 'sleeper', 26, 79, null); run.zombies.push(z3);
  DH.Z.visT = 0; DH.Z.updateAll(DH.DT);
  ok(!z3.visible, 'a dormant sleeper 7 m away is not visible');
}
section('shrieker');
{
  const { DH } = fresh(); const G = DH.G; G.newRun(1, {}, 6); quiet(DH);
  const run = G.run, p = run.player; p.inTruck = false; p.x = 66; p.y = 70;
  const s = DH.Z.make(run, 'shrieker', 66, 62, null); s.face = Math.PI / 2; run.zombies.push(s);
  const crowd = [];
  for (let k = 0; k < 5; k++) { const z = DH.Z.make(run, 'drifter', 50 + k * 2, 90, null); z.state = 'idle'; run.zombies.push(z); crowd.push(z); }
  let started = false; for (let k = 0; k < 120 && !started; k++) { step(DH, 1); started = s.state === 'shriek'; }
  ok(started, 'a shrieker that sees you winds up a shriek');
  DH.Z.damage(s, 5, p.x, p.y, 'gun');
  ok(s.state === 'stagger' && s.shriekCd > 0, 'damage during the wind-up cuts the shriek off');
  s.shriekCd = 0; s.state = 'shriek'; s.t = 0.01;
  step(DH, 3);
  const drawn = crowd.filter((z) => z.state === 'investigate' && Math.hypot(z.tx - s.x, z.ty - s.y) < 4).length;
  ok(drawn === 5, 'a completed shriek calls every idle corpse in range to the shrieker', drawn);
  ok(s.shriekCd > 10, 'then it needs time before the next one', s.shriekCd);
}
// ---------------------------------------------------------------- fuel
section('fuel');
{
  const { DH } = fresh(); const G = DH.G; G.newRun(1, {}, 6); quiet(DH);
  const run = G.run, t = run.truck, p = run.player;
  ok(DH.Fuel.on(run) && t.fuel === 40 && t.fuelCap === 100, 'Landfall starts with 40 of 100 fuel', [t.fuel, t.fuelCap]);
  const { DH: D1 } = fresh(); D1.G.newRun(1, {}, 2);
  ok(!D1.Fuel.on(D1.G.run), 'Kettle Creek missions have no fuel gauge');
  p.inTruck = true; t.engine = true;
  const f0 = t.fuel; step(DH, 60, () => Object.assign(blankInput(), { drive: { throttle: 0, brake: 0, steer: 0, handbrake: true } }));
  ok(f0 - t.fuel > 0.1 && f0 - t.fuel < 0.2, 'idling burns ~0.12/s', f0 - t.fuel);
  const f1 = t.fuel; step(DH, 120, () => Object.assign(blankInput(), { drive: { throttle: 1, brake: 0, steer: 0, handbrake: false } }));
  ok((f1 - t.fuel) / 2 > 0.6, 'driving burns much more', (f1 - t.fuel) / 2);
  t.fuel = 0.05; t.speed = 5;
  step(DH, 10, () => Object.assign(blankInput(), { drive: { throttle: 1, brake: 0, steer: 0, handbrake: false } }));
  ok(t.fuel === 0 && !t.engine, 'running dry kills the engine');
  step(DH, 200, () => Object.assign(blankInput(), { drive: { throttle: 1, brake: 0, steer: 0, handbrake: false } }));
  ok(Math.abs(t.speed) < 0.1, 'and the truck rolls to a stop; throttle does nothing', t.speed);
  // refuel from a jerry can in the backpack
  p.inTruck = false; const sp = DH.Truck.toWorld(0.5, -(DH.Truck.HW + 0.7)); p.x = sp.x; p.y = sp.y;
  run.items.fuel0.loc = 'backpack';
  DH.Interact.update(0, Object.assign(blankInput(), { _consumed: true }));
  const c = DH.Interact.candidates().find((q) => q.id === 'refuel');
  ok(c && c.hold && !c.disabled, 'the truck offers a refuel prompt when you carry a can', c && c.label);
  DH.Player.startAction('refuel', DH.Fuel.refuelTime(run), 'Pouring fuel', { hold: true });
  step(DH, 140, () => Object.assign(blankInput(), { interactHeld: true }));
  ok(Math.abs(t.fuel - DH.T.fuel.can) < 0.5 && run.items.fuel0.loc === 'used', 'a can adds 35 fuel and is used up', [t.fuel, run.items.fuel0.loc]);
  ok(DH.Cargo.check(run).length === 0, 'cargo invariants hold with a used can');
  // perks and upgrades
  const { DH: D2 } = fresh(); const st2 = D2.Save.story(); st2.milestones.depot = true; D2.G.newRun(1, {}, 6);
  ok(D2.G.run.truck.fuelCap === 150 && D2.G.run.truck.fuel === 60, 'Fuel Bladder: 150 capacity, starts at 60', [D2.G.run.truck.fuelCap, D2.G.run.truck.fuel]);
  const { DH: D3 } = fresh(); D3.G.newRun(1, { tank: true }, 6); D3.G.run.truck.speed = 0;
  ok(Math.abs(D3.Fuel.rate(D3.G.run) - DH.T.fuel.idle * 0.7) < 1e-9, 'Long-Range Tank: 30% less fuel use');
}
// ---------------------------------------------------------------- skiff
section('skiff');
{
  const { DH } = fresh(); const G = DH.G; G.newRun(1, {}, 8); quiet(DH);
  const run = G.run, p = run.player, b = run.boat;
  ok(b && DH.Boat.fits(b.x, b.y), 'Night Ferry starts with the skiff afloat at its slip');
  ok(!DH.Boat.fits(60, 25) && !DH.Boat.water(60, 25), 'the quay is not water');
  p.inTruck = false; p.x = b.x; p.y = 16.6;
  DH.Interact.update(0, Object.assign(blankInput(), { _consumed: true }));
  ok(DH.Interact.candidates().some((q) => q.id === 'boat'), 'the slip offers "Board the skiff"');
  DH.Boat.board();
  ok(p.inBoat && b.engine, 'boarding puts you at the tiller');
  const x0 = b.x;
  step(DH, 180, () => Object.assign(blankInput(), { drive: { throttle: 1, brake: 0, steer: 0, handbrake: false } }));
  ok(Math.abs(b.x - x0) > 6 && DH.Boat.fits(b.x, b.y), 'it drives on open water', [x0, b.x, b.y]);
  for (let k = 0; k < 600; k++) { G.update(DH.DT, Object.assign(blankInput(), { drive: { throttle: 1, brake: 0, steer: 0.4, handbrake: false } })); if (!DH.Boat.fits(b.x, b.y)) break; }
  ok(DH.Boat.fits(b.x, b.y), 'and never leaves it, whatever you steer into');
  ok(G.noise.some((n) => n.kind === 'boat'), 'the outboard makes noise');
  b.x = 58.5; b.y = 11; b.speed = 0; G.noise.length = 0; b.noiseT = 0; step(DH, 1);
  const sh = DH.Boat.shore(b, 14); const nb = G.noise.find((n) => n.kind === 'boat');
  ok(sh && nb && G.W.navCost(Math.floor(nb.fx), Math.floor(nb.fy), true) > 0, 'its noise focuses on the nearest shore, where the dead can stand');
  ok(DH.Player.damage(50, b.x + 1, b.y) === false, 'nothing can hurt you in the skiff');
  // bring it to the slip and step off
  b.x = G.W.boatSlip.x; b.y = 13.6; b.speed = 0;
  ok(DH.Boat.exit() && !p.inBoat && G.W.circleFree(p.x, p.y, 0.33), 'stepping ashore lands you on solid ground');
  // cargo
  run.items.medstock0.loc = 'backpack'; run.items.medstock1.loc = 'backpack';
  p.x = b.x; p.y = 16.6; DH.Interact.update(0, Object.assign(blankInput(), { _consumed: true }));
  const stow = DH.Interact.candidates().find((q) => q.id === 'boatStow'); stow.run();
  ok(DH.Cargo.list(run, 'boat').length === 2 && DH.Cargo.check(run).length === 0, 'light cargo stows in the skiff (3 units)');
}
// ---------------------------------------------------------------- convoy
section('convoy');
{
  const { DH } = fresh(); const st = DH.Save.story(); st.milestones.nell = true; st.milestones.tomas = true;
  const G = DH.G; G.newRun(1, {}, 10); quiet(DH);
  const run = G.run, c = run.convoy, t = run.truck, p = run.player;
  ok(c && !c.rolling && c.driver === 'marta', 'Long Haul starts with a second truck, Marta at the wheel, waiting');
  ok(run.convoyDrivers.join() === 'marta,nell,tomas', 'Nell and Tomas can take the wheel if they are home', run.convoyDrivers);
  ok(DH.Convoy.setDriver(run, 'tomas') && c.maxDur === 260, 'Tomas drives a sturdier truck');
  ok(DH.Convoy.setDriver(run, 'nell') && DH.Convoy.DRIVERS.nell.gap < DH.Convoy.DRIVERS.marta.gap, 'Nell follows tighter');
  // load the filtration unit into the second truck
  const it = run.items.filtration; it.loc = 'hauled'; p.hauling = true; p.haulId = 'filtration';
  const r = DH.Convoy.load(run, 'filtration');
  ok(r.ok && it.loc === 'convoy' && DH.Cargo.check(run).length === 0, 'heavy gear loads into the second truck bed');
  // lead off: it follows the tracks
  p.inTruck = true; t.engine = true;
  const pts = [[36, 96], [40, 86.5], [70, 86.5]];
  let wi = 0;
  for (let k = 0; k < 60 * 30 && wi < pts.length; k++) {
    const w = pts[wi], a = Math.atan2(w[1] - t.y, w[0] - t.x), da = DH.M.angDiff(t.ang, a);
    G.update(DH.DT, Object.assign(blankInput(), { drive: { throttle: t.speed < 5 ? 1 : 0, brake: 0, steer: DH.M.clamp(da * 2, -1, 1), handbrake: false } }));
    if (Math.hypot(w[0] - t.x, w[1] - t.y) < 3) wi++;
  }
  ok(c.rolling, 'the second truck rolls once you lead off');
  for (let k = 0; k < 60 * 8; k++) G.update(DH.DT, Object.assign(blankInput(), { drive: { throttle: 0, brake: 1, steer: 0, handbrake: true } }));
  const gap = Math.hypot(c.x - t.x, c.y - t.y);
  ok(gap > 5 && gap < 16 && c.y < 95, 'and keeps a following distance on your tracks', { gap, c: [c.x, c.y] });
  ok(G.W.circleFree(c.x, c.y, 1.0, { truck: true }), 'it never ends up inside a wall');
  ok(DH.Convoy.aboard(run, 'ferry') === true, 'near your truck, it counts as leaving with you');
  c.disabled = true;
  ok(DH.Convoy.aboard(run, 'ferry') === false, 'a wrecked second truck does not');
  const ev = DH.Extract.evaluate(run, 'ferry', G.extractCtx('ferry'));
  ok(!ev.got.filtration && ev.leftBehind.some((s) => /second truck/i.test(s)), 'its cargo is left behind', ev.leftBehind);
}
// ---------------------------------------------------------------- conditions, modifiers, medals
section('conditions and modifiers');
{
  const { DH } = fresh(); const G = DH.G;
  G.newRun(1, {}, 8);
  ok(G.cond().night && G.theme().night && G.theme().lightR < G.W.theme.lightR + 0.01, 'Night Ferry is always night');
  ok(G.sightMul() < 1, 'night shortens how far the dead see');
  G.newRun(1, {}, 1, { cond: { rain: true } });
  G.noise.length = 0; G.emitNoise(10, 10, 10, 'step', 0.3); G.emitNoise(30, 30, 10, 'gun', 0.3);
  ok(Math.abs(G.noise[0].r - 7) < 1e-9 && G.noise[1].r === 10, 'rain masks footsteps only (x0.7)');
  G.newRun(1, {}, 1, { mods: { loud: true } });
  G.noise.length = 0; G.emitNoise(10, 10, 10, 'gun', 0.3);
  ok(G.noise[0].r === 15, 'Loud World: every sound x1.5');
  G.newRun(1, {}, 1, { mods: { ironman: true, pistol: true } });
  ok(G.run.player.medkits === 0 && G.run.player.repairkits === 0 && !G.run.pickups.some((k) => k.kind === 'medkit' || k.kind === 'repairkit' || k.kind === 'weapon'), 'Ironman strips kits, Pistol Only strips found weapons');
  ok(DH.Modes.scrapMul(G.run) === 2.08, 'modifiers multiply scrap (1.6 x 1.3)', DH.Modes.scrapMul(G.run));
  G.newRun(1, {}, 1, { mods: { notruck: true, ironman: true, pistol: true, loud: true }, cond: { night: true }, nightBonus: true });
  ok(DH.Modes.scrapMul(G.run) === DH.Modes.MAX_MULT, 'the multiplier is capped at x4');
  G.run.player.inTruck = false;
  const ex = G.W.exits.find((z) => z.kind === 'truck');
  ok(!G.exitOpen(ex), 'No Truck closes the road exits');
  // a result carries the multiplier
  quiet(DH); G.run.items.case.loc = 'backpack';
  const ev = DH.Extract.evaluate(G.run, 'foot', G.extractCtx('foot'));
  ok(ev.status === 'success' && ev.scrap === DH.T.rewards.case * 4, 'scrap on extraction includes the multiplier', ev.scrap);
}
section('medals');
{
  const { DH } = fresh(); const G = DH.G; G.newRun(1, {}, 1); quiet(DH);
  const L = DH.LEVELS[1], run = G.run;
  const res = (t, dmg, opt) => { run.stats.damageTaken = dmg; const r = { status: 'success', time: t, outcome: { optional: opt } }; DH.Modes.grade(run, r, L); return r.medal; };
  ok(res(100, 10, { a: true, b: true }) === 'gold', 'gold: fast, healthy, every optional job');
  ok(res(100, 10, { a: true, b: false }) === 'silver', 'silver: two of the three');
  ok(res(9999, 90, { a: false }) === 'bronze', 'bronze: a clear');
  const r2 = { status: 'partial', time: 10, outcome: {} }; DH.Modes.grade(run, r2, L);
  ok(!r2.medal, 'no medal without a clear');
  run.mode = 'salvage'; const r3 = { status: 'success', time: 10, outcome: { optional: {} } }; DH.Modes.grade(run, r3, L);
  ok(!r3.medal, 'salvage runs do not earn mission medals');
}
section('daily haul and salvage');
{
  const { DH } = fresh();
  const st = DH.Save.story(); for (const l of [1, 2, 3, 6]) st.completed[l] = true;
  const a = DH.Modes.dailySpec(st, '2026-11-25'), b = DH.Modes.dailySpec(st, '2026-11-25'), c = DH.Modes.dailySpec(st, '2026-11-26');
  ok(JSON.stringify(a) === JSON.stringify(b), 'the same date gives the same Daily Haul');
  ok([1, 2, 3, 6].indexOf(a.level) >= 0, 'on a cleared map', a.level);
  ok(a.seed !== c.seed, 'and the next day is different');
  const st0 = DH.Save.storyDefaults(); ok(DH.Modes.dailySpec(st0, '2026-11-25').level === 1, 'with nothing cleared it falls back to Mercer Crossing');
  // salvage run on Saltworks
  const G = DH.G; G.newRun(99, {}, 7, { mode: 'salvage' });
  const run = G.run;
  ok(G.L().salvage && run.reserve.remaining > 100 && !run.items.membrane, 'salvage: no mission objectives, an endless reserve');
  const its = Object.values(run.items);
  ok(its.filter((i) => i.kind === 'salvage').length === 14 && its.filter((i) => i.kind === 'supplies').length === 5 && its.filter((i) => i.kind === 'fuel').length === 3, 'caches: 14 salvage, 5 supplies, 3 jerry cans (fuel map)');
  const W = G.W, reach = (x, y) => !!W.findPath(W.start.player.x, W.start.player.y, x, y, false, 80000);
  ok(its.every((i) => reach(i.x, i.y)), 'every cache is reachable on foot');
  const G2 = fresh().DH.G; G2.newRun(99, {}, 7, { mode: 'salvage' }); const its2 = Object.values(G2.run.items);
  ok(its2.map((i) => i.x.toFixed(1) + ',' + i.y.toFixed(1)).join() === its.map((i) => i.x.toFixed(1) + ',' + i.y.toFixed(1)).join(), 'the same seed lays the same caches');
  ok(!G.exitOpen(W.exits.find((z) => z.id === 'shore')) === false, 'road exits stay open');
  // waves escalate
  quiet(DH); run.reserve.remaining = 999;
  step(DH, 60 * 95);
  ok(run.salvage.wave >= 1 && run.zombies.some((z) => z.reserve && !z.dead), 'waves arrive', run.salvage.wave);
  // banking: success records a best, campaign untouched
  run.items.salvage0.loc = 'backpack'; run.items.supplies0.loc = 'backpack';
  run.player.inTruck = false; run.player.hp = 100;
  G.endRun('foot');
  const r = G.lastResult;
  ok(r.status === 'success' && r.scrap === DH.T.rewards.salvage + DH.T.rewards.supplies && DH.Save.data.campaign.salvageBest[7] === r.scrap && !DH.Save.story().completed[7], 'banking pays out, records a best, leaves the campaign alone', [r.status, r.scrap]);
}
// ---------------------------------------------------------------- locker
section('weapon locker');
{
  const { DH } = fresh(); const G = DH.G, st = DH.Save.story();
  st.milestones.ferryrun = true;
  G.newRun(1, {}, 1); quiet(DH);
  G.run.player.weapons.push({ type: 'rifle', mag: 4 }); G.run.items.case.loc = 'backpack'; G.run.player.inTruck = false;
  G.endRun('foot');
  ok(DH.Save.data.campaign.locker === 'rifle' && G.lastResult.lockerStored === 'rifle', 'a found weapon you bring out goes on the rack');
  G.newRun(2, {}, 2);
  const w = G.run.player.weapons.find((q) => q.type === 'rifle');
  ok(w && w.mag === DH.WEAPONS.rifle.mag && G.run.player.ammo.r30 === DH.WEAPONS.rifle.startReserve, 'and deploys with you, full magazine and standard reserve');
  G.newRun(3, {}, 2, { mods: { pistol: true } });
  ok(!G.run.player.weapons.some((q) => q.type === 'rifle'), 'except on Pistol Only');
  const { DH: D2 } = fresh(); D2.G.newRun(1, {}, 1); quiet(D2); D2.G.run.player.weapons.push({ type: 'smg', mag: 3 }); D2.G.run.items.case.loc = 'backpack'; D2.G.endRun('foot');
  ok(!D2.Save.data.campaign.locker, 'without the Weapon Locker unlock nothing is kept');
  G.newRun(4, {}, 1); quiet(DH); G.run.player.hp = 0; G.update(DH.DT, blankInput());
  ok(DH.Save.data.campaign.locker === 'rifle', 'dying never clears the rack');
}
// ---------------------------------------------------------------- saves
section('save v2 -> v3');
{
  const v2 = { v: 2, campaign: { scrap: 77, upgrades: { quiet: true, bumper: false, gear: true }, settings: { volume: 0.5, music: 0.2, muted: false, aimAssist: false, reducedShake: true, reducedFlashes: false, hints: true }, best: { bestScrap: 50, fastestSuccess: 100, successes: 5, runs: 7 }, levelBest: { 1: { runs: 2, successes: 1, fastest: 100 } }, recentRunIds: ['x'], history: [], story: { completed: { 1: true, 2: true, 3: true, 4: true, 5: true }, firstClear: { 1: 'a', 2: 'b', 3: 'c', 4: 'd', 5: 'e' }, milestones: { nell: true, crossing: true }, outcomes: { 5: { stranded: 1 } }, optional: {}, seen: { 1: true, 2: true, 3: true, 4: true }, endingSeen: true, log: ['nell'], selected: 5 } }, active: null };
  const store = { 'skab.deadhaul.v1': JSON.stringify(v2) };
  const ctx = load({ store }); const DH = ctx.DH; DH.Save.load();
  const c = DH.Save.data.campaign, st = c.story;
  ok(DH.Save.status === 'ok' && DH.Save.migrated, 'a v2 save loads and migrates');
  ok(c.scrap === 77 && c.upgrades.quiet && c.upgrades.gear && !c.upgrades.cage && !c.upgrades.tank && c.settings.reducedShake, 'scrap, upgrades and settings kept; new upgrades start uninstalled');
  ok(st.completed[5] && st.milestones.crossing && DH.Save.unlocked(st, 6) && !DH.Save.unlocked(st, 7), 'Kettle Creek progress kept; Landfall unlocked, nothing past it');
  ok(c.locker === null && JSON.stringify(c.medals) === '{}' && JSON.stringify(c.daily) === '{}', 'v3 fields start empty');
  ok(JSON.parse(store['skab.deadhaul.v1']).v === 3, 'written back as v3');
  // garbage in v3 fields is dropped, valid entries kept
  const bad = JSON.parse(store['skab.deadhaul.v1']); bad.campaign.locker = 'bazooka'; bad.campaign.medals = { 1: 'gold', 2: 'platinum', 99: 'gold' }; bad.campaign.daily = { 'not-a-date': { best: 5 }, '2026-11-24': { best: 30, level: 2, runs: 3 } }; bad.campaign.salvageBest = { 7: 40, 8: 'x' };
  const store2 = { 'skab.deadhaul.v1': JSON.stringify(bad) }; const D2 = load({ store: store2 }).DH; D2.Save.load();
  const c2 = D2.Save.data.campaign;
  ok(c2.locker === null && c2.medals[1] === 'gold' && !c2.medals[2] && !c2.medals[99] && c2.daily['2026-11-24'].best === 30 && !c2.daily['not-a-date'] && c2.salvageBest[7] === 40 && c2.salvageBest[8] == null, 'invalid locker, medals and records are dropped; valid ones kept');
  // medals only improve
  D2.Save.commitResult('r1', { level: 1, status: 'success', scrap: 10, time: 90, medal: 'silver', outcome: {} });
  D2.Save.commitResult('r2', { level: 1, status: 'success', scrap: 10, time: 90, medal: 'bronze', outcome: {} });
  ok(c2.medals[1] === 'gold', 'a worse medal never replaces a better one');
}
// ---------------------------------------------------------------- story
section('Island Line story');
{
  const { DH } = fresh(); const S = DH.Story, st = DH.Save.story();
  for (let l = 1; l <= 5; l++) st.completed[l] = true;
  ok(S.current(st) === 6 && /landfall/i.test(S.objective(st)), 'after the crossing the story moves to Landfall');
  const apply = (lvl, oc) => S.apply(st, { level: lvl, status: 'success', runId: 'r' + lvl, outcome: oc, time: 100 });
  let o = apply(6, { route: 'side', dockers: true, optional: { dockers: true } });
  ok(o.firstClear && o.unlocked === 7 && st.milestones.depot && st.milestones.dockers, 'Landfall: depot + dockers milestones, Saltworks unlocked');
  ok(S.perks(st).bladder && S.perks(st).dock, 'Fuel Bladder and Dock Crew unlocked');
  o = apply(7, { route: 'early', hale: true }); ok(st.milestones.desal && st.milestones.hale && S.perks(st).desal && S.perks(st).watch, 'Saltworks: Desal Plant and Lighthouse Watch');
  o = apply(8, { decoy: 'boat', quay: 1, quayFirst: 'bo', quayAll: true }); ok(st.milestones.ferryrun && st.milestones.quay && S.perks(st).locker, 'Night Ferry: Weapon Locker; the quay emptied');
  o = apply(9, { route: 'crusher', crushed: true, family: true }); ok(st.milestones.quarry && st.milestones.family && S.perks(st).gravel, 'Quarry Road: Crusher Gravel, the family');
  o = apply(10, { convoy: true, gear: ['generator', 'assembly'], holdouts: true }); ok(st.milestones.island && !o.unlocked && st.completed[10], 'Long Haul finishes the Island Line');
  ok(/both ways/i.test(S.objective(st)), 'post-campaign objective invites replay and modes');
  const a6 = S.aftermath(6, st), a8 = S.aftermath(8, st), a9 = S.aftermath(9, st);
  ok(a6.title === 'ISLAND DEPOT' && a6.next === 7 && a6.lines.some((l) => l.who === 'cal'), 'Landfall aftermath at the depot; Cal speaks when rescued');
  ok(a8.lines.some((l) => /outboard/i.test(l.text)) && a8.lines.some((l) => l.who === 'bo'), 'Night Ferry aftermath reflects the skiff decoy and who came back');
  ok(a9.lines.some((l) => /crusher/i.test(l.text)) && a9.lines.some((l) => l.who === 'pia'), 'Quarry aftermath reflects the crusher and the family');
  const e1 = S.ending(st, { level: 10, outcome: { convoy: true, gear: ['generator', 'assembly'], holdouts: true } });
  const e2 = S.ending(st, { level: 10, outcome: { convoy: false, gear: [], holdouts: false } });
  ok(e1.some((l) => /both trucks/i.test(l)) && e1.some((l) => /Rosa and Eli/.test(l)) && e1.some((l) => /generator/.test(l)), 'second ending names both trucks, holdouts and gear');
  ok(e2.some((l) => /didn.t make it/.test(l)) && !e2.some((l) => /Rosa/.test(l)) && e2.some((l) => /stayed behind/.test(l)), 'and changes when the second truck and holdouts were lost');
  ok(e1.every((l) => l.length < 180) && e1.length <= 9, 'ending lines stay short', e1.map((l) => l.length));
  // route events in the Long Haul come from earlier choices
  const { DH: D3 } = fresh(); const s3 = D3.Save.story(); s3.outcomes[3] = { setting: 'A' }; s3.outcomes[9] = { route: 'crusher', crushed: true };
  D3.G.newRun(1, {}, 10);
  ok(!D3.G.run.gates.lowst.on && !D3.G.run.gates.cut.on, 'drained Low Street and a crushed Quarry Cut open both short roads');
  const { DH: D4 } = fresh(); D4.G.newRun(1, {}, 10);
  ok(D4.G.run.gates.lowst.on && D4.G.run.gates.cut.on, 'otherwise only the Ridge Road is open');
  // Night Ferry spawns whoever Last Crossing left behind
  const { DH: D5 } = fresh(); D5.Save.story().outcomes[5] = { stranded: 1 }; D5.G.newRun(1, {}, 8);
  ok(D5.G.run.survivors.map((s) => s.id).join() === 'ray,bo', 'Night Ferry: the dockworkers you left on the quay are still there', D5.G.run.survivors.map((s) => s.id));
}
// ---------------------------------------------------------------- integrity on every new map
section('maps');
{
  for (const l of [6, 7, 8, 9, 10]) {
    const { DH } = fresh(); const G = DH.G; G.newRun(1, {}, l);
    const run = G.run, W = G.W;
    ok(DH.Cargo.check(run).length === 0, 'L' + l + ': cargo invariants at start', DH.Cargo.check(run));
    ok(W.circleFree(W.start.truck.x, W.start.truck.y, 1.1, { truck: true }) && W.circleFree(W.start.player.x, W.start.player.y, 0.33), 'L' + l + ': truck and player start in free space');
    ok(run.zombies.every((z) => W.circleFree(z.x, z.y, 0.3) || z.dormant), 'L' + l + ': every zombie spawns in free space');
    ok(run.zombies.length >= 30 && run.zombies.length <= 60, 'L' + l + ': zombie count in range', run.zombies.length);
    const snap = G.snapshot(); G.restore(snap);
    ok(G.run.level === l && JSON.stringify(Object.keys(G.run.items)) === JSON.stringify(Object.keys(run.items)), 'L' + l + ': snapshot round-trips');
    step(DH, 120);
    ok(G.run && G.run.player.hp > 0, 'L' + l + ': two quiet seconds run without errors');
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
require('fs').writeFileSync(__dirname + '/island-results.json', JSON.stringify({ pass, fail }, null, 1));
process.exitCode = fail ? 1 : 0;
