// Quick visual check: load the build, capture console errors, take screenshots of key states.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const vw = +(process.argv[2] || 1366), vh = +(process.argv[3] || 768);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: vw, height: vh } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  await page.goto('file://' + path.resolve(__dirname, '../dist/index.html'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.resolve(__dirname, '../screenshots/_title.png') });
  await page.click('#b-new'); await page.waitForTimeout(300);
  await page.screenshot({ path: path.resolve(__dirname, '../screenshots/_brief.png') });
  await page.click('#b-go'); await page.waitForTimeout(1500);
  await page.mouse.move(vw * 0.3, vh * 0.3);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.resolve(__dirname, '../screenshots/_play.png') });
  console.log(JSON.stringify(await page.evaluate(() => DH.debug.state())), 'frameMs', await page.evaluate(() => DH.debug.frameMs()));
  console.log('ERRORS', errors.length, errors.slice(0, 10).join('\n'));
  await browser.close();
})();
