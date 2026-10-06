// Touch emulation for every required (and optional) interaction on the four new maps (acceptance 12).
// Phone viewport 844x390, hasTouch, real CDP touch events on the on-screen USE button, the contextual alt buttons
// and the DROP button. Positioning between interactions uses [state] teleports and clears nearby zombies so each
// check isolates the touch path; the bots in tests/campaign.js cover reaching these places with normal input.
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
  // [state] a save with missions 1-4 complete so every map is deployable from the board
  await page.addInitScript(() => {
    if (localStorage.getItem('skab.deadhaul.v1')) return;
    const st = { completed: { 1: true, 2: true, 3: true, 4: true }, firstClear: {}, milestones: {}, outcomes: {}, optional: {}, seen: { 1: true, 2: true, 3: true, 4: true }, endingSeen: false, log: [], selected: 5 };
    localStorage.setItem('skab.deadhaul.v1', JSON.stringify({ v: 2, campaign: { scrap: 0, upgrades: { quiet: false, bumper: false, gear: false }, settings: { volume: 0, music: 0, muted: true, aimAssist: true, reducedShake: false, reducedFlashes: false, hints: false }, best: { bestScrap: 0, fastestSuccess: 0, successes: 4, runs: 4 }, levelBest: {}, recentRunIds: [], history: [], story: st }, active: null }));
  });
  await page.goto(URL); await page.waitForTimeout(700);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: p.id || 1, radiusX: 4, radiusY: 4, force: 1 })) });
  const E = (fn, a) => page.evaluate(fn, a);
  const center = (sel) => E((s) => { const e = document.querySelector(s); if (!e || !e.offsetParent) return null; const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);

  const tp = (x, y, extra) => E(([x0, y0, ex]) => {
    const run = DH.G.run, p = run.player; p.x = x0; p.y = y0; p.action = null;
    for (const z of run.zombies) if (!z.dead && Math.hypot(z.x - x0, z.y - y0) < 14) { z.dead = true; z.hp = 0; }
    if (ex === 'haulAlong') { const it = DH.Cargo.hauled(run); if (it) { it.x = x0 - 1.1; it.y = y0; } }
    DH.R.updateCamera(0, true);
  }, [x, y, extra || null]);
  // press the on-screen control that shows `id` (USE for the primary prompt, a contextual button for alternatives)
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
  const step = async (level, name, x, y, id, until, extra, maxMs) => {
    await tp(x, y, extra);
    const r = await act(id, until, maxMs);
    rec('M' + level + ' touch: ' + name, r.ok, r.ok ? `${r.via} "${r.label}" completed in ${(r.ms / 1000).toFixed(1)} s` : r.why || `${r.via} "${r.label}" did not complete`);
    return r.ok;
  };

  // ---- Cold Chain ----
  let d = await deploy(2);
  rec('M2 deployed from the board by touch', d.level === 2 && d.mode === 'touch' && d.touchUi, JSON.stringify(d));
  await step(2, 'hold to throw the bay power breaker', 31.4, 64.6, 'breaker', () => DH.G.run.flags.power);
  await step(2, 'hold to pry Freezer 2', 78, 44.3, await E(() => DH.G.W.doors.find((q) => q.label === 'Freezer 2 Door').id), () => { const i = DH.G.W.doors.findIndex((q) => q.label === 'Freezer 2 Door'); return DH.G.run.doors[i].open || DH.G.run.doors[i].broken; });
  await step(2, 'recruit Tomas', 79, 34.5, 'recruit', () => DH.G.findSurvivor(DH.G.run, 'tomas').recruited);
  await step(2, 'take the medical stock', 67, 64.6, 'medstock', () => DH.G.run.items.medstock.loc !== 'world');
  const asm = await E(() => ({ x: DH.G.run.items.assembly.x, y: DH.G.run.items.assembly.y }));
  await step(2, 'haul the refrigeration unit', asm.x - 0.9, asm.y, 'haul_assembly', () => DH.G.run.player.hauling);
  {
    const c = await center('#tb-drop');
    if (c) { await touch('touchStart', [{ id: 8, ...c }]); await page.waitForTimeout(120); await touch('touchEnd', []); await page.waitForTimeout(200); }
    const dropped = await E(() => !DH.G.run.player.hauling && DH.G.run.items.assembly.loc === 'world');
    rec('M2 touch: DROP button releases heavy cargo', !!c && dropped, 'drop button visible=' + !!c + ', released=' + dropped);
  }
  // [state] park the truck on the apron and bring the unit to the tailgate, then load with a USE hold
  await E(() => { const t = DH.G.run.truck; t.x = 81.5; t.y = 80; t.ang = -Math.PI / 2; t.speed = 0; });
  const rp = await E(() => { const r = DH.Truck.rearPoint(); const it = DH.G.run.items.assembly; it.x = r.x + 1.6; it.y = r.y; return { x: r.x + 0.5, y: r.y }; });
  await step(2, 'haul again at the tailgate', rp.x + 0.2, rp.y, 'haul_assembly', () => DH.G.run.player.hauling);
  await tp(rp.x, rp.y, 'haulAlong');
  { const r = await act('loadGen', () => DH.G.run.items.assembly.loc === 'truck', 8000); rec('M2 touch: hold USE to load heavy cargo into the truck', r.ok, r.ok ? `${r.via} "${r.label}" ${(r.ms / 1000).toFixed(1)} s` : r.why || 'not loaded'); }

  // ---- High Water ----
  d = await deploy(3);
  rec('M3 deployed from the board by touch', d.level === 3 && d.touchUi, JSON.stringify(d));
  await tp(81.2, 13.8);
  const pumpOffer = await E(() => [DH.Interact.primary && DH.Interact.primary.id].concat(DH.Interact.alts.map((a) => a.id)));
  // choose the setting shown as an alternative button so the alt path is exercised
  const pumpId = pumpOffer[0] === 'pumpA' ? 'pumpB' : 'pumpA';
  await step(3, 'hold an alternative prompt to prime the pumps (' + pumpId + ')', 81.2, 13.8, pumpId, () => !!DH.G.run.flags.pumps, null, 8000);
  await step(3, 'recruit Ada', 19.5, 85.2, 'recruit', () => DH.G.findSurvivor(DH.G.run, 'ada').recruited);
  await step(3, 'take household supplies', 24, 85.1, 'supplies0', () => DH.G.run.items.supplies0.loc !== 'world');
  const flt = await E(() => ({ x: DH.G.run.items.filtration.x, y: DH.G.run.items.filtration.y }));
  await step(3, 'haul the filtration unit', flt.x - 0.9, flt.y, 'haul_filtration', () => DH.G.run.player.hauling);
  await E(() => { DH.Interact.releaseHaul(); });

  // ---- Dead Air ----
  d = await deploy(4);
  rec('M4 deployed from the board by touch', d.level === 4 && d.touchUi, JSON.stringify(d));
  await step(4, 'hold to open the compound gate', 65.6, 60.3, 'gateopen', () => !DH.G.W.doors.find((q) => q.label === 'Compound Gate').locked);
  await step(4, 'hold to start the generator', 91, 54.4, 'genstart', () => DH.G.run.flags.power);
  await step(4, 'hold to seat the relay module', 78, 18.6, 'module', () => DH.G.run.flags.module, null, 8000);
  await step(4, 'hold to call the waterfront', 50.5, 13.8, 'call', () => DH.G.run.flags.contact);
  await E(() => { const r = DH.G.run; r.timers.bcAt = r.time - 1; }); // [state] skip the few seconds before the broadcast trips
  await page.waitForTimeout(800);
  await step(4, 'hold the alternative "route the broadcast" button', 61, 13.8, 'bcroute', () => DH.G.run.flags.broadcast === 'routed');
  await step(4, 'knock on the Dish Hut door', 13.8, 26.8, 'knock', () => !DH.G.W.doors.find((q) => q.label === 'Hut Door').locked);
  await step(4, 'recruit Wes', 14, 30.5, 'recruit', () => DH.G.findSurvivor(DH.G.run, 'wes').recruited);

  // ---- Last Crossing ----
  d = await deploy(5);
  rec('M5 deployed from the board by touch', d.level === 5 && d.touchUi, JSON.stringify(d));
  await step(5, 'hold to open the staging gate', 67.6, 45.4, 'gateA', () => DH.G.run.flags.gateA);
  await step(5, 'hold to pry Gate C', 100.5, 35.4, await E(() => DH.G.W.doors.find((q) => q.label === 'Gate C').id), () => { const i = DH.G.W.doors.findIndex((q) => q.label === 'Gate C'); return DH.G.run.doors[i].open || DH.G.run.doors[i].broken; }, null, 8000);
  await step(5, 'recruit Bo', 78.3, 85.2, 'recruit_bo', () => DH.G.findSurvivor(DH.G.run, 'bo').recruited);
  const pp = await E(() => ({ x: DH.G.run.items.powerpack.x, y: DH.G.run.items.powerpack.y }));
  await step(5, 'haul the power pack', pp.x - 0.9, pp.y, 'haul_powerpack', () => DH.G.run.player.hauling);
  await step(5, 'hold to install the power pack', 97.6, 18.4, 'install', () => DH.G.run.items.powerpack.loc === 'installed', 'haulAlong', 8000);
  await step(5, 'hold to lower the ramp', 96, 17.8, 'ramp', () => DH.G.run.flags.ramping || DH.G.run.flags.rampDown);
  {
    // the FOLLOW/WAIT button commands survivors
    const bo = await E(() => { const b = DH.G.findSurvivor(DH.G.run, 'bo'); return { x: b.x, y: b.y }; });
    await tp(bo.x + 1.5, bo.y); await page.waitForTimeout(200);
    const before = await E(() => DH.G.findSurvivor(DH.G.run, 'bo').mode);
    const c = await center('#tb-cmd');
    if (c) { await touch('touchStart', [{ id: 9, ...c }]); await page.waitForTimeout(100); await touch('touchEnd', []); await page.waitForTimeout(200); }
    const after = await E(() => DH.G.findSurvivor(DH.G.run, 'bo').mode);
    rec('M5 touch: FOLLOW/WAIT commands a survivor', !!c && before !== after, before + ' -> ' + after);
  }
  rec('No page errors under touch emulation', errors.length === 0, errors.slice(0, 3).join(' | ') || 'none');
  fs.writeFileSync(path.join(__dirname, 'mobile-levels-results.json'), JSON.stringify(rows, null, 1));
  await browser.close();
  const failN = rows.filter((r) => r.status !== 'PASS').length;
  console.log(rows.length - failN + ' passed, ' + failN + ' failed');
  process.exitCode = failN ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
