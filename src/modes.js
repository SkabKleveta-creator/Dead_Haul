/* DEAD HAUL - replay modes: Salvage Runs, Daily Haul, board modifiers, night replays, mission medals */
(function () {
  'use strict';
  const DH = window.DH;
  const M = DH.M, T = DH.T, G = DH.G;
  const Modes = (DH.Modes = {});

  Modes.MODS = {
    notruck: { name: 'No Truck', mult: 1.5, desc: 'The truck stays parked. Leave on foot.' },
    ironman: { name: 'Ironman', mult: 1.6, desc: 'One life: no medical kits, no repair kits, no revives.' },
    pistol: { name: 'Pistol Only', mult: 1.3, desc: 'No found weapons and no weapon locker.' },
    loud: { name: 'Loud World', mult: 1.4, desc: 'Every sound carries 50% farther.' },
  };
  Modes.MAX_MULT = 4;
  // missions whose primary can be finished without driving (No Truck is only offered there and in salvage)
  Modes.footOK = (l) => !!(DH.LEVELS[l] && DH.LEVELS[l].footOK);

  Modes.scrapMul = (run) => {
    if (!run) return 1;
    let m = 1;
    for (const k in run.mods || {}) if (run.mods[k] && Modes.MODS[k]) m *= Modes.MODS[k].mult;
    if (run.nightBonus) m *= T.cond.nightScrap;
    return Math.min(Modes.MAX_MULT, Math.round(m * 100) / 100);
  };

  // run-start adjustments shared by every mode
  Modes.applyRun = (run, rng, opts) => {
    const p = run.player, mods = run.mods || {};
    if (opts && opts.nightBonus) run.nightBonus = true;
    if (mods.ironman) { p.medkits = 0; p.repairkits = 0; run.pickups = run.pickups.filter((k) => k.kind !== 'medkit' && k.kind !== 'repairkit'); }
    if (mods.pistol) run.pickups = run.pickups.filter((k) => k.kind !== 'weapon');
    else {
      const c = DH.Save.data && DH.Save.data.campaign;
      const wt = c && c.locker;
      if (wt && run.perks && run.perks.locker && DH.WEAPONS[wt] && !p.weapons.some((w) => w.type === wt)) {
        const def = DH.WEAPONS[wt];
        p.weapons.push({ type: wt, mag: def.mag });
        p.ammo[def.ammo] = Math.min(def.cap, (p.ammo[def.ammo] || 0) + def.startReserve);
        run.lockerWeapon = wt;
      }
    }
    if (mods.notruck) { run.truck.parked = true; }
  };

  // ---------- Medals ----------
  Modes.grade = (run, result, L) => {
    if (result.status !== 'success' || (run.mode && run.mode !== 'campaign')) return;
    const par = (L && L.par) || 300;
    const opt = (result.outcome && result.outcome.optional) || {};
    const keys = Object.keys(opt);
    const fast = result.time <= par, clean = run.stats.damageTaken <= 50, full = keys.length > 0 && keys.every((k) => opt[k]);
    const n = (fast ? 1 : 0) + (clean ? 1 : 0) + (full ? 1 : 0);
    result.medal = n === 3 ? 'gold' : n === 2 ? 'silver' : 'bronze';
    result.medalInfo = { fast, clean, full, par };
  };

  // ---------- Daily Haul ----------
  Modes.today = (d) => { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  Modes.hash = (s) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
  Modes.dailySpec = (st, date) => {
    date = date || Modes.today();
    const seed = Modes.hash('deadhaul-daily-' + date);
    const cleared = DH.Save.LEVELS.filter((l) => st.completed[l]);
    const pool = cleared.length ? cleared : [1];
    const level = pool[seed % pool.length];
    const r = DH.RNG(seed);
    const modKeys = ['ironman', 'pistol', 'loud'];
    const mods = {};
    if (r.next() < 0.7) mods[r.pick(modKeys)] = true;
    const cond = { night: r.next() < 0.4, rain: r.next() < 0.3, fog: false };
    if (!cond.night && r.next() < 0.2) cond.fog = true;
    return { date, seed, level, mods, cond };
  };

  // ---------- Salvage Runs: endless haul on a cleared map ----------
  const cache = {};
  const reachable = (W, sx, sy) => {
    const N = W.N, seen = new Uint8Array(N * N), out = [];
    const q = [W.idx(Math.floor(sx), Math.floor(sy))]; seen[q[0]] = 1;
    while (q.length) {
      const i = q.pop(); const x = i % N, y = (i / N) | 0;
      out.push(i);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (!W.inB(nx, ny)) continue;
        const j = W.idx(nx, ny); if (seen[j]) continue;
        if (W.navCost(nx, ny, false) <= 0) continue;
        seen[j] = 1; q.push(j);
      }
    }
    return out;
  };
  Modes.setupSalvage = (run, rng, story, opts) => {
    const W = G.W, L = DH.LEVELS[run.level];
    // power everywhere so no shutter is a dead end, and every gate in its starting state
    for (const d of W.doors) if (d.needs) run.flags[d.needs] = true;
    const tiles = reachable(W, W.start.player.x, W.start.player.y).filter((i) => {
      const x = i % W.N, y = (i / W.N) | 0;
      if (W.doorAt[i] || W.deep[i]) return false;
      if (M.dist(x, y, W.start.player.x, W.start.player.y) < 14) return false;
      return W.circleFree(x + 0.5, y + 0.5, 0.4);
    });
    rng.shuffle(tiles);
    const spaced = [];
    for (const i of tiles) {
      const x = (i % W.N) + 0.5, y = ((i / W.N) | 0) + 0.5;
      if (spaced.every((q) => M.dist(q.x, q.y, x, y) > 7)) spaced.push({ x, y });
      if (spaced.length >= 26) break;
    }
    let k = 0;
    const put = (kind, n) => { for (let j = 0; j < n && k < spaced.length; j++, k++) G.addItem(run, kind + j, kind, spaced[k].x, spaced[k].y); };
    put('salvage', 14); put('supplies', 5);
    if (L.fuel != null) put('fuel', 3);
    for (let j = 0; j < 4 && k < spaced.length; j++, k++) G.addPickup(run, j % 2 ? 'medkit' : 'ammo', spaced[k].x, spaced[k].y, j % 2 ? { n: 1 } : { atype: 'p9', n: 24 });
    if (k < spaced.length) G.addPickup(run, 'weapon', spaced[k].x, spaced[k].y, { wtype: rng.pick(['shotgun', 'smg', 'rifle']), mag: 6, reserve: 12, crate: true }), k++;
    if (k < spaced.length) G.addPickup(run, 'repairkit', spaced[k].x, spaced[k].y, { n: 1 }), k++;
    run.reserve.remaining = 999;
    run.salvage = { wave: 0, nextWave: 75 };
    if (L.salvageSetup) L.salvageSetup(run, rng);
  };
  Modes.banked = (run) => {
    let s = 0;
    for (const id in run.items) { const it = run.items[id]; if (it.loc === 'backpack' || it.loc === 'truck') { const d = DH.ITEMS[it.kind]; s += (T.rewards[d.reward] || 0); } }
    return s;
  };
  Modes.salvageLevel = (l) => {
    if (cache[l]) return cache[l];
    const B = DH.LEVELS[l];
    const S = {
      id: l, key: B.key, name: B.name + ': Salvage', place: B.place, short: 'Salvage run', tag: 'Endless salvage', build: B.build, fuel: B.fuel, cond: B.cond, par: 600,
      reserve: 999, salvage: true, footOK: true, backdropCam: B.backdropCam,
      brief: () => 'Salvage run on ' + B.name + '. Scrap, supplies and fuel are scattered across the map. The longer you stay, the more of them come. Drive out or walk out whenever you like: everything in your pack and truck bed is banked. Die and you lose the haul.',
      meta: () => [['Goal', 'Bank as much scrap as you can'], ['Danger', 'Waves grow every minute or so'], ['Exits', 'Any road exit or evac gate']],
      optionalKeys: [],
      setup: (run, rng, story, opts) => Modes.setupSalvage(run, rng, story, opts),
      exitOpen(z) { if (z.kind === 'ferry' || z.kind === 'boat') return 'Salvage runs leave by road or on foot.'; return true; },
      update(run, dt) {
        const sv = run.salvage; if (!sv) return;
        if (run.time >= sv.nextWave) {
          sv.wave++; sv.nextWave = run.time + Math.max(35, 75 - sv.wave * 6);
          run.reserve.heat = 120; run.reserve.lastT = -999;
          if (sv.wave === 1) G.radio('marta', 'Salvage run. Grab what you can, but don’t get greedy. They keep coming.', 'salv1');
          if (sv.wave >= 3) { const pp = DH.Player.pos(); for (const z of run.zombies) if (!z.dead && z.state === 'idle' && Math.random() < 0.25) { z.state = 'investigate'; z.t = 30; z.tx = pp.x + (Math.random() - 0.5) * 10; z.ty = pp.y + (Math.random() - 0.5) * 10; } }
        }
      },
      objectives(run) {
        const left = Object.values(run.items).filter((i) => i.loc === 'world').length;
        return [
          { text: 'Banked if you leave now: ' + Modes.banked(run) + ' scrap', done: Modes.banked(run) > 0 },
          { text: 'Wave ' + (run.salvage ? run.salvage.wave : 0) + ' · next in ' + Math.max(0, Math.ceil((run.salvage ? run.salvage.nextWave : 0) - run.time)) + ' s', opt: true },
          { text: left + ' caches still out there', opt: true },
        ];
      },
      pointer(run) {
        const p = DH.Player.pos(); let best = null, bd = 1e9;
        if (DH.Cargo.free(run, 'backpack') <= 0 && !run.player.inTruck) return G.exitPointer(run);
        for (const id in run.items) { const it = run.items[id]; if (it.loc !== 'world') continue; const d = M.dist(p.x, p.y, it.x, it.y); if (d < bd) { bd = d; best = it; } }
        return best && bd < 45 ? { x: best.x, y: best.y, label: 'CACHE', col: '#e0ad2a' } : G.exitPointer(run);
      },
      markers(run, dot) { for (const id in run.items) { const it = run.items[id]; if (it.loc === 'world' && run.seen[id]) dot(it.x, it.y, '#e0ad2a', 2.5); } },
      primaryOut: (out) => (out.salvageOut || 0) + (out.got.supplies || 0) + (out.got.fuel || 0) > 0,
      primaryGot: (run) => Modes.banked(run) >= 60,
      departWarn: 'Nothing banked yet. Leaving now pays nothing.',
      resultSub(r) { return r.status === 'failed' ? 'The haul is lost. Salvage runs never touch your campaign.' : r.status === 'partial' ? 'You left empty-handed.' : 'Haul banked.' + (r.newBest ? ' New best for this map.' : ''); },
      resultRows(run, ev) {
        return [
          ['Salvage bundles', String(ev.salvageOut || 0), ev.salvageOut ? 'good' : ''],
          ['Supplies', String(ev.got.supplies || 0), ev.got.supplies ? 'good' : ''],
          ['Waves survived', String(run.salvage ? run.salvage.wave : 0)],
          ['Kills', String(run.stats.kills)],
          ['Multiplier', 'x' + (ev.mult || 1)],
        ];
      },
      outcome: () => ({ optional: {} }),
      hints: { start: { kbm: 'Salvage run: grab caches (yellow pointer), stash them in the truck, and leave before the waves get too big.', touch: 'Salvage run: grab caches, stash them, and leave before the waves get too big.' } },
    };
    cache[l] = S;
    return S;
  };
})();
