// Story delivery and campaign-structure checks (Node): briefing length, radio line length, outcome-aware aftermath,
// ending for minimal and full playthroughs, and bounded state across many consecutive missions and retries.
const fs = require('fs');
const { load, blankInput } = require('./harness');
let pass = 0, fail = 0;
const rows = [];
const ok = (c, n) => { if (c) pass++; else { fail++; console.log('FAIL', n); } rows.push([c ? 'PASS' : 'FAIL', n]); };

const ctx = load({ seedMath: 3 }); const DH = ctx.DH, G = DH.G; DH.Save.load();
const words = (s) => String(s).split(/\s+/).filter(Boolean).length;

// briefings
for (let l = 1; l <= 5; l++) {
  const L = DH.LEVELS[l]; const b = typeof L.brief === 'function' ? L.brief(DH.Save.data.campaign.story) : L.brief;
  ok(words(b) <= 80, 'M' + l + ' briefing ' + words(b) + ' words (<= 80)');
}
// radio lines (string literals in the level and story sources)
const src = ['l1', 'l2', 'l3', 'l4', 'l5', 'story'].map((f) => fs.readFileSync(__dirname + '/../src/' + f + '.js', 'utf8')).join('\n');
const radio = [...src.matchAll(/G\.radio\('[a-z]+', '((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]);
const longest = Math.max(...radio.map((s) => s.length));
ok(radio.length >= 20 && longest <= 140, radio.length + ' radio lines, longest ' + longest + ' characters (<= 140, about two HUD lines)');

// aftermath: minimal (no optional outcomes) vs full
const minimal = { completed: { 1: true, 2: true, 3: true, 4: true, 5: true }, milestones: { refrigeration: true, water: true, relay: true, crossing: true }, outcomes: { 1: {}, 2: { route: 'service' }, 3: { setting: 'B' }, 4: { broadcast: 'off' }, 5: {} }, optional: {}, seen: {}, log: [] };
const full = { completed: minimal.completed, milestones: Object.assign({ nell: true, generator: true, tomas: true, ada: true, wes: true, medstock: true }, minimal.milestones), outcomes: { 1: {}, 2: { route: 'power' }, 3: { setting: 'A', supplies: 2 }, 4: { broadcast: 'routed' }, 5: { stranded: 3, supplies: 4 } }, optional: {}, seen: {}, log: [] };
const inPerson = (lines, who) => lines.some((x) => x.who === who && !x.radio);
for (let l = 1; l <= 4; l++) {
  const a = DH.Story.aftermath(l, minimal), b = DH.Story.aftermath(l, full);
  ok(a.lines.length >= 3 && a.next === l + 1, 'M' + l + ' aftermath (no optional outcomes) has ' + a.lines.length + ' lines and points to M' + (l + 1));
  ok(!['nell', 'tomas', 'ada', 'wes'].some((k) => inPerson(a.lines, k)), 'M' + l + ' minimal aftermath: nobody you did not rescue speaks at the garage');
  ok(JSON.stringify(a.lines) !== JSON.stringify(b.lines), 'M' + l + ' aftermath changes with outcomes');
  ok(a.lines.every((x) => words(x.text) <= 30) && b.lines.every((x) => words(x.text) <= 30), 'M' + l + ' aftermath lines stay short');
}
ok(inPerson(DH.Story.aftermath(1, full).lines, 'nell'), 'Nell (rescued) delivers the depot lead in person');
ok(DH.Story.aftermath(1, minimal).lines.some((x) => /Route 9/.test(x.text)), 'without Nell, Marta delivers the depot lead');
ok(DH.Story.aftermath(1, full).lines.some((x) => /generator/i.test(x.text) && /lights/i.test(x.text)) && DH.Story.aftermath(1, minimal).lines.some((x) => /batteries/i.test(x.text)), 'generator outcome: lit bay vs battery workaround');
ok(DH.Story.aftermath(2, minimal).lines.some((x) => /evac/i.test(x.text)) && DH.Story.aftermath(2, minimal).lines.some((x) => /Harbor Street|June/.test(x.text)), 'M2 aftermath: evac center closed + waterfront note (with or without Tomas)');
const eMin = DH.Story.ending(minimal, { outcome: {} }), eFull = DH.Story.ending(full, { outcome: full.outcomes[5] });
ok(eMin.length >= 3 && eMin.some((x) => /foothold/i.test(x)) && !eMin.some((x) => /Nell|Tomas|Ada|Wes/.test(x)), 'minimal ending is coherent and names no one you did not bring home');
ok(eFull.some((x) => /Nell, Tomas, Ada and Wes/.test(x)) && eFull.some((x) => /3 dockworkers/.test(x)) && eFull.some((x) => /4 crates/.test(x)), 'full ending lists people, stranded rescues and supplies');
ok(eFull.some((x) => /does not end/i.test(x)), 'ending frames the crossing as a foothold, not the end of the outbreak');

// bounded state across consecutive missions and retries (random input, 25 runs cycling all five maps)
{
  const hc = () => Object.values(DH.bus.h).reduce((n, a) => n + a.length, 0);
  G.state = 'play';
  G.newRun(1, {}, 1); const h0 = hc();
  let maxZ = 0, maxNoise = 0, maxMsgs = 0, maxEmit = 0, worlds = new Set();
  const r = DH.RNG(5);
  for (let k = 0; k < 25; k++) {
    const level = 1 + (k % 5);
    G.newRun(100 + k, {}, level); worlds.add(G.W);
    for (let f = 0; f < 60 * 40 && G.run; f++) {
      const i = blankInput();
      if (f % 15 === 0) { i.move = { x: r.range(-1, 1), y: r.range(-1, 1) }; i.fire = r.next() < 0.3; i.firePressed = i.fire; i.interactPressed = r.next() < 0.2; i.throwN = r.next() < 0.02; }
      G.update(DH.DT, i);
      if (!G.run) break;
      if (G.run.player.hp < 30) G.run.player.hp = 100; // [state] keep the run alive to stress populations
      maxZ = Math.max(maxZ, G.run.zombies.length); maxNoise = Math.max(maxNoise, G.noise.length); maxMsgs = Math.max(maxMsgs, G.msgs.length); maxEmit = Math.max(maxEmit, (G.run.emitters || []).length);
    }
  }
  ok(hc() <= h0 + 2, 'event listeners do not accumulate across 25 runs (' + h0 + ' -> ' + hc() + ')');
  ok(maxZ <= 80 && maxNoise <= 40 && maxMsgs <= 4 && maxEmit <= 8, 'populations bounded: zombies<=' + maxZ + ', noise events<=' + maxNoise + ', messages<=' + maxMsgs + ', machines<=' + maxEmit);
  ok(worlds.size <= 5, 'one cached world per map reused across retries (' + worlds.size + ' world objects for 25 runs)');
}

console.log(pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(__dirname + '/story-results.json', JSON.stringify({ pass, fail, rows }, null, 1));
process.exitCode = fail ? 1 : 0;
