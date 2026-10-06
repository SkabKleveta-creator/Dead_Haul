/* ==== audio.js ==== */
/* DEAD HAUL - original procedural audio (WebAudio). Starts only after a user gesture. */
(function () {
  'use strict';
  const DH = window.DH;
  const M = DH.M, G = DH.G;
  const A = (DH.Audio = { ctx: null, ok: false, voices: 0 });

  A.init = () => {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      A.ctx = new AC();
      const c = A.ctx;
      A.master = c.createGain();
      A.comp = c.createDynamicsCompressor(); A.comp.threshold.value = -16; A.comp.ratio.value = 4;
      A.master.connect(A.comp); A.comp.connect(c.destination);
      A.sfx = c.createGain(); A.sfx.connect(A.master);
      A.music = c.createGain(); A.music.connect(A.master);
      A.amb = c.createGain(); A.amb.connect(A.master); A.amb.gain.value = 0.35;
      // noise buffer
      const len = c.sampleRate * 2;
      A.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = A.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      A.ok = true;
      A.applySettings();
      A.startAmbient();
    } catch (e) { A.ok = false; }
  };
  A.applySettings = () => {
    if (!A.ok) return;
    const s = DH.Save.settings();
    const t = A.ctx.currentTime;
    A.master.gain.setTargetAtTime(s.muted ? 0 : s.volume, t, 0.05);
    A.music.gain.setTargetAtTime(s.music * 0.5, t, 0.2);
  };
  A.suspend = (on) => { if (!A.ok) return; if (on) A.ctx.suspend().catch(() => {}); else A.ctx.resume().catch(() => {}); };

  // positional gain/pan relative to the listener (player)
  const pos = (x, y, maxD) => {
    if (x == null || !G.run) return { g: 1, p: 0 };
    const pp = DH.Player.pos();
    const d = M.dist(pp.x, pp.y, x, y);
    const g = M.clamp(1 - d / (maxD || 40), 0, 1);
    const sx = (x - y) - (pp.x - pp.y);
    return { g: g * g, p: M.clamp(sx / 14, -0.9, 0.9) };
  };
  const out = (gain, pan, bus) => {
    const c = A.ctx;
    const g = c.createGain(); g.gain.value = gain;
    let node = g;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan || 0; g.connect(p); p.connect(bus || A.sfx); }
    else g.connect(bus || A.sfx);
    return node;
  };
  const voice = (dur) => { A.voices++; setTimeout(() => { A.voices--; }, dur * 1000 + 50); return A.voices < 28; };
  // noise burst through a filter
  const noise = (dur, f, q, type, gain, x, y, maxD, attack) => {
    if (!A.ok || !voice(dur)) return;
    const c = A.ctx, t = c.currentTime;
    const P = pos(x, y, maxD);
    if (P.g < 0.01) return;
    const src = c.createBufferSource(); src.buffer = A.noiseBuf; src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = c.createBiquadFilter(); fl.type = type || 'bandpass'; fl.frequency.value = f; fl.Q.value = q || 1;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain * P.g + 0.0002, t + (attack || 0.004));
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(env); env.connect(out(1, P.p));
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
    return fl;
  };
  const tone = (type, f0, f1, dur, gain, x, y, maxD, bus) => {
    if (!A.ok || !voice(dur)) return;
    const c = A.ctx, t = c.currentTime;
    const P = pos(x, y, maxD);
    if (P.g < 0.01) return;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const env = c.createGain(); env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(gain * P.g + 0.0002, t + 0.01); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(env); env.connect(out(1, P.p, bus));
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  };

  // ---------- Named sounds ----------
  A.shot = (type) => {
    const p = DH.Player.pos();
    if (type === 'pistol') { noise(0.16, 1800, 0.7, 'bandpass', 0.9, p.x, p.y); tone('square', 180, 60, 0.08, 0.35, p.x, p.y); }
    else if (type === 'shotgun') { noise(0.42, 700, 0.5, 'lowpass', 1.2, p.x, p.y); tone('sine', 110, 38, 0.25, 0.7, p.x, p.y); }
    else if (type === 'smg') { noise(0.09, 2600, 0.9, 'bandpass', 0.6, p.x, p.y); tone('square', 240, 90, 0.05, 0.2, p.x, p.y); }
    else if (type === 'rifle') { noise(0.55, 1200, 0.4, 'bandpass', 1.1, p.x, p.y); tone('sawtooth', 300, 50, 0.18, 0.4, p.x, p.y); setTimeout(() => noise(0.5, 500, 0.6, 'lowpass', 0.25, p.x, p.y), 90); }
  };
  A.click = (f, g) => tone('square', f || 1400, (f || 1400) * 0.7, 0.03, g || 0.15);
  A.reload = (type) => { A.click(900, 0.2); setTimeout(() => A.click(1300, 0.18), type === 'shotgun' ? 500 : 350); setTimeout(() => A.click(700, 0.22), (DH.WEAPONS[type] ? DH.WEAPONS[type].reload : 1.2) * 1000 - 120); };
  A.step = (sprint, x, y, wet) => { if (wet) { noise(0.16, 1500, 0.8, 'bandpass', sprint ? 0.2 : 0.12, x, y, 22); noise(0.1, 400, 1, 'lowpass', 0.08, x, y, 22); } else noise(0.05, sprint ? 900 : 650, 2, 'bandpass', sprint ? 0.14 : 0.07, x, y, 14); };
  A.swing = () => noise(0.18, 1400, 3, 'bandpass', 0.25);
  A.thud = (x, y) => { noise(0.12, 300, 1, 'lowpass', 0.6, x, y, 30); tone('sine', 120, 50, 0.1, 0.3, x, y, 30); };
  A.groan = (x, y, pitch) => {
    if (!A.ok) return;
    const o = tone('sawtooth', (pitch || 90) + Math.random() * 30, (pitch || 90) * 0.7, 0.9 + Math.random() * 0.5, 0.18, x, y, 26);
    if (o) { const c = A.ctx; const lfo = c.createOscillator(); lfo.frequency.value = 5 + Math.random() * 3; const lg = c.createGain(); lg.gain.value = 12; lfo.connect(lg); lg.connect(o.frequency); lfo.start(); lfo.stop(c.currentTime + 1.5); }
    noise(0.9, 400 + Math.random() * 200, 4, 'bandpass', 0.12, x, y, 26, 0.2);
  };
  A.howl = (x, y) => {
    if (!A.ok) return;
    const c = A.ctx, t = c.currentTime; const P = pos(x, y, 60);
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(180, t); o.frequency.linearRampToValueAtTime(520, t + 0.5); o.frequency.linearRampToValueAtTime(260, t + 1.6);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 3;
    const env = c.createGain(); env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(0.6 * Math.max(0.15, P.g) + 0.001, t + 0.15); env.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    o.connect(f); f.connect(env); env.connect(out(1, P.p)); o.start(t); o.stop(t + 1.9);
  };
  A.inhale = (x, y) => noise(1.4, 1200, 1.5, 'highpass', 0.25, x, y, 30, 1.2);
  A.screech = (x, y) => tone('sawtooth', 700, 300, 0.25, 0.3, x, y, 30);
  A.door = (open, x, y) => { tone('triangle', open ? 260 : 200, open ? 180 : 120, 0.25, 0.15, x, y, 20); noise(0.1, 500, 1, 'lowpass', 0.3, x, y, 20); };
  A.bang = (x, y) => { noise(0.2, 220, 0.8, 'lowpass', 0.8, x, y, 34); tone('sine', 90, 40, 0.18, 0.4, x, y, 34); };
  A.crash = (v) => { noise(0.4, 600, 0.5, 'lowpass', Math.min(1.2, v * 0.15), null, null); tone('sine', 80, 30, 0.3, 0.4); };
  A.beep = (x, y) => tone('square', 1800, 1800, 0.07, 0.25, x, y, 30);
  A.hurt = () => { tone('sawtooth', 220, 120, 0.2, 0.35); noise(0.12, 800, 1, 'bandpass', 0.3); };
  A.pickup = () => { tone('triangle', 660, 990, 0.12, 0.25); };
  A.load = () => { noise(0.25, 200, 1, 'lowpass', 0.8); tone('sine', 70, 40, 0.3, 0.5); };
  A.confirm = () => { tone('triangle', 523, 523, 0.5, 0.2); setTimeout(() => tone('triangle', 659, 659, 0.5, 0.2), 120); setTimeout(() => tone('triangle', 784, 784, 0.7, 0.22), 240); };
  A.fail = () => { tone('sawtooth', 220, 110, 1.0, 0.25); tone('sawtooth', 165, 82, 1.2, 0.2); };
  A.horde = (x, y) => { for (let k = 0; k < 4; k++) setTimeout(() => A.groan(x + Math.random() * 4, y + Math.random() * 4, 70 + k * 12), k * 180); };
  A.ui = () => tone('sine', 880, 660, 0.06, 0.12);
  A.ratchet = () => { for (let k = 0; k < 4; k++) setTimeout(() => A.click(500 + k * 60, 0.2), k * 160); };

  // ---------- Continuous loops: engine, scrape, alarm, ambient ----------
  A.startEngine = () => {
    if (!A.ok || A.engine) return;
    const c = A.ctx;
    const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 42;
    const o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.value = 21;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 240; f.Q.value = 2;
    const g = c.createGain(); g.gain.value = 0;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(A.sfx);
    o1.start(); o2.start();
    A.engine = { o1, o2, f, g };
  };
  A.stopEngine = () => { if (!A.engine) return; const e = A.engine; const t = A.ctx.currentTime; e.g.gain.setTargetAtTime(0, t, 0.1); setTimeout(() => { try { e.o1.stop(); e.o2.stop(); } catch (er) { /* */ } }, 600); A.engine = null; };
  A.startLoop = (name, build) => { if (!A.ok || A[name]) return; A[name] = build(); };
  A.stopLoop = (name) => { const l = A[name]; if (!l) return; const t = A.ctx.currentTime; l.g.gain.setTargetAtTime(0, t, 0.08); setTimeout(() => { try { l.src.stop(); if (l.o) l.o.stop(); if (l.lfo) l.lfo.stop(); } catch (e) { /* */ } }, 500); A[name] = null; };
  const scrapeLoop = () => {
    const c = A.ctx; const src = c.createBufferSource(); src.buffer = A.noiseBuf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 6;
    const lfo = c.createOscillator(); lfo.frequency.value = 3.5; const lg = c.createGain(); lg.gain.value = 900; lfo.connect(lg); lg.connect(f.frequency);
    const g = c.createGain(); g.gain.value = 0.25; src.connect(f); f.connect(g); g.connect(A.sfx); src.start(); lfo.start();
    return { src, lfo, g };
  };
  const alarmLoop = () => {
    const c = A.ctx; const o = c.createOscillator(); o.type = 'square'; o.frequency.value = 900;
    const lfo = c.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 2.2; const lg = c.createGain(); lg.gain.value = 300; lfo.connect(lg); lg.connect(o.frequency);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2500;
    const g = c.createGain(); g.gain.value = 0.0; o.connect(f); f.connect(g); g.connect(A.sfx); o.start(); lfo.start();
    return { src: o, lfo, g };
  };
  const machineLoop = () => {
    const c = A.ctx; const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 90;
    const lfo = c.createOscillator(); lfo.frequency.value = 7; const lg = c.createGain(); lg.gain.value = 18; lfo.connect(lg); lg.connect(o.frequency);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = c.createGain(); g.gain.value = 0; o.connect(f); f.connect(g); g.connect(A.sfx); o.start(); lfo.start();
    return { src: o, o, lfo, g };
  };
  const rainLoop = () => {
    const c = A.ctx; const src = c.createBufferSource(); src.buffer = A.noiseBuf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800;
    const g = c.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(A.amb); src.start();
    return { src, g };
  };
  const windLoop = () => {
    const c = A.ctx; const src = c.createBufferSource(); src.buffer = A.noiseBuf; src.loop = true; src.playbackRate.value = 0.5;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 450; f.Q.value = 0.7;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.15; const lg = c.createGain(); lg.gain.value = 250; lfo.connect(lg); lg.connect(f.frequency);
    const g = c.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(A.amb); src.start(); lfo.start();
    return { src, lfo, g };
  };
  A.startAmbient = () => {
    if (!A.ok || A.ambient) return;
    const c = A.ctx;
    const src = c.createBufferSource(); src.buffer = A.noiseBuf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
    const g = c.createGain(); g.gain.value = 0.18; src.connect(f); f.connect(g); g.connect(A.amb); src.start();
    // quiet music drone
    const m1 = c.createOscillator(); m1.type = 'triangle'; m1.frequency.value = 55;
    const m2 = c.createOscillator(); m2.type = 'triangle'; m2.frequency.value = 82.4;
    const m3 = c.createOscillator(); m3.type = 'sine'; m3.frequency.value = 130.8;
    const mf = c.createBiquadFilter(); mf.type = 'lowpass'; mf.frequency.value = 500;
    const mg = c.createGain(); mg.gain.value = 0.12;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.05; const lg = c.createGain(); lg.gain.value = 0.08; lfo.connect(lg); lg.connect(mg.gain);
    m1.connect(mf); m2.connect(mf); m3.connect(mf); mf.connect(mg); mg.connect(A.music);
    m1.start(); m2.start(); m3.start(); lfo.start();
    A.ambient = { src, g };
  };

  // per-frame continuous updates
  A.update = () => {
    if (!A.ok || !G.run) return;
    const run = G.run, t = run.truck, c = A.ctx;
    const playing = G.state === 'play';
    if (t.engine && playing) {
      A.startEngine();
      const sp = Math.abs(t.speed);
      const P = pos(t.x, t.y, 40);
      const quiet = G.upg.quiet ? 0.7 : 1;
      A.engine.o1.frequency.setTargetAtTime(40 + sp * 9, c.currentTime, 0.1);
      A.engine.o2.frequency.setTargetAtTime(20 + sp * 4.5, c.currentTime, 0.1);
      A.engine.f.frequency.setTargetAtTime(200 + sp * 70, c.currentTime, 0.1);
      // keep the engine under enemy warning sounds
      A.engine.g.gain.setTargetAtTime((0.14 + sp * 0.012) * quiet * P.g, c.currentTime, 0.1);
    } else if (A.engine) A.stopEngine();
    if (t.clingers.length && playing && !t.disabled) { A.startLoop('scrape', scrapeLoop); } else A.stopLoop('scrape');
    if (run.alarm.active > 0 && playing && G.W.alarmCar) { A.startLoop('alarm', alarmLoop); const P = pos(G.W.alarmCar.x, G.W.alarmCar.y, 70); A.alarm.g.gain.setTargetAtTime(0.18 * Math.max(0.12, P.g), c.currentTime, 0.1); } else A.stopLoop('alarm');
    // machinery / speakers: one shared loop at the loudest active emitter
    let best = null, bg = 0;
    for (const e of run.emitters) if (e.on) { const P = pos(e.x, e.y, 70); const g2 = Math.max(0.06, P.g) * (e.warm > 0 ? 0.5 : 1); if (g2 > bg) { bg = g2; best = e; } }
    if (best && playing) {
      A.startLoop('machine', machineLoop);
      const f = best.kind === 'broadcast' || best.kind === 'speaker' ? 420 : best.kind === 'pump' ? 70 : best.kind === 'klaxon' ? 520 : 95;
      A.machine.o.frequency.setTargetAtTime(f, c.currentTime, 0.2);
      A.machine.lfo.frequency.setTargetAtTime(best.kind === 'broadcast' || best.kind === 'speaker' ? 1.6 : best.kind === 'klaxon' ? 2.5 : 7, c.currentTime, 0.2);
      A.machine.g.gain.setTargetAtTime(0.16 * bg, c.currentTime, 0.15);
    } else A.stopLoop('machine');
    const TH = G.W && G.W.theme;
    if (TH && TH.rain && playing) { A.startLoop('rain', rainLoop); A.rain.g.gain.setTargetAtTime(0.09, c.currentTime, 0.5); } else A.stopLoop('rain');
    if (TH && TH.wind && playing) { A.startLoop('wind', windLoop); A.wind.g.gain.setTargetAtTime(0.06 + Math.sin(c.currentTime * 0.3) * 0.03, c.currentTime, 0.8); } else A.stopLoop('wind');
    // ambient zombie groans from visible zombies
    A.groanT = (A.groanT || 0) - 1 / 60;
    if (A.groanT <= 0 && playing) {
      A.groanT = 1.2 + Math.random() * 1.8;
      const pp = DH.Player.pos();
      const near = run.zombies.filter((z) => !z.dead && M.dist(z.x, z.y, pp.x, pp.y) < 20);
      if (near.length) { const z = near[Math.floor(Math.random() * near.length)]; A.groan(z.x, z.y, z.type === 'runner' ? 140 : z.type === 'howler' ? 70 : 95); }
    }
  };
  A.stopAll = () => { A.stopEngine(); A.stopLoop('scrape'); A.stopLoop('alarm'); A.stopLoop('machine'); A.stopLoop('rain'); A.stopLoop('wind'); };

  // ---------- Event wiring ----------
  const B = DH.bus;
  B.on('shot', (type) => A.shot(type));
  B.on('reload', (type) => A.reload(type));
  B.on('dry', () => A.click(500, 0.2));
  B.on('step', (sprint, x, y, wet) => A.step(sprint, x, y, wet));
  B.on('radio', () => { noise(0.12, 2600, 1.5, 'bandpass', 0.12); tone('square', 1250, 1250, 0.05, 0.07); setTimeout(() => noise(0.25, 1800, 0.8, 'bandpass', 0.05), 80); });
  B.on('shutter', (open, x, y) => { noise(1.4, 500, 1.5, 'bandpass', 0.45, x, y, 40, 0.1); for (let k = 0; k < 8; k++) setTimeout(() => A.click(300 + k * 20, 0.12), k * 150); });
  B.on('emitter', (e, on) => { if (on) { tone('sawtooth', 60, 140, 2.2, 0.2, e.x, e.y, 60); } else tone('sawtooth', 140, 50, 1.2, 0.12, e.x, e.y, 60); });
  B.on('emitterLive', (e) => { if (e.kind === 'broadcast' || e.kind === 'speaker') { tone('square', 660, 660, 0.4, 0.12, e.x, e.y, 80); setTimeout(() => tone('square', 520, 520, 0.6, 0.12, e.x, e.y, 80), 450); } else noise(0.8, 300, 1, 'lowpass', 0.5, e.x, e.y, 70); });
  B.on('survivorSafe', () => A.confirm());
  B.on('swing', () => A.swing());
  B.on('zhit', (z, kind) => { if (kind === 'melee' || kind === 'truck') A.thud(z.x, z.y); else noise(0.06, 500, 1, 'lowpass', 0.25, z.x, z.y, 30); });
  B.on('zdie', (z) => noise(0.3, 260, 1, 'lowpass', 0.4, z.x, z.y, 30));
  B.on('howlStart', (z) => A.inhale(z.x, z.y));
  B.on('howl', (z) => { A.howl(z.x, z.y); if (DH.FX) DH.FX.ring(z.x, z.y, 32, 'rgba(255,200,80,1)', 1.4); });
  B.on('lunge', (z) => A.screech(z.x, z.y));
  B.on('runnerChase', (z) => A.screech(z.x, z.y));
  B.on('windup', (z) => noise(0.25, 300, 2, 'bandpass', 0.15, z.x, z.y, 18));
  B.on('door', (open, x, y) => A.door(open, x, y));
  B.on('bang', (x, y) => A.bang(x, y));
  B.on('doorBroken', (x, y) => { A.bang(x, y); noise(0.6, 900, 0.5, 'bandpass', 0.5, x, y, 40); });
  B.on('beep', (x, y) => A.beep(x, y));
  B.on('noiseLand', (x, y) => { A.click(600, 0.2); if (DH.FX) DH.FX.ring(x, y, 20, 'rgba(127,255,208,1)', 1.2); });
  B.on('alarm', (on) => { if (on && DH.FX && G.W.alarmCar) DH.FX.ring(G.W.alarmCar.x, G.W.alarmCar.y, 30, 'rgba(255,170,60,1)', 1.6); });
  B.on('truckCrash', (v) => A.crash(v));
  B.on('ram', (z) => A.thud(z.x, z.y));
  B.on('playerHurt', () => A.hurt());
  B.on('pickup', () => A.pickup());
  B.on('cargoPickup', () => A.pickup());
  B.on('transfer', () => A.click(700, 0.2));
  B.on('loaded', () => A.load());
  B.on('haul', () => A.click(400, 0.25));
  B.on('enterTruck', () => noise(0.15, 300, 1, 'lowpass', 0.4));
  B.on('exitTruck', () => noise(0.15, 300, 1, 'lowpass', 0.4));
  B.on('clingerOn', () => A.screech(DH.G.run.truck.x, DH.G.run.truck.y));
  B.on('clingerTell', (z) => A.screech(z.x, z.y));
  B.on('hordeWarn', (e) => A.horde(e.x, e.y));
  B.on('healed', () => tone('sine', 520, 780, 0.3, 0.2));
  B.on('repaired', () => A.ratchet());
  B.on('truckDisabled', () => { A.crash(10); tone('sawtooth', 120, 40, 1.2, 0.3); });
  B.on('survivorDown', () => tone('sawtooth', 300, 120, 0.6, 0.25));
  B.on('recruit', () => A.pickup());
  B.on('confirmDepart', () => A.ui());
  B.on('shelf', () => noise(0.4, 300, 1, 'lowpass', 0.5));
  B.on('runEnded', (r) => { A.stopAll(); if (r.status === 'failed') A.fail(); else A.confirm(); });
})();

