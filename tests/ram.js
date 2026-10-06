// Ramming check: crowd pressed against a stopped truck, then full throttle; and a run-up at speed.
const { load, blankInput } = require('./harness');
const out = {};
for (const scen of ['pressed', 'runup']) {
  const ctx = load(); const DH = ctx.DH, G = DH.G; DH.Save.load(); G.state = 'play';
  const run = G.newRun(5); run.zombies = [];
  const t = run.truck; DH.Truck.enter(); t.x = 59.5; t.y = 100; t.ang = -Math.PI / 2; // main street heading north
  const y0 = scen === 'pressed' ? 96.5 : 86;
  for (let i = 0; i < 6; i++) { const z = DH.Z.make(run, 'drifter', 58.3 + (i % 3) * 1.1, y0 - Math.floor(i / 3) * 0.9); z.state = 'chase'; z.target = 'truck'; z.lastSeen = G.time; run.zombies.push(z); }
  const d0 = t.dur; let frames = 0;
  for (; frames < 60 * 4; frames++) { const inp = blankInput(); inp.drive.throttle = 1; G.update(DH.DT, inp); }
  const dead = run.zombies.filter((z) => z.dead).length;
  const hurt = run.zombies.filter((z) => !z.dead && z.hp < z.maxHp).length;
  out[scen] = { killed: dead, wounded: hurt, of: 6, truckLoss: +(d0 - t.dur).toFixed(1), speedAfter4s: +t.speed.toFixed(1), travelled: +(100 - t.y).toFixed(1) };
}
console.log(JSON.stringify(out));
