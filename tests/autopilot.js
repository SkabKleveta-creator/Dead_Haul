// Autopilot playthroughs using only the normal input intent (no invulnerability, standard loadout).
// Verifies the mission is achievable and the end-to-end flow (pickup -> transfer -> drive/walk -> extract -> reward).
const { load, blankInput } = require('./harness');

function makeBot(DH, opts) {
  const G = DH.G, W = G.W, M = DH.M;
  const toScreen = (wx, wy) => { const ix = (wx - wy) / 2, iy = (wx + wy) / 4; const l = Math.hypot(ix, iy) || 1; return { x: ix / l, y: iy / l }; };
  let path = null, pathGoal = null, pathT = 0, stuck = 0, lastPos = null;
  const bot = { log: [] };
  bot.walkTo = (inp, gx, gy) => {
    const p = G.run.player;
    if (!path || pathT <= 0 || M.dist(pathGoal.x, pathGoal.y, gx, gy) > 0.5) { path = W.findPath(p.x, p.y, gx, gy, false, 20000) || []; pathGoal = { x: gx, y: gy }; pathT = 1.0; }
    pathT -= DH.DT;
    while (path.length > 1 && M.dist(p.x, p.y, path[0].x, path[0].y) < 0.6) path.shift();
    while (path.length > 1 && W.walkLine(p.x, p.y, path[1].x, path[1].y, 0.3)) path.shift();
    const wp = path[0] || { x: gx, y: gy };
    // open closed doors in the way
    const ax = Math.floor(p.x + Math.sign(wp.x - p.x) * 0.9), ay = Math.floor(p.y + Math.sign(wp.y - p.y) * 0.9);
    if (W.inB(ax, ay) && W.doorClosed(W.idx(ax, ay)) && DH.Interact.primary && /^Open/.test(DH.Interact.primary.label)) inp.interactPressed = true;
    const s = toScreen(wp.x - p.x, wp.y - p.y);
    inp.move = s;
    if (lastPos && M.dist(lastPos.x, lastPos.y, p.x, p.y) < 0.002) stuck += DH.DT; else stuck = 0;
    if (stuck > 1.5) { path = null; stuck = 0; inp.move = { x: Math.random() - 0.5, y: Math.random() - 0.5 }; }
    lastPos = { x: p.x, y: p.y };
    return M.dist(p.x, p.y, gx, gy);
  };
  bot.fight = (inp) => {
    const run = G.run, p = run.player;
    if (p.inTruck) return false;
    let best = null, bd = 1e9;
    for (const z of run.zombies) {
      if (z.dead || z.attached) continue;
      const d = M.dist(p.x, p.y, z.x, z.y);
      const threat = z.state === 'chase' || z.state === 'windup' || z.state === 'lunge' || z.state === 'recover' || z.state === 'howl' || d < 4;
      if (!threat || d > (opts.engage || 11) || !W.los(p.x, p.y, z.x, z.y)) continue;
      if (d < bd) { bd = d; best = z; }
    }
    if (!best) return false;
    inp.aimDir = Math.atan2(best.y - p.y, best.x - p.x);
    const w = DH.Player.weapon();
    if (bd < 1.6 && (best.type !== 'drifter' || !w || w.mag === 0)) inp.melee = true;
    else if (w && (w.mag > 0 || p.ammo[DH.WEAPONS[w.type].ammo] > 0)) { inp.fire = true; inp.firePressed = true; }
    else inp.melee = true;
    // back-pedal from close attackers while shooting
    if (bd < 2.2) { const s = toScreen(p.x - best.x, p.y - best.y); inp.move = s; }
    else inp.move = { x: 0, y: 0 };
    return true;
  };
  bot.driveTo = (inp, gx, gy, maxSpeed) => {
    const t = G.run.truck;
    const a = Math.atan2(gy - t.y, gx - t.x);
    const da = M.angDiff(t.ang, a);
    inp.drive.steer = M.clamp(da * 2.2, -1, 1);
    const d = M.dist(t.x, t.y, gx, gy);
    const want = Math.min(maxSpeed || 7, d * 0.9 + 1.5) * (Math.abs(da) > 1.0 ? 0.4 : 1);
    if (t.speed < want - 0.3) inp.drive.throttle = 1; else if (t.speed > want + 0.8) inp.drive.brake = 1;
    if (t.stuckT > 1.5) inp.recover = true;
    return d;
  };
  return bot;
}

function runScenario(name, seed, mode) {
  const ctx = load(); const DH = ctx.DH, G = DH.G;
  DH.Save.load(); G.state = 'play';
  const run = G.newRun(seed);
  const bot = makeBot(DH, { engage: 11 });
  let phase = 'toCase', result = null, t = 0, lastPhase = '';
  const phases = [];
  DH.bus.on('runEnded', (r) => { result = r; });
  DH.bus.on('confirmDepart', () => { G.acceptDepart(); });
  const roadRoute = [[14.5, 102.5], [14.5, 60], [50, 59.5], [51, 50]]; // arrival -> west road -> cross street -> pharmacy lot
  const backRoute = [[51, 59], [14.5, 59.5], [14.5, 102.5], [2, 102.5]];
  let ri = 0;
  while (!result && t < 60 * 15) {
    const inp = blankInput();
    const p = G.run.player;
    if (phase !== lastPhase) { phases.push(phase + '@' + t.toFixed(0)); lastPhase = phase; }
    if (p.hp < 45 && p.medkits > 0 && !p.action && !p.inTruck) inp.heal = true;
    const fighting = !p.inTruck && !p.action && bot.fight(inp);
    if (!fighting && !p.action) {
      if (phase === 'toCase') {
        if (mode === 'truck' && ri < roadRoute.length) {
          if (!p.inTruck) { if (bot.walkTo(inp, G.run.truck.x + 0.5, G.run.truck.y - 1.8) < 1.5 && DH.Interact.primary && DH.Interact.primary.id === 'enter') inp.interactPressed = true; }
          else { const w = roadRoute[ri]; if (bot.driveTo(inp, w[0], w[1], 7) < 3.5) ri++; }
        } else if (p.inTruck) { inp.drive.handbrake = true; if (Math.abs(G.run.truck.speed) < 0.5) inp.interactPressed = true; }
        else {
          const c = G.run.items.case;
          const d = bot.walkTo(inp, c.x, c.y);
          if (d < 1.2 && DH.Interact.primary && DH.Interact.primary.id === 'case') inp.interactPressed = true;
          if (c.loc !== 'world') { phase = mode === 'truck' ? 'toTruck' : 'toGate'; ri = 0; }
        }
      } else if (phase === 'toTruck') {
        if (!p.inTruck) { if (bot.walkTo(inp, G.run.truck.x + 0.5, G.run.truck.y - 1.8) < 1.5 && DH.Interact.primary && DH.Interact.primary.id === 'enter') inp.interactPressed = true; }
        else phase = 'drive';
      } else if (phase === 'drive') {
        const w = backRoute[Math.min(ri, backRoute.length - 1)];
        if (bot.driveTo(inp, w[0], w[1], 7) < 3.5 && ri < backRoute.length - 1) ri++;
      } else if (phase === 'toGate') {
        bot.walkTo(inp, 31, 117.5);
      }
    }
    G.update(DH.DT, inp);
    t += DH.DT;
  }
  const r = result || { status: 'timeout', time: t };
  const out = { name, seed, status: r.status, mode: r.mode, scrap: r.scrap, time: +(r.time || t).toFixed(1), hp: G.run ? G.run.player.hp : null, kills: r.kills, truckDur: r.truckDur, phases: phases.join(' > '), end: G.run ? [G.run.player.x.toFixed(1), G.run.player.y.toFixed(1), G.run.player.inTruck, G.run.truck.x.toFixed(1), G.run.truck.y.toFixed(1), ri] : null, campaignScrap: DH.Save.data.campaign.scrap };
  return out;
}

const res = [];
const MAIN = require.main === module;
if (MAIN && !process.argv.includes("--full")) for (const seed of [101, 202, 303, 404, 505]) res.push(runScenario('foot', seed, 'foot'));
if (MAIN && !process.argv.includes("--full")) for (const seed of [111, 222, 333, 444, 555]) res.push(runScenario('truck', seed, 'truck'));
for (const r of res) console.log(JSON.stringify(r));
const wins = res.filter((r) => r.status === 'success').length;
if (MAIN && res.length) console.log('successes', wins, '/', res.length);
if (res.length) require('fs').writeFileSync(__dirname + '/autopilot-results.json', JSON.stringify(res, null, 1));

// ---------- Full run: case + survivor + generator + truck extraction via NE exit ----------
function runFull(seed, shared, mseed) {
  const ctx = shared || load(mseed != null ? { seedMath: mseed } : undefined); const DH = ctx.DH, G = DH.G, M = DH.M;
  if (!shared) DH.Save.load();
  G.state = 'play';
  G.newRun(seed, Object.assign({}, DH.Save.data.campaign.upgrades), 1);
  const bot = makeBot(DH, { engage: 10 });
  let result = null;
  const onEnd = (r) => { result = r; }; onEnd._bot = true; const onConf = () => G.acceptDepart(); onConf._bot = true;
  DH.bus.h.runEnded = (DH.bus.h.runEnded || []).filter((f) => !f._bot); DH.bus.on('runEnded', onEnd);
  DH.bus.h.confirmDepart = (DH.bus.h.confirmDepart || []).filter((f) => !f._bot); DH.bus.on('confirmDepart', onConf);
  const log = [];
  const steps = [
    { k: 'enter' },
    { k: 'drive', pts: [[14.5, 102.5], [14.5, 60], [50, 59.5], [51, 50]] },
    { k: 'exit' }, { k: 'take', id: 'case' }, { k: 'enter' },
    { k: 'drive', pts: [[51, 59.5], [59.5, 60], [59.5, 92.5], [80, 93.8]] },
    { k: 'exit' }, { k: 'recruit' }, { k: 'enter' }, { k: 'waitBoard' },
    { k: 'drive', pts: [[96, 94], [105.5, 90], [105.5, 64], [96, 59.6], [86, 58.6]] },
    { k: 'cmdWait' }, { k: 'exit' }, { k: 'haul' }, { k: 'load' }, { k: 'enter' },
    { k: 'drive', pts: [[100, 59.5], [105.5, 52], [105.5, 12], [105.5, 1.5]] },
  ];
  let si = 0, ri = 0, t = 0, stT = 0;
  while (!result && t < 60 * 20 && si < steps.length + 1) {
    const inp = blankInput();
    const run = G.run, p = run.player, st = steps[si];
    if (p.hp < 45 && p.medkits > 0 && !p.action && !p.inTruck) inp.heal = true;
    // a human drops the generator to fight when something closes in
    if (p.hauling && run.zombies.some((z) => !z.dead && !z.attached && M.dist(z.x, z.y, p.x, p.y) < 5 && (z.state === 'chase' || z.state === 'windup' || z.state === 'lunge'))) inp.drop = true;
    const busy = !p.inTruck && !p.action && !p.hauling && bot.fight(inp);
    const P = DH.Interact.primary;
    let done = false;
    // recovery behaviours: revive survivor, repair a disabled truck, pry off clingers
    if (!busy && !p.inTruck && !p.action && st && st.k !== 'drive') {
      const sv = run.survivor, cand = [P].concat(DH.Interact.alts);
      const pick = (id) => cand.findIndex((c) => c && c.id && c.id.indexOf(id) === 0 && !c.disabled);
      if (sv.state === 'downed' && p.medkits > 0) { bot.walkTo(inp, sv.x, sv.y); const k = pick('revive'); if (k === 0) inp.interactPressed = true; else if (k > 0) inp.alt[k - 1] = true; G.update(DH.DT, inp); t += DH.DT; continue; }
      if ((run.truck.disabled || run.truck.dur < 80) && p.repairkits > 0 && !p.hauling) { const sp = DH.Truck.toWorld(0.5, -(DH.Truck.HW + 0.7)); bot.walkTo(inp, sp.x, sp.y); const k = pick('repair'); if (k === 0) inp.interactPressed = true; else if (k > 0) inp.alt[k - 1] = true; G.update(DH.DT, inp); t += DH.DT; continue; }
      if (run.truck.clingers.length) { const k = pick('clinger'); if (k === 0) inp.interactPressed = true; else if (k > 0) inp.alt[k - 1] = true; }
    }
    if (st && !busy && !p.action) {
      switch (st.k) {
        case 'drive': { const w = st.pts[ri]; if (bot.driveTo(inp, w[0], w[1], ri === st.pts.length - 1 ? 3 : 7) < (ri === st.pts.length - 1 ? 1.8 : 3.5)) { ri++; if (ri >= st.pts.length) { done = true; ri = 0; } } break; }
        case 'exit': if (!p.inTruck) { done = true; break; } inp.drive.handbrake = true; if (Math.abs(run.truck.speed) < 0.5) inp.interactPressed = true; break;
        case 'enter': { if (p.inTruck) { done = true; break; } const sp = DH.Truck.toWorld(0.5, -(DH.Truck.HW + 0.7)); bot.walkTo(inp, sp.x, sp.y); if (P && P.id === 'enter') inp.interactPressed = true; break; }
        case 'take': { const c = run.items[st.id]; bot.walkTo(inp, c.x, c.y); if (P && P.id === st.id) inp.interactPressed = true; if (c.loc !== 'world') done = true; break; }
        case 'recruit': { const s = run.survivor; bot.walkTo(inp, s.x, s.y); if (P && P.id === 'recruit') inp.interactPressed = true; if (s.recruited) done = true; break; }
        case 'cmdWait': inp.command = true; done = true; break;
        case 'waitBoard': inp.drive.handbrake = true; stT += DH.DT; if (run.survivor.boarded || stT > 25) { done = true; log.push('boarded=' + run.survivor.boarded); } break;
        case 'haul': { const g = run.items.generator; if (p.hauling) { done = true; break; } bot.walkTo(inp, g.x - 0.8, g.y); if (P && P.id === 'gen') inp.interactPressed = true; break; }
        case 'load': {
          const g = run.items.generator; if (g.loc === 'truck') { done = true; break; }
          if (!p.hauling && g.loc === 'world') { bot.walkTo(inp, g.x - 0.8, g.y); if (P && P.id === 'gen') inp.interactPressed = true; break; }
          const rp = DH.Truck.rearPoint(); const d = bot.walkTo(inp, rp.x, rp.y);
          if (P && P.id === 'loadGen' && !P.disabled) { inp.interactPressed = !bot._held; inp.interactHeld = true; bot._held = true; inp.move = { x: 0, y: 0 }; } else bot._held = false;
          break;
        }
      }
    } else if (st && p.action && st.k === 'load') { inp.interactHeld = true; }
    if (done) { log.push(st.k + '@' + t.toFixed(0)); si++; stT = 0; }
    G.update(DH.DT, inp);
    t += DH.DT;
  }
  const r = result || { status: 'timeout' };
  return { name: 'full', seed, status: r.status, mode: r.mode, scrap: r.scrap, case: r.caseOut, survivor: r.survivorOut, generator: r.generatorOut, time: +(r.time || t).toFixed(1), kills: r.kills, truckDur: r.truckDur, steps: log.join(' > '), stuckAt: result ? null : (steps[si] || {}).k, prim: DH.Interact.primary && DH.Interact.primary.label, alts: DH.Interact.alts.map((a) => a.label).join('|'), surv: G.run && G.run.survivor && [G.run.survivor.state, G.run.survivor.x.toFixed(1), G.run.survivor.y.toFixed(1)], result: r, pos: G.run ? [G.run.player.x.toFixed(1), G.run.player.y.toFixed(1), G.run.truck.x.toFixed(1), G.run.truck.y.toFixed(1)] : null };
}
module.exports = { runFull, runScenario };
if (MAIN && process.argv.includes('--full')) {
  const fr = [];
  for (const seed of [7, 8, 9]) { const r = runFull(seed); console.log(JSON.stringify(r)); fr.push(r); }
  require('fs').writeFileSync(__dirname + '/autopilot-full-results.json', JSON.stringify(fr, null, 1));
}
