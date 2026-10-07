const { load, blankInput } = require('./harness');
const ctx = load();
const DH = ctx.DH, G = DH.G;
DH.Save.load();
G.state = 'play';
const run = G.newRun(12345);
console.log('zombies', run.zombies.length, 'items', Object.keys(run.items).length, 'pickups', run.pickups.length);
const t0 = Date.now();
for (let i = 0; i < 60 * 60; i++) { G.update(DH.DT, blankInput()); if (!G.run) break; }
console.log('sim 60s in', Date.now() - t0, 'ms; player hp', G.run && G.run.player.hp, 'states', G.run && JSON.stringify(G.run.zombies.reduce((a, z) => (a[z.state] = (a[z.state] || 0) + 1, a), {})));
