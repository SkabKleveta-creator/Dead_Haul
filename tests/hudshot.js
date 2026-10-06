// Compact HUD screenshots: phone landscape, phone inside the Claude app frame (~844x335), desktop.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  for (const [w, h, touch] of [[844, 390, true], [844, 335, true], [1366, 768, false]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1 });
    const page = await ctx.newPage();
    await page.goto('file://' + path.resolve(__dirname, '../dist/index.html')); await page.waitForTimeout(600);
    if (touch) { await page.tap('#b-new'); await page.tap('#b-go'); } else { await page.click('#b-new'); await page.click('#b-go'); }
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.resolve(__dirname, '../screenshots/hud_' + w + 'x' + h + '.png') });
    const cover = await page.evaluate(() => { const els = [...document.querySelectorAll('#hud-tl,#hud-obj,#hud-tr,#truck-panel,#tb-util,#tb-foot .tb:not(.off):not(.hidden),#msgs .msg,#hint')].filter((e) => e.offsetParent && !e.classList.contains('hidden')); let a = 0; for (const e of els) { const r = e.getBoundingClientRect(); a += r.width * r.height; } return Math.round((a / (innerWidth * innerHeight)) * 100); });
    console.log(w + 'x' + h, 'HUD covers ~' + cover + '% of the screen');
    await ctx.close();
  }
  await browser.close();
})();
