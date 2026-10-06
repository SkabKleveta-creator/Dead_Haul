// Deterministic logic tests: cargo ownership, extraction rules, rewards, persistence, snapshot restore.
const { load, blankInput } = require('./harness');
let pass = 0, fail = 0;
const results = [];
const ok = (cond, name) => { if (cond) pass++; else { fail++; console.log('FAIL', name); } results.push([cond ? 'PASS' : 'FAIL', name]); };
const section = (n) => console.log('--', n);

// ---------- Cargo ----------
section('cargo');
{
  const ctx = load(); const DH = ctx.DH, G = DH.G; DH.Save.load();
  const run = G.newRun(7);
  const C = DH.Cargo;
  ok(C.check(run).length === 0, 'fresh run cargo invariants');
  ok(C.pickUp(run, 'case').ok && run.items.case.loc === 'backpack', 'pick up case into backpack');
  ok(!C.pickUp(run, 'case').ok, 'cannot pick up case twice');
  ok(!C.pickUp(run, 'generator').ok, 'generator cannot go in backpack');
  for (let i = 0; i < 6; i++) C.pickUp(run, 'salvage' + i);
  ok(C.used(run, 'backpack') === 6, 'backpack fills to 6 units');
  ok(run.items.salvage5.loc === 'world', 'seventh unit refused and stays in world');
  const r = C.pickUp(run, 'salvage5'); ok(!r.ok && /full/i.test(r.msg), 'full backpack gives clear message');
  ok(C.transfer(run, 'case', 'truck').ok && run.items.case.loc === 'truck', 'transfer case to truck');
  ok(!C.transfer(run, 'case', 'truck').ok, 'transfer twice rejected');
  for (let i = 0; i < 5; i++) C.transfer(run, 'salvage' + i, 'truck');
  ok(C.used(run, 'truck') === 6 && !C.transfer(run, 'case', 'truck').ok, 'truck capacity 6 enforced');
  ok(!C.canLoadGenerator(run).ok, 'generator needs 3 free truck units');
  for (let i = 0; i < 3; i++) C.transfer(run, 'salvage' + i, 'backpack');
  ok(C.canLoadGenerator(run).ok && C.loadGenerator(run).ok && run.items.generator.loc === 'truck', 'generator loads with 3 free units');
  ok(C.used(run, 'truck') === 6, 'generator counts 3 units');
  ok(!C.transfer(run, 'generator', 'backpack').ok, 'generator never transfers to backpack');
  ok(C.unloadGenerator(run, 30, 100).ok && run.items.generator.loc === 'world', 'generator unloads to world');
  // fuzz
  const rnd = DH.RNG(99); let bad = 0;
  const ids = Object.keys(run.items);
  for (let k = 0; k < 5000; k++) {
    const id = ids[Math.floor(rnd.next() * ids.length)];
    const op = rnd.int(0, 4);
    if (op === 0) C.pickUp(run, id); else if (op === 1) C.transfer(run, id, 'truck'); else if (op === 2) C.transfer(run, id, 'backpack');
    else if (op === 3) C.loadGenerator(run); else C.unloadGenerator(run, 30, 100);
    if (C.check(run).length) bad++;
  }
  ok(bad === 0, 'cargo invariants hold over 5000 random operations');
  ok(Object.values(run.items).filter((i) => i.kind === 'case').length === 1, 'exactly one medical case exists');
}

// ---------- Extraction ----------
section('extraction');
{
  const ctx = load(); const DH = ctx.DH, G = DH.G; DH.Save.load();
  const run = G.newRun(8);
  const E = DH.Extract, R = DH.T.rewards;
  let e = E.evaluate(run, 'truck', {});
  ok(e.status === 'partial' && e.scrap === 0 && !e.caseOut, 'truck extraction without case is partial, no scrap');
  run.items.case.loc = 'truck';
  e = E.evaluate(run, 'truck', {}); ok(e.status === 'success' && e.scrap === R.case, 'case in truck bed counts for truck extraction');
  e = E.evaluate(run, 'foot', {}); ok(e.status === 'partial' && !e.caseOut, 'case left in truck does NOT count for foot extraction');
  ok(e.leftBehind.some((s) => /truck/i.test(s)), 'foot extraction lists abandoned truck cargo');
  run.items.case.loc = 'backpack';
  e = E.evaluate(run, 'foot', {}); ok(e.status === 'success' && e.scrap === R.case, 'case in backpack counts on foot');
  run.items.generator.loc = 'truck';
  e = E.evaluate(run, 'foot', {}); ok(!e.generatorOut, 'generator never leaves on foot');
  e = E.evaluate(run, 'truck', { survivorBoarded: true }); ok(e.generatorOut && e.survivorOut && e.scrap === R.case + R.generator + R.survivor, 'truck extraction with generator + boarded survivor rewards');
  e = E.evaluate(run, 'foot', { survivorNearMobile: true }); ok(e.survivorOut, 'survivor within 4 m counts on foot');
  e = E.evaluate(run, 'foot', { survivorNearMobile: false, survivorRecruited: true, survivorDowned: true }); ok(!e.survivorOut && e.leftBehind.some((s) => /downed/i.test(s)), 'downed survivor reported as left behind');
  run.items.salvage0.loc = 'backpack'; run.items.salvage1.loc = 'truck';
  e = E.evaluate(run, 'foot', {}); ok(e.salvageOut === 1, 'foot extraction counts only backpack salvage');
  e = E.evaluate(run, 'truck', {}); ok(e.salvageOut === 2, 'truck extraction counts backpack + bed salvage');
  run.items.case.loc = 'world';
  e = E.evaluate(run, 'truck', {}); ok(e.status === 'partial' && e.scrap === R.generator + 2 * R.salvage, 'partial extraction still earns optional rewards, not the primary');
  e = E.evaluate(run, 'death', {}); ok(e.status === 'failed' && e.scrap === 0, 'death is failure with no rewards');
}

// ---------- Persistence ----------
section('persistence');
{
  const ctx = load(); const DH = ctx.DH, G = DH.G;
  ctx.localStorage.setItem('skab.othergame.save', '{"keep":1}');
  ctx.localStorage.setItem('arcade.highscores', 'abc');
  DH.Save.load();
  ok(DH.Save.status === 'ok', 'fresh storage loads ok');
  const run = G.newRun(9);
  G.state = 'play';
  run.items.case.loc = 'backpack';
  DH.Save.saveRun(G.snapshot());
  ok(DH.Save.hasRun(), 'active run saved');
  G.endRun('foot');
  const s1 = DH.Save.data.campaign.scrap;
  ok(s1 === DH.T.rewards.case, 'reward committed once (' + s1 + ')');
  ok(!DH.Save.hasRun(), 'active run cleared after terminal result');
  const again = DH.Save.commitResult(run.id, { status: 'success', scrap: 40, time: 10 });
  ok(!again && DH.Save.data.campaign.scrap === s1, 'committing the same run id twice is a no-op');
  // simulate a reload with a stale active snapshot of a finished run
  const raw = JSON.parse(ctx.localStorage.getItem(DH.SAVE_KEY));
  raw.active = Object.assign({}, raw.active || {}, { id: run.id, v: 1 });
  ctx.localStorage.setItem(DH.SAVE_KEY, JSON.stringify(raw));
  DH.Save.load();
  ok(!DH.Save.hasRun(), 'stale snapshot of an already-rewarded run is discarded on load');
  ok(DH.Save.data.campaign.scrap === s1, 'scrap preserved across reload');
  // upgrades
  DH.Save.data.campaign.scrap = 100; DH.Save.write();
  ok(DH.Save.buy('quiet').ok && DH.Save.data.campaign.scrap === 50, 'buy Quiet Exhaust for 50');
  ok(!DH.Save.buy('quiet').ok, 'cannot buy twice');
  ok(DH.Save.buy('gear').ok && DH.Save.data.campaign.scrap === 10, 'buy Loading Gear for 40');
  ok(!DH.Save.buy('bumper').ok, 'insufficient scrap refused');
  DH.Save.load(); ok(DH.Save.data.campaign.upgrades.quiet && DH.Save.data.campaign.upgrades.gear, 'purchases persisted immediately');
  // run uses upgrades
  const r2 = G.newRun(10, DH.Save.data.campaign.upgrades);
  ok(G.truckNoiseMul() === 0.75, 'Quiet Exhaust applies 25% truck noise reduction on next deployment');
  // corrupt
  ctx.localStorage.setItem(DH.SAVE_KEY, '{not json');
  DH.Save.load(); ok(DH.Save.status === 'corrupt' && DH.Save.data.campaign.scrap === 0, 'corrupt save -> message + fresh session, no crash');
  // valid campaign + broken active
  ctx.localStorage.setItem(DH.SAVE_KEY, JSON.stringify({ v: 1, campaign: { scrap: 77, upgrades: { quiet: true } }, active: { garbage: true } }));
  DH.Save.load(); ok(DH.Save.data.campaign.scrap === 77 && DH.Save.data.campaign.upgrades.quiet && !DH.Save.hasRun(), 'broken active run dropped, campaign preserved');
  // reset
  DH.Save.resetAll();
  ok(DH.Save.data.campaign.scrap === 0 && !DH.Save.data.campaign.upgrades.quiet, 'reset all progress');
  ok(ctx.localStorage.getItem('skab.othergame.save') === '{"keep":1}' && ctx.localStorage.getItem('arcade.highscores') === 'abc', "other games' storage untouched");
  const keys = Object.keys(ctx.__store).filter((k) => k.startsWith('skab.deadhaul'));
  ok(keys.every((k) => k === 'skab.deadhaul.v1' || k === 'skab.deadhaul.v1.corrupt'), 'only game-specific keys written: ' + keys.join(','));
}
{
  const ctx = load({ noStorage: true }); const DH = ctx.DH;
  let threw = false;
  try { DH.Save.load(); DH.G.newRun(3); DH.Save.saveRun(DH.G.snapshot()); DH.Save.commitResult('x', { status: 'success', scrap: 5, time: 1 }); } catch (e) { threw = e; }
  ok(!threw && DH.Save.status === 'unavailable', 'unavailable storage: no crash, status reported');
}

// ---------- Snapshot / restore ----------
section('snapshot');
{
  const ctx = load(); const DH = ctx.DH, G = DH.G; DH.Save.load();
  G.state = 'play';
  const run = G.newRun(11);
  for (let i = 0; i < 300; i++) G.update(DH.DT, blankInput());
  // mutate state
  run.pickups[0].taken = true; DH.Interact.takePickup(run.pickups[1]);
  DH.World.setDoor(0, true, 'player'); run.doors[2].broken = true; G.applyRunToWorld();
  run.reserve.remaining = 5; run.reserve.groups = 2;
  DH.Cargo.pickUp(run, 'case');
  run.zombies[3].hp = 0; run.zombies[3].dead = true;
  // attach two clingers
  run.player.inTruck = true;
  const cl = run.zombies.filter((z) => z.type === 'clinger').slice(0, 2);
  for (const z of cl) { z.x = run.truck.x; z.y = run.truck.y + 1.5; DH.Truck.attach(z); }
  ok(run.truck.clingers.length === 2, 'two clingers attached');
  const third = run.zombies.find((z) => z.type === 'clinger' && !z.attached);
  third.x = run.truck.x; third.y = run.truck.y - 1.5;
  ok(!DH.Truck.attach(third) && run.truck.clingers.length === 2, 'third clinger cannot attach');
  const snap = JSON.parse(JSON.stringify(G.snapshot()));
  const n0 = run.zombies.length;
  const r2 = G.restore(snap);
  ok(r2.zombies.length === n0, 'zombie count preserved');
  ok(r2.truck.clingers.length === 2 && r2.zombies.filter((z) => z.attached).length === 2, 'clingers not duplicated by save/load');
  ok(r2.pickups[0].taken && r2.pickups[1].taken, 'depleted pickups stay depleted');
  ok(r2.doors[0].open && r2.doors[2].broken && G.W.doors[2].broken, 'changed doors restored');
  ok(r2.reserve.remaining === 5 && r2.reserve.groups === 2, 'reserve spawn budget restored (not reset)');
  ok(r2.items.case.loc === 'backpack', 'objective ownership restored');
  ok(r2.seed === run.seed && Math.abs(r2.time - run.time) < 1e-6, 'seed and mission time restored');
  ok(r2.player.iframes > 0, 'resume grants brief protection');
  // continue simulating after restore
  let err = null; try { for (let i = 0; i < 600; i++) G.update(DH.DT, blankInput()); } catch (e) { err = e; }
  ok(!err, 'simulation continues after restore' + (err ? ' ' + err.stack : ''));
}

// ---------- Long idle simulation / reserve spawns ----------
section('long sim');
{
  const ctx = load(); const DH = ctx.DH, G = DH.G; DH.Save.load();
  G.state = 'play';
  const run = G.newRun(12);
  const spawnDists = [];
  DH.bus.on('hordeSpawn', (e) => { const p = DH.Player.pos(); spawnDists.push(Math.hypot(e.x - p.x, e.y - p.y)); });
  let err = null; let maxZ = 0; let stepNoise = 0;
  // stand near the truck, firing occasionally to raise heat
  try {
    for (let i = 0; i < 60 * 600; i++) {
      const inp = blankInput();
      if (i % 240 === 0) { inp.fire = true; inp.firePressed = true; inp.aimDir = Math.PI; }
      run.player.iframes = 10; // isolate spawning behaviour from death
      G.update(DH.DT, inp);
      if (!G.run) break;
      maxZ = Math.max(maxZ, run.zombies.filter((z) => !z.dead).length);
      stepNoise = Math.max(stepNoise, G.noise.length);
    }
  } catch (e) { err = e; }
  ok(!err, '10 simulated minutes without exceptions' + (err ? ' ' + err.stack : ''));
  ok(run.reserve.remaining >= 0 && 12 - run.reserve.remaining <= 12, 'reserve never exceeds 12 (' + (12 - run.reserve.remaining) + ' spawned)');
  ok(spawnDists.every((d) => d >= 25), 'reserve groups spawn >= 25 m from player (' + spawnDists.map((d) => d.toFixed(0)).join(',') + ')');
  ok(stepNoise <= 40, 'noise event list stays bounded (' + stepNoise + ')');
  ok(maxZ <= 54, 'living zombies <= 42 + 12 (' + maxZ + ')');
  const active = run.zombies.filter((z) => !z.dead && ['chase', 'windup', 'lunge', 'recover', 'howl', 'leap', 'attached'].includes(z.state)).length;
  ok(active <= 24, 'active pursuers capped at 24 (' + active + ')');
}

// ---------- Walls block shots / sight ----------
section('walls');
{
  const ctx = load(); const DH = ctx.DH, G = DH.G; DH.Save.load();
  G.state = 'play';
  const run = G.newRun(13);
  const W = G.W;
  ok(!W.los(34, 56, 34, 50), 'pharmacy south wall blocks sight (window)');
  ok(W.los(33.5, 56, 33.5, 50) === false, 'closed front door blocks sight');
  DH.World.setDoor(W.doors.findIndex((d) => d.label === 'Front Door' && d.bld === 'pharmacy'), true);
  ok(W.los(33.5, 56, 33.5, 50), 'open front door allows sight');
  // shoot at a zombie behind a wall
  const z = run.zombies[0]; z.x = 30; z.y = 50; z.hp = 55; z.dead = false; z.state = 'idle';
  const p = run.player; p.x = 30; p.y = 56; p.aim = -Math.PI / 2; // zombie is north, behind the wall
  const hp0 = z.hp;
  DH.Player.shoot(p, { type: 'pistol', mag: 12 });
  ok(z.hp === hp0, 'pistol shot blocked by wall');
  p.x = 30; p.y = 47.5; z.x = 30; z.y = 50; p.aim = Math.PI / 2;
  DH.Player.shoot(p, { type: 'pistol', mag: 12 });
  ok(z.hp < hp0, 'shot with clear line hits the zombie torso volume');
  // zombie at wall should not path through walls
  const path = W.findPath(30, 56, 30, 50, true);
  ok(path && path.every((q) => !W.wall[W.idx(Math.floor(q.x), Math.floor(q.y))]), 'zombie path never crosses wall tiles');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
require('fs').writeFileSync(__dirname + '/logic-results.json', JSON.stringify({ pass, fail, results }, null, 1));
process.exit(fail ? 1 : 0);
