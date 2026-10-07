// Nav/physics agreement: tiles the nav raster calls walkable whose center a person (r 0.33) cannot occupy.
// Such tiles make the AI and bots path into invisible blockers. Usage: node tools/navphys.js [level]
const { load } = require('../tests/harness');
const levels = process.argv[2] ? [+process.argv[2]] : [1, 2, 3, 4, 5];
let total = 0;
for (const L of levels) {
  const ctx = load(); const DH = ctx.DH, G = DH.G; DH.Save.load();
  G.newRun(1, {}, L); const W = G.W, N = W.N; const bad = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = W.idx(x, y);
    if (W.navCost(x, y, false) <= 0 || W.doorAt[i]) continue;
    if (!W.circleFree(x + 0.5, y + 0.5, 0.33)) bad.push(x + ',' + y);
  }
  total += bad.length;
  console.log('L' + L, bad.length, bad.slice(0, 60).join(' '));
}
process.exitCode = 0;
