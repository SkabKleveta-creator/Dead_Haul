// Campaign bots: scripted playthroughs of all five missions using only the normal input intent
// (move, aim, fire, melee, interact press/hold, alt actions, drive). Standard loadout, no invulnerability,
// no teleporting, no direct state edits. Usage: node tests/campaign.js [level|all] [--seeds=1,2,3] [--variant=name]
const { load, blankInput } = require('./harness');

function makeBot(DH) {
  const G = DH.G, M = DH.M;
  const W = () => G.W;
  const toScreen = (wx, wy) => { const ix = (wx - wy) / 2, iy = (wx + wy) / 4; const l = Math.hypot(ix, iy) || 1; return { x: ix / l, y: iy / l }; };
  let path = null, pathGoal = null, pathT = 0, stuck = 0, lastPos = null, rs = 12345, detour = null;
  const rnd = () => ((rs = (rs * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const bot = {};
  bot.state = () => ({ path, pathGoal, stuck, detour });
  bot.reset = () => { path = null; pathGoal = null; stuck = 0; detour = null; };
  bot.walkTo = (inp, gx, gy) => {
    const p = G.run.player, w = W();
    // the nav grid ignores the parked truck, so the bot treats the tiles under the hull as blocked while planning
    const T = DH.Truck, onFoot = !p.inTruck;
    const clearOfTruck = (x1, y1, x2, y2) => { if (!onFoot) return true; for (let k = 0; k <= 10; k++) { const q = k / 10; if (T.distToHull(x1 + (x2 - x1) * q, y1 + (y2 - y1) * q) < 0.4) return false; } return true; };
    if (!path || pathT <= 0 || M.dist(pathGoal.x, pathGoal.y, gx, gy) > 0.5) {
      const marked = [];
      if (onFoot) { const t = G.run.truck; for (let y = Math.floor(t.y - 4); y <= Math.floor(t.y + 4); y++) for (let x = Math.floor(t.x - 4); x <= Math.floor(t.x + 4); x++) { if (!w.inB(x, y)) continue; const i = w.idx(x, y); if (!w.propBlock[i] && T.distToHull(x + 0.5, y + 0.5) < 0.45 && M.dist(x + 0.5, y + 0.5, p.x, p.y) > 0.8 && M.dist(x + 0.5, y + 0.5, gx, gy) > 0.8) { w.propBlock[i] = 1; marked.push(i); } } }
      path = w.findPath(p.x, p.y, gx, gy, false, 40000) || [];
      for (const i of marked) w.propBlock[i] = 0;
      pathGoal = { x: gx, y: gy }; pathT = 1.0;
    }
    pathT -= DH.DT;
    while (path.length > 1 && M.dist(p.x, p.y, path[0].x, path[0].y) < 0.6) path.shift();
    while (path.length > 1 && w.walkLine(p.x, p.y, path[1].x, path[1].y, 0.3) && clearOfTruck(p.x, p.y, path[1].x, path[1].y)) path.shift();
    const wp = path[0] || { x: gx, y: gy };
    const ax = Math.floor(p.x + Math.sign(wp.x - p.x) * 0.9), ay = Math.floor(p.y + Math.sign(wp.y - p.y) * 0.9);
    if (w.inB(ax, ay) && w.doorClosed(w.idx(ax, ay)) && DH.Interact.primary && /^(Open|Raise)/.test(DH.Interact.primary.label)) inp.interactPressed = true;
    inp.move = toScreen(wp.x - p.x, wp.y - p.y);
    if (lastPos && M.dist(lastPos.x, lastPos.y, p.x, p.y) < 0.002) stuck += DH.DT; else stuck = 0;
    if (stuck > 1.5) { path = null; stuck = 0; inp.move = { x: rnd() - 0.5, y: rnd() - 0.5 }; }
    lastPos = { x: p.x, y: p.y };
    return M.dist(p.x, p.y, gx, gy);
  };
  bot.threat = (range) => {
    const run = G.run, p = run.player;
    let best = null, bd = 1e9;
    for (const z of run.zombies) {
      if (z.dead || z.attached) continue;
      const d = M.dist(p.x, p.y, z.x, z.y);
      const active = z.state === 'chase' || z.state === 'windup' || z.state === 'lunge' || z.state === 'recover' || z.state === 'howl' || z.state === 'batter' || d < 4;
      if (!active || d > (range || 11) || !W().los(p.x, p.y, z.x, z.y)) continue;
      if (d < bd) { bd = d; best = z; }
    }
    return best ? { z: best, d: bd } : null;
  };
  bot.fight = (inp) => {
    const run = G.run, p = run.player;
    if (p.inTruck) return false;
    const t = bot.threat(11);
    if (!t) return false;
    const best = t.z, bd = t.d;
    inp.aimDir = Math.atan2(best.y - p.y, best.x - p.x);
    const w = DH.Player.weapon();
    const has = (q) => q && (q.mag > 0 || p.ammo[DH.WEAPONS[q.type].ammo] > 0);
    // empty gun: switch to one with ammo if carried, otherwise step in and use the melee strike
    if (!has(w) && p.weapons.some((q) => has(q))) inp.swap = true;
    const dry = !p.weapons.some((q) => has(q));
    if (bd < 1.6 && (best.type !== 'drifter' || !w || w.mag === 0)) inp.melee = true;
    else if (has(w)) { inp.fire = true; inp.firePressed = true; }
    else inp.melee = true;
    if (dry) inp.move = bd > 1.2 ? toScreen(best.x - p.x, best.y - p.y) : { x: 0, y: 0 };
    else if (bd < 2.2) inp.move = toScreen(p.x - best.x, p.y - best.y); else inp.move = { x: 0, y: 0 };
    return true;
  };
  bot.driveTo = (inp, gx, gy, maxSpeed) => {
    const t = G.run.truck;
    const a = Math.atan2(gy - t.y, gx - t.x);
    const da = M.angDiff(t.ang, a);
    const back = Math.abs(da) > 2.5 && M.dist(t.x, t.y, gx, gy) < 6;
    inp.drive.steer = M.clamp((back ? -M.angDiff(t.ang + Math.PI, a) : da) * 2.2, -1, 1);
    const d = M.dist(t.x, t.y, gx, gy);
    const want = Math.min(maxSpeed || 7, d * 0.9 + 1.5) * (Math.abs(da) > 1.0 ? 0.4 : 1);
    if (back) { if (t.speed > -2) inp.drive.brake = 1; }
    else if (t.speed < want - 0.3) inp.drive.throttle = 1; else if (t.speed > want + 0.8) inp.drive.brake = 1;
    if (t.stuckT > 1.5) inp.recover = true;
    return d;
  };
  // pick an interaction candidate by id (primary or alt) and trigger it with the normal input
  bot.trigger = (inp, id) => {
    const I = DH.Interact, cand = [I.primary].concat(I.alts);
    const k = cand.findIndex((c) => c && (typeof id === 'function' ? id(c) : c.id === id) && !c.disabled);
    if (k < 0) return false;
    inp.primaryId = I.primary ? I.primary.id : null; inp.altIds = I.alts.map((a) => a.id);
    if (k === 0) { inp.interactPressed = true; inp.interactHeld = true; } else inp.alt[k - 1] = true;
    return true;
  };
  return bot;
}

// ---------------- level scripts ----------------
const door = (label) => ({ k: 'door', label });
const S = {
  1: {
    truck: [
      { k: 'enter' }, { k: 'drive', pts: [[14.5, 102.5], [14.5, 60], [50, 59.5], [51, 50]] },
      { k: 'exit' }, { k: 'take', id: 'case' }, { k: 'enter' },
      { k: 'drive', pts: [[51, 59.5], [59.5, 60], [59.5, 92.5], [64, 95.8], [76, 95.8], [96, 94], [105.5, 90], [105.5, 52], [105.5, 12], [105.5, 1.5]] },
    ],
    full: [
      { k: 'enter' }, { k: 'drive', pts: [[14.5, 102.5], [14.5, 60], [50, 59.5], [51, 50]] },
      { k: 'exit' }, { k: 'take', id: 'case' }, { k: 'enter' },
      { k: 'drive', pts: [[51, 59.5], [59.5, 60], [59.5, 92.5], [80, 93.8]] },
      { k: 'exit' }, { k: 'recruit', id: 'nell' }, { k: 'enter' }, { k: 'waitBoard', id: 'nell' },
      { k: 'drive', pts: [[96, 94], [105.5, 90], [105.5, 64], [96, 59.6], [86, 58.6]] },
      { k: 'command', id: 'nell', mode: 'wait' }, { k: 'exit' }, { k: 'haul', id: 'generator' }, { k: 'load' }, { k: 'enter' },
      { k: 'drive', pts: [[100, 59.5], [105.5, 52], [105.5, 12], [105.5, 1.5]] },
    ],
  },
  2: {
    power: [
      { k: 'enter' },
      { k: 'drive', pts: [[30, 112], [55.5, 110], [55.5, 100], [66, 90], [81.5, 80]] },
      { k: 'exit' },
      door('Switch Room Exit'),
      { k: 'use', id: 'breaker', x: 31.4, y: 64.6, done: (r) => r.flags.power },
      door('Bay 4 Shutter'),
      { k: 'haul', id: 'assembly' }, { k: 'load' },
      door('Bay 3 Shutter'),
      { k: 'take', id: 'medstock' },
      { k: 'enter' },
      { k: 'drive', pts: [[81.5, 88], [70, 96], [56, 100], [56, 111], [100, 112], [118, 112]] },
    ],
    service: [
      { k: 'enter' },
      { k: 'drive', pts: [[30, 112], [55.5, 110], [55.5, 98], [40, 95.5], [17, 95.5], [16, 70], [16, 20], [30, 15.5], [95, 15.5], [98.5, 24], [98.5, 43]] },
      { k: 'exit' },
      door('Service Door'),
      { k: 'haul', id: 'assembly' }, { k: 'load' },
      { k: 'take', id: 'medstock' },
      { k: 'enter' },
      { k: 'drive', pts: [[98.5, 24], [95, 15.5], [30, 15.5], [16, 22], [16, 70], [17, 95.5], [40, 95.5], [55.5, 98], [55.5, 110], [2, 112]] },
    ],
  },
  3: {
    A: [
      { k: 'enter' },
      { k: 'drive', pts: [[40, 103], [57.5, 101], [57.5, 72]] },
      { k: 'exit' },
      { k: 'use', id: 'pumpA', x: 81.2, y: 13.8, done: (r) => r.flags.pumps },
      { k: 'enter' },
      { k: 'drive', pts: [[57.5, 50], [57.5, 33.5], [72, 33.5], [84, 32]] },
      { k: 'exit' },
      door('Store Door'),
      { k: 'haul', id: 'filtration' }, { k: 'load' },
      { k: 'enter' },
      { k: 'drive', pts: [[87, 35.5], [80, 37.5], [74, 32], [74, 16], [77, 11], [83, 9.5], [87, 7], [87, 1]] },
    ],
    B: [
      { k: 'enter' },
      { k: 'drive', pts: [[9, 100], [9, 60], [9, 22], [10, 13], [27, 13]] },
      { k: 'exit' },
      { k: 'use', id: 'pumpB', x: 81.2, y: 13.8, done: (r) => r.flags.pumps },
      { k: 'enter' },
      { k: 'drive', pts: [[45, 13], [68, 13], [74, 17], [74, 27], [84, 32]] },
      { k: 'exit' },
      door('Store Door'),
      { k: 'haul', id: 'filtration' }, { k: 'load' },
      { k: 'enter' },
      { k: 'drive', pts: [[87, 35.5], [80, 37.5], [74, 32], [74, 16], [77, 11], [83, 9.5], [87, 7], [87, 1]] },
    ],
  },
  4: {
    trench: [
      { k: 'walk', x: 44.5, y: 98 }, { k: 'walk', x: 44.5, y: 52 }, { k: 'walk', x: 60, y: 50.5 },
      door('Shed Door'),
      { k: 'use', id: 'genstart', x: 91, y: 54.4, done: (r) => r.flags.power },
      { k: 'use', id: 'module', x: 78, y: 18.6, done: (r) => r.flags.module },
      { k: 'use', id: 'call', x: 50.5, y: 13.8, done: (r) => r.flags.contact },
      { k: 'use', id: 'bcroute', x: 61, y: 13.8, done: (r) => r.flags.broadcast === 'routed' },
      { k: 'walk', x: 44.5, y: 44 }, { k: 'walk', x: 44.5, y: 110 }, { k: 'walk', x: 44.5, y: 118 },
    ],
    road: [
      { k: 'enter' },
      { k: 'drive', pts: [[50, 106.5], [92, 106.5], [93, 92], [86, 88.5], [20, 88.5], [17, 74], [20, 68.5], [56, 68.5]] },
      { k: 'exit' },
      { k: 'walk', x: 60, y: 50.5 },
      door('Guardhouse Door'),
      { k: 'use', id: 'gateopen', x: 65.6, y: 60.3, done: (r) => !G_().W.doors.find((d) => d.label === 'Compound Gate').locked },
      { k: 'enter' },
      { k: 'drive', pts: [[66, 68.5], [79, 66], [79, 50], [79, 38], [79, 30]] },
      { k: 'exit' },
      { k: 'use', id: 'genstart', x: 91, y: 54.4, pre: [door('Shed Door')], done: (r) => r.flags.power },
      { k: 'use', id: 'module', x: 78, y: 18.6, done: (r) => r.flags.module },
      { k: 'use', id: 'call', x: 50.5, y: 13.8, done: (r) => r.flags.contact },
      { k: 'use', id: 'bcoff', x: 61, y: 13.8, done: (r) => r.flags.broadcast === 'off' },
      { k: 'enter' },
      { k: 'drive', pts: [[79, 40], [79, 50], [79, 62], [70, 68.5], [20, 68.5], [17, 80], [20, 88.5], [88, 88.5], [93, 98], [88, 106.5], [2, 106.5]] },
    ],
  },
  5: {
    direct: [
      { k: 'enter' },
      { k: 'drive', pts: [[10.5, 103], [30, 102.5], [94, 102.5], [99, 96], [99, 80], [93, 77], [88, 77]] },
      { k: 'exit' },
      { k: 'haul', id: 'powerpack' }, { k: 'load' },
      { k: 'enter' },
      { k: 'drive', pts: [[80, 75.5], [67, 74], [67, 57], [75, 51], [76, 42], [72, 38.5], [66, 38.5]] },
      { k: 'exit' },
      door('Gatehouse Door'),
      { k: 'use', id: 'gateA', x: 67.6, y: 45.4, done: (r) => r.flags.gateA },
      { k: 'enter' },
      { k: 'drive', pts: [[70, 37], [73, 28], [80, 27.5], [85.5, 27], [88, 24.5]] },
      { k: 'exit' },
      { k: 'unload', id: 'powerpack' },
      { k: 'haul', id: 'powerpack' },
      { k: 'use', id: 'install', x: 97.6, y: 18.4, hauling: true, done: (r) => r.items.powerpack.loc === 'installed' },
      { k: 'use', id: 'ramp', x: 96, y: 17.8, done: (r) => r.flags.ramping || r.flags.rampDown },
      { k: 'wait', until: (r) => r.flags.rampDown, max: 60 },
      { k: 'enter' },
      { k: 'drive', pts: [[88, 25], [88, 19]] },
    ],
    sheltered: [
      { k: 'enter' },
      { k: 'drive', pts: [[10.5, 103], [30, 102.5], [94, 102.5], [99, 96], [99, 80], [93, 77], [88, 77]] },
      { k: 'exit' },
      { k: 'haul', id: 'powerpack' }, { k: 'load' },
      { k: 'enter' },
      { k: 'drive', pts: [[94, 77.5], [100, 82], [101.5, 70], [101.5, 40], [101, 37]] },
      { k: 'exit' },
      door('Gate C'),
      { k: 'enter' },
      { k: 'drive', pts: [[101, 30], [98, 27], [93, 26.5]] },
      { k: 'exit' },
      { k: 'unload', id: 'powerpack' },
      { k: 'haul', id: 'powerpack' },
      { k: 'use', id: 'install', x: 97.6, y: 18.4, hauling: true, done: (r) => r.items.powerpack.loc === 'installed' },
      { k: 'use', id: 'ramp', x: 96, y: 17.8, done: (r) => r.flags.ramping || r.flags.rampDown },
      { k: 'wait', until: (r) => r.flags.rampDown, max: 60 },
      { k: 'enter' },
      { k: 'drive', pts: [[88, 25], [88, 19]] },
    ],
  },
};
// optional-rescue variants reuse a primary route and add the detour
S[3].rescue = [
  { k: 'walk', x: 20.5, y: 79.3 }, door('Front Door'),
  { k: 'recruit', id: 'ada' },
  { k: 'take', id: 'supplies0' }, { k: 'take', id: 'supplies1' },
  { k: 'escort', x: 20.5, y: 79.3 }, { k: 'escort', x: 17, y: 100 },
  { k: 'enter' }, { k: 'waitBoard', id: 'ada' }, { k: 'command', id: 'ada', mode: 'wait' },
].concat(S[3].A.slice(1));
S[2].rescue = S[2].power.slice(0, 10).concat([
  door('Freezer 2 Door'),
  { k: 'recruit', id: 'tomas' },
  { k: 'escort', x: 78, y: 47 }, { k: 'escort', x: 70, y: 66 }, { k: 'escort', x: 79, y: 76.5 },
  { k: 'enter' }, { k: 'waitBoard', id: 'tomas' },
], S[2].power.slice(11));
S[4].rescue = S[4].trench.slice(0, 8).concat([
  { k: 'walk', x: 30, y: 25 },
  { k: 'clear', x: 14, y: 27, r: 8 },
  { k: 'use', id: 'knock', x: 13.8, y: 26.8, done: (r) => !G_().W.doors.find((d) => d.label === 'Hut Door').locked },
  { k: 'recruit', id: 'wes' },
  { k: 'escort', x: 30, y: 25 }, { k: 'escort', x: 44.5, y: 44 }, { k: 'escort', x: 44.5, y: 110 }, { k: 'escort', x: 44.5, y: 118 },
]);
// sequential rescue: Bo rides to the staging pen in the one passenger seat, Ines is walked in through the turnstile
{
  const sh = S[5].sheltered;
  S[5].rescue = [sh[0], sh[1], sh[2],
    { k: 'walk', x: 76, y: 79 }, { k: 'recruit', id: 'bo' }, { k: 'escort', x: 86, y: 79 },
    sh[3], sh[4], sh[5], { k: 'waitBoard', id: 'bo' },
    sh[6], sh[7], sh[8], sh[9], { k: 'waitBoard', id: 'bo' }, sh[10], sh[11],
    { k: 'escort', x: 84, y: 27 }, { k: 'waitSafe', id: 'bo', x: 80, y: 25.5 },
  ].concat(sh.slice(12, 17), [
    { k: 'walk', x: 79, y: 30.5 }, { k: 'walk', x: 76, y: 32.5 }, { k: 'walk', x: 60, y: 31 }, { k: 'walk', x: 47.5, y: 23 },
    door('Side Door'), door('Ticket Office Door'), { k: 'recruit', id: 'ines' },
    { k: 'escort', x: 47.5, y: 23 }, { k: 'escort', x: 60, y: 31 }, { k: 'escort', x: 74, y: 32.5 }, { k: 'escort', x: 78.5, y: 30.5 },
    { k: 'waitSafe', id: 'ines', x: 80, y: 26 },
  ], sh.slice(17));
}
let G_ = null;

function runLevel(ctx, level, script, opts) {
  opts = opts || {};
  const DH = ctx.DH, G = DH.G, M = DH.M;
  G_ = () => G; const W_ = () => G.W;
  G.state = 'play';
  if (!opts.useCurrent) G.newRun(opts.seed || 1, Object.assign({}, DH.Save.data.campaign.upgrades), level);
  const bot = makeBot(DH); ctx.bot = bot;
  let result = null;
  const onEnd = (r) => { result = r; };
  DH.bus.h.runEnded = (DH.bus.h.runEnded || []).filter((f) => !f._bot); onEnd._bot = true; DH.bus.on('runEnded', onEnd);
  const onConf = () => G.acceptDepart(); onConf._bot = true;
  DH.bus.h.confirmDepart = (DH.bus.h.confirmDepart || []).filter((f) => !f._bot); DH.bus.on('confirmDepart', onConf);
  const steps = []; for (const st of script) { if (st.pre) steps.push(...st.pre); steps.push(st); }
  const log = [];
  let si = 0, ri = 0, t = 0, stT = 0, held = false;
  const LIMIT = opts.limit || 60 * 20;
  while (!result && t < LIMIT && si <= steps.length) {
    const inp = blankInput();
    const run = G.run, p = run.player, st = steps[si];
    if (p.hp < 50 && p.medkits > 0 && !p.action && !p.inTruck && !p.hauling) inp.heal = true;
    // a human drops a heavy load to fight when something closes in
    if (p.hauling && bot.threat(5)) inp.drop = true;
    const busy = !p.inTruck && !p.action && !p.hauling && bot.fight(inp);
    let done = false;
    // a human tops up ammo and medkits lying close by when nothing is chasing them
    if (!busy && !p.inTruck && !p.action && !p.hauling && st && st.k !== 'drive' && st.k !== 'exit') {
      if (!bot.loot || bot.loot.taken || t - bot.lootT > 6) {
        bot.loot = null;
        const want = run.pickups.filter((k) => !k.taken && (k.kind === 'ammo' || k.kind === 'weapon' || k.kind === 'medkit') && M.dist(p.x, p.y, k.x, k.y) < 8 && W_().los(p.x, p.y, k.x, k.y) && !(bot.skip || {})[k.id]);
        if (want.length) { want.sort((a, b) => M.dist(p.x, p.y, a.x, a.y) - M.dist(p.x, p.y, b.x, b.y)); bot.loot = want[0]; bot.lootT = t; }
      }
      if (bot.loot && t - bot.lootT > 5.5) { (bot.skip = bot.skip || {})[bot.loot.id] = 1; bot.loot = null; }
      if (bot.loot) { bot.walkTo(inp, bot.loot.x, bot.loot.y); bot.trigger(inp, bot.loot.id); G.update(DH.DT, inp); t += DH.DT; continue; }
    }
    if (!busy && !p.inTruck && !p.action && st && st.k !== 'drive') {
      // recovery: revive a downed survivor, repair the truck, pry off clingers
      if ((run.truck.disabled || run.truck.dur < 70) && p.repairkits > 0 && !p.hauling && M.dist(p.x, p.y, run.truck.x, run.truck.y) < 25) { const sp = DH.Truck.toWorld(0.5, -(DH.Truck.HW + 0.7)); bot.walkTo(inp, sp.x, sp.y); bot.trigger(inp, 'repair'); G.update(DH.DT, inp); t += DH.DT; continue; }
      if (run.truck.clingers.length) bot.trigger(inp, (c) => c.id.indexOf('clinger') === 0);
    }
    if (p.action && (p.action.hold || p.action.kind === 'loadGen' || p.action.kind === 'unloadGen')) inp.interactHeld = true;
    if (st && !busy && !p.action) {
      stT += DH.DT;
      const W = G.W;
      switch (st.k) {
        case 'drive': {
          if (!p.inTruck) { done = true; log.push('drive-skipped'); break; }
          // a clinger chews the truck: pull over, step out and pry it off (a human sees the warning and does the same)
          if (run.truck.clingers.length && !run.truck.disabled && t - (bot.lastPry || -99) > 8) { bot.lastPry = t; steps.splice(si, 0, { k: 'exit' }, { k: 'unclinger' }, { k: 'enter' }); log.push('pry'); stT = 0; break; }
          const w = st.pts[ri]; const last = ri === st.pts.length - 1;
          if (bot.driveTo(inp, w[0], w[1], last ? 3.5 : 8) < (last ? 2.0 : 4.0)) { ri++; if (ri >= st.pts.length) { done = true; ri = 0; } }
          break;
        }
        case 'exit': if (!p.inTruck) { done = true; break; } inp.drive.handbrake = true; if (Math.abs(run.truck.speed) < 0.5) inp.interactPressed = true; break;
        case 'enter': {
          if (p.inTruck) { done = true; break; }
          if (p.hauling) { inp.drop = true; break; }
          const sp = DH.Truck.toWorld(0.5, -(DH.Truck.HW + 0.7)); const sp2 = DH.Truck.toWorld(0.5, DH.Truck.HW + 0.7);
          const a = W.circleFree(sp.x, sp.y, 0.35) ? sp : sp2;
          bot.walkTo(inp, a.x, a.y); bot.trigger(inp, 'enter');
          break;
        }
        case 'walk': if (bot.walkTo(inp, st.x, st.y) < (st.r || 1.2)) done = true; break;
        case 'door': {
          const di = W.doors.findIndex((d) => d.label === st.label); const d = W.doors[di];
          if (run.doors[di].open || run.doors[di].broken) { done = true; break; }
          const side = d.orient === 'h' ? [{ x: d.cx, y: d.cy + 1.2 }, { x: d.cx, y: d.cy - 1.2 }] : [{ x: d.cx + 1.2, y: d.cy }, { x: d.cx - 1.2, y: d.cy }];
          side.sort((a, b) => M.dist(p.x, p.y, a.x, a.y) - M.dist(p.x, p.y, b.x, b.y));
          bot.walkTo(inp, side[0].x, side[0].y);
          if (M.dist(p.x, p.y, d.cx, d.cy) < 2.4) bot.trigger(inp, d.id);
          break;
        }
        case 'use': {
          if (st.done(run)) { done = true; break; }
          if (st.hauling && !p.hauling) { const it = run.items.powerpack; if (it.loc === 'world') { bot.walkTo(inp, it.x - 0.8, it.y); bot.trigger(inp, 'haul_powerpack'); } break; }
          if (bot.walkTo(inp, st.x, st.y) < 1.6) { if (bot.trigger(inp, st.id)) inp.move = { x: 0, y: 0 }; }
          break;
        }
        case 'take': { const it = run.items[st.id]; if (it.loc !== 'world') { done = true; break; } bot.walkTo(inp, it.x, it.y); bot.trigger(inp, st.id); break; }
        case 'haul': {
          const it = run.items[st.id];
          if (p.hauling && p.haulId === st.id) { done = true; break; }
          if (it.loc !== 'world') { done = true; break; }
          bot.walkTo(inp, it.x - 0.8, it.y); bot.trigger(inp, st.id === 'generator' ? 'gen' : 'haul_' + st.id);
          break;
        }
        case 'load': {
          const id = steps[si - 1] && steps[si - 1].id; const it = run.items[id];
          if (it.loc === 'truck') { done = true; break; }
          if (!p.hauling && it.loc === 'world') { bot.walkTo(inp, it.x - 0.8, it.y); bot.trigger(inp, id === 'generator' ? 'gen' : 'haul_' + id); break; }
          const rp = DH.Truck.rearPoint(); bot.walkTo(inp, rp.x, rp.y);
          if (bot.trigger(inp, 'loadGen')) inp.move = { x: 0, y: 0 };
          break;
        }
        case 'unload': {
          const it = run.items[st.id]; if (it.loc !== 'truck') { done = true; break; }
          const rp = DH.Truck.rearPoint(); bot.walkTo(inp, rp.x, rp.y); if (bot.trigger(inp, 'unload_' + st.id) || bot.trigger(inp, 'unloadGen')) inp.move = { x: 0, y: 0 };
          break;
        }
        case 'recruit': {
          const sv = run.survivors.find((q) => q.id === st.id);
          if (!sv || sv.recruited) { done = true; break; }
          if (bot.walkTo(inp, sv.x, sv.y) < 2.0 && bot.trigger(inp, (c) => c.id.indexOf('recruit') === 0 && Math.hypot(c.x - sv.x, c.y - sv.y) < 0.1)) inp.move = { x: 0, y: 0 };
          break;
        }
        case 'waitBoard': {
          const sv = run.survivors.find((q) => q.id === st.id);
          inp.drive.handbrake = true;
          if (!sv || sv.boarded || stT > 25) done = true;
          break;
        }
        case 'escort': {
          // walk somewhere slowly enough for followers to keep up
          const lag = run.survivors.filter((q) => q.recruited && !q.safe && !q.boarded && q.state !== 'downed').reduce((m, q) => Math.max(m, M.dist(q.x, q.y, p.x, p.y)), 0);
          if (lag > (st.lag || 3)) { inp.move = { x: 0, y: 0 }; if (stT > 90) done = true; break; }
          if (bot.walkTo(inp, st.x, st.y) < (st.r || 1.2)) done = true;
          break;
        }
        case 'waitSafe': {
          const sv = run.survivors.find((q) => q.id === st.id);
          if (!sv || sv.safe || stT > 30) done = true;
          else if (sv.state === 'downed') { bot.walkTo(inp, sv.x, sv.y); bot.trigger(inp, (c) => c.id.indexOf('revive') === 0); }
          else bot.walkTo(inp, st.x, st.y);
          break;
        }
        case 'command': {
          const sv = run.survivors.find((q) => q.id === st.id);
          if (!sv || sv.mode === st.mode || stT > 5) { done = true; break; }
          if (!bot.cmdT || t - bot.cmdT > 0.5) { bot.cmdT = t; inp.command = true; }
          break;
        }
        case 'clear': {
          // deal with idle shamblers loitering at a spot before doing something there
          const zs = run.zombies.filter((z) => !z.dead && !z.attached && M.dist(z.x, z.y, st.x, st.y) < st.r);
          if (!zs.length || stT > 60) { done = true; break; }
          zs.sort((a, b) => M.dist(p.x, p.y, a.x, a.y) - M.dist(p.x, p.y, b.x, b.y));
          const z = zs[0], d = M.dist(p.x, p.y, z.x, z.y);
          if (d > 7 || !W.los(p.x, p.y, z.x, z.y)) bot.walkTo(inp, z.x, z.y);
          else { inp.aimDir = Math.atan2(z.y - p.y, z.x - p.x); const w = DH.Player.weapon(); if (d < 1.6) inp.melee = true; else if (w && (w.mag > 0 || p.ammo[DH.WEAPONS[w.type].ammo] > 0)) { inp.fire = true; inp.firePressed = true; } else bot.walkTo(inp, z.x, z.y); }
          break;
        }
        case 'unclinger': {
          if (!run.truck.clingers.length || stT > 20) { done = true; break; }
          const c = run.truck.clingers[0]; const z = run.zombies.find((q) => q.id === c.zid);
          if (z) { bot.walkTo(inp, z.x, z.y); if (bot.trigger(inp, (q) => q.id === 'clinger' + z.id)) inp.move = { x: 0, y: 0 }; }
          break;
        }
        case 'wait': if (st.until(run)) done = true; else if (stT > st.max) done = true; break;
      }
      if (stT > (st.k === 'wait' ? st.max + 5 : 150)) { log.push('TIMEOUT:' + st.k + (st.id || st.label || '')); break; }
    } else if (st && p.action && (st.k === 'load' || st.k === 'use' || st.k === 'unload')) inp.interactHeld = true;
    if (done) { log.push(st.k + (st.id ? ':' + st.id : st.label ? ':' + st.label : '') + '@' + t.toFixed(0)); si++; stT = 0; bot.reset(); }
    G.update(DH.DT, inp);
    t += DH.DT;
  }
  const r = result || { status: 'timeout' };
  const run = G.run || G.lastRun;
  return { level, seed: opts.seed, variant: opts.variant, status: r.status, mode: r.mode, scrap: r.scrap, time: +(r.time || t).toFixed(1), kills: r.kills, truckDur: r.truckDur, hp: run ? Math.round(run.player.hp) : null,
    steps: log.join(' > '), stuckAt: result ? null : (steps[si] || {}).k + ':' + ((steps[si] || {}).id || (steps[si] || {}).label || ''), pos: run ? [run.player.x.toFixed(1), run.player.y.toFixed(1), run.player.inTruck, run.truck.x.toFixed(1), run.truck.y.toFixed(1)] : null,
    prim: DH.Interact.primary && DH.Interact.primary.label, story: r.story, optional: r.outcome && r.outcome.optional, survivorsOut: r.survivorsOut || (r.ev && r.ev.survivorsOut) };
}

module.exports = { makeBot, runLevel, S };

if (require.main === module) {
  const arg = process.argv[2] || 'all';
  const seeds = ((process.argv.find((a) => a.startsWith('--seeds=')) || '--seeds=1,2,3').slice(8)).split(',').map(Number);
  const vOnly = (process.argv.find((a) => a.startsWith('--variant=')) || '').slice(10);
  const levels = arg === 'all' ? [1, 2, 3, 4, 5] : [+arg];
  const out = [];
  for (const L of levels) for (const v of Object.keys(S[L])) {
    if (vOnly && v !== vOnly) continue;
    for (const seed of seeds) {
      const ctx = load({ seedMath: seed }); ctx.DH.Save.load();
      const r = runLevel(ctx, L, S[L][v], { seed, variant: v });
      console.log(JSON.stringify(Object.assign({}, r, { story: undefined })));
      out.push(r);
    }
  }
  const ok = out.filter((r) => r.status === 'success').length;
  console.log('successes', ok, '/', out.length);
  require('fs').writeFileSync(__dirname + '/campaign-results.json', JSON.stringify(out, null, 1));
}
