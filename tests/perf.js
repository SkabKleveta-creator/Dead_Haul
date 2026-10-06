// Performance evidence (acceptance 21). Headless Chromium uses a software (CPU) canvas here; GPU browsers are typically faster.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
async function measure(browser, vw, vh, dpr) {
  const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr || 1 });
  await page.goto('file://' + path.resolve(__dirname, '../dist/index.html'));
  await page.waitForTimeout(600);
  await page.click('#b-new'); await page.click('#b-go');
  const res = await page.evaluate(async () => {
    const G = DH.G; DH.debug.manual = true;
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    const scenario = async (setup, frames, inpMod) => {
      setup();
      for (let i = 0; i < 20; i++) DH.R.render(1 / 60);
      let sim = 0, ren = 0, worst = 0; const rafGaps = []; let last = performance.now();
      for (let i = 0; i < frames; i++) {
        const t0 = performance.now(); DH.debug.step(1, inpMod); const t1 = performance.now();
        DH.R.updateCamera(1 / 60); DH.R.render(1 / 60); DH.UI.update(1 / 60); const t2 = performance.now();
        sim += t1 - t0; ren += t2 - t1; worst = Math.max(worst, t2 - t0);
        if (!G.run || G.state !== 'play') break;
      }
      return { simMs: +(sim / frames).toFixed(2), renderMs: +(ren / frames).toFixed(2), worstMs: +worst.toFixed(1), estFps: Math.round(1000 / Math.max(16.7, (sim + ren) / frames)) };
    };
    const out = {};
    out.crowdOnFoot = await scenario(() => { const run = G.run, p = run.player; p.x = 59; p.y = 60; p.iframes = 1e9; run.zombies.forEach((z, i) => { z.x = 52 + (i % 7) * 2; z.y = 52 + Math.floor(i / 7) * 2.2; z.state = 'chase'; z.target = 'player'; z.lastSeen = G.time; }); DH.R.updateCamera(0, true); }, 240, (inp, i) => { inp.fire = i % 4 === 0; inp.aimDir = (i / 40) % 6.28; inp.aimWorld = null; });
    out.crowdDriving = await scenario(() => { const run = G.run, t = run.truck; DH.Truck.enter(); t.x = 59.5; t.y = 95; t.ang = -Math.PI / 2; run.zombies.forEach((z) => { if (!z.dead) { z.x = 56 + Math.random() * 7; z.y = 50 + Math.random() * 30; z.state = 'chase'; z.target = 'truck'; z.lastSeen = G.time; } }); DH.R.updateCamera(0, true); }, 240, (inp) => { inp.drive.throttle = 1; inp.drive.steer = 0.05; });
    // replay accumulation: three fresh runs
    const counts = [];
    for (let k = 0; k < 3; k++) { G.newRun(100 + k, {}); G.state = 'play'; DH.R.updateCamera(0, true); for (let i = 0; i < 300; i++) { DH.debug.step(1, (inp) => { inp.fire = i % 5 === 0; inp.aimDir = i / 30; inp.aimWorld = null; }); if (i % 3 === 0) DH.R.render(1 / 60); } counts.push({ zombies: G.run.zombies.length, parts: DH.FX.parts.length, decals: DH.FX.decals.length, tracers: DH.FX.tracers.length, noise: G.noise.length, figCache: DH.SP.figCache.size, chunks: DH.R.chunks.size }); }
    out.replay = counts;
    // every campaign map: frame cost with the local population awake and chasing, then caches after cycling all maps twice
    out.levels = {};
    for (const lv of [2, 3, 4, 5]) {
      G.newRun(300 + lv, {}, lv); G.state = 'play';
      out.levels[lv] = await scenario(() => { const run = G.run, p = run.player; p.iframes = 1e9; let k = 0; for (const z of run.zombies) { if (z.dead) continue; if (k++ < 26) { const a = k * 0.7, r = 6 + (k % 5) * 2; const q = G.W.findFreeNear(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 0.35, 4); if (q) { z.x = q.x; z.y = q.y; } z.state = 'chase'; z.target = 'player'; z.lastSeen = G.time; } } DH.R.updateCamera(0, true); }, 180, (inp, i) => { inp.fire = i % 4 === 0; inp.aimDir = (i / 40) % 6.28; inp.aimWorld = null; });
    }
    const cyc = [];
    for (let k = 0; k < 10; k++) { const lv = 1 + (k % 5); G.newRun(400 + k, {}, lv); G.state = 'play'; DH.R.updateCamera(0, true); for (let i = 0; i < 240; i++) { DH.debug.step(1, (inp) => { inp.fire = i % 5 === 0; inp.aimDir = i / 30; inp.aimWorld = null; }); if (!G.run) break; if (i % 3 === 0) DH.R.render(1 / 60); } if (G.run) cyc.push({ level: lv, zombies: G.run.zombies.length, parts: DH.FX.parts.length, decals: DH.FX.decals.length, figCache: DH.SP.figCache.size, chunks: DH.R.chunks.size }); }
    out.cycle = cyc;
    out.mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB JS heap' : 'n/a';
    return out;
  });
  await page.close();
  return { viewport: vw + 'x' + vh + '@' + (dpr || 1) + 'x', ...res };
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const results = [];
  for (const [w, h, d] of [[1366, 768, 1], [844, 390, 3]]) { const r = await measure(browser, w, h, d); console.log(JSON.stringify(r)); results.push(r); }
  fs.writeFileSync(path.join(__dirname, 'perf-results.json'), JSON.stringify(results, null, 1));
  await browser.close();
})();
