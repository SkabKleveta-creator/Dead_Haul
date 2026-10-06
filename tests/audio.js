// Audio plumbing checks (sound itself cannot be heard in this environment).
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--autoplay-policy=user-gesture-required'] });
  const out = {};
  let page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '../dist/index.html')); await page.waitForTimeout(500);
  out.beforeGesture = await page.evaluate(() => !!DH.Audio.ctx);
  await page.click('#b-new'); await page.click('#b-go'); await page.waitForTimeout(300);
  out.afterGesture = await page.evaluate(() => ({ ok: DH.Audio.ok, state: DH.Audio.ctx && DH.Audio.ctx.state }));
  out.events = await page.evaluate(async () => {
    DH.debug.manual = true; const G = DH.G; const p = G.run.player;
    let n = 0; const orig = DH.Audio.ctx.createOscillator.bind(DH.Audio.ctx); DH.Audio.ctx.createOscillator = () => { n++; return orig(); };
    p.x = 59; p.y = 60; DH.debug.step(1, (inp) => { inp.fire = true; inp.firePressed = true; inp.aimDir = 0; inp.aimWorld = null; });
    DH.Truck.enter(); DH.debug.step(30, (inp) => { inp.drive.throttle = 1; }); DH.Audio.update();
    const engine = !!DH.Audio.engine;
    DH.World.triggerAlarm(false); DH.debug.step(5); DH.Audio.update(); const alarm = !!DH.Audio.alarm;
    return { oscillatorsCreated: n, engineLoop: engine, alarmLoop: alarm };
  });
  out.mute = await page.evaluate(async () => { DH.Save.settings().muted = true; DH.Audio.applySettings(); await new Promise((r) => setTimeout(r, 400)); const m = DH.Audio.master.gain.value; DH.Save.settings().muted = false; DH.Audio.applySettings(); await new Promise((r) => setTimeout(r, 400)); return { mutedGain: +m.toFixed(3), unmutedGain: +DH.Audio.master.gain.value.toFixed(3) }; });
  out.errors = errs.length;
  await page.close();
  // no WebAudio at all: game must still start
  const ctx = await browser.newContext(); await ctx.addInitScript(() => { delete window.AudioContext; delete window.webkitAudioContext; });
  page = await ctx.newPage(); const errs2 = []; page.on('pageerror', (e) => errs2.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '../dist/index.html')); await page.waitForTimeout(500);
  await page.click('#b-new'); await page.click('#b-go'); await page.waitForTimeout(500);
  out.noAudio = await page.evaluate(() => ({ state: DH.G.state, ok: DH.Audio.ok })); out.noAudioErrors = errs2.length;
  console.log(JSON.stringify(out));
  fs.writeFileSync(path.join(__dirname, 'audio-results.json'), JSON.stringify(out, null, 1));
  await browser.close();
})();
