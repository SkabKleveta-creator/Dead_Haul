// Teleport the player to landmarks and capture screenshots for visual review.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const vw = +(process.argv[2] || 1366), vh = +(process.argv[3] || 768);
  const spots = JSON.parse(process.argv[4] || '[["pharm_front",34,56],["pharm_in",33,47],["stock",36,41],["inter",59,52],["diner",80,88],["hardware",84,48],["fuel",30,31]]');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: vw, height: vh } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../dist/index.html'));
  await page.waitForTimeout(800);
  await page.click('#b-new'); await page.click('#b-go');
  await page.evaluate(() => { DH.Save.settings().hints = false; document.getElementById('hint').classList.add('hidden'); });
  for (const [name, x, y, extra] of spots) {
    await page.evaluate(([x, y, extra]) => { const p = DH.G.run.player; p.x = x; p.y = y; p.iframes = 999; if (extra) eval(extra); DH.R.updateCamera(0, true); }, [x, y, extra || '']);
    await page.mouse.move(vw / 2 + 120, vh / 2 - 60);
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.resolve(__dirname, '../screenshots/_v_' + name + '.png') });
  }
  console.log('ERRORS', errors.length, errors.slice(0, 5).join('\n'), 'frameMs', await page.evaluate(() => DH.R.frameMs));
  await browser.close();
})();
