/* DEAD HAUL - boot and main loop */
(function () {
  'use strict';
  const DH = window.DH;
  const G = DH.G;

  const fatal = (err) => {
    try {
      document.getElementById('fatal').classList.remove('hidden');
      document.getElementById('fatal-msg').textContent = String((err && (err.stack || err.message)) || err);
    } catch (e) { /* nothing else we can do */ }
  };
  window.addEventListener('error', (e) => { if (!DH.booted) fatal(e.error || e.message); else console.error(e.error || e.message); });

  let last = 0, acc = 0, saveT = 0;
  const Q = { slowT: 0 };
  const frame = (now) => {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, 0.25); // clamp large gaps (tab switches, hitches)
    try {
      if (G.state === 'play' && G.run && !DH.debug.manual) {
        acc += dt;
        let first = true, steps = 0;
        while (acc >= DH.DT && steps < 8) {
          const inp = DH.Input.sample(first);
          first = false;
          G.update(DH.DT, inp);
          acc -= DH.DT; steps++;
          if (G.state !== 'play' || !G.run) { acc = 0; break; }
        }
        if (steps >= 8) acc = 0;
        saveT += dt;
        if (saveT > 10 && G.run && G.state === 'play') { saveT = 0; DH.UI.saveRun(); }
      } else {
        acc = 0;
        if (G.state === 'title' && G.run) {
          // gentle cinematic drift on the title screen
          const t = now / 1000;
          const bc = (DH.LEVELS[G.run.level] || {}).backdropCam || { x: 46, y: 60 };
          DH.R.cam.x = bc.x + Math.sin(t * 0.05) * 10; DH.R.cam.y = bc.y + 2 + Math.cos(t * 0.04) * 8;
          if (DH.FX) DH.FX.update(dt);
          DH.Z.updateAll && G.run.zombies.forEach((z) => { z.visible = true; z.seenA = 1; });
        }
      }
      if (G.run && G.state !== 'title') DH.R.updateCamera(dt);
      DH.Audio.update();
      DH.R.render(dt);
      DH.UI.update(dt);
      // adaptive quality: drop decorative cost before input responsiveness
      if (G.state === 'play') {
        if (dt > 0.034) Q.slowT += dt; else Q.slowT = Math.max(0, Q.slowT - dt * 0.5);
        if (Q.slowT > 3 && DH.R.quality > 0.6) { DH.R.quality = 0.6; DH.FX.MAXP = 120; DH.R.resize(); Q.slowT = 0; }
      }
    } catch (e) {
      console.error(e);
      if (!DH.booted) fatal(e);
    }
  };

  const boot = () => {
    try {
      if (!document.createElement('canvas').getContext) throw new Error('Canvas is not supported by this browser.');
      DH.Save.load();
      G.initWorld();
      DH.R.init(document.getElementById('game'));
      DH.Input.init(document.getElementById('game'));
      DH.UI.init();
      window.addEventListener('resize', () => DH.R.resize());
      window.addEventListener('orientationchange', () => setTimeout(() => DH.R.resize(), 200));
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (G.state === 'play') DH.UI.pause('hidden');
          else DH.UI.saveRun();
          DH.Audio.suspend(true);
        } else DH.Audio.suspend(false);
      });
      window.addEventListener('pagehide', () => { if (G.state === 'play') DH.UI.pause('hidden'); else DH.UI.saveRun(); });
      DH.UI.toTitle();
      DH.booted = true;
      if (DH.Save.status !== 'ok' && DH.Save.message) DH.UI.toast(DH.Save.message, 5000);
      else if (DH.Save.migrated && DH.Save.story().completed[1]) DH.UI.toast('Campaign update: your Mercer Crossing progress carried over. Four new missions are on the garage board.', 6000);
      requestAnimationFrame((t) => { last = t; frame(t); });
    } catch (e) { fatal(e); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  // Debug / test hooks (no gameplay effect unless called)
  DH.debug = {
    manual: false,
    // deterministic stepping for automated tests: mod(intent, frameIndex) may edit the intent
    step: (frames, mod) => { for (let i = 0; i < frames; i++) { const inp = DH.Input.sample(true); if (mod) mod(inp, i); G.update(DH.DT, inp); if (!G.run || G.state !== 'play') return i; } return frames; },
    state: () => ({ state: G.state, level: G.run && G.run.level, run: G.run && { time: G.run.time, hp: G.run.player.hp, pos: [G.run.player.x, G.run.player.y], inTruck: G.run.player.inTruck, truck: [G.run.truck.x, G.run.truck.y, G.run.truck.dur], items: Object.fromEntries(Object.entries(G.run.items).map(([k, v]) => [k, v.loc])), zombies: G.run.zombies.filter((z) => !z.dead).length } }),
    frameMs: () => DH.R.frameMs,
  };
})();
