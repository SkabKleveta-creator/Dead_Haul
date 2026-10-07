// Screenshot a level at given player positions. node tools/levelshot.js <level> <out-prefix> x,y[,truck][,flags] ...
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [lvl, prefix, ...spots] = process.argv.slice(2);
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1366, height: 768 } });
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e))); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.goto('file://' + path.resolve(__dirname, '../dist/index.html'));
  await pg.waitForTimeout(600);
  let i = 0;
  for (const sp of spots) {
    const [x, y, mode, extra] = sp.split(',');
    await pg.evaluate(([lvl, x, y, mode, extra]) => {
      const G = DH.G;
      if (!G.run || G.backdrop || G.run.level !== +lvl) { DH.Save.clearRun(); G.backdrop = false; G.newRun(5, {}, +lvl); }
      G.state = 'play'; DH.UI.show(null); DH.UI.setHud(true); DH.Save.settings().hints = false; DH.debug.manual = true;
      const p = G.run.player;
      if (extra) for (const f of extra.split('+')) { if (f.startsWith('gate:')) { const [, id, v] = f.split(':'); G.run.gates[id].on = v === '1'; G.applyGates(); } else G.run.flags[f] = true; }
      if (mode === 'truck') { G.run.truck.x = +x; G.run.truck.y = +y; p.inTruck = true; G.run.truck.engine = true; }
      else { p.inTruck = false; p.x = +x; p.y = +y; }
      for (const z of G.run.zombies) { z.visible = true; z.seenA = 1; }
      DH.R.updateCamera(0, true);
      DH.debug.step(30);
    }, [lvl, x, y, mode, extra]);
    await pg.waitForTimeout(350);
    await pg.screenshot({ path: prefix + '_' + (i++) + '.png' });
  }
  console.log('errors', errs.slice(0, 5));
  await b.close();
})();
