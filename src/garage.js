/* DEAD HAUL - Kettle Creek garage diorama: shows the community changing as the campaign progresses */
(function () {
  'use strict';
  const DH = window.DH;
  const SP = DH.SP;
  const HX = DH.TW / 2, HY = DH.TH / 2, HZ = DH.HZ;
  const Gar = (DH.Garage = {});

  // Draw the garage scene into a canvas. st: story block. opts.speaker: cast id to highlight.
  Gar.draw = (cv, st, opts) => {
    opts = opts || {};
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(200, cv.clientWidth || 360), ch = Math.max(120, cv.clientHeight || 190);
    if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
    const x = cv.getContext('2d');
    const m = (st && st.milestones) || {};
    const t = performance.now() / 1000;
    x.setTransform(1, 0, 0, 1, 0, 0);
    // night sky to ground
    const sky = x.createLinearGradient(0, 0, 0, cv.height);
    sky.addColorStop(0, '#0b1018'); sky.addColorStop(0.45, '#141a22'); sky.addColorStop(1, '#1c1d1b');
    x.fillStyle = sky; x.fillRect(0, 0, cv.width, cv.height);
    // scene scale: fit ~22 m wide
    const k = Math.min(cv.width / (15 * HX * 2), cv.height / 200);
    const S = SP.S;
    const sc = k / S; // sprites are cached at SP.S; scale them down/up
    const fx = 0.5, fy = 1.5; // focus point (world)
    x.setTransform(k, 0, 0, k, cv.width * 0.5 - k * (fx - fy) * HX, cv.height * 0.6 - k * (fx + fy) * HY);
    const P = (wx, wy, wz) => [(wx - wy) * HX, ((wx + wy) * HY - (wz || 0) * HZ)];
    const box = (cx, cy, z0, hl, hw, h, col, o) => SP.box(x, P, cx, cy, z0, hl, hw, h, 0, col, o);
    // ground slab: forecourt and road
    const quad = (x1, y1, x2, y2, col) => { const a = P(x1, y1), b = P(x2, y1), c = P(x2, y2), d = P(x1, y2); x.fillStyle = col; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.lineTo(c[0], c[1]); x.lineTo(d[0], d[1]); x.closePath(); x.fill(); };
    quad(-12, -10, 12, 12, '#2c2e2c');
    quad(-12, 6, 12, 12, '#34363a');
    for (let i = -11; i < 12; i += 3) { const a = P(i, 9), b = P(i + 1.5, 9); x.strokeStyle = 'rgba(200,170,70,0.5)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
    // garage building (bay door open), with the roof
    const gx = -2, gy = -4;
    box(gx, gy, 0, 5, 3.5, 3.2, '#8a8578', { top: '#3c4043', faceFn: (f, p1, p2, p3, p4) => {
      if (f.ny > 0.5) { // front face: open bay with warm or dim light
        const lit = m.generator ? 'rgba(255,196,110,0.85)' : 'rgba(120,110,90,0.55)';
        x.fillStyle = '#121212'; const u0 = 0.15, u1 = 0.62; x.beginPath(); x.moveTo(p1[0] + (p2[0] - p1[0]) * u0, p1[1] + (p2[1] - p1[1]) * u0); x.lineTo(p1[0] + (p2[0] - p1[0]) * u1, p1[1] + (p2[1] - p1[1]) * u1); x.lineTo(p4[0] + (p3[0] - p4[0]) * u1, p4[1] + (p3[1] - p4[1]) * u1 + (p2[1] - p3[1]) * 0.25); x.lineTo(p4[0] + (p3[0] - p4[0]) * u0, p4[1] + (p3[1] - p4[1]) * u0 + (p1[1] - p4[1]) * 0.25); x.closePath(); x.fill();
        x.fillStyle = lit; x.globalAlpha = m.generator ? 0.55 + Math.sin(t * 2) * 0.03 : 0.35 + (Math.sin(t * 7) > 0.6 ? 0.1 : 0); x.fill(); x.globalAlpha = 1;
        x.fillStyle = '#e0e0e0'; x.font = 'bold 7px system-ui'; x.fillText('KETTLE CREEK AUTO', p4[0] + (p3[0] - p4[0]) * 0.66, p4[1] + (p3[1] - p4[1]) * 0.66 + 8);
      }
    } });
    // relay antenna mast on the roof
    if (m.relay) {
      const b0 = P(gx + 3, gy - 2, 3.2), b1 = P(gx + 3, gy - 2, 8.5);
      x.strokeStyle = '#3a3f44'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(b0[0], b0[1]); x.lineTo(b1[0], b1[1]); x.stroke();
      for (let z = 4; z < 8.5; z += 1) { const a = P(gx + 2.6, gy - 2, z), b = P(gx + 3.4, gy - 2, z + 0.5); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
      x.fillStyle = (t % 1.2) < 0.6 ? '#ff3b2b' : '#4a1410'; x.beginPath(); x.arc(b1[0], b1[1] - 1, 1.8, 0, 7); x.fill();
    }
    // water tank and filtration skid
    if (m.water) {
      const q0 = P(gx + 6.5, gy - 1, 0), q1 = P(gx + 6.5, gy - 1, 3.0), rx = 1.4 * HX * 1.2, ry = 1.4 * HY * 1.2;
      x.fillStyle = '#3e6a82'; x.fillRect(q0[0] - rx, q1[1], rx * 2, q0[1] - q1[1]); x.beginPath(); x.ellipse(q0[0], q0[1], rx, ry, 0, 0, Math.PI); x.fill();
      x.fillStyle = '#5d8ea8'; x.beginPath(); x.ellipse(q1[0], q1[1], rx, ry, 0, 0, 7); x.fill();
      box(gx + 6.6, gy + 1.6, 0, 0.6, 0.4, 0.8, '#2f6d8c');
    } else {
      // rain barrels
      for (const dx of [0, 0.9]) box(gx + 6 + dx, gy - 0.5, 0, 0.35, 0.35, 0.9, '#3e5a46');
    }
    // refrigeration unit with vapor
    if (m.refrigeration) {
      box(gx + 5.6, gy + 3.2, 0, 0.8, 0.6, 1.6, '#d5dadb', { top: '#9ca1a4' });
      for (let i = 0; i < 3; i++) { const ph = (t * 0.3 + i / 3) % 1; const q = P(gx + 5.6, gy + 3.2, 1.7 + ph * 1.5); x.fillStyle = 'rgba(225,240,250,' + (0.18 * (1 - ph)).toFixed(3) + ')'; x.beginPath(); x.arc(q[0] + Math.sin(t + i) * 2, q[1], 3 + ph * 5, 0, 7); x.fill(); }
    } else box(gx + 5.6, gy + 3.2, 0, 0.5, 0.4, 0.9, '#7a7a74', { top: '#5a5a54' }); // cooler on batteries
    // generator or battery bank
    if (m.generator) {
      box(gx - 6.2, gy + 2.5, 0, 0.55, 0.38, 0.65, '#d9a520', { top: '#2c2c2c' });
      // string lights
      const a = P(gx - 5, gy + 3.6, 3.0), b = P(gx + 4, gy + 3.6, 3.0);
      x.strokeStyle = 'rgba(60,50,30,0.8)'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(a[0], a[1]); x.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 10, b[0], b[1]); x.stroke();
      for (let i = 0; i <= 10; i++) { const u = i / 10; const px = a[0] + (b[0] - a[0]) * u, py = a[1] + (b[1] - a[1]) * u + Math.sin(u * Math.PI) * 5; x.fillStyle = 'rgba(255,205,120,' + (0.75 + Math.sin(t * 3 + i) * 0.2).toFixed(2) + ')'; x.beginPath(); x.arc(px, py, 1.3, 0, 7); x.fill(); }
    } else {
      box(gx - 6.2, gy + 2.5, 0, 0.5, 0.3, 0.45, '#2a2a2a', { top: '#c0392b' });
      const q = P(gx - 4.5, gy + 4.2, 1.1); x.fillStyle = 'rgba(255,190,90,' + (0.5 + Math.sin(t * 9) * 0.15).toFixed(2) + ')'; x.beginPath(); x.arc(q[0], q[1], 1.8, 0, 7); x.fill();
    }
    // ferry schedule board after the crossing
    if (m.crossing) {
      box(gx - 4, gy + 6.4, 0, 0.06, 0.06, 1.6, '#3a3c40');
      const q = P(gx - 4, gy + 6.4, 2.0); x.fillStyle = '#1f3a56'; x.fillRect(q[0] - 9, q[1] - 7, 18, 11); x.fillStyle = '#e9e4d8'; x.font = 'bold 4px system-ui'; x.textAlign = 'center'; x.fillText('FERRY', q[0], q[1] - 2); x.fillText('06:00 18:00', q[0], q[1] + 2);
    }
    // the recovery truck
    const tr = { x: gx + 1.5, y: gy + 7.5, ang: Math.PI * 0.02, engine: false, disabled: false, speed: 0 };
    SP.drawTruck(x, P, tr, 1, { cargo: [], generator: false, passenger: false, bumper: DH.Save.data.campaign.upgrades.bumper, winch: m.water });
    // people: Marta always; rescued characters appear and stay
    const cast = [['marta', gx - 2.6, gy + 4.6, 0.6]];
    if (m.nell) cast.push(['nell', gx - 1.2, gy + 5.2, -0.3]);
    if (m.tomas) cast.push(['tomas', gx + 3.4, gy + 4.0, 2.4]);
    if (m.ada) cast.push(['ada', gx + 4.6, gy + 5.4, 2.8]);
    if (m.wes) cast.push(['wes', gx + 0.6, gy + 4.4, 1.2]);
    const extra = Math.min(3, Object.keys(st && st.completed || {}).length);
    for (let i = 0; i < extra; i++) cast.push(['_c' + i, gx - 7.5 + i * 1.3, gy + 6.2 + (i % 2) * 0.8, 0.4 + i]);
    x.save();
    for (const [id, wx, wy, face] of cast.sort((a, b) => a[1] + a[2] - b[1] - b[2])) {
      const fig = id.charAt(0) === '_' ? ['bo', 'ines', 'ray'][+id.slice(2) % 3] : (DH.Story.CAST[id] || {}).fig || 'survivor';
      const e = SP.figure(fig, face + Math.sin(t * 0.4 + wx) * 0.15, 'default', 0, false, null, null);
      const q = P(wx, wy, 0);
      x.save(); x.translate(q[0], q[1]); x.scale(1 / S, 1 / S);
      if (opts.speaker === id) { x.fillStyle = 'rgba(240,181,74,0.35)'; x.beginPath(); x.ellipse(0, 0, 14 * S, 7 * S, 0, 0, 7); x.fill(); }
      x.drawImage(e.c, -e.ox, -e.oy);
      x.restore();
    }
    x.restore();
    void sc;
    // soft dark vignette
    x.setTransform(1, 0, 0, 1, 0, 0);
    const vg = x.createRadialGradient(cv.width / 2, cv.height * 0.55, cv.height * 0.2, cv.width / 2, cv.height * 0.55, cv.width * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    x.fillStyle = vg; x.fillRect(0, 0, cv.width, cv.height);
  };
})();
