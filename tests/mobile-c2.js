// Touch emulation for the Island Line interactions (phone 844x390, real CDP touch on USE, alt buttons and the
// driving buttons): gate motor and console, refuelling, prying, the skiff (board, GAS/steer, step ashore), the
// ferry beacon, quarry generator and crusher, handing the second truck to another driver, loading it.
// Positioning uses [state] teleports and clears nearby zombies; the bots in tests/campaign.js cover the walking.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const URL = 'file://' + path.resolve(__dirname, '../dist/index.html');
const rows = [];
const rec = (name, ok, notes) => { rows.push({ name, status: ok ? 'PASS' : 'FAIL', notes }); console.log((ok ? 'PASS' : 'FAIL').padEnd(6), name, '-', notes); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  // [state] a save with missions 1-9 complete so every Island Line map is deployable; Nell and Tomas at the garage
  await page.addInitScript(() => {
    if (localStorage.getItem('skab.deadhaul.v1')) return;
    const c = {}; for (let l = 1; l <= 9; l++) c[l] = true;
    const st = { completed: c, firstClear: {}, milestones: { nell: true, tomas: true }, outcomes: {}, optional: {}, seen: c, endingSeen: true, log: [], selected: 10 };
    localStorage.setItem('skab.deadhaul.v1', JSON.stringify({ v: 3, campaign: { scrap: 0, upgrades: {}, settings: { volume: 0, music: 0, muted: true, aimAssist: true, reducedShake: false, reducedFlashes: false, hints: false }, best: { bestScrap: 0, fastestSuccess: 0, successes: 9, runs: 9 }, levelBest: {}, recentRunIds: [], history: [], story: st, prefs: { night: false, mods: {} } }, active: null }));
  });
  await page.goto(URL); await page.waitForTimeout(700);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: p.id || 1, radiusX: 4, radiusY: 4, force: 1 })) });
  const E = (fn, a) => page.evaluate(fn, a);
  const center = (sel) => E((s) => { const e = document.querySelector(s); if (!e || !e.offsetParent) return null; const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
  const tp = (x, y) => E(([x0, y0]) => {
    const run = DH.G.run, p = run.player; p.x = x0; p.y = y0; p.action = null;
    for (const z of run.zombies) if (!z.dead && Math.hypot(z.x - x0, z.y - y0) < 16) { z.dead = true; z.hp = 0; }
    DH.R.updateCamera(0, true);
  }, [x, y]);
  const act = async (id, until, maxMs) => {
    await page.waitForTimeout(250);
    const where = await E((i) => { const I = DH.Interact; if (I.primary && I.primary.id === i) return { k: 0, label: I.primary.label }; const k = I.alts.findIndex((a) => a.id === i); return k >= 0 ? { k: k + 1, label: I.alts[k].label } : { k: -1, prim: I.primary && I.primary.id, alts: I.alts.map((a) => a.id) }; }, id);
    if (where.k < 0) return { ok: false, why: 'prompt not offered (primary ' + where.prim + ', alts ' + where.alts + ')' };
    const sel = where.k === 0 ? '#tb-use' : '#prompt-alts button:nth-child(' + where.k + ')';
    const c = await center(sel);
    if (!c) return { ok: false, why: 'control not visible: ' + sel };
    await touch('touchStart', [{ id: 7, ...c }]);
    const t0 = Date.now(); let done = false;
    while (Date.now() - t0 < (maxMs || 6000)) { await page.waitForTimeout(100); done = await E(until); if (done) break; }
    await touch('touchEnd', []);
    await page.waitForTimeout(150);
    if (!done) done = await E(until);
    return { ok: done, via: where.k === 0 ? 'USE' : 'alt ' + where.k, label: where.label, ms: Date.now() - t0 };
  };
  const deploy = async (level) => {
    await E(() => { DH.UI.toTitle(); }); await page.waitForTimeout(200);
    await page.tap('#b-garage'); await page.waitForTimeout(250);
    await page.tap('[data-deploy="' + level + '"]'); await page.waitForTimeout(250);
    if (await E(() => !document.getElementById('scr-confirm').classList.contains('hidden'))) { await page.tap('#cf-yes'); await page.waitForTimeout(250); }
    await page.tap('#b-go'); await page.waitForTimeout(500);
    return E(() => ({ level: DH.G.run && DH.G.run.level, mode: DH.Input.mode, touchUi: !document.getElementById('touch').classList.contains('hidden') }));
  };
  const step = async (level, name, x, y, id, until, maxMs) => {
    await tp(x, y);
    const r = await act(id, until, maxMs);
    rec('M' + level + ' touch: ' + name, r.ok, r.ok ? `${r.via} "${r.label}" completed in ${(r.ms / 1000).toFixed(1)} s` : r.why || `${r.via} "${r.label}" did not complete`);
    return r.ok;
  };
  const doorId = (label) => E((l) => DH.G.W.doors.find((q) => q.label === l).id, label);
  const hold = async (sel, ms) => { const c = await center(sel); if (!c) return false; await touch('touchStart', [{ id: 5, ...c }]); await page.waitForTimeout(ms); await touch('touchEnd', []); return true; };

  // ---- Landfall ----
  let d = await deploy(6);
  rec('M6 deployed from the board by touch; fuel gauge on the truck panel', d.level === 6 && d.mode === 'touch' && d.touchUi && await E(() => !document.getElementById('fuel-row').classList.contains('hidden') || !document.getElementById('truck-panel').classList.contains('hidden')), JSON.stringify(d));
  await step(6, 'hold to splice the gate motor', 73.4, 51.6, 'motor', () => DH.G.run.flags.motor);
  await step(6, 'hold to run the depot gate', 71.6, 49.6, 'gateCon', () => { const i = DH.G.W.doors.findIndex((q) => q.label === 'Depot Gate'); return DH.G.run.doors[i].open; });
  await step(6, 'hold to pry the pier hut', 109.2, 46, await doorId('Pier Hut Door'), () => { const i = DH.G.W.doors.findIndex((q) => q.label === 'Pier Hut Door'); return DH.G.run.doors[i].open; }, 8000);
  await step(6, 'take a jerry can', 104, 45.5, 'fuel0', () => DH.G.run.items.fuel0.loc === 'backpack');
  {
    const sp = await E(() => { const t = DH.G.run.truck; t.fuel = 10; const q = DH.Truck.toWorld(0.5, -(DH.Truck.HW + 0.7)); return q; });
    await step(6, 'hold to refuel the truck', sp.x, sp.y, 'refuel', () => DH.G.run.truck.fuel > 40, 8000);
  }

  // ---- Night Ferry: the skiff ----
  d = await deploy(8);
  rec('M8 deployed by touch at night', d.level === 8 && d.touchUi && await E(() => !!DH.G.run.cond.night), JSON.stringify(d));
  await step(8, 'hold to light the beacon', 96, 18, 'signal', () => DH.G.run.flags.signal);
  await step(8, 'board the skiff', 58.5, 16.4, 'boat', () => DH.G.run.player.inBoat);
  {
    const lay = await E(() => ({ drive: !document.getElementById('tb-drive').classList.contains('hidden'), foot: !document.getElementById('tb-foot').classList.contains('hidden') }));
    const x0 = await E(() => DH.G.run.boat.x);
    await hold('#tb-drive [data-act="gas"]', 1600);
    await page.waitForTimeout(200);
    const moved = await E(() => DH.G.run.boat.x) !== x0 || await E(() => Math.abs(DH.G.run.boat.speed) > 0.5);
    await hold('#tb-drive [data-act="left"]', 500);
    rec('M8 touch: the skiff shows driving controls and GAS drives it', lay.drive && !lay.foot && moved, 'drive buttons=' + lay.drive + ', foot buttons hidden=' + !lay.foot + ', moved=' + moved);
    await E(() => { const b = DH.G.run.boat; b.x = DH.G.W.boatSlip.x; b.y = 13.6; b.speed = 0; });
    await page.waitForTimeout(150);
    await hold('#tb-drive [data-act="exit"]', 150); await page.waitForTimeout(300);
    const ashore = await E(() => !DH.G.run.player.inBoat && DH.G.W.circleFree(DH.G.run.player.x, DH.G.run.player.y, 0.33));
    rec('M8 touch: EXIT steps ashore from the skiff', ashore, 'ashore=' + ashore);
  }

  // ---- Quarry Road ----
  d = await deploy(9);
  rec('M9 deployed by touch', d.level === 9 && d.touchUi, JSON.stringify(d));
  await step(9, 'hold to start the quarry generator', 68.2, 65, 'gen', () => DH.G.run.flags.power);
  await step(9, 'hold to run the crusher', 77.6, 61.8, 'crusher', () => DH.G.run.flags.crushing || DH.G.run.flags.crushed);
  await step(9, 'hold to pry the weigh station', 88.8, 88, await doorId('Weigh Station Door'), () => { const i = DH.G.W.doors.findIndex((q) => q.label === 'Weigh Station Door'); return DH.G.run.doors[i].open || DH.G.run.doors[i].broken; }, 8000);
  await step(9, 'open the powered gantry gate', 47, 48, await doorId('Gantry Gate'), () => { const i = DH.G.W.doors.findIndex((q) => q.label === 'Gantry Gate'); return DH.G.run.doors[i].open || DH.G.run.doors[i].broken; });

  // ---- Long Haul: the second truck ----
  d = await deploy(10);
  rec('M10 deployed by touch', d.level === 10 && d.touchUi, JSON.stringify(d));
  {
    const c = await E(() => { const c = DH.G.run.convoy; return { x: c.x + 2.2, y: c.y }; });
    await step(10, 'hand the second truck to Nell (contextual button)', c.x, c.y, 'driver_nell', () => DH.G.run.convoy.driver === 'nell');
    const g = await E(() => ({ x: DH.G.run.items.generator.x - 0.9, y: DH.G.run.items.generator.y }));
    await step(10, 'haul the generator', g.x, g.y, 'gen', () => DH.G.run.player.hauling);
    const rp = await E(() => { const r = DH.Convoy.rearPoint(); const it = DH.G.run.items.generator; it.x = r.x; it.y = r.y - 1.2; return { x: r.x, y: r.y - 0.4 }; });
    await tp(rp.x, rp.y);
    const r = await act('loadConvoy', () => DH.G.run.items.generator.loc === 'convoy', 8000);
    rec('M10 touch: hold USE at the second truck’s tailgate loads heavy gear into it', r.ok, r.ok ? `${r.via} "${r.label}" ${(r.ms / 1000).toFixed(1)} s` : r.why || 'not loaded');
  }
  rec('No page errors under touch emulation', errors.length === 0, errors.slice(0, 3).join(' | ') || 'none');
  fs.writeFileSync(path.join(__dirname, 'mobile-c2-results.json'), JSON.stringify(rows, null, 1));
  await browser.close();
  const failN = rows.filter((r) => r.status !== 'PASS').length;
  console.log(rows.length - failN + ' passed, ' + failN + ' failed');
  process.exitCode = failN ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
