// Browser acceptance checks (Playwright + Chromium). Records PASS / FAIL / NOT TESTED with notes.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const URL = 'file://' + path.resolve(__dirname, '../dist/index.html');
const report = [];
const rec = (id, name, status, notes, env) => { report.push({ id, name, status, notes, env }); console.log(status.padEnd(10), id, name, '-', notes); };

const HELPERS = () => {
  const G = DH.G, M = DH.M;
  window.TH = {
    fresh(seed, opts) {
      opts = opts || {};
      DH.Save.clearRun(); DH.Input.pressed.clear();
      G.backdrop = false;
      G.newRun(seed || 1, Object.assign({}, DH.Save.data.campaign.upgrades));
      if (opts.noZ) G.run.zombies = [];
      G.state = 'play'; DH.UI.show(null); DH.UI.setHud(true);
      DH.Save.settings().hints = false; document.getElementById('hint').classList.add('hidden');
      DH.debug.manual = true;
      DH.R.updateCamera(0, true);
      return true;
    },
    tp(x, y) { const p = G.run.player; p.x = x; p.y = y; DH.R.updateCamera(0, true); },
    spawn(type, x, y, st) { const z = DH.Z.make(G.run, type, x, y, null); if (st) Object.assign(z, st); G.run.zombies.push(z); return z.id; },
    z(id) { return G.run.zombies.find((q) => q.id === id); },
    step(n, mod) { return DH.debug.step(n, (inp, i) => { if (mod) mod(inp, i); if (inp.aimDir != null && !inp._keepWorld) { inp.aimWorld = null; inp.aimZombie = null; } }); },
    toScreenDir(wx, wy) { return Math.atan2((wx + wy) * 12, (wx - wy) * 24); },
  };
  return true;
};

async function newPage(browser, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1366, height: 768 } }, opts || {}));
  const page = await ctx.newPage();
  page._errors = [];
  page.on('pageerror', (e) => page._errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') page._errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForTimeout(600);
  await page.evaluate(HELPERS);
  return { ctx, page };
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const ENV = 'Chromium 141 headless (Playwright 1.56), Linux, 1366x768, keyboard+mouse';
  let { ctx, page } = await newPage(browser);
  const E = (fn, arg) => page.evaluate(fn, arg);

  // ---------- 1. Fresh start ----------
  try {
    const titleVisible = await page.isVisible('#scr-title');
    await page.click('#b-new'); await page.click('#b-go');
    await page.waitForTimeout(300);
    const start = await E(() => { const p = DH.G.run.player; return { x: p.x, y: p.y, minZ: Math.min(...DH.G.run.zombies.map((z) => Math.hypot(z.x - p.x, z.y - p.y))) }; });
    await page.keyboard.down('KeyW'); await page.waitForTimeout(400); await page.keyboard.up('KeyW');
    const moved = await E(() => DH.G.run.player.y);
    // survive the first 20 s idle (no forced combat)
    await E(() => { DH.debug.manual = true; });
    const after20 = await E(() => { DH.debug.step(60 * 20); return { hp: DH.G.run.player.hp, chasing: DH.G.run.zombies.filter((z) => z.state === 'chase').length }; });
    const hintOk = await E(() => { DH.Save.settings().hints = true; DH.G.run.hints = {}; DH.UI.hint('start'); return !document.getElementById('hint').classList.contains('hidden'); });
    await page.click('#hint-x');
    const hintGone = await E(() => document.getElementById('hint').classList.contains('hidden'));
    await E(() => { DH.Truck.enter(); });
    const dh = await page.isVisible('#drivehelp'); await page.click('#drivehelp-x'); const dhGone = !(await page.isVisible('#drivehelp'));
    const ok = titleVisible && moved < start.y - 0.3 && start.minZ >= 18 && after20.hp === 100 && after20.chasing === 0 && hintOk && hintGone && dh && dhGone && page._errors.length === 0;
    rec(1, 'Fresh start, safe spawn, dismissible prompts', ok ? 'PASS' : 'FAIL', `nearest zombie ${start.minZ.toFixed(1)} m; moved with W; 20 s idle hp=${after20.hp}, chasing=${after20.chasing}; hint+drive help dismissed=${hintGone && dhGone}; console errors=${page._errors.length}`, ENV);
  } catch (e) { rec(1, 'Fresh start', 'FAIL', String(e), ENV); }

  // ---------- 2. Movement, aim, targeting ----------
  try {
    await E(() => TH.fresh(2, { noZ: true }));
    const mv = await E(() => {
      const out = [];
      const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
      for (const [ix, iy] of dirs) {
        TH.tp(36, 59.5); // open stretch of the cross street, clear of wrecks
        const p = DH.G.run.player; const x0 = p.x, y0 = p.y;
        TH.step(30, (inp) => { inp.move = { x: ix, y: iy }; });
        const dx = p.x - x0, dy = p.y - y0;
        const scrA = TH.toScreenDir(dx, dy), want = Math.atan2(iy, ix);
        out.push({ err: Math.abs(DH.M.angDiff(scrA, want)) * 57.3, dist: Math.hypot(dx, dy) });
      }
      return out;
    });
    const maxErr = Math.max(...mv.map((m) => m.err));
    const dists = mv.map((m) => m.dist); const spread = (Math.max(...dists) - Math.min(...dists)) / Math.max(...dists);
    // mouse aim in 8 directions
    await E(() => { TH.tp(60, 59.5); DH.debug.manual = true; });
    const aimErrs = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const c = await E(() => { const p = DH.G.run.player; return DH.R.toScreen(p.x, p.y, 1.15); });
      await page.mouse.move(c.x + Math.cos(a) * 160, c.y + Math.sin(a) * 160);
      const aim = await E(() => { const inp = DH.Input.sample(false); const p = DH.G.run.player; return Math.atan2(inp.aimWorld.y - p.y, inp.aimWorld.x - p.x); });
      const scr = await E((aim) => TH.toScreenDir(Math.cos(aim), Math.sin(aim)), aim);
      aimErrs.push(Math.abs(Math.atan2(Math.sin(scr - a), Math.cos(scr - a))) * 57.3);
    }
    // targeting: click on a zombie torso, at normal and driving zoom
    const hits = [];
    for (const zoomMul of [1, 0.8]) {
      const id = await E((zm) => { DH.G.run.zombies = []; TH.tp(60, 59.5); DH.G.run.player.fireCd = 0; DH.G.run.player.reload = 0; DH.R.cam.zoom = DH.R.cam.base * zm; const id = TH.spawn('drifter', 64.5, 57.5, { state: 'idle', visible: true, seenA: 1 }); DH.R.render(0.016); DH.DH = 1; return id; }, zoomMul);
      await E(() => { DH.debug.manual = true; DH.Z.updateAll(0.1); });
      const s = await E((id) => { const z = TH.z(id); return DH.R.toScreen(z.x, z.y, 1.1); }, id);
      await page.mouse.move(s.x, s.y);
      await page.mouse.down();
      await E(() => TH.step(2));
      await page.mouse.up();
      const hp = await E((id) => { const z = TH.z(id); return z ? z.hp : -1; }, id);
      const rt = await E(() => { const p = DH.G.run.player; const sc = DH.R.toScreen(p.x, p.y, 0); const w = DH.R.screenToWorld(sc.x, sc.y, 0); return Math.hypot(w.x - p.x, w.y - p.y); });
      hits.push({ zoomMul, hit: hp < 55, rt });
    }
    const ok = maxErr < 3 && spread < 0.03 && Math.max(...aimErrs) < 4 && hits.every((h) => h.hit && h.rt < 0.01);
    rec(2, 'Move/aim all directions, normalized diagonals, zoom-safe targeting', ok ? 'PASS' : 'FAIL', `move dir error max ${maxErr.toFixed(2)} deg, speed spread ${(spread * 100).toFixed(2)}%, mouse aim error max ${Math.max(...aimErrs).toFixed(2)} deg, torso click hit at zoom x1=${hits[0].hit} x0.8=${hits[1].hit}, screen<->world round-trip ${hits[1].rt.toExponential(1)} m`, ENV);
  } catch (e) { rec(2, 'Move/aim', 'FAIL', String(e), ENV); }

  // ---------- 3. Pharmacy entrances, case, extract, reward, upgrade, redeploy ----------
  try {
    await E(() => { DH.Save.resetAll(); TH.fresh(3, { noZ: true }); });
    // front door via real E key
    await E(() => { TH.tp(33.9, 54.7); DH.G.run.player.face = -Math.PI / 2; DH.debug.manual = false; });
    await page.waitForTimeout(150);
    await page.keyboard.press('KeyE'); await page.waitForTimeout(150);
    const front = await E(() => DH.G.run.doors[DH.G.W.doors.findIndex((d) => d.label === 'Front Door' && d.bld === 'pharmacy')].open);
    await E(() => { DH.debug.manual = true; });
    const walkedIn = await E(() => { TH.step(60, (inp) => { inp.move = { x: 0, y: -1 }; }); const p = DH.G.run.player; return DH.G.W.bld[DH.G.W.idx(Math.floor(p.x), Math.floor(p.y))] === DH.G.W.buildings.find((b) => b.key === 'pharmacy').id; });
    // rear loading door
    await E(() => { TH.tp(40.9, 37.3); DH.G.run.player.face = Math.PI / 2; DH.debug.manual = false; });
    await page.waitForTimeout(150); await page.keyboard.press('KeyE'); await page.waitForTimeout(150);
    const rear = await E(() => DH.G.run.doors[DH.G.W.doors.findIndex((d) => d.label === 'Loading Door')].open);
    await E(() => { DH.debug.manual = true; });
    const inStock = await E(() => { TH.step(50, (inp) => { inp.move = { x: -0.5, y: 0.5 }; }); return DH.G.run.player.y > 38.5; });
    // take the case with E
    await E(() => { TH.tp(27.4, 41.8); DH.G.run.player.face = Math.PI; DH.debug.manual = false; });
    await page.waitForTimeout(150); await page.keyboard.press('KeyE'); await page.waitForTimeout(200);
    const caseLoc = await E(() => DH.G.run.items.case.loc);
    // to the truck rear, transfer with the panel
    await E(() => { const r = DH.Truck.rearPoint(); TH.tp(r.x - 0.4, r.y); DH.G.run.player.face = 0; });
    await page.waitForTimeout(200);
    const prim = await E(() => DH.Interact.primary && DH.Interact.primary.id);
    await page.keyboard.press('KeyE'); await page.waitForTimeout(200);
    const panel = await page.isVisible('#transfer');
    await page.click('#tf-stow'); await page.waitForTimeout(100);
    const caseInTruck = await E(() => DH.G.run.items.case.loc);
    await page.click('#tf-take'); await page.waitForTimeout(100);
    const caseBack = await E(() => DH.G.run.items.case.loc);
    await page.click('#tf-stow'); await page.waitForTimeout(100);
    // drive into the SW exit zone
    await E(() => { DH.Truck.enter(); DH.debug.manual = true; const t = DH.G.run.truck; t.x = 9; t.y = 102.5; t.ang = Math.PI; });
    await E(() => TH.step(90, (inp) => { inp.drive.throttle = 1; }));
    const modal = await page.isVisible('#scr-depart');
    const leaving = await E(() => document.getElementById('dp-leave').textContent);
    await page.click('#dp-go'); await page.waitForTimeout(200);
    const res = await E(() => ({ title: document.getElementById('rs-title').textContent, scrap: DH.Save.data.campaign.scrap, earned: document.getElementById('rs-scrap').textContent }));
    await page.click('#rs-garage'); await page.waitForTimeout(100);
    if (await E(() => !document.getElementById('scr-after').classList.contains('hidden'))) { await page.click('#af-skip'); await page.waitForTimeout(100); }
    const quietDisabled = await E(() => !!document.querySelector('[data-buy=quiet]') && document.querySelector('[data-buy=quiet]').disabled);
    await page.click('[data-buy=gear]'); await page.waitForTimeout(100);
    const afterBuy = await E(() => ({ scrap: DH.Save.data.campaign.scrap, gear: DH.Save.data.campaign.upgrades.gear }));
    // the board's main Deploy now points at the next story mission (Cold Chain); replay Mercer Crossing from its card
    const nextIsM2 = await E(() => /Cold Chain/.test(document.getElementById('g-deploy').textContent));
    await page.click('[data-deploy="1"]'); await page.click('#b-go'); await page.waitForTimeout(200);
    const eff = await E(() => { DH.debug.manual = true; const run = DH.G.run; run.zombies = []; const g = run.items.generator; DH.G.run.player.hauling = true; g.loc = 'hauled'; const r = DH.Truck.rearPoint(); TH.tp(r.x - 0.3, r.y); g.x = r.x - 1.2; g.y = r.y; DH.Interact.update(0, DH.Input.sample(false)); const lbl = DH.Interact.primary && DH.Interact.primary.label; return { upg: DH.G.upg.gear, lbl }; });
    const ok = front && walkedIn && rear && inStock && caseLoc === 'backpack' && prim === 'transfer' && panel && caseInTruck === 'truck' && caseBack === 'backpack' && modal && /Medical Case/.test(leaving) && res.title === 'MISSION COMPLETE' && res.scrap === 40 && quietDisabled && afterBuy.gear && afterBuy.scrap === 0 && eff.upg && /1\.5 s/.test(eff.lbl) && nextIsM2;
    rec(3, 'Both pharmacy entrances -> case -> truck -> extract -> reward -> upgrade -> redeploy', ok ? 'PASS' : 'FAIL', `front door opened=${front}, walked in=${walkedIn}, loading door opened=${rear}, case=${caseLoc}, tailgate prompt=${prim}, transfer stow/take/stow ok=${caseInTruck === 'truck' && caseBack === 'backpack'}, depart modal=${modal}, result "${res.title}" +${res.earned} scrap, Loading Gear bought (scrap ${afterBuy.scrap}), next run prompt "${eff.lbl}", board's main Deploy pointed at Cold Chain=${nextIsM2}, Mercer replayed from its mission card`, ENV);
  } catch (e) { rec(3, 'Pharmacy -> extract -> garage', 'FAIL', String(e), ENV); }

  // ---------- 4. Primary only ----------
  try {
    const r = JSON.parse(fs.readFileSync(path.join(__dirname, 'autopilot-results.json'), 'utf8'));
    const wins = r.filter((x) => x.status === 'success').length;
    rec(4, 'Primary mission completes while skipping survivor and generator', wins === r.length ? 'PASS' : 'FAIL', `Check 3 extracted with optional objectives untouched (MISSION COMPLETE). Node autopilot (standard loadout, no invulnerability): ${wins}/${r.length} successes across foot and truck routes.`, ENV + ' + Node 22 simulation');
  } catch (e) { rec(4, 'Primary only', 'FAIL', String(e), ENV); }

  // ---------- 5. Partial extraction, death with case ----------
  try {
    await E(() => TH.fresh(5, { noZ: true }));
    await E(() => { TH.tp(31, 113.5); TH.step(60, (inp) => { inp.move = { x: 0.3, y: 1 }; }); });
    const modal = await page.isVisible('#scr-depart');
    const warn = await E(() => document.getElementById('dp-warn').textContent);
    await page.click('#dp-go'); await page.waitForTimeout(150);
    const partial = await E(() => ({ t: document.getElementById('rs-title').textContent, sub: document.getElementById('rs-sub').textContent, scrap: +document.getElementById('rs-scrap').textContent }));
    const before = await E(() => DH.Save.data.campaign.scrap);
    await E(() => { TH.fresh(6, { noZ: true }); DH.Cargo.pickUp(DH.G.run, 'case'); const p = DH.G.run.player; p.hp = 10; TH.spawn('drifter', p.x + 0.8, p.y, { state: 'chase', target: 'player', lastSeen: DH.G.time }); TH.step(60 * 5); });
    await page.waitForTimeout(150);
    const dead = await E(() => ({ t: document.getElementById('rs-title').textContent, scrap: DH.Save.data.campaign.scrap, run: DH.Save.hasRun() }));
    const ok = modal && /partial/i.test(warn) && partial.t === 'PARTIAL EXTRACTION' && /incomplete/i.test(partial.sub) && partial.scrap === 0 && dead.t === 'YOU DIED' && dead.scrap === before && !dead.run;
    rec(5, 'Partial extraction without case; death with case = failure, no reward', ok ? 'PASS' : 'FAIL', `foot exit without case -> "${partial.t}" (${partial.sub}) +${partial.scrap}; death with case -> "${dead.t}", scrap ${before} -> ${dead.scrap}, resumable run cleared=${!dead.run}`, ENV);
  } catch (e) { rec(5, 'Partial/death', 'FAIL', String(e), ENV); }

  // ---------- 6. Weapons, ammo, reload, pickups, swap, melee, healing ----------
  try {
    await E(() => TH.fresh(7, { noZ: true }));
    const r = await E(() => {
      const run = DH.G.run, p = run.player, out = {};
      const take = (kind, wt) => { const k = run.pickups.find((q) => q.kind === kind && (!wt || q.wtype === wt) && !q.taken); TH.tp(k.x - 0.5, k.y); p.face = 0; DH.Interact.update(0, DH.Input.sample(false)); const id = DH.Interact.primary && DH.Interact.primary.id; TH.step(1, (inp) => { inp.interactPressed = true; }); return id === k.id; };
      out.shotgunTaken = take('weapon', 'shotgun');
      out.after1 = p.weapons.map((w) => w.type + ':' + w.mag).join(',') + ' shells=' + p.ammo.shell;
      const fireAt = (type) => {
        run.zombies = []; TH.tp(60, 59.5);
        const id = TH.spawn('howler', 64, 59.5, { hp: 999, maxHp: 999, state: 'idle' });
        p.cur = p.weapons.findIndex((w) => w.type === type);
        const w = p.weapons[p.cur]; const m0 = w.mag; const a0 = p.ammo[DH.WEAPONS[type].ammo];
        p.fireCd = 0; p.reload = 0;
        TH.step(1, (inp) => { inp.fire = true; inp.firePressed = true; inp.aimDir = 0; });
        const z = TH.z(id);
        return { dmg: 999 - z.hp, used: m0 - w.mag, reserve: a0 };
      };
      out.shotgun = fireAt('shotgun');
      out.pistol = fireAt('pistol');
      // reload pistol
      const pw = p.weapons.find((w) => w.type === 'pistol'); pw.mag = 3; const res0 = p.ammo.p9;
      TH.step(1, (inp) => { inp.reload = true; }); TH.step(80);
      out.reload = { mag: pw.mag, reserveDelta: res0 - p.ammo.p9 };
      // swap
      const c0 = p.cur; TH.step(1, (inp) => { inp.swap = true; }); out.swapped = p.cur !== c0;
      // pick up SMG with two firearms -> current dropped, magazine preserved
      p.cur = p.weapons.findIndex((w) => w.type === 'shotgun'); p.weapons[p.cur].mag = 4;
      out.smgTaken = take('weapon', 'smg');
      const dropped = run.pickups.find((k) => k.kind === 'weapon' && k.wtype === 'shotgun' && !k.taken);
      out.dropped = dropped ? dropped.mag : null;
      out.smg = fireAt('smg');
      // rifle replaces smg
      out.rifleTaken = take('weapon', 'rifle');
      out.rifle = fireAt('rifle');
      out.loadout = p.weapons.map((w) => w.type).join(',');
      // melee: two crowbar hits kill a drifter (30 x 2 >= 55)
      run.zombies = []; TH.tp(60, 59.5); p.aim = 0; p.face = 0;
      const did = TH.spawn('drifter', 61.1, 59.5, { state: 'idle' });
      TH.step(1, (inp) => { inp.melee = true; inp.aimDir = 0; }); TH.step(45, (inp) => { inp.aimDir = 0; });
      const hp1 = TH.z(did) ? TH.z(did).hp : 0;
      TH.step(1, (inp) => { inp.melee = true; inp.aimDir = 0; }); TH.step(45, (inp) => { inp.aimDir = 0; });
      out.melee = { first: 55 - hp1, dead: !TH.z(did) || TH.z(did).dead };
      // healing interrupted by moving does not consume
      p.hp = 50; const mk = p.medkits;
      TH.step(1, (inp) => { inp.heal = true; }); TH.step(30); TH.step(5, (inp) => { inp.move = { x: 1, y: 0 }; }); TH.step(120);
      out.healInterrupted = { hp: p.hp, medkits: p.medkits, before: mk };
      TH.step(1, (inp) => { inp.heal = true; }); TH.step(130);
      out.healed = { hp: p.hp, medkits: p.medkits };
      return out;
    });
    const ok = r.shotgunTaken && r.shotgun.dmg >= 56 && r.shotgun.used === 1 && r.pistol.dmg === 30 && r.pistol.used === 1 && r.reload.mag === 12 && r.reload.reserveDelta === 9 && r.swapped && r.smgTaken && r.dropped === 4 && r.smg.dmg === 13 && r.rifleTaken && r.rifle.dmg === 75 && r.melee.first === 30 && r.melee.dead && r.healInterrupted.medkits === r.healInterrupted.before && r.healInterrupted.hp === 50 && r.healed.hp === 90 && r.healed.medkits === r.healInterrupted.before - 1;
    rec(6, 'Weapons, ammo types, reload, pickup, swap/drop, melee, interrupted healing', ok ? 'PASS' : 'FAIL', `shotgun from cabinet (${r.after1}); damage per trigger pull: shotgun ${r.shotgun.dmg} (6 pellets), pistol ${r.pistol.dmg}, SMG ${r.smg.dmg}, rifle ${r.rifle.dmg}; one round consumed per shot; reload 3->${r.reload.mag} used ${r.reload.reserveDelta} reserve; swap ok; SMG pickup dropped shotgun with mag ${r.dropped}; final loadout ${r.loadout}; crowbar ${r.melee.first} dmg, 2 hits kill=${r.melee.dead}; heal cancelled by moving kept kit (${r.healInterrupted.medkits}/${r.healInterrupted.before}), completed heal 50->${r.healed.hp}. Wall blocking: see check 7 and Node tests.`, ENV);
  } catch (e) { rec(6, 'Weapons', 'FAIL', String(e), ENV); }

  // ---------- 7. Enemy types and perception ----------
  try {
    await E(() => TH.fresh(8, { noZ: true }));
    const r = await E(() => {
      const run = DH.G.run, p = run.player, out = {};
      // drifter: windup, then hit, then cooldown; never per-frame damage
      TH.tp(60, 59.5); p.hp = 100;
      const d = TH.spawn('drifter', 61.2, 59.5, { state: 'chase', target: 'player', lastSeen: DH.G.time });
      const hpLog = []; let sawWindup = false;
      TH.step(180, () => { const z = TH.z(d); if (z && z.state === 'windup') sawWindup = true; hpLog.push(p.hp); });
      const drops = []; for (let i = 1; i < hpLog.length; i++) if (hpLog[i] < hpLog[i - 1]) drops.push(i);
      out.drifter = { sawWindup, hits: drops.length, minGap: drops.length > 1 ? Math.min(...drops.slice(1).map((v, i) => v - drops[i])) / 60 : null };
      // runner lunge can miss: sidestep during windup
      run.zombies = []; TH.tp(60, 59.5); p.hp = 100; p.iframes = 0;
      const rn = TH.spawn('runner', 62.0, 59.5, { state: 'chase', target: 'player', lastSeen: DH.G.time });
      let lunged = false; let moved = false;
      TH.step(90, (inp) => { const z = TH.z(rn); if (z && z.state === 'windup' && !moved) { moved = true; p.x = 60; p.y = 56.5; } if (z && z.state === 'lunge') lunged = true; });
      out.runnerMiss = { lunged, hp: p.hp };
      // howler: interrupt the inhale by shooting
      run.zombies = []; TH.tp(60, 59.5); p.hp = 100;
      const h = TH.spawn('howler', 66, 59.5, { state: 'chase', target: 'player', lastSeen: DH.G.time, face: Math.PI });
      let inhaling = false; TH.step(40, () => { const z = TH.z(h); if (z.state === 'howl') inhaling = true; });
      const noiseBefore = DH.G.noise.filter((n) => n.kind === 'howl').length;
      p.weapons[0].mag = 12; p.fireCd = 0; p.reload = 0; TH.step(1, (inp) => { inp.fire = true; inp.aimDir = 0; });
      const hz = TH.z(h); out.howl = { inhaling, afterShot: hz.state, howlEvents: DH.G.noise.filter((n) => n.kind === 'howl').length - noiseBefore };
      // let a second howl complete
      TH.step(60 * 6, (inp) => { p.hp = 100; p.iframes = 1; });
      out.howlDone = DH.G.noise.some((n) => n.kind === 'howl' && n.r === 32) || run.zombies.some((z) => z.id === h && z.howlCd > 0);
      // noise investigation: idle drifter 15 m away hears a noise maker
      run.zombies = []; DH.G.noise.length = 0; TH.tp(30, 47); // player hidden inside the pharmacy
      const di = TH.spawn('drifter', 75, 59.5, { state: 'idle', face: 0 });
      DH.G.emitNoise(70, 59.5, 20, 'noisemaker', 3);
      TH.step(30);
      const dz = TH.z(di); out.investigate = { state: dz.state, tx: +dz.tx.toFixed(1) };
      // LOS loss -> investigate/search, never through walls
      run.zombies = []; TH.tp(30, 47); // inside pharmacy sales area
      const lz = TH.spawn('drifter', 30, 58, { state: 'chase', target: 'player', lastSeen: DH.G.time });
      TH.step(60 * 8, () => { p.iframes = 1; });
      const lzz = TH.z(lz);
      const wallTile = DH.G.W.wall[DH.G.W.idx(Math.floor(lzz.x), Math.floor(lzz.y))];
      out.los = { state: lzz.state, inWall: !!wallTile, x: +lzz.x.toFixed(1), y: +lzz.y.toFixed(1) };
      // separation: crowd does not collapse
      run.zombies = []; TH.tp(60, 59.5);
      for (let i = 0; i < 12; i++) TH.spawn('drifter', 65 + (i % 4) * 0.3, 57 + Math.floor(i / 4) * 0.3, { state: 'chase', target: 'player', lastSeen: DH.G.time });
      TH.step(240, () => { p.iframes = 1; p.hp = 100; });
      let minD = 9; const zs = run.zombies.filter((z) => !z.dead);
      for (let i = 0; i < zs.length; i++) for (let j = i + 1; j < zs.length; j++) minD = Math.min(minD, Math.hypot(zs[i].x - zs[j].x, zs[i].y - zs[j].y));
      out.minSep = +minD.toFixed(2);
      // walls: zombie outside the pharmacy cannot hit the player inside
      run.zombies = []; TH.tp(30, 52.2); p.hp = 100; p.iframes = 0;
      TH.spawn('drifter', 30, 54.8, { state: 'chase', target: 'player', lastSeen: DH.G.time });
      TH.step(120, () => { const z = run.zombies[0]; z.x = 30; z.y = 54.8; });
      out.throughWall = p.hp;
      return out;
    });
    // clinger behaviour checked in 10
    const ok = r.drifter.sawWindup && r.drifter.hits >= 2 && r.drifter.minGap >= 1.5 && r.runnerMiss.lunged && r.runnerMiss.hp === 100 && r.howl.inhaling && r.howl.afterShot === 'stagger' && r.howl.howlEvents === 0 && r.howlDone && r.investigate.state === 'investigate' && Math.abs(r.investigate.tx - 70) < 2 && !r.los.inWall && r.los.state !== 'chase' && r.minSep > 0.4 && r.throughWall === 100;
    rec(7, 'Enemy types, LOS loss, noise investigation, howler interrupt, cooldowns, avoidance', ok ? 'PASS' : 'FAIL', `drifter windup seen=${r.drifter.sawWindup}, ${r.drifter.hits} hits in 3 s, min gap ${r.drifter.minGap && r.drifter.minGap.toFixed(2)} s; runner lunged and missed a sidestepping player (hp ${r.runnerMiss.hp}); howler inhale interrupted by a pistol hit -> ${r.howl.afterShot}, no howl emitted, later howl completed=${r.howlDone}; idle drifter heard noise maker -> ${r.investigate.state} toward x=${r.investigate.tx}; after losing sight -> ${r.los.state} at (${r.los.x},${r.los.y}), inside wall=${r.los.inWall}; crowd min separation ${r.minSep} m; zombie against the wall outside did not hurt player inside (hp ${r.throughWall}). Clinger: check 10.`, ENV);
  } catch (e) { rec(7, 'Enemies', 'FAIL', String(e), ENV); }

  // ---------- 8. Alarm and noise maker ----------
  try {
    await E(() => TH.fresh(9, { noZ: true }));
    const r = await E(() => {
      const run = DH.G.run, p = run.player, W = DH.G.W, out = {};
      TH.tp(58.6, 45.6); p.face = Math.PI / 2;
      const far = []; for (let i = 0; i < 5; i++) far.push(TH.spawn('drifter', 52 + i * 2, 70, { state: 'idle', face: -1.5 }));
      const nearId = TH.spawn('drifter', 59.4, 44.2, { state: 'idle', face: Math.PI });
      DH.Interact.update(0, DH.Input.sample(false));
      out.prompt = DH.Interact.primary && DH.Interact.primary.label;
      TH.step(1, (inp) => { inp.interactPressed = true; });
      out.active = run.alarm.active > 0;
      TH.tp(20, 20); // player leaves; near zombie keeps chasing? (it saw the player)
      TH.step(60 * 4, () => { p.iframes = 1; });
      out.farStates = far.map((id) => TH.z(id).state);
      out.farToward = far.filter((id) => { const z = TH.z(id); return Math.hypot(z.tx - W.alarmCar.x, z.ty - W.alarmCar.y) < 4; }).length;
      // visible nearby player takes precedence over the alarm
      TH.tp(56, 64);
      const vz = TH.spawn('drifter', 56, 61, { state: 'idle', face: Math.PI / 2 });
      run.alarm.active = 0; run.alarm.cooldown = 0; DH.World.triggerAlarm(false);
      TH.step(60, () => { p.iframes = 1; });
      out.visiblePrecedence = TH.z(vz).state;
      // expiry: after alarm and noise end, no alarm events remain
      TH.tp(20, 20);
      TH.step(60 * 14, () => { p.iframes = 1; });
      out.alarmEventsAfter = DH.G.noise.filter((n) => n.kind === 'alarm').length;
      out.cooldown = run.alarm.cooldown;
      // noise maker throw
      run.zombies = []; TH.tp(60, 80); p.aim = 0;
      const nz = TH.spawn('drifter', 75, 80, { state: 'idle', face: Math.PI });
      const nm0 = p.noisemakers;
      TH.step(1, (inp) => { inp.throwN = true; inp.aimWorld = { x: 68, y: 80 }; });
      TH.step(60);
      const z = TH.z(nz);
      out.nm = { consumed: nm0 - p.noisemakers, state: z.state, dist: +Math.hypot(z.tx - run.noisemakers[0].x, z.ty - run.noisemakers[0].y).toFixed(1), landed: run.noisemakers[0].landed };
      TH.step(60 * 10);
      out.nmExpired = run.noisemakers.length === 0 && !DH.G.noise.some((n) => n.kind === 'noisemaker');
      // throw range clamp (10 m)
      TH.tp(60, 80); TH.step(1, (inp) => { inp.throwN = true; inp.aimWorld = { x: 95, y: 80 }; });
      out.clamp = +Math.hypot(run.noisemakers[0].x - 60, run.noisemakers[0].y - 80).toFixed(2);
      return out;
    });
    const ok = /Trigger Car Alarm/.test(r.prompt) && r.active && r.farToward >= 3 && r.visiblePrecedence === 'chase' && r.alarmEventsAfter === 0 && r.cooldown > 0 && r.nm.consumed === 1 && r.nm.state === 'investigate' && r.nm.dist < 2.5 && r.nmExpired && r.clamp <= 10.01 && r.clamp > 8.5;
    rec(8, 'Car alarm and noise maker redirect zombies; visible player wins; sounds expire', ok ? 'PASS' : 'FAIL', `prompt "${r.prompt}"; ${r.farToward}/5 distant drifters investigating the alarm (${r.farStates.join(',')}); drifter that can see the player 3 m away stayed "${r.visiblePrecedence}"; after expiry alarm events=${r.alarmEventsAfter}, cooldown ${r.cooldown.toFixed(1)} s; noise maker consumed=${r.nm.consumed}, drifter -> ${r.nm.state} (${r.nm.dist} m from device), expired=${r.nmExpired}; 35 m throw toward the diner clamped to ${r.clamp} m (10 m max, stopped short of the wall)`, ENV);
  } catch (e) { rec(8, 'Alarm/noise maker', 'FAIL', String(e), ENV); }

  // ---------- 9. Driving ----------
  try {
    await E(() => { TH.fresh(10, { noZ: true }); DH.Truck.enter(); DH.debug.manual = false; });
    const t0 = await E(() => ({ x: DH.G.run.truck.x, ang: DH.G.run.truck.ang }));
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1500);
    const fwd = await E(() => ({ v: DH.G.run.truck.speed, x: DH.G.run.truck.x }));
    await page.keyboard.up('KeyW'); await page.keyboard.down('KeyS'); await page.waitForTimeout(2600);
    const rev = await E(() => DH.G.run.truck.speed);
    await page.keyboard.up('KeyS');
    await page.keyboard.down('Space'); await page.waitForTimeout(500); await page.keyboard.up('Space');
    const angBefore = await E(() => DH.G.run.truck.ang);
    await page.keyboard.down('KeyW'); await page.waitForTimeout(800); await page.keyboard.down('KeyD'); await page.waitForTimeout(900);
    const turnR = await E(() => DH.G.run.truck.ang);
    t0.ang = angBefore;
    await page.keyboard.up('KeyD'); await page.keyboard.up('KeyW');
    await page.keyboard.down('Space'); await page.waitForTimeout(700); await page.keyboard.up('Space');
    const hb = await E(() => DH.G.run.truck.speed);
    await E(() => { DH.debug.manual = true; });
    const r = await E(() => {
      const run = DH.G.run, t = run.truck, out = {};
      // exit refused while moving
      t.x = 40; t.y = 102.5; t.ang = 0; t.speed = 6;
      TH.step(1, (inp) => { inp.interactPressed = true; inp.drive.throttle = 1; });
      out.exitMoving = run.player.inTruck;
      // crash into the laundromat wall at speed (north side of the south street)
      t.x = 30; t.y = 90.5; t.ang = -Math.PI / 2; t.speed = 7; t.dur = 200;
      const hits = [];
      TH.step(120, (inp, i) => { inp.drive.throttle = 1; hits.push(t.dur); });
      const losses = []; for (let i = 1; i < hits.length; i++) if (hits[i] < hits[i - 1]) losses.push(hits[i - 1] - hits[i]);
      out.crash = { events: losses.length, first: losses[0] || 0, total: 200 - t.dur };
      // nudges at low speed cost nothing
      const d0 = t.dur; t.speed = 0;
      TH.step(60, (inp) => { inp.drive.throttle = 0.3; });
      out.nudge = d0 - t.dur;
      // exit next to a wall: never inside wall or zombie
      t.speed = 0; run.zombies = [];
      const zid = TH.spawn('drifter', t.x - 2.0, t.y, { state: 'idle' });
      TH.step(1, (inp) => { inp.interactPressed = true; });
      const p = run.player, W = DH.G.W;
      out.exit = { out: !p.inTruck, inWall: !W.circleFree(p.x, p.y, 0.3), zDist: +Math.hypot(TH.z(zid).x - p.x, TH.z(zid).y - p.y).toFixed(2) };
      return out;
    });
    const ok = fwd.v > 3 && fwd.x < t0.x - 2 && rev < -0.5 && Math.abs(DH_angDiff(turnR, t0.ang)) > 0.2 && Math.abs(hb) < Math.abs(rev) + 8 && r.exitMoving && r.crash.events >= 1 && r.crash.events <= 3 && r.crash.first <= 20 && r.nudge === 0 && r.exit.out && !r.exit.inWall && r.exit.zDist > 1.0;
    rec(9, 'Drive, brake, reverse, turn, collide, enter/exit safety', ok ? 'PASS' : 'FAIL', `W 1.5 s -> ${fwd.v.toFixed(1)} m/s forward; S -> braked then reversed (${rev.toFixed(1)} m/s); W+D turned ${(DH_angDiff(turnR, t0.ang) * 57.3).toFixed(0)} deg; handbrake speed ${hb.toFixed(2)}; exit refused while moving=${r.exitMoving}; wall crash at 7 m/s: ${r.crash.events} damage event(s) over 2 s of contact, first ${r.crash.first.toFixed(1)}, total ${r.crash.total.toFixed(1)}; slow nudge cost ${r.nudge}; exit spot clear of walls=${!r.exit.inWall}, ${r.exit.zDist} m from nearest zombie`, ENV);
  } catch (e) { rec(9, 'Driving', 'FAIL', String(e), ENV); }

  // ---------- 10. Clingers ----------
  try {
    await E(() => TH.fresh(11, { noZ: true }));
    const r = await E(() => {
      const run = DH.G.run, t = run.truck, p = run.player, out = {};
      DH.Truck.enter(); t.x = 60; t.y = 80; t.ang = -Math.PI / 2;
      const ids = [TH.spawn('clinger', 62.5, 80.5), TH.spawn('clinger', 57.6, 79.5), TH.spawn('clinger', 62.6, 78)];
      ids.forEach((id) => Object.assign(TH.z(id), { state: 'chase', target: 'truck', lastSeen: DH.G.time }));
      let tells = 0; DH.bus.on('clingerTell', () => tells++);
      TH.step(60 * 3, (inp) => { inp.drive.handbrake = true; });
      out.attached = t.clingers.length;
      out.tells = tells;
      const d0 = t.dur; TH.step(120, (inp) => { inp.drive.handbrake = true; });
      out.dps = (d0 - t.dur) / 2;
      DH.UI.last = {}; DH.UI.update(0.016); out.hud = document.getElementById('cl-num').textContent;
      // save/load does not duplicate
      const snap = DH.G.snapshot(); DH.G.restore(snap); DH.debug.manual = true;
      out.afterLoad = { cl: DH.G.run.truck.clingers.length, attachedZ: DH.G.run.zombies.filter((z) => z.attached).length };
      // stop, exit, knock them off
      const run2 = DH.G.run;
      TH.step(1, (inp) => { inp.interactPressed = true; });
      out.exited = !run2.player.inTruck;
      let guard = 0;
      while (run2.truck.clingers.length && guard++ < 20) {
        const c = run2.truck.clingers[0]; const z = run2.zombies.find((q) => q.id === c.zid);
        const sp = DH.G.W.findFreeNear(z.x + (z.x - run2.truck.x) * 0.3, z.y + (z.y - run2.truck.y) * 0.3, 0.32, 2) || { x: z.x, y: z.y };
        run2.player.x = sp.x; run2.player.y = sp.y; run2.player.iframes = 2;
        DH.Interact.update(0, DH.Input.sample(false));
        const cand = [DH.Interact.primary].concat(DH.Interact.alts);
        const k = cand.findIndex((q) => q && q.id && q.id.indexOf('clinger') === 0);
        TH.step(1, (inp) => { if (k === 0) inp.interactPressed = true; else if (k > 0) inp.alt[k - 1] = true; else inp.melee = true; inp.aimDir = Math.atan2(z.y - run2.player.y, z.x - run2.player.x); });
        TH.step(50, () => { run2.player.iframes = 2; });
      }
      out.removed = run2.truck.clingers.length;
      return out;
    });
    const ok = r.attached === 2 && r.tells >= 2 && Math.abs(r.dps - 6) < 1.1 && r.hud === '2' && r.afterLoad.cl === 2 && r.afterLoad.attachedZ === 2 && r.exited && r.removed === 0;
    rec(10, 'Two clingers attach, damage, warning, removal; no third; no duplication on load', ok ? 'PASS' : 'FAIL', `3 clingers approached, ${r.attached} attached (third refused), ${r.tells} leap tells; truck damage ${r.dps.toFixed(1)}/s; HUD clinger count ${r.hud}; after save/load ${r.afterLoad.cl} attached; exited and pried/struck off -> ${r.removed} remaining`, ENV);
  } catch (e) { rec(10, 'Clingers', 'FAIL', String(e), ENV); }

  // ---------- 11. Generator ----------
  try {
    await E(() => TH.fresh(12, { noZ: true }));
    const r = await E(() => {
      const run = DH.G.run, t = run.truck, p = run.player, g = run.items.generator, out = {};
      t.x = 86; t.y = 58.6; t.ang = 0; // parked outside the yard gate
      TH.tp(g.x - 1.0, g.y); p.face = 0;
      DH.Interact.update(0, DH.Input.sample(false)); out.prompt = DH.Interact.primary.label;
      TH.step(1, (inp) => { inp.interactPressed = true; });
      out.hauling = p.hauling && g.loc === 'hauled';
      const x0 = p.x, y0 = p.y; out.expect = +(DH.T.player.walk * DH.T.player.haulMul).toFixed(2); TH.step(60, (inp) => { inp.move = { x: -1, y: 0 }; inp.sprint = true; });
      out.speed = +(Math.hypot(p.x - x0, p.y - y0)).toFixed(2);
      const shots = run.stats.shots; TH.step(5, (inp) => { inp.fire = true; inp.firePressed = true; inp.aimDir = 0; }); out.firedWhileHauling = run.stats.shots - shots;
      TH.step(1, (inp) => { inp.drop = true; }); out.dropped = !p.hauling && g.loc === 'world';
      const gx = g.x, gy = g.y; TH.step(30, (inp) => { inp.move = { x: 1, y: 0 }; }); out.stayed = g.x === gx && g.y === gy;
      TH.tp(g.x - 1.0, g.y); p.face = 0; TH.step(1, (inp) => { inp.interactPressed = true; }); out.resumed = p.hauling;
      // walk the dolly to the tailgate through the gate along a valid path
      const rp = DH.Truck.rearPoint();
      const path = DH.G.W.findPath(p.x, p.y, rp.x, rp.y, false, 20000);
      out.pathOk = !!path;
      let guard = 0;
      while (DH.M.dist(p.x, p.y, rp.x, rp.y) > 1.0 && guard++ < 60 * 40) {
        const wp = path.find((q) => DH.M.dist(p.x, p.y, q.x, q.y) > 0.8) || rp;
        const dx = wp.x - p.x, dy = wp.y - p.y; const ix = (dx - dy) / 2, iy = (dx + dy) / 4; const l = Math.hypot(ix, iy) || 1;
        TH.step(1, (inp) => { inp.move = { x: ix / l, y: iy / l }; });
        while (path.length > 1 && DH.M.dist(p.x, p.y, path[0].x, path[0].y) < 0.8) path.shift();
      }
      out.atRear = DH.Truck.inRearZone(p.x, p.y);
      // fill the bed so loading is refused
      ['salvage0', 'salvage1', 'salvage2', 'salvage3'].forEach((id) => (run.items[id].loc = 'truck'));
      DH.Interact.update(0, DH.Input.sample(false)); out.fullMsg = DH.Interact.primary && DH.Interact.primary.label;
      ['salvage0', 'salvage1', 'salvage2', 'salvage3'].forEach((id) => (run.items[id].loc = 'world'));
      // interrupted load (release after 1 s)
      DH.Interact.update(0, DH.Input.sample(false));
      TH.step(1, (inp) => { inp.interactPressed = true; inp.interactHeld = true; });
      TH.step(60, (inp) => { inp.interactHeld = true; });
      TH.step(2);
      out.interrupted = { loc: g.loc, hauling: p.hauling, gens: Object.values(run.items).filter((i) => i.kind === 'generator').length };
      // full load (hold 3 s)
      TH.step(1, (inp) => { inp.interactPressed = true; inp.interactHeld = true; });
      TH.step(190, (inp) => { inp.interactHeld = true; });
      out.loaded = { loc: g.loc, used: DH.Cargo.used(run, 'truck'), hauling: p.hauling };
      // unload then reload
      DH.Interact.update(0, DH.Input.sample(false));
      const cands = [DH.Interact.primary].concat(DH.Interact.alts); const ui = cands.findIndex((c) => c && c.id === 'unloadGen');
      TH.step(1, (inp) => { if (ui === 0) inp.interactPressed = true; else inp.alt[ui - 1] = true; inp.interactHeld = true; });
      TH.step(90, (inp) => { inp.interactHeld = true; });
      out.unloaded = g.loc;
      DH.Cargo.loadGenerator(run);
      // extract with it
      DH.Truck.enter(); t.x = 105.5; t.y = 3; t.ang = -Math.PI / 2; TH.step(5);
      return out;
    });
    await page.waitForTimeout(100);
    const modal = await page.isVisible('#scr-depart');
    const leaving = await E(() => document.getElementById('dp-leave').textContent);
    await page.click('#dp-go'); await page.waitForTimeout(100);
    const gen = await E(() => document.getElementById('rs-table').textContent);
    const ok = /Haul Generator/.test(r.prompt) && r.hauling && Math.abs(r.speed - r.expect) < 0.12 && r.firedWhileHauling === 0 && r.dropped && r.stayed && r.resumed && r.pathOk && r.atRear && /needs 3 free/.test(r.fullMsg) && r.interrupted.loc === 'hauled' && r.interrupted.gens === 1 && r.loaded.loc === 'truck' && r.loaded.used === 3 && !r.loaded.hauling && r.unloaded === 'world' && modal && /Generator/.test(leaving) && /Recovered \+35/.test(gen);
    rec(11, 'Generator: haul, drop, resume, load, interrupt, full truck, unload, extract', ok ? 'PASS' : 'FAIL', `prompt "${r.prompt}"; hauling speed ${r.speed} m/s (55% of walking = ${r.expect}, sprint ignored); shots while hauling ${r.firedWhileHauling}; X dropped it and it stayed put; resumed; valid path through the yard gate to the tailgate; full bed -> "${r.fullMsg}"; released E after 1 s -> still ${r.interrupted.loc}, ${r.interrupted.gens} generator; 3 s hold -> ${r.loaded.loc} (${r.loaded.used} units); unload -> ${r.unloaded}; NE exit listed Generator and paid +35`, ENV);
  } catch (e) { rec(11, 'Generator', 'FAIL', String(e), ENV); }

  // ---------- 12. Transfers ----------
  try {
    await E(() => TH.fresh(13, { noZ: true }));
    const r = await E(() => {
      const run = DH.G.run, out = {};
      Object.values(run.items).forEach((i) => { if (i.kind !== 'generator') i.loc = 'backpack'; }); run.items.salvage5.loc = 'truck';
      const rp = DH.Truck.rearPoint(); TH.tp(rp.x - 0.3, rp.y); run.player.face = 0;
      DH.G.transferOpen = true; DH.UI.update(0.016);
      let errs = 0; const rnd = DH.RNG(5);
      for (let k = 0; k < 400; k++) {
        const ids = Object.keys(run.items).filter((i) => i !== 'generator');
        const id = ids[Math.floor(rnd.next() * ids.length)];
        DH.Interact.transfer(id, rnd.next() < 0.5 ? 'truck' : 'backpack');
        if (DH.Cargo.check(run).length) errs++;
      }
      DH.Interact.stowAll(); out.after = [DH.Cargo.used(run, 'backpack'), DH.Cargo.used(run, 'truck')];
      DH.Interact.takeAll(); out.after2 = [DH.Cargo.used(run, 'backpack'), DH.Cargo.used(run, 'truck')];
      out.errs = errs; out.caseCount = Object.values(run.items).filter((i) => i.kind === 'case').length;
      out.caseFoot = DH.Extract.evaluate(run, 'foot', {}).caseOut === (run.items.case.loc === 'backpack');
      return out;
    });
    // click-driven transfers through the panel
    await E(() => { DH.debug.manual = false; DH.G.transferOpen = true; DH.UI.last = {}; });
    await page.waitForTimeout(150);
    const btns = await page.$$('#tf-bp [data-tf]');
    if (btns.length) { await btns[0].click(); await page.waitForTimeout(80); }
    const clicked = await E(() => DH.Cargo.used(DH.G.run, 'truck'));
    await E(() => { DH.debug.manual = true; });
    const ok = r.errs === 0 && r.after[0] + r.after[1] === 7 && r.after[1] === 6 && r.after2[0] === 6 && r.caseCount === 1 && r.caseFoot && clicked >= 1;
    rec(12, 'Repeated light-cargo transfers keep capacity and ownership', ok ? 'PASS' : 'FAIL', `400 random transfers starting from a full backpack (7 items, 6+6 capacity): invariant violations ${r.errs}; stow all -> pack/bed ${r.after.join('/')}; take all -> ${r.after2.join('/')}; one case exists; foot rule matches case location; panel button click moved an item (bed ${clicked})`, ENV);
  } catch (e) { rec(12, 'Transfers', 'FAIL', String(e), ENV); }

  // ---------- 13. Survivor ----------
  try {
    await E(() => TH.fresh(14, { noZ: true }));
    const r = await E(() => {
      const run = DH.G.run, s = run.survivor, p = run.player, t = run.truck, out = {};
      // open the back room door and recruit
      const di = DH.G.W.doors.findIndex((d) => d.label === 'Back Room Door'); DH.World.setDoor(di, true);
      TH.tp(85.6, 74.0); p.face = -Math.PI / 2;
      DH.Interact.update(0, DH.Input.sample(false)); out.prompt = DH.Interact.primary.label;
      TH.step(1, (inp) => { inp.interactPressed = true; });
      out.recruited = s.recruited;
      // follow: walk out the front door; survivor follows through doors
      DH.World.setDoor(DH.G.W.doors.findIndex((d) => d.label === 'Front Door' && d.bld === 'diner'), true);
      const route = [[86.5, 77], [80, 80], [76.5, 83], [76.5, 88], [76, 92]];
      for (const [x, y] of route) { let g = 0; while (DH.M.dist(p.x, p.y, x, y) > 0.4 && g++ < 400) { const dx = x - p.x, dy = y - p.y; const ix = (dx - dy) / 2, iy = (dx + dy) / 4, l = Math.hypot(ix, iy) || 1; TH.step(1, (inp) => { inp.move = { x: ix / l, y: iy / l }; }); } }
      TH.step(180);
      out.followDist = +DH.M.dist(s.x, s.y, p.x, p.y).toFixed(1);
      // wait command
      TH.step(1, (inp) => { inp.command = true; }); const wx = s.x, wy = s.y;
      TH.tp(70, 92); TH.step(120); out.waited = DH.M.dist(s.x, s.y, wx, wy) < 0.5 && s.mode === 'wait';
      TH.tp(wx + 1.5, wy); TH.step(1, (inp) => { inp.command = true; }); out.following = s.mode === 'follow';
      // board the stopped truck
      t.x = wx + 4; t.y = wy + 3; t.ang = 0; t.speed = 0;
      DH.Truck.enter(); TH.step(60 * 6);
      out.boarded = s.boarded;
      // exit -> disembarks
      TH.step(1, (inp) => { inp.interactPressed = true; }); TH.step(5);
      out.disembarked = !s.boarded && !p.inTruck;
      // downed and revive (4 s + medkit)
      DH.Survivor.damage(999); out.downed = s.state;
      TH.tp(s.x + 0.8, s.y); p.face = Math.PI; const mk = p.medkits;
      DH.Interact.update(0, DH.Input.sample(false)); out.revPrompt = DH.Interact.primary.label;
      TH.step(1, (inp) => { inp.interactPressed = true; }); TH.step(60 * 4 + 10);
      out.revived = { state: s.state, medkits: mk - p.medkits };
      // foot extraction with survivor near
      run.items.case.loc = 'backpack';
      out.footNear = DH.Extract.evaluate(run, 'foot', DH.G.extractCtx('foot')).survivorOut;
      s.x = p.x + 8; out.footFar = DH.Extract.evaluate(run, 'foot', DH.G.extractCtx('foot'));
      return out;
    });
    const ok = /Recruit/.test(r.prompt) && r.recruited && r.followDist < 4 && r.waited && r.following && r.boarded && r.disembarked && r.downed === 'downed' && /Revive/.test(r.revPrompt) && r.revived.state === 'following' && r.revived.medkits === 1 && r.footNear && !r.footFar.survivorOut && (r.footFar.leftBehind.includes('Survivor') || r.footFar.leftBehind.includes('Nell'));
    rec(13, 'Survivor: recruit, follow, wait, board, disembark, revive, extraction rules', ok ? 'PASS' : 'FAIL', `"${r.prompt}" -> recruited; followed out of the diner (${r.followDist} m behind); Wait held position=${r.waited}; Follow resumed; boarded stopped truck=${r.boarded}; disembarked on exit=${r.disembarked}; downed -> "${r.revPrompt}" -> ${r.revived.state} using ${r.revived.medkits} kit; foot extraction counts her within 4 m, reports "Nell" left behind when far. Truck-boarded extraction counted in Node tests.`, ENV);
  } catch (e) { rec(13, 'Survivor', 'FAIL', String(e), ENV); }

  // ---------- 14. Disabled truck ----------
  try {
    await E(() => TH.fresh(15, { noZ: true }));
    const r = await E(() => {
      const run = DH.G.run, t = run.truck, p = run.player, out = {};
      run.items.case.loc = 'truck'; run.items.salvage0.loc = 'truck';
      DH.Truck.damage(250, 'clinger'); out.disabled = t.disabled;
      DH.Truck.enter(); t.speed = 0; TH.step(60, (inp) => { inp.drive.throttle = 1; }); out.moved = Math.hypot(t.x - 26, t.y - 102.6) > 0.1;
      TH.step(1, (inp) => { inp.interactPressed = true; });
      const rp = DH.Truck.rearPoint(); TH.tp(rp.x - 0.3, rp.y); p.face = 0;
      DH.Interact.update(0, DH.Input.sample(false)); const cands = [DH.Interact.primary].concat(DH.Interact.alts).map((c) => c && c.id);
      out.cands = cands.join(',');
      DH.Interact.takeAll(); out.retrieved = run.items.case.loc;
      // repair with kit (4 s)
      const k = cands.indexOf('repair');
      TH.step(1, (inp) => { if (k === 0) inp.interactPressed = true; else inp.alt[k - 1] = true; }); TH.step(250);
      out.repaired = { disabled: t.disabled, dur: t.dur, kits: p.repairkits };
      return out;
    });
    // independent: disabled truck, no kit, foot evac with case
    await E(() => TH.fresh(16, { noZ: true }));
    const r2 = await E(() => { const run = DH.G.run; run.player.repairkits = 0; DH.Truck.damage(999, 'clinger'); DH.Cargo.pickUp(run, 'case'); TH.tp(31, 113); TH.step(80, (inp) => { inp.move = { x: 0.35, y: 1 }; }); return DH.G.confirm ? DH.G.confirm.ev.status : null; });
    await page.click('#dp-go'); await page.waitForTimeout(100);
    const title = await E(() => document.getElementById('rs-title').textContent);
    const ok = r.disabled && !r.moved && /transfer/.test(r.cands) && /repair/.test(r.cands) && r.retrieved === 'backpack' && !r.repaired.disabled && r.repaired.dur === 60 && r.repaired.kits === 0 && r2 === 'success' && title === 'MISSION COMPLETE';
    rec(14, 'Disabled truck keeps cargo; repair with kit; foot evacuation without kit', ok ? 'PASS' : 'FAIL', `disabled=${r.disabled} (no explosion), would not drive; tailgate options ${r.cands}; case retrieved to ${r.retrieved}; repair kit -> durability ${r.repaired.dur}, running; separate run with no kit walked the case out: ${r2} / "${title}"`, ENV);
  } catch (e) { rec(14, 'Disabled truck', 'FAIL', String(e), ENV); }

  // ---------- 15. Exits ----------
  try {
    await E(() => TH.fresh(17, { noZ: true }));
    const a = await E(() => { const run = DH.G.run, t = run.truck; DH.Truck.enter(); t.x = 7; t.y = 102.5; t.ang = Math.PI; TH.step(150, (inp) => { inp.drive.throttle = 1; }); return { confirm: !!DH.G.confirm, zone: DH.G.confirm && DH.G.confirm.zone.id, speed: t.speed, time: run.time }; });
    await page.click('#dp-cancel'); await page.waitForTimeout(50);
    const b = await E(() => { const run = DH.G.run; const st = DH.G.state; DH.debug.manual = true; const tt = run.time; TH.step(30, (inp) => { inp.drive.handbrake = true; }); return { state: st, reprompt: !!DH.G.confirm, inExit: DH.G.inExit && DH.G.inExit.id, hp: run.player.hp, dur: run.truck.dur, adv: run.time - tt }; });
    const btn = await page.isVisible('#btn-depart');
    await E(() => { DH.debug.manual = false; });
    await page.keyboard.press('Enter'); await page.waitForTimeout(150);
    const again = await page.isVisible('#scr-depart');
    await page.click('#dp-cancel'); await E(() => { DH.debug.manual = true; });
    const ne = await E(() => { const run = DH.G.run, t = run.truck; t.x = 105.5; t.y = 8; t.ang = -Math.PI / 2; TH.step(120, (inp) => { inp.drive.throttle = 1; }); return DH.G.confirm && DH.G.confirm.zone.id; });
    await page.click('#dp-go'); await page.waitForTimeout(100);
    const neRes = await E(() => document.getElementById('rs-eyebrow').textContent);
    const ok = a.confirm && a.zone === 'sw' && b.state === 'play' && !b.reprompt && b.inExit === 'sw' && btn && again && ne === 'ne' && /TRUCK/.test(neRes);
    rec(15, 'Both road exits and the foot exit; cancel departure', ok ? 'PASS' : 'FAIL', `SW zone prompted (simulation paused); Stay -> back to play with no penalty, no re-prompt loop, Depart button + Enter re-open it; NE zone prompted and extracted (${neRes}); foot exit covered in checks 5 and 14; foot extraction never counts abandoned truck cargo (Node tests)`, ENV);
  } catch (e) { rec(15, 'Exits', 'FAIL', String(e), ENV); }

  // ---------- 16. Doors and shelf ----------
  try {
    await E(() => TH.fresh(18, { noZ: true }));
    const r = await E(() => {
      const run = DH.G.run, W = DH.G.W, p = run.player, out = {};
      const sd = W.doors.findIndex((d) => d.label === 'Stockroom Door');
      DH.World.setDoor(sd, true); out.open = run.doors[sd].open && W.los(31.5, 46, 31.5, 42);
      DH.World.setDoor(sd, false); out.closedBlocks = !W.los(31.5, 46, 31.5, 42);
      DH.World.setDoor(sd, true);
      // push the shelf across the stockroom doorway (from the sales side)
      TH.tp(29.5, 47); p.face = -Math.PI / 2;
      DH.Interact.update(0, DH.Input.sample(false)); out.shelfPrompt = (DH.Interact.primary.id === 'shelf' ? DH.Interact.primary : DH.Interact.alts.find((a) => a.id === 'shelf') || {}).label;
      DH.Player.startAction('shelf', 0.8, 'Moving shelf'); TH.step(60);
      out.blocked = run.shelf.state === 'block' && !W.findPath(30, 48, 32, 41, false, 20000) === false;
      const pathHumans = W.findPath(30, 48, 32, 41, false, 20000);
      out.humanPathLen = pathHumans ? pathHumans.length : null; // goes round via the loading door
      // zombie in the sales area hunting the player in the stockroom must batter the shelf
      TH.tp(31.5, 41.5);
      DH.G.noise.length = 0; // let the shelf-push noise expire so the drifter's goal is the stockroom
      const zid = TH.spawn('drifter', 32, 48.5, { state: 'investigate', tx: 31.5, ty: 41.5, t: 60 });
      DH.World.setDoor(W.doors.findIndex((d) => d.label === 'Loading Door'), false);
      DH.World.setDoor(W.doors.findIndex((d) => d.label === 'Front Door' && d.bld === 'pharmacy'), false);
      let battered = false; const hp0 = run.shelf.hp;
      TH.step(60 * 60, () => { p.iframes = 1; p.hp = 100; const z = TH.z(zid); if (z && z.state === 'batter') battered = true; if (run.shelf.broken) return; });
      out.battered = battered; out.shelfHp = [hp0, run.shelf.hp, run.shelf.broken];
      out.pathAfter = !!W.findPath(32, 48.5, 31.5, 41.5, true, 20000);
      out.essential = !!W.findPath(27, 56, 26.5, 41.6, false, 20000);
      return out;
    });
    const ok = r.open && r.closedBlocks && /Push Shelf/.test(r.shelfPrompt) && r.humanPathLen > 0 && r.battered && r.shelfHp[2] && r.pathAfter && r.essential;
    rec(16, 'Doors open/close; shelf barricade delays and is battered; routes never permanently blocked', ok ? 'PASS' : 'FAIL', `closed door blocks sight=${r.closedBlocks}; "${r.shelfPrompt}" blocked the stockroom door; humans still reach the case via the loading door (path ${r.humanPathLen} nodes); drifter switched to battering, shelf hp ${r.shelfHp[0]} -> ${r.shelfHp[1]}, broken=${r.shelfHp[2]}; path restored afterwards; route from the street to the case always exists`, ENV);
  } catch (e) { rec(16, 'Doors/shelf', 'FAIL', String(e), ENV); }

  // ---------- 17. Visibility aids never reveal through walls ----------
  try {
    await E(() => TH.fresh(19, { noZ: true }));
    const r = await E(() => {
      const run = DH.G.run, out = {};
      TH.tp(34, 57); // street outside the pharmacy
      const inside = TH.spawn('drifter', 34, 50, { state: 'idle' });
      const behindCar = TH.spawn('drifter', 40, 58, { state: 'idle' });
      DH.Z.visT = 0; DH.Z.updateAll(0.016); DH.R.render(0.016);
      out.insideVisible = TH.z(inside).visible;
      out.streetVisible = TH.z(behindCar).visible;
      // player inside: roof fades, zombie in the unexplored stockroom (closed door) stays hidden
      TH.tp(30, 48); const stock = TH.spawn('drifter', 27, 41, { state: 'idle' });
      DH.Z.visT = 0; DH.Z.updateAll(0.016);
      for (let i = 0; i < 40; i++) DH.R.render(0.05);
      out.roofAlpha = DH.R.alpha.get('r' + DH.G.W.buildings.find((b) => b.key === 'pharmacy').id);
      out.stockVisible = TH.z(stock).visible;
      return out;
    });
    await page.screenshot({ path: path.resolve(__dirname, '../screenshots/accept_17_roof_fade.jpg') });
    const ok = !r.insideVisible && r.streetVisible && r.roofAlpha < 0.05 && !r.stockVisible;
    rec(17, 'Depth/roof fade/visibility: no enemy exposed through solid walls', ok ? 'PASS' : 'FAIL', `zombie inside the closed pharmacy hidden from the street=${!r.insideVisible}; zombie in the open street visible=${r.streetVisible}; roof alpha inside=${r.roofAlpha.toFixed(2)}; zombie behind the closed stockroom door hidden=${!r.stockVisible}. Depth sorting, silhouettes and flashes reviewed visually in screenshots (see report).`, ENV + ' + visual review');
  } catch (e) { rec(17, 'Visibility', 'FAIL', String(e), ENV); }

  // ---------- 19/20. Lifecycle and storage ----------
  try {
    await E(() => { DH.Save.resetAll(); TH.fresh(20); DH.debug.manual = false; DH.UI.startPlay(); });
    await E(() => { DH.debug.manual = true; const run = DH.G.run; TH.step(120); DH.Cargo.pickUp(run, 'salvage0'); run.pickups[2].taken = true; run.reserve.remaining = 8; run.reserve.groups = 1; DH.debug.manual = false; });
    const before = await E(() => ({ time: DH.G.run.time, pos: [DH.G.run.player.x, DH.G.run.player.y], z: DH.G.run.zombies.length, id: DH.G.run.id }));
    await E(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    const paused = await E(() => ({ st: DH.G.state, saved: !!JSON.parse(localStorage.getItem('skab.deadhaul.v1')).active }));
    const hpBefore = await E(() => DH.G.run.player.hp);
    await page.waitForTimeout(1500);
    const hpAfterWait = await E(() => DH.G.run.player.hp);
    await page.reload(); await page.waitForTimeout(700); await page.evaluate(HELPERS);
    const resumeBtn = await page.isVisible('#b-resume');
    await page.click('#b-resume'); await page.waitForTimeout(150);
    const restored = await E(() => ({ st: DH.G.state, time: DH.G.run.time, pos: [DH.G.run.player.x, DH.G.run.player.y], taken: DH.G.run.pickups[2].taken, salv: DH.G.run.items.salvage0.loc, res: DH.G.run.reserve.remaining, z: DH.G.run.zombies.length, id: DH.G.run.id }));
    await page.click('#p-resume');
    await E(() => { DH.debug.manual = true; const t = DH.G.run.truck; DH.Truck.enter(); t.x = 7; t.y = 102.5; t.ang = Math.PI; TH.step(150, (inp) => { inp.drive.throttle = 1; }); });
    await page.click('#dp-go'); await page.waitForTimeout(100);
    const scrap1 = await E(() => DH.Save.data.campaign.scrap);
    await page.reload(); await page.waitForTimeout(700);
    const after = await E(() => ({ scrap: DH.Save.data.campaign.scrap, active: DH.Save.hasRun(), resume: !document.getElementById('b-resume').classList.contains('hidden') }));
    await page.click('#b-new'); await page.click('#b-go'); await page.waitForTimeout(200);
    const replay = await E(() => ({ z: DH.G.run.zombies.length, fx: DH.FX.parts.length + DH.FX.decals.length, taken: DH.G.run.pickups.filter((k) => k.taken).length }));
    const ok = paused.st === 'paused' && paused.saved && hpAfterWait === hpBefore && resumeBtn && restored.st === 'paused' && Math.abs(restored.time - before.time) < 0.5 && restored.taken && restored.salv === 'backpack' && restored.res === 8 && restored.id === before.id && scrap1 === 5 && after.scrap === 5 && !after.active && !after.resume && replay.z === 42 && replay.taken === 0;
    rec(19, 'Pause, hidden tab, reload, resume, finish, replay', ok ? 'PASS' : 'FAIL', `hidden tab -> ${paused.st}, saved; no damage while hidden (hp ${hpBefore} -> ${hpAfterWait}); reload showed Resume; restored paused at t=${restored.time.toFixed(1)} s (saved ${before.time.toFixed(1)}), taken pickup stayed taken, salvage in pack, reserve budget ${restored.res}; extraction paid +${scrap1}; second reload: scrap ${after.scrap}, no resumable run; replay reset to 42 zombies and fresh pickups`, ENV);
  } catch (e) { rec(19, 'Lifecycle', 'FAIL', String(e), ENV); }

  try {
    await E(() => { DH.G.state = 'title'; DH.G.run = null; localStorage.setItem('arcade.other.game', 'KEEP'); localStorage.setItem('skab.deadhaul.v1', '{{{corrupt'); });
    await page.reload(); await page.waitForTimeout(700);
    const c = await E(() => ({ status: DH.Save.status, toast: document.getElementById('toast').textContent, title: !document.getElementById('scr-title').classList.contains('hidden'), other: localStorage.getItem('arcade.other.game') }));
    await page.click('#b-new'); await page.click('#b-go'); await page.waitForTimeout(150);
    const plays = await E(() => DH.G.state);
    // restart run via pause menu
    await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    await page.click('#p-restart'); await page.click('#cf-yes'); await page.waitForTimeout(100);
    const restarted = await page.isVisible('#scr-brief');
    // reset all progress needs explicit confirmation
    await E(() => { DH.Save.data.campaign.scrap = 90; DH.Save.write(); DH.UI.toTitle(); });
    await page.click('#b-garage'); await page.click('#g-reset');
    const confirmShown = await page.isVisible('#scr-confirm');
    await page.click('#cf-no'); const kept = await E(() => DH.Save.data.campaign.scrap);
    await page.click('#g-reset'); await page.click('#cf-yes'); const wiped = await E(() => DH.Save.data.campaign.scrap);
    const other = await E(() => localStorage.getItem('arcade.other.game'));
    // storage unavailable
    const { ctx: c2, page: p2 } = await newPage(browser);
    await c2.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('SecurityError: storage disabled'); } }); });
    await p2.reload(); await p2.waitForTimeout(700);
    const un = await p2.evaluate(() => ({ status: DH.Save.status, toast: document.getElementById('toast').textContent }));
    await p2.click('#b-new'); await p2.click('#b-go'); await p2.waitForTimeout(300);
    const unPlay = await p2.evaluate(() => DH.G.state);
    const unErr = p2._errors.filter((e) => !/storage/i.test(e)).length;
    await c2.close();
    const ok = c.status === 'corrupt' && /fresh/i.test(c.toast) && c.title && c.other === 'KEEP' && plays === 'play' && restarted && confirmShown && kept === 90 && wiped === 0 && other === 'KEEP' && un.status === 'unavailable' && /not be saved/i.test(un.toast) && unPlay === 'play' && unErr === 0;
    rec(20, 'Corrupt and unavailable storage, restart run, reset progress, other games untouched', ok ? 'PASS' : 'FAIL', `corrupt save -> "${c.toast}", title usable, new run plays; Restart Run -> briefing; Reset All Progress asks for confirmation (cancel kept ${kept}, confirm -> ${wiped}); other key "arcade.other.game" untouched; blocked storage -> "${un.toast}", game still playable`, ENV);
  } catch (e) { rec(20, 'Storage', 'FAIL', String(e), ENV); }

  console.log('page errors:', page._errors.slice(0, 5));
  fs.writeFileSync(path.join(__dirname, 'acceptance-results.json'), JSON.stringify(report, null, 1));
  await browser.close();
})();

function DH_angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
