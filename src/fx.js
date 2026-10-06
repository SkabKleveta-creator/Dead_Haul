/* ==== fx.js ==== */
/* DEAD HAUL - pooled effects: tracers, particles, decals, shake, flashes */
(function () {
  'use strict';
  const DH = window.DH;
  const FX = (DH.FX = { parts: [], tracers: [], decals: [], flashes: [], rings: [], shakeT: 0, shakeA: 0, MAXP: 260 });

  FX.reset = () => { FX.parts.length = 0; FX.tracers.length = 0; FX.decals.length = 0; FX.flashes.length = 0; FX.rings.length = 0; FX.shakeT = 0; };
  const quality = () => (DH.R ? DH.R.quality : 1);

  FX.particle = (o) => {
    if (FX.parts.length >= FX.MAXP * quality()) FX.parts.shift();
    FX.parts.push(o);
  };
  FX.tracer = (x0, y0, x1, y1, type) => { FX.tracers.push({ x0, y0, x1, y1, t: 0.07, type }); if (FX.tracers.length > 40) FX.tracers.shift(); };
  FX.muzzle = (x, y, ang, type) => {
    FX.flashes.push({ x, y, ang, t: 0.06, type, kind: 'muzzle' });
    if (FX.flashes.length > 12) FX.flashes.shift();
  };
  FX.spark = (x, y) => {
    for (let i = 0; i < 4; i++) { const a = Math.random() * 6.28, s = 1 + Math.random() * 3; FX.particle({ x, y, z: 1.0 + Math.random() * 0.6, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: Math.random() * 2, life: 0.25, max: 0.25, color: '#ffd28a', size: 1.6, kind: 'spark' }); }
    FX.particle({ x, y, z: 1.1, vx: 0, vy: 0, vz: 0.3, life: 0.5, max: 0.5, color: 'rgba(170,165,150,0.5)', size: 5, kind: 'dust' });
  };
  FX.blood = (x, y, ang) => {
    for (let i = 0; i < 3; i++) { const a = ang + (Math.random() - 0.5) * 1.2, s = 1 + Math.random() * 2.2; FX.particle({ x, y, z: 1.0, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: Math.random() * 1.5, life: 0.35, max: 0.35, color: '#5a1a16', size: 2.2, kind: 'blood' }); }
    if (Math.random() < 0.5) FX.decal(x + Math.cos(ang) * 0.4, y + Math.sin(ang) * 0.4, 'blood');
  };
  FX.decal = (x, y, kind) => {
    FX.decals.push({ x, y, kind, r: 0.25 + Math.random() * 0.35, a: Math.random() * 6.28, t: 40 });
    if (FX.decals.length > 90) FX.decals.shift();
  };
  FX.dust = (x, y) => FX.particle({ x, y, z: 0.2, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6, vz: 0.4, life: 0.8, max: 0.8, color: 'rgba(140,130,115,0.35)', size: 6, kind: 'dust' });
  FX.splash = (x, y) => {
    for (let i = 0; i < 3; i++) { const a = Math.random() * 6.28, sp = 0.6 + Math.random() * 1.2; FX.particle({ x, y, z: 0.1, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 1.6 + Math.random(), life: 0.4, max: 0.4, color: 'rgba(190,215,225,0.8)', size: 1.6, kind: 'spark' }); }
    FX.ring(x, y, 0.9, 'rgba(180,210,225,1)', 0.5);
  };
  FX.vapor = (x, y, col) => FX.particle({ x: x + (Math.random() - 0.5) * 0.8, y: y + (Math.random() - 0.5) * 0.8, z: 0.2 + Math.random() * 0.6, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, vz: 0.25, life: 2.2, max: 2.2, color: col || 'rgba(225,240,250,0.16)', size: 9 + Math.random() * 6, kind: 'dust' });
  FX.ring = (x, y, r, color, dur) => { FX.rings.push({ x, y, r, color, t: dur || 1, max: dur || 1 }); if (FX.rings.length > 16) FX.rings.shift(); };
  FX.shake = (a) => { if (DH.Save.settings().reducedShake) return; FX.shakeA = Math.min(0.6, Math.max(FX.shakeA, a)); FX.shakeT = 0.25; };

  FX.update = (dt) => {
    for (let i = FX.parts.length - 1; i >= 0; i--) {
      const p = FX.parts[i];
      p.life -= dt;
      if (p.life <= 0) { FX.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.kind !== 'dust') { p.vz -= 9 * dt; if (p.z < 0) { p.z = 0; p.vz *= -0.2; p.vx *= 0.5; p.vy *= 0.5; } }
    }
    for (let i = FX.tracers.length - 1; i >= 0; i--) { FX.tracers[i].t -= dt; if (FX.tracers[i].t <= 0) FX.tracers.splice(i, 1); }
    for (let i = FX.flashes.length - 1; i >= 0; i--) { FX.flashes[i].t -= dt; if (FX.flashes[i].t <= 0) FX.flashes.splice(i, 1); }
    for (let i = FX.rings.length - 1; i >= 0; i--) { FX.rings[i].t -= dt; if (FX.rings[i].t <= 0) FX.rings.splice(i, 1); }
    for (let i = FX.decals.length - 1; i >= 0; i--) { FX.decals[i].t -= dt; if (FX.decals[i].t <= 0) FX.decals.splice(i, 1); }
    if (FX.shakeT > 0) { FX.shakeT -= dt; if (FX.shakeT <= 0) FX.shakeA = 0; }
  };
})();

