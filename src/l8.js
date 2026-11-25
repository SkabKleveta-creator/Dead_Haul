/* DEAD HAUL - Level 8: Night Ferry (Harbor Street terminal after dark: signal, hold the ramp, load the medicine) */
(function () {
  'use strict';
  const DH = window.DH;
  DH.LEVELS = DH.LEVELS || {};
  const M = DH.M;
  const APPROACH = 70;                       // metres the ferry has to cover once signalled
  const RAMP = { x1: 84, y1: 15, x2: 92, y2: 24 };
  const QUAY = ['ines', 'ray', 'bo'];
  const QPOS = { ines: [22.5, 19.5, 'Ticket office', 'terminal', 'her', false], ray: [39.5, 74.8, 'Container office', 'office', 'him', true], bo: [78.3, 86.5, 'Shed 1', 'sheds', 'him', false] };

  // Same terminal as Last Crossing, after dark, with the ferry out at the island.
  const build = () => {
    const W = DH.LEVELS[5].build();
    W.key = 'nightferry';
    W.theme = Object.assign({}, W.theme, { dark: 'rgba(3,6,16,0.84)', lightR: 6.5, flashlight: true });
    W.mapTitle = 'HARBOR STREET, NIGHT FERRY';
    W.boatSlip = { x: 58.5, y: 13.4 };
    W.glows.push({ x: 58.5, y: 16.4, r: 2.2, col: 'rgba(120,220,255,A)', a: 0.18, z: 0.4, hole: { x: 58.5, y: 16.4, r: 3, a: 0.5 } });
    W.glows.push({ x: 88, y: 21.5, r: 3, col: 'rgba(120,255,170,A)', a: 0.3, blink: 1.0, z: 3, power: 'signal', hole: { x: 88, y: 21.5, r: 5, a: 0.6 } });
    W.zombieGroups = W.zombieGroups.concat([
      [56, 66, 2.5, { brute: 1, drifter: 1 }, { tag: 'lanes' }], [50, 37, 2.5, { shrieker: 1, drifter: 2 }, { tag: 'quay' }],
      [26, 36, 3, { drifter: 2, runner: 1 }, { tag: 'quay' }], [96, 96, 3, { drifter: 2, clinger: 1 }, { tag: 'sheds' }],
    ]);
    return W;
  };

  const rampCount = (run) => run.zombies.filter((z) => !z.dead && !z.dormant && !z.attached && z.x >= RAMP.x1 && z.x <= RAMP.x2 && z.y >= RAMP.y1 && z.y <= RAMP.y2).length;

  const L = (DH.LEVELS[8] = {
    id: 8, key: 'nightferry', name: 'Night Ferry', place: 'HARBOR STREET, AFTER DARK', short: 'Medicine across the water', tag: 'Signal the ferry, hold the ramp, load the medicine',
    build, cond: { night: true }, par: 360, footOK: false,
    brief: () => 'Kettle Creek sent its spare medicine to the Harbor Street quay, and the ferry has to make a night run to fetch it. Light the beacon at the ramp control house to call the ferry in, then hold the ramp: it will not dock while the dead stand on it. Collect the three medicine crates (maintenance shed 2 and the gatehouse) and drive aboard. You can make a wall of the truck, or take the skiff out and lead the crowd away with its outboard.',
    meta: () => [['Primary', 'Signal the ferry → hold the ramp → 3 medicine crates → drive aboard'], ['Tactics', 'Truck across the lanes · or the skiff’s outboard as a decoy · or the terminal PA'], ['Optional', 'Anyone still stranded from Last Crossing'], ['Conditions', 'Night: short sight lines, flashlight follows your aim'], ['Exits', 'Ferry · Terminal Road · seawall path']],
    optionalKeys: [['quay', 'Bring the last dockworkers across'], ['meds', 'All three crates aboard']],
    reserve: 14,
    recruitTip: () => 'Walk them into the staging pen, or one at a time in the passenger seat.',
    setup(run, rng, story) {
      const G = DH.G, W = G.W;
      // the ramp hydraulics still have the power pack from Last Crossing; the staging gate was left open
      run.flags.pack = true;
      const gi = W.doors.findIndex((d) => d.label === 'Staging Gate');
      run.doors[gi].locked = false; run.doors[gi].open = true;
      run.ferryOff = -APPROACH;
      G.addItem(run, 'medstock0', 'medstock', 88.5, 87, { spot: 'Medicine crates from Kettle Creek.' });
      G.addItem(run, 'medstock1', 'medstock', 85.8, 89.6);
      G.addItem(run, 'medstock2', 'medstock', 69.4, 45.4, { spot: 'A medicine crate in the gatehouse.' });
      const salv = rng.shuffle([[44, 20], [70, 45.5], [33, 66], [57, 80], [78, 90], [99, 40], [20, 100], [86, 74], [64, 39.5], [41, 74.5], [12, 30], [94, 104]]).slice(0, 6);
      salv.forEach((p, i) => G.addItem(run, 'salvage' + i, 'salvage', p[0], p[1]));
      const pk = G.addPickup;
      pk(run, 'weapon', 26.5, 18.8, { wtype: 'shotgun', mag: 6, reserve: 12, cabinet: true });
      pk(run, 'weapon', 79, 86, { wtype: 'smg', mag: 30, reserve: 60, crate: true });
      pk(run, 'repairkit', 74, 84, { n: 1 }); pk(run, 'repairkit', 70.5, 44.5, { n: 1 });
      pk(run, 'medkit', 40, 21, { n: 1 }); pk(run, 'medkit', 90.6, 82.5, { n: 1 }); pk(run, 'medkit', 97, 19.5, { n: 1 });
      pk(run, 'ammo', 67.4, 44.6, { atype: 'p9', n: 24 }); pk(run, 'ammo', 76.5, 90.5, { atype: 'p9', n: 24 }); pk(run, 'ammo', 21.6, 22, { atype: 'shell', n: 6 });
      pk(run, 'noisemaker', 13.6, 104, { n: 1 }); pk(run, 'noisemaker', 58, 18.6, { n: 1 });
      // whoever Last Crossing left on the quay is still out there
      const saved = (story && story.outcomes && story.outcomes[5] && story.outcomes[5].stranded) || 0;
      const missing = QUAY.slice(saved);
      run.flags.quayMissing = missing.length;
      for (const id of missing) { const q = QPOS[id]; G.addSurvivor(run, id, { ines: 'Ines', ray: 'Ray', bo: 'Bo' }[id], id, q[0], q[1], { locked: q[5], where: q[2], landmark: q[3], pron: q[4], call: true, stranded: true }); }
      if (!missing.length) { G.addItem(run, 'supplies0', 'supplies', 96, 30.5); G.addItem(run, 'supplies1', 'supplies', 26.5, 20.4); }
      run.boat = DH.Boat.make(W.boatSlip.x, W.boatSlip.y, Math.PI);
      G.addEmitter(run, { id: 'beacon', x: 88, y: 21, r: 40, period: 1.2, warmup: 3, kind: 'speaker', cueLabel: 'BEACON', color: 'rgba(120,255,170,1)' });
      G.addEmitter(run, { id: 'klaxon', x: 88, y: 21, r: 46, period: 1.0, warmup: 2, kind: 'klaxon', cueLabel: 'RAMP', color: 'rgba(255,170,40,1)', after: 'rampDone' });
      G.addEmitter(run, { id: 'pa', x: 18, y: 33.6, r: 42, period: 1.2, warmup: 3, kind: 'speaker', cueLabel: 'PA', color: 'rgba(255,220,120,1)' });
    },
    exitOpen(z, run) {
      if (z.kind !== 'ferry') return true;
      if (!run.flags.rampDown) return run.flags.signal ? 'The ferry has not docked yet.' : 'No ferry. Signal it from the ramp control console.';
      return true;
    },
    nextStep(run) {
      if (!run.flags.signal) return 'signal';
      if (!run.flags.rampDown) return 'hold';
      return 'board';
    },
    interact(run, add, p) {
      const W = DH.G.W, G = DH.G, Pl = DH.Player;
      const near = (o, r) => M.dist(p.x, p.y, o.x, o.y) < (r || 1.9);
      const act = (key, dur, label, o) => () => Pl.startAction('script', dur, label, { key, hold: true, near: { x: o.x, y: o.y, r: 2.6 } });
      if (near(W.rampConsole, 2.0)) {
        if (run.flags.rampDown) add('signal', 'Ramp down: ferry docked', W.rampConsole.x, W.rampConsole.y, 0.6, () => {}, { disabled: true });
        else if (run.flags.signal) add('signal', 'Beacon lit: ferry ' + Math.max(0, Math.round(-run.ferryOff)) + ' m out', W.rampConsole.x, W.rampConsole.y, 0.6, () => {}, { disabled: true });
        else add('signal', 'Hold E: Light the beacon and call the ferry (LOUD)', W.rampConsole.x, W.rampConsole.y, -0.3, act('signal', 2, 'Lighting the beacon', W.rampConsole), { hold: true });
      }
      if (near(W.paCtl)) {
        const e = G.emitter(run, 'pa'), cd = (run.timers.pa || 0) - run.time;
        if (e.on) add('pa', 'Terminal PA: playing', W.paCtl.x, W.paCtl.y, 0.5, () => {}, { disabled: true });
        else if (cd > 0) add('pa', 'Terminal PA (amplifier cooling ' + Math.ceil(cd) + ' s)', W.paCtl.x, W.paCtl.y, 0.5, () => {}, { disabled: true });
        else add('pa', 'Hold E: Terminal PA: west quay speakers (25 s, LOUD)', W.paCtl.x, W.paCtl.y, -0.25, act('pa', 1, 'Keying the PA', W.paCtl), { hold: true });
      }
    },
    highlights(run) {
      const W = DH.G.W, out = [];
      if (!run.flags.signal) out.push({ x: W.rampConsole.x, y: W.rampConsole.y, r: 0.9, d: 14 });
      out.push({ x: W.paCtl.x, y: W.paCtl.y, r: 0.6, d: 9, col: '#8cd6ff' });
      if (run.boat && !run.player.inBoat) out.push({ x: run.boat.x, y: run.boat.y, r: 1.4, d: 10, col: '#8cd6ff' });
      return out;
    },
    labels(run) {
      const pp = DH.Player.pos(), W = DH.G.W, out = [];
      const lb = (o, t, c) => { if (M.dist(pp.x, pp.y, o.x, o.y) < 14) out.push({ x: o.x, y: o.y, z: 2.2, text: t, col: c || '#ffd36a' }); };
      lb({ x: 88, y: 22 }, run.flags.rampDown ? 'RAMP DOWN: BOARD HERE' : run.flags.signal ? 'HOLD THE RAMP (' + rampCount(run) + ' on it)' : 'RAMP: CALL THE FERRY', run.flags.rampDown ? '#7fe3a0' : '#ffd36a');
      lb(W.paCtl, 'TERMINAL PA', '#8cd6ff');
      if (run.boat && !run.player.inBoat) lb({ x: run.boat.x, y: run.boat.y + 1.5 }, 'SKIFF (outboard decoy)', '#8cd6ff');
      return out;
    },
    onAction(run, key, data) {
      const G = DH.G, Wd = DH.World, W = G.W;
      if (key === 'signal' && !run.flags.signal) {
        run.flags.signal = true; W.version++;
        Wd.startEmitter('beacon', 12);
        G.msg('Beacon lit. The ferry is coming in. Keep the ramp clear until it docks.', 'objective', 4);
        G.radio('june', 'I see your light. Coming in. Keep the ramp clear, I can’t put the bow door down on a crowd.', 'signal');
        const n = Wd.drawGroup('lanes', 84, 30, 10) + Wd.drawGroup('quay', 84, 30, 8);
        if (n) { G.cue('MOVEMENT', 60, 50, 'danger'); }
      } else if (key === 'rampDone') {
        run.flags.ramping = false; run.flags.rampDown = true;
        G.setGate('ramp', false);
        G.msg('The bow door is down on the ramp. Drive aboard with the medicine.', 'objective', 4);
        G.radio('june', 'Ramp’s down! Bring the truck and the crates up.', 'rampDown');
      } else if (key === 'pa') {
        Wd.startEmitter('pa', 25); run.timers.pa = run.time + 50;
        if (run.flags.signal && !run.flags.decoy) run.flags.decoy = 'pa';
        G.msg('Terminal PA playing on the west quay.', 'info', 2);
      } else if (key === 'pried') {
        const d = W.doors[data.door];
        if (d.label === 'Gate C') G.msg('Gate C forced. The east alley runs into staging.', 'info', 3);
        if (d.label === 'Container Door') { const s = G.findSurvivor(run, 'ray'); if (s) { s.locked = false; s.call = false; G.radio('ray', 'Ray. Again. You came back for me. I owe you twice now.', 'ray'); } }
      }
    },
    update(run, dt) {
      const G = DH.G, pp = DH.Player.pos(), W = G.W, perks = run.perks || {};
      if (run.time > 2) G.radio('june', 'Ferry’s idling off the point. Light the beacon at the ramp house when you’re ready, and grab Kettle Creek’s crates.', 'intro');
      if (run.time > 14) G.radio('marta', 'Two crates in maintenance shed two, one in the gatehouse. It’s dark: stay near the lights.', 'tip');
      if (run.time > 30 && run.flags.quayMissing) G.radio('june', 'Some of my people never made it off this quay. If you see them, they ride with us.', 'quayTip');
      for (const s of run.survivors) if (!s.recruited && s.call && M.dist(pp.x, pp.y, s.x, s.y) < 15) G.radio(s.id, s.id === 'ines' ? 'You came back! Get me to staging this time?' : s.id === 'ray' ? 'Box again! Jammed again! Pry it!' : 'Took you long enough, son.', 'call_' + s.id);
      // the ferry comes in only while the ramp is clear
      if (run.flags.signal && !run.flags.docked) {
        const n = rampCount(run);
        run.flags.rampCrowd = n;
        if (n >= 3) { if (G.time - (run.timers.crowdMsg || -9) > 6) { run.timers.crowdMsg = G.time; G.msg('The ferry is holding off: ' + n + ' of them on the ramp!', 'danger', 2.5); G.cue('RAMP', 88, 21, 'danger'); } }
        else run.ferryOff = Math.min(0, run.ferryOff + dt);
        if (!run.flags.decoy && run.player.inBoat) run.flags.decoy = 'boat';
        if (!run.flags.decoy && !run.player.inTruck && M.dist(run.truck.x, run.truck.y, 88, 28) < 9) run.flags.decoyTruckT = (run.flags.decoyTruckT || 0) + dt;
        if (run.ferryOff >= 0) {
          run.flags.docked = true; run.flags.ramping = true;
          DH.World.stopEmitter('beacon');
          DH.World.startEmitter('klaxon', 10);
          G.msg('The ferry is alongside. Bow door coming down: klaxon!', 'warn', 3.5);
          if (!run.flags.decoy) run.flags.decoy = (run.flags.decoyTruckT || 0) > 15 ? 'truck' : 'none';
        } else if (run.ferryOff > -20 && !run.said.close) G.radio('june', 'Twenty metres. Keep it clear!', 'close');
      }
      if (perks.wes && run.time > 40 && Math.floor(run.time) % 45 === 0 && !run.said['wesTick' + Math.floor(run.time)]) {
        const near = run.zombies.filter((z) => !z.dead && z.state === 'chase').length;
        if (near >= 5) G.radio('wes', near + ' of them on you. Break line of sight or throw something loud.', 'wesTick' + Math.floor(run.time));
      }
      const pa = G.emitter(run, 'pa');
      if (pa.on && pa.warm <= 0 && !pa._drawn) { pa._drawn = true; const n = DH.World.drawGroup('lanes', pa.x, pa.y + 2, 8) + DH.World.drawGroup('quay', pa.x, pa.y + 2, 6); if (n) G.cue('MOVEMENT', 40, 50, 'warn'); }
      if (!pa.on) pa._drawn = false;
      if (DH.FX && Math.random() < dt * 2) { const x = 4 + Math.random() * 100, y = 14.5; if (M.dist(x, y, pp.x, pp.y) < 30) DH.FX.ring(x, y, 0.8, 'rgba(170,200,215,1)', 0.8); }
      void W;
    },
    objectives(run) {
      const out = [], meds = Object.values(run.items).filter((i) => i.kind === 'medstock' && i.loc !== 'world').length;
      out.push({ text: run.flags.rampDown ? 'Ferry docked' : run.flags.signal ? 'Ferry ' + Math.round(-run.ferryOff) + ' m out' + (run.flags.rampCrowd >= 3 ? ': CLEAR THE RAMP (' + run.flags.rampCrowd + ')' : '') : 'Signal the ferry (ramp control console)', done: !!run.flags.rampDown });
      out.push({ text: 'Medicine crates ' + meds + '/3', done: meds >= 3, opt: false });
      out.push({ text: run.flags.rampDown ? 'Drive aboard with the crates' : 'Then drive aboard', done: false, opt: false });
      const st = run.survivors.filter((s) => s.stranded), safe = st.filter((s) => s.safe || s.boarded).length;
      out.push({ text: st.length ? 'Optional: stranded dockworkers ' + safe + '/' + st.length : 'Optional: everyone from the quay already made it', done: !st.length || safe === st.length, opt: true });
      return out;
    },
    pointer(run) {
      const G = DH.G, W = G.W, p = run.player, st = L.nextStep(run);
      const meds = Object.values(run.items).filter((i) => i.kind === 'medstock' && i.loc === 'world');
      if (meds.length && !p.inTruck) { const m = meds.sort((a, b) => M.dist(a.x, a.y, p.x, p.y) - M.dist(b.x, b.y, p.x, p.y))[0]; return { x: m.x, y: m.y, label: 'MEDICINE', col: '#ff8a7a' }; }
      if (st === 'signal') return { x: W.rampConsole.x, y: W.rampConsole.y, label: 'BEACON', col: '#ff8a7a' };
      if (st === 'hold') return { x: 88, y: 22, label: 'HOLD THE RAMP', col: '#ffd36a' };
      if (!p.inTruck) return { x: run.truck.x, y: run.truck.y, label: 'TRUCK', col: '#ffd36a' };
      return { x: 88, y: 18, label: 'FERRY', col: '#8cd6ff' };
    },
    markers(run, dot) {
      const W = DH.G.W;
      for (const id in run.items) { const it = run.items[id]; if (it.kind === 'medstock' && it.loc === 'world') dot(it.x, it.y, '#ff6b5a', 3); }
      dot(W.rampConsole.x, W.rampConsole.y, run.flags.signal ? '#7fe3a0' : '#ff6b5a', 3);
      if (run.boat) dot(run.boat.x, run.boat.y, '#8cd6ff', 3);
    },
    primaryOut: (out, run, mode) => mode === 'ferry' && !!run.flags.rampDown && (out.got.medstock || 0) >= 3,
    primaryGot: (run) => !!run.flags.rampDown && Object.values(run.items).filter((i) => i.kind === 'medstock' && i.loc !== 'world').length >= 3,
    bonus: (out, run, mode) => (L.primaryOut(out, run, mode) ? [{ label: 'Night run', scrap: DH.T.rewards.ferryrun }] : []),
    departWarn: 'The ferry needs the truck and all three medicine crates aboard. This will be a partial extraction.',
    resultSub(r) { return r.status === 'partial' ? 'The medicine did not make the crossing.' : r.status === 'failed' ? 'Nothing extracted. No rewards from this run. Your campaign progress is safe.' : 'The ferry backs off the quay with the truck and the medicine.'; },
    resultRows(run, ev) {
      const R = DH.T.rewards;
      const st = run.survivors.filter((s) => s.stranded), out = st.filter((s) => ev.survivorsOut.indexOf(s.id) >= 0);
      const d = run.flags.decoy;
      return [
        ['Ferry signalled and docked', run.flags.rampDown ? 'Yes' : run.flags.signal ? 'Signalled, never docked' : 'No', run.flags.rampDown ? 'good' : 'bad'],
        ['Medicine crates (primary)', (ev.got.medstock || 0) + ' / 3' + (ev.got.medstock ? ' (+' + ev.got.medstock * R.medstock + ')' : ''), (ev.got.medstock || 0) >= 3 ? 'good' : 'bad'],
        ['Holding the ramp', d === 'boat' ? 'Skiff decoy' : d === 'pa' ? 'Terminal PA' : d === 'truck' ? 'Truck across the lanes' : 'Fought it out'],
        ['Dockworkers brought across', st.length ? out.length + ' / ' + st.length + (out.length ? ' (+' + out.length * R.survivor + ')' : '') : 'Nobody left behind', out.length ? 'good' : ''],
        ['Salvage bundles', ev.salvageOut + (ev.salvageOut ? ' (+' + ev.salvageOut * R.salvage + ')' : ''), ev.salvageOut ? 'good' : ''],
      ];
    },
    outcome(run, ev, mode) {
      const st = run.survivors.filter((s) => s.stranded), out = st.filter((s) => ev.survivorsOut.indexOf(s.id) >= 0);
      const all = st.length === 0 || out.length === st.length;
      return { ferryrun: L.primaryOut(ev, run, mode), decoy: run.flags.decoy || null, quay: out.length, quayFirst: out[0] ? out[0].id : null, quayAll: st.length > 0 && out.length === st.length, optional: { quay: all, meds: (ev.got.medstock || 0) >= 3 } };
    },
    hints: {
      start: { kbm: 'Night at Harbor Street. Your flashlight follows your aim. Grab the medicine, light the beacon, and keep the ramp clear until the ferry docks.', touch: 'Night. Grab the medicine, light the beacon, keep the ramp clear until the ferry docks.' },
      primaryGot: { kbm: 'Ferry docked and the crates are aboard your truck. Drive up the ramp.', touch: 'Ferry docked, crates loaded: drive up the ramp.' },
    },
    backdropCam: { x: 70, y: 40 },
  });
})();
