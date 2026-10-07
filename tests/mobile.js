// Mobile emulation checks (acceptance item 18): multi-touch via CDP, layout, pointer cancellation, rotation.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const URL = 'file://' + path.resolve(__dirname, '../dist/index.html');
const out = [];

async function runSize(browser, vw, vh) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL); await page.waitForTimeout(700);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 4, radiusY: 4, force: 1 })) });
  await page.tap('#b-new'); await page.waitForTimeout(150); await page.tap('#b-go'); await page.waitForTimeout(500);
  const r = { size: vw + 'x' + vh };
  r.mode = await page.evaluate(() => DH.Input.mode);
  r.edgeSprint = await page.evaluate(() => { const m = DH.Input.touch.move; m.x = 0; m.y = -1; const a = DH.Input.sample(false).sprint; m.x = 0; m.y = -0.6; const b = DH.Input.sample(false).sprint; m.x = 0; m.y = 0; return a && !b; });
  r.compact = await page.evaluate(() => document.body.classList.contains('compact'));
  // regression: tapping open game area must not switch to mouse mode and hide the controls
  await page.touchscreen.tap(Math.round(vw * 0.5), Math.round(vh * 0.2)); await page.waitForTimeout(250);
  r.tapKeepsControls = await page.evaluate(() => DH.Input.mode === 'touch' && !document.getElementById('touch').classList.contains('hidden'));
  await page.evaluate(() => { DH.Save.settings().hints = false; document.getElementById('hint').classList.add('hidden'); DH.G.run.zombies.forEach((z) => (z.x = Math.max(z.x, 70))); });
  // layout: button sizes and gaps
  r.layout = await page.evaluate(() => {
    const bs = [...document.querySelectorAll('#tb-foot .tb')].filter((b) => !b.classList.contains('hidden')).map((b) => b.getBoundingClientRect());
    let minGap = 99; for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i], b = bs[j]; const gx = Math.max(b.left - a.right, a.left - b.right), gy = Math.max(b.top - a.bottom, a.top - b.bottom); minGap = Math.min(minGap, Math.max(gx, gy)); }
    const minSize = Math.min(...bs.map((b) => Math.min(b.width, b.height)));
    const all = [...document.querySelectorAll('#touch .tb, #hud-tl, #hud-obj, #minimap')].filter((e) => e.offsetParent).map((e) => e.getBoundingClientRect());
    const inView = all.every((b) => b.left >= 0 && b.top >= 0 && b.right <= innerWidth + 0.5 && b.bottom <= innerHeight + 0.5);
    return { minSize: Math.round(minSize), minGap: Math.round(minGap), inView, n: bs.length };
  });
  // multi-touch: move stick + aim/fire stick simultaneously
  const start = await page.evaluate(() => ({ x: DH.G.run.player.x, y: DH.G.run.player.y, shots: DH.G.run.stats.shots }));
  const mv = { x: vw * 0.18, y: vh * 0.7 }, am = { x: vw * 0.62, y: vh * 0.62 };
  await touch('touchStart', [{ id: 1, ...mv }]);
  await touch('touchStart', [{ id: 1, ...mv }, { id: 2, ...am }]);
  for (let k = 1; k <= 12; k++) {
    await touch('touchMove', [{ id: 1, x: mv.x, y: mv.y - 5 * k }, { id: 2, x: am.x + 7 * k, y: am.y }]);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(500);
  const mid = await page.evaluate(() => ({ x: DH.G.run.player.x, y: DH.G.run.player.y, shots: DH.G.run.stats.shots, aim: DH.G.run.player.aim, moveIn: { ...DH.Input.touch.move }, aimIn: { ...DH.Input.touch.aim }, scrollY: window.scrollY, docTop: document.documentElement.scrollTop, sel: String(getSelection()) }));
  // third finger taps a button while both sticks are held
  const reloadBox = await page.evaluate(() => { const b = document.querySelector('[data-act=reload]').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await page.evaluate(() => { const w = DH.G.run.player.weapons[0]; w.mag = 3; DH.G.run.player.reload = 0; });
  await touch('touchMove', [{ id: 1, x: mv.x, y: mv.y - 60 }, { id: 2, x: am.x + 30, y: am.y }, { id: 3, ...reloadBox }]);
  await touch('touchStart', [{ id: 1, x: mv.x, y: mv.y - 60 }, { id: 2, x: am.x + 30, y: am.y }, { id: 3, ...reloadBox }]);
  await page.waitForTimeout(80);
  await touch('touchEnd', [{ id: 1, x: mv.x, y: mv.y - 60 }, { id: 2, x: am.x + 30, y: am.y }]);
  await page.waitForTimeout(80);
  const reloading = await page.evaluate(() => DH.G.run.player.reload > 0 || DH.G.run.player.weapons[0].mag === 12);
  // cancellation clears everything
  await touch('touchCancel', []);
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => ({ move: { ...DH.Input.touch.move }, aim: DH.Input.touch.aim.active, held: [...DH.Input.touch.held], pos: [DH.G.run.player.x, DH.G.run.player.y] }));
  await page.waitForTimeout(300);
  const still = await page.evaluate(() => [DH.G.run.player.x, DH.G.run.player.y]);
  r.multitouch = { moved: Math.hypot(mid.x - start.x, mid.y - start.y) > 0.5, fired: mid.shots - start.shots, upScreen: mid.y < start.y && mid.x < start.x, reloadWhileHeld: reloading, cancelCleared: after.move.x === 0 && after.move.y === 0 && !after.aim && after.held.length === 0, noDriftAfterCancel: Math.hypot(still[0] - after.pos[0], still[1] - after.pos[1]) < 0.05, scroll: mid.scrollY + mid.docTop, selection: mid.sel.length };
  // driving controls
  await page.evaluate(() => { DH.G.run.zombies = []; DH.Truck.enter(); });
  await page.waitForTimeout(200);
  const gas = await page.evaluate(() => { const b = document.querySelector('[data-act=gas]').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width }; });
  const left = await page.evaluate(() => { const b = document.querySelector('[data-act=left]').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  const a0 = await page.evaluate(() => DH.G.run.truck.ang);
  await touch('touchStart', [{ id: 5, ...gas }]); await touch('touchStart', [{ id: 5, ...gas }, { id: 6, ...left }]);
  await page.waitForTimeout(1200);
  const drv = await page.evaluate(() => ({ v: DH.G.run.truck.speed, ang: DH.G.run.truck.ang }));
  await touch('touchCancel', []); await page.waitForTimeout(100);
  const held = await page.evaluate(() => [...DH.Input.touch.held]);
  await page.waitForTimeout(1500);
  const coast = await page.evaluate(() => DH.G.run.truck.speed);
  r.driving = { speed: +drv.v.toFixed(2), turned: +(drv.ang - a0).toFixed(2), clearedOnCancel: held.length === 0, slowed: coast < drv.v, gasWidth: Math.round(gas.w) };
  // portrait -> rotate prompt, accessible menu
  await page.setViewportSize({ width: vh, height: vw }); await page.waitForTimeout(400);
  const port = await page.evaluate(() => ({ st: DH.G.state, rot: !document.getElementById('rotate').classList.contains('hidden') }));
  await page.tap('#rot-menu'); await page.waitForTimeout(150);
  const menu = await page.evaluate(() => !document.getElementById('scr-pause').classList.contains('hidden') && document.getElementById('rotate').classList.contains('hidden'));
  await page.setViewportSize({ width: vw, height: vh }); await page.waitForTimeout(300);
  await page.tap('#p-resume'); await page.waitForTimeout(150);
  r.rotate = { paused: port.st === 'paused', prompt: port.rot, menu, resumed: await page.evaluate(() => DH.G.state) };
  // safe-area insets shift controls inward
  r.safeArea = await page.evaluate(() => { const q = () => document.querySelector('#tb-drive .gas').getBoundingClientRect(); const b0 = q(); document.documentElement.style.setProperty('--sar', '44px'); document.documentElement.style.setProperty('--sab', '21px'); const b1 = q(); document.documentElement.style.removeProperty('--sar'); document.documentElement.style.removeProperty('--sab'); return { shiftedRight: Math.round(b0.right - b1.right), shiftedBottom: Math.round(b0.bottom - b1.bottom) }; });
  await page.screenshot({ path: path.resolve(__dirname, '../screenshots/mobile_' + vw + 'x' + vh + '.png') });
  r.errors = errors.length;
  await ctx.close();
  return r;
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  for (const [w, h] of [[844, 390], [932, 430], [844, 335]]) {
    const r = await runSize(browser, w, h);
    const m = r.multitouch;
    const ok = r.mode === 'touch' && r.edgeSprint && r.compact && r.tapKeepsControls && r.layout.minSize >= 56 && r.layout.minGap >= 8 && r.layout.inView && m.moved && m.fired > 0 && m.upScreen && m.reloadWhileHeld && m.cancelCleared && m.noDriftAfterCancel && m.scroll === 0 && m.selection === 0 && r.driving.speed > 1 && Math.abs(r.driving.turned) > 0.05 && r.driving.clearedOnCancel && r.driving.slowed && r.rotate.paused && r.rotate.prompt && r.rotate.menu && r.rotate.resumed === 'play' && r.safeArea.shiftedRight === 44 && r.safeArea.shiftedBottom === 21 && r.errors === 0;
    out.push({ ok, ...r });
    console.log(ok ? 'PASS' : 'FAIL', JSON.stringify(r));
  }
  fs.writeFileSync(path.join(__dirname, 'mobile-results.json'), JSON.stringify(out, null, 1));
  await browser.close();
})();
