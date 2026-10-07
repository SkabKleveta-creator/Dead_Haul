// Map inspection: ASCII dump + reachability for people and the truck. Usage: node tools/mapcheck.js <level> [x0 y0 x1 y1] [--targets]
const { load } = require('../tests/harness');
const lvl = +process.argv[2] || 2;
const ctx = load(); const DH = ctx.DH, G = DH.G; DH.Save.load();
const run = G.newRun(1, {}, lvl);
const W = G.W, N = W.N;
const args = process.argv.slice(3).filter((a) => !a.startsWith('--')).map(Number);
const [x0, y0, x1, y1] = args.length === 4 ? args : [0, 0, N - 1, N - 1];
// human reachability (navCost) from player start; truck reachability: tile centers where truck circle fits (HW 1.15)
const human = new Uint8Array(N * N), truck = new Uint8Array(N * N);
const bfs = (sx, sy, ok, out) => { const q = [W.idx(Math.floor(sx), Math.floor(sy))]; out[q[0]] = 1; while (q.length) { const i = q.pop(); const x = i % N, y = (i / N) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue; const j = W.idx(nx, ny); if (out[j] || !ok(nx, ny)) continue; out[j] = 1; q.push(j); } } };
bfs(W.start.player.x, W.start.player.y, (x, y) => W.navCost(x, y, false) > 0 || (W.doorAt[W.idx(x, y)] > 0), human);
const tfree = (x, y) => W.circleFree(x + 0.5, y + 0.5, 1.2, { truck: true });
bfs(W.start.truck.x, W.start.truck.y, tfree, truck);
const ch = (x, y) => {
  const i = W.idx(x, y);
  if (Math.floor(run.player.x) === x && Math.floor(run.player.y) === y) return '@';
  if (Math.floor(run.truck.x) === x && Math.floor(run.truck.y) === y) return 'T';
  for (const id in run.items) { const it = run.items[id]; if (Math.floor(it.x) === x && Math.floor(it.y) === y) return DH.ITEMS[it.kind].heavy ? 'H' : DH.ITEMS[it.kind].primary ? '!' : '$'; }
  for (const s of run.survivors) if (Math.floor(s.x) === x && Math.floor(s.y) === y) return 'S';
  if (W.doorAt[i]) return W.doors[W.doorAt[i] - 1].locked ? 'L' : W.doors[W.doorAt[i] - 1].shutter ? '=' : W.doors[W.doorAt[i] - 1].gate ? 'g' : 'D';
  if (W.wall[i]) return DH.MAT_INFO[W.wall[i]].see ? ':' : '#';
  if (W.ground[i]) return '~';
  if (W.propBlock[i]) return 'o';
  for (const g of W.gates) if (g.set[i]) return run.gates[g.id].on ? 'w' : 'v';
  if (W.truckWallS[i]) return 'x';
  for (const z of W.exits) if (x >= z.x1 && x <= z.x2 && y >= z.y1 && y <= z.y2) return 'E';
  if (truck[i]) return ',';
  if (human[i]) return '.';
  return ' ';
};
let out = '    ' + Array.from({ length: x1 - x0 + 1 }, (_, k) => ((x0 + k) % 10)).join('') + '\n';
for (let y = y0; y <= y1; y++) { let row = String(y).padStart(3) + ' '; for (let x = x0; x <= x1; x++) row += ch(x, y); out += row + '\n'; }
console.log(out);
console.log('legend: # wall  : see-through  D door  L locked  = shutter  g gate  o prop  ~ void/sea  w flooded  v drainable  x truck-blocked  E exit  , truck-reachable  . foot-reachable  H heavy  ! primary  $ item  S survivor');
if (process.argv.includes('--targets')) {
  const rep = (name, x, y) => console.log(name.padEnd(28), 'foot', !!human[W.idx(Math.floor(x), Math.floor(y))] || W.findPath(W.start.player.x, W.start.player.y, x, y, false, 60000) ? 'ok' : 'NO');
  for (const id in run.items) rep('item ' + id, run.items[id].x, run.items[id].y);
  for (const s of run.survivors) rep('survivor ' + s.id, s.x, s.y);
  for (const z of W.exits) rep('exit ' + z.id, (z.x1 + z.x2) / 2, (z.y1 + z.y2) / 2);
  console.log('zombies', run.zombies.length, 'doors', W.doors.length, 'props', W.props.length);
}
