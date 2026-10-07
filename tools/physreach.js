// Physics reachability: flood-fill a 0.25 m grid using the real collision (resolveCircle, person r 0.33)
// with every door open, then confirm each item, survivor, labelled prop (panels, consoles) and exit can be reached.
// Catches thin props that the tile nav raster misses. Usage: node tools/physreach.js [level]
const { load } = require('../tests/harness');
const levels = process.argv[2] ? [+process.argv[2]] : [1, 2, 3, 4, 5];
let fails = 0;
for (const L of levels) {
  const ctx = load(); const DH = ctx.DH, G = DH.G; DH.Save.load();
  const run = G.newRun(1, {}, L); const W = G.W, N = W.N;
  for (const d of W.doors) d.open = true;
  const S = 4, M = N * S, free = new Int8Array(M * M).fill(-1), seen = new Uint8Array(M * M);
  const ok = (i) => { if (free[i] < 0) { const x = (i % M) / S + 0.125, y = ((i / M) | 0) / S + 0.125; free[i] = W.circleFree(x, y, 0.33) ? 1 : 0; } return free[i] === 1; };
  const start = Math.floor(run.player.y * S) * M + Math.floor(run.player.x * S);
  const q = [start]; seen[start] = 1;
  while (q.length) { const i = q.pop(); const x = i % M, y = (i / M) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= M || ny >= M) continue; const j = ny * M + nx; if (seen[j] || !ok(j)) continue; seen[j] = 1; q.push(j); } }
  const near = (x, y, r) => { for (let yy = Math.floor((y - r) * S); yy <= Math.floor((y + r) * S); yy++) for (let xx = Math.floor((x - r) * S); xx <= Math.floor((x + r) * S); xx++) { if (xx < 0 || yy < 0 || xx >= M || yy >= M) continue; if (seen[yy * M + xx] && Math.hypot(xx / S + 0.125 - x, yy / S + 0.125 - y) <= r) return true; } return false; };
  const bad = [];
  for (const id in run.items) { const it = run.items[id]; if (it.loc === 'world' && !near(it.x, it.y, 1.3)) bad.push('item ' + id + ' @' + it.x.toFixed(1) + ',' + it.y.toFixed(1)); }
  for (const s of run.survivors) if (!near(s.x, s.y, 1.4)) bad.push('survivor ' + s.id + ' @' + s.x.toFixed(1) + ',' + s.y.toFixed(1));
  for (const p of W.props) if (p.label && !near(p.x, p.y, Math.max(p.hw || p.r || 0, p.hl || 0) + 1.3)) bad.push('prop ' + p.label + ' @' + p.x.toFixed(1) + ',' + p.y.toFixed(1));
  for (const e of W.exits) { const cx = (e.x1 + e.x2 + 1) / 2, cy = (e.y1 + e.y2 + 1) / 2; if (!near(cx, cy, Math.max(e.x2 - e.x1, e.y2 - e.y1) / 2 + 1.5)) bad.push('exit ' + (e.id || e.label) + ' @' + cx + ',' + cy); }
  for (const d of W.doors) if (!near(d.cx, d.cy, 1.8)) bad.push('door ' + d.label);
  fails += bad.length;
  console.log('L' + L + ': ' + (bad.length ? 'UNREACHABLE ' + bad.join(' | ') : 'all reachable'));
}
process.exitCode = fails ? 1 : 0;
