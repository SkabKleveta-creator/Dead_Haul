// Representative screenshots captured from the implemented game (desktop 1366x768).
const { chromium } = require('playwright');
const path = require('path');
const S = (n) => path.resolve(__dirname, '../screenshots/' + n + '.png');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto('file://' + path.resolve(__dirname, '../dist/index.html'));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: S('01_title') });
  await page.click('#b-new'); await page.waitForTimeout(200);
  await page.screenshot({ path: S('02_briefing') });
  await page.click('#b-go'); await page.waitForTimeout(900);
  await page.screenshot({ path: S('03_arrival') });
  // combat at the pharmacy lot
  await page.evaluate(() => { const G = DH.G, p = G.run.player; DH.Save.settings().hints = false; document.getElementById('hint').classList.add('hidden'); p.x = 50.5; p.y = 56; p.iframes = 999; DH.R.updateCamera(0, true); G.run.zombies.forEach((z) => { if (Math.hypot(z.x - 50, z.y - 46) < 12) { z.state = 'chase'; z.target = 'player'; z.lastSeen = G.time; } }); });
  await page.mouse.move(683 + 40, 384 - 140);
  await page.waitForTimeout(1600);
  await page.mouse.down(); await page.waitForTimeout(90); await page.screenshot({ path: S('04_combat') }); await page.mouse.up();
  // stockroom with the case and interaction prompt
  await page.evaluate(() => { const p = DH.G.run.player; DH.G.run.zombies.forEach((z) => { if (z.x < 50 && z.y > 36 && z.y < 56) z.dead = true; }); p.x = 28.2; p.y = 42.2; p.face = Math.PI; DH.R.updateCamera(0, true); });
  await page.mouse.move(560, 380); await page.waitForTimeout(900);
  await page.screenshot({ path: S('05_stockroom_case') });
  // howler inhale tell
  await page.evaluate(() => { const G = DH.G, run = G.run; run.player.x = 76; run.player.y = 50; DH.R.updateCamera(0, true); const h = run.zombies.find((z) => z.type === 'howler' && Math.hypot(z.x - 78, z.y - 46) < 8) || run.zombies.find((z) => z.type === 'howler'); h.x = 80; h.y = 47; h.dead = false; h.state = 'howl'; h.t = 1.0; h.target = 'player'; h.lastSeen = G.time; h.face = Math.PI; });
  await page.mouse.move(800, 300); await page.waitForTimeout(250);
  await page.screenshot({ path: S('06_howler_tell') });
  // driving with a clinger and headlights
  await page.evaluate(() => { const G = DH.G, run = G.run, t = run.truck; run.player.iframes = 999; t.x = 59.5; t.y = 75; t.ang = -Math.PI / 2; DH.Truck.enter(); DH.R.updateCamera(0, true); const c = run.zombies.find((z) => z.type === 'clinger' && !z.dead); c.x = t.x + 1.6; c.y = t.y; DH.Truck.attach(c); document.getElementById('drivehelp').classList.add('hidden'); });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(900); await page.keyboard.up('KeyW');
  await page.screenshot({ path: S('07_driving_clinger') });
  // transfer panel at the tailgate
  await page.evaluate(() => { const G = DH.G, run = G.run; run.zombies.forEach((z) => (z.dead = true)); run.truck.clingers = []; run.zombies.forEach((z) => (z.attached = null)); run.player.inTruck = false; run.truck.speed = 0; DH.Cargo.pickUp(run, 'case'); run.items.salvage0.loc = 'backpack'; const rp = DH.Truck.rearPoint(); run.player.x = rp.x; run.player.y = rp.y + 0.6; run.player.face = -Math.PI / 2; DH.R.updateCamera(0, true); G.transferOpen = true; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: S('08_transfer') });
  await page.evaluate(() => { DH.G.transferOpen = false; });
  await page.keyboard.press('Tab'); await page.waitForTimeout(300);
  await page.screenshot({ path: S('09_map') });
  await page.keyboard.press('Tab'); await page.waitForTimeout(200);
  // diner interior with survivor
  await page.evaluate(() => { const G = DH.G, run = G.run; G.W.doors.forEach((d, i) => { if (d.bld === 'diner') DH.World.setDoor(i, true); }); run.player.x = 85; run.player.y = 76.5; DH.R.updateCamera(0, true); });
  await page.mouse.move(700, 300); await page.waitForTimeout(700);
  await page.screenshot({ path: S('10_diner_survivor') });
  // depart confirm and results
  await page.evaluate(() => { const G = DH.G, run = G.run; run.player.x = 31; run.player.y = 116; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: S('11_depart_confirm') });
  await page.click('#dp-go'); await page.waitForTimeout(300);
  await page.screenshot({ path: S('12_results') });
  await page.click('#rs-garage'); await page.waitForTimeout(200);
  await page.screenshot({ path: S('13_garage') });
  await browser.close();
})();
