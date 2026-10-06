/* ==== nav.js ==== */
/* DEAD HAUL - world queries, collision, line of sight, pathfinding */
(function () {
  'use strict';
  const DH = window.DH;
  const M = DH.M;

  // Attach query helpers to a world object built by DH.buildMap
  DH.initWorldQueries = function (W) {
    const N = W.N;
    const idx = W.idx;
    // Prop spatial buckets (4m)
    const BS = 4, BN = Math.ceil(N / BS);
    W.propBuckets = Array.from({ length: BN * BN }, () => []);
    for (const p of W.props) {
      if (!p.solid) continue;
      const ext = p.shape === 'box' ? Math.hypot(p.hl, p.hw) : p.r;
      const x1 = Math.max(0, Math.floor((p.x - ext) / BS)), x2 = Math.min(BN - 1, Math.floor((p.x + ext) / BS));
      const y1 = Math.max(0, Math.floor((p.y - ext) / BS)), y2 = Math.min(BN - 1, Math.floor((p.y + ext) / BS));
      for (let by = y1; by <= y2; by++) for (let bx = x1; bx <= x2; bx++) W.propBuckets[by * BN + bx].push(p);
    }
    W.propsNear = (x, y, out) => {
      out.length = 0;
      const bx = Math.floor(x / BS), by = Math.floor(y / BS);
      for (let j = by - 1; j <= by + 1; j++) for (let i = bx - 1; i <= bx + 1; i++) {
        if (i < 0 || j < 0 || i >= BN || j >= BN) continue;
        for (const p of W.propBuckets[j * BN + i]) if (out.indexOf(p) < 0) out.push(p);
      }
      return out;
    };

    W.doorClosed = (i) => { const d = W.doorAt[i]; if (!d) return false; const door = W.doors[d - 1]; return !door.open && !door.broken; };
    W.doorLocked = (i) => { const d = W.doorAt[i]; if (!d) return false; const door = W.doors[d - 1]; return !door.open && !door.broken && !!door.locked; };
    // tile blocks movement for characters
    W.solidTile = (x, y) => {
      if (x < 0 || y < 0 || x >= N || y >= N) return true;
      const i = idx(x, y);
      return W.wall[i] > 0 || W.ground[i] > 0 || W.zoneBlock[i] > 0 || W.doorClosed(i) || W.dynBlock[i] > 0;
    };
    // the truck is also kept out of narrow foot paths and flooded channels
    W.truckSolid = (x, y) => W.solidTile(x, y) || W.truckWall[idx(x, y)] > 0;
    // sight = true: strip curtains block vision (bullets pass through)
    W.opaqueTile = (x, y, sight) => {
      if (x < 0 || y < 0 || x >= N || y >= N) return true;
      const i = idx(x, y);
      const m = W.wall[i];
      if (m && DH.MAT_INFO[m].opaque) return true;
      if (sight && W.softOpaque[i]) return true;
      return W.doorClosed(i) || W.dynOpaque[i] > 0 || W.propOpaque[i] > 0;
    };
    // nav passability: 0 blocked, else cost multiplier; doors/shelf breakable cost
    W.navCost = (x, y, forZombie) => {
      if (x < 0 || y < 0 || x >= N || y >= N) return 0;
      const i = idx(x, y);
      if (W.wall[i] || W.propBlock[i] || W.ground[i] || W.zoneBlock[i]) return 0;
      if (W.dynBlock[i]) return forZombie ? 14 : 0;
      if (!forZombie && W.truckBlock[i]) return 0;
      if (W.doorClosed(i)) return forZombie ? 10 : W.doors[W.doorAt[i] - 1].locked ? 0 : 1.5; // survivor opens doors, never locked ones
      if (W.deep[i]) return forZombie ? 2 : 2.5;
      return 1;
    };

    // ---- Line of sight / bullets (Amanatides-Woo DDA) ----
    // returns distance to first opaque tile along segment, or -1 if clear
    W.raycast = (x0, y0, x1, y1, sight) => {
      let dx = x1 - x0, dy = y1 - y0;
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) return -1;
      dx /= len; dy /= len;
      let tx = Math.floor(x0), ty = Math.floor(y0);
      const ex = Math.floor(x1), ey = Math.floor(y1);
      const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
      const tDX = Math.abs(1 / (dx || 1e-9)), tDY = Math.abs(1 / (dy || 1e-9));
      let tMX = dx > 0 ? (tx + 1 - x0) * tDX : (x0 - tx) * tDX;
      let tMY = dy > 0 ? (ty + 1 - y0) * tDY : (y0 - ty) * tDY;
      if (!isFinite(tMX)) tMX = 1e9; if (!isFinite(tMY)) tMY = 1e9;
      let t = 0, guard = 0;
      while (guard++ < 400) {
        if (tx === ex && ty === ey) return -1;
        if (tMX < tMY) { t = tMX; tMX += tDX; tx += sx; } else { t = tMY; tMY += tDY; ty += sy; }
        if (t > len) return -1;
        if (W.opaqueTile(tx, ty, sight)) return t;
      }
      return -1;
    };
    W.los = (x0, y0, x1, y1) => W.raycast(x0, y0, x1, y1, true) < 0;
    W.shotClear = (x0, y0, x1, y1) => W.raycast(x0, y0, x1, y1) < 0;
    // Movement line check (for "can walk straight there")
    W.walkLine = (x0, y0, x1, y1, r) => {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.ceil(len / 0.4);
      const nx = -(y1 - y0) / (len || 1), ny = (x1 - x0) / (len || 1);
      for (let k = 0; k <= steps; k++) {
        const t = k / (steps || 1);
        const px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t;
        for (const o of [0, r, -r]) {
          const qx = px + nx * o, qy = py + ny * o;
          const tx = Math.floor(qx), ty = Math.floor(qy);
          if (W.solidTile(tx, ty) || W.propBlock[idx(M.clamp(tx, 0, N - 1), M.clamp(ty, 0, N - 1))]) return false;
        }
      }
      return true;
    };

    // ---- Collision: circle vs world ----
    const tmpProps = [];
    // Circle vs oriented box: returns push {x,y,d} or null
    W.circleBox = (cx, cy, r, bx, by, hl, hw, ang) => {
      const c = Math.cos(ang), s = Math.sin(ang);
      const lx = (cx - bx) * c + (cy - by) * s, ly = -(cx - bx) * s + (cy - by) * c;
      const qx = M.clamp(lx, -hl, hl), qy = M.clamp(ly, -hw, hw);
      let dx = lx - qx, dy = ly - qy;
      let d2 = dx * dx + dy * dy;
      if (d2 >= r * r) return null;
      let nx, ny, pen;
      if (d2 < 1e-9) { // center inside box: push out along min axis
        const px = hl - Math.abs(lx), py = hw - Math.abs(ly);
        if (px < py) { nx = Math.sign(lx) || 1; ny = 0; pen = px + r; } else { nx = 0; ny = Math.sign(ly) || 1; pen = py + r; }
      } else { const d = Math.sqrt(d2); nx = dx / d; ny = dy / d; pen = r - d; }
      return { x: nx * c - ny * s, y: nx * s + ny * c, d: pen };
    };
    // Resolve circle against tiles and props, returns true if collided. opts.noProps
    W.resolveCircle = (e, r, opts) => {
      let hit = false;
      for (let it = 0; it < 3; it++) {
        let moved = false;
        const x1 = Math.floor(e.x - r), x2 = Math.floor(e.x + r), y1 = Math.floor(e.y - r), y2 = Math.floor(e.y + r);
        const solid = opts && opts.truck ? W.truckSolid : W.solidTile;
        for (let ty = y1; ty <= y2; ty++) for (let tx = x1; tx <= x2; tx++) {
          if (!solid(tx, ty)) continue;
          const qx = M.clamp(e.x, tx, tx + 1), qy = M.clamp(e.y, ty, ty + 1);
          let dx = e.x - qx, dy = e.y - qy; const d2 = dx * dx + dy * dy;
          if (d2 >= r * r) continue;
          if (d2 < 1e-9) { // inside tile: push toward nearest free side
            const opts4 = [[e.x - tx, -1, 0], [tx + 1 - e.x, 1, 0], [e.y - ty, 0, -1], [ty + 1 - e.y, 0, 1]].sort((a, b) => a[0] - b[0]);
            for (const o of opts4) { if (!solid(tx + o[1], ty + o[2])) { e.x += o[1] * (o[0] + r); e.y += o[2] * (o[0] + r); break; } }
          } else { const d = Math.sqrt(d2); e.x += (dx / d) * (r - d); e.y += (dy / d) * (r - d); }
          moved = hit = true;
        }
        if (!(opts && opts.noProps)) {
          W.propsNear(e.x, e.y, tmpProps);
          for (const p of tmpProps) {
            if (opts && opts.ignoreBollards && p.type === 'bollard') continue;
            let push;
            if (p.shape === 'box') push = W.circleBox(e.x, e.y, r, p.x, p.y, p.hl, p.hw, p.ang);
            else { const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy); if (d < r + p.r) push = d > 1e-6 ? { x: dx / d, y: dy / d, d: r + p.r - d } : { x: 1, y: 0, d: r + p.r }; }
            if (push) { e.x += push.x * push.d; e.y += push.y * push.d; moved = hit = true; }
          }
        }
        // dynamic boxes (shelf)
        if (W.dynBoxes) for (const b of W.dynBoxes) {
          if (!b.active) continue;
          const push = W.circleBox(e.x, e.y, r, b.x, b.y, b.hl, b.hw, b.ang);
          if (push) { e.x += push.x * push.d; e.y += push.y * push.d; moved = hit = true; }
        }
        if (!moved) break;
      }
      e.x = M.clamp(e.x, 0.3, N - 0.3); e.y = M.clamp(e.y, 0.3, N - 0.3);
      return hit;
    };
    // move a circle entity with substeps
    W.moveCircle = (e, dx, dy, r, opts) => {
      const len = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.ceil(len / 0.2));
      let hit = false;
      for (let k = 0; k < steps; k++) { e.x += dx / steps; e.y += dy / steps; if (W.resolveCircle(e, r, opts)) hit = true; }
      return hit;
    };
    W.circleFree = (x, y, r, opts) => {
      const e = { x, y };
      W.resolveCircle(e, r, opts);
      return Math.hypot(e.x - x, e.y - y) < 0.01;
    };
    // Find a free standing spot near (x,y) with LOS-free path (no crossing walls)
    W.findFreeNear = (x, y, r, maxR, fromX, fromY) => {
      for (let rad = 0; rad <= (maxR || 4); rad += 0.4) {
        const n = rad === 0 ? 1 : Math.ceil(rad * 8);
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
          if (px < 1 || py < 1 || px > N - 1 || py > N - 1) continue;
          if (!W.circleFree(px, py, r)) continue;
          if (fromX != null && !W.walkLine(fromX, fromY, px, py, 0.05)) continue;
          return { x: px, y: py };
        }
      }
      return null;
    };

    // ---- Pathfinding ----
    const size = N * N;
    const gScore = new Float32Array(size), fScore = new Float32Array(size), came = new Int32Array(size), closed = new Uint8Array(size), stamp = new Uint32Array(size);
    let curStamp = 1;
    const heap = { a: [], push(i) { const a = this.a; a.push(i); let k = a.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (fScore[a[p]] <= fScore[a[k]]) break; [a[p], a[k]] = [a[k], a[p]]; k = p; } }, pop() { const a = this.a; const top = a[0]; const last = a.pop(); if (a.length) { a[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < a.length && fScore[a[l]] < fScore[a[m]]) m = l; if (r < a.length && fScore[a[r]] < fScore[a[m]]) m = r; if (m === k) break; [a[m], a[k]] = [a[k], a[m]]; k = m; } } return top; } };
    const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    // A* from world pos to world pos; returns array of waypoints [{x,y}] or null
    W.findPath = (sx, sy, gx, gy, forZombie, maxNodes) => {
      let s = idx(M.clamp(Math.floor(sx), 0, N - 1), M.clamp(Math.floor(sy), 0, N - 1));
      let g = idx(M.clamp(Math.floor(gx), 0, N - 1), M.clamp(Math.floor(gy), 0, N - 1));
      if (!W.navCost(g % N, (g / N) | 0, forZombie)) {
        // goal blocked: find nearest passable neighbour
        let best = -1, bd = 1e9; const gx0 = g % N, gy0 = (g / N) | 0;
        for (let r = 1; r <= 3 && best < 0; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const x = gx0 + i, y = gy0 + j; if (W.navCost(x, y, forZombie)) { const d = i * i + j * j; if (d < bd) { bd = d; best = idx(x, y); } } }
        if (best < 0) return null; g = best;
      }
      curStamp++;
      heap.a.length = 0;
      stamp[s] = curStamp; gScore[s] = 0; closed[s] = 0; came[s] = -1;
      const hx = g % N, hy = (g / N) | 0;
      const h = (i) => { const dx = Math.abs((i % N) - hx), dy = Math.abs(((i / N) | 0) - hy); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
      fScore[s] = h(s); heap.push(s);
      let nodes = 0; const limit = maxNodes || 5000;
      while (heap.a.length) {
        const cur = heap.pop();
        if (cur === g) break;
        if (closed[cur] && stamp[cur] === curStamp) continue;
        closed[cur] = 1;
        if (++nodes > limit) return null;
        const cx = cur % N, cy = (cur / N) | 0;
        for (const d of DIRS) {
          const nx = cx + d[0], ny = cy + d[1];
          const c = W.navCost(nx, ny, forZombie);
          if (!c) continue;
          if (d[0] && d[1] && (!W.navCost(cx + d[0], cy, forZombie) || !W.navCost(cx, cy + d[1], forZombie))) continue;
          const ni = idx(nx, ny);
          const ng = gScore[cur] + d[2] * c;
          if (stamp[ni] !== curStamp) { stamp[ni] = curStamp; closed[ni] = 0; gScore[ni] = 1e9; }
          if (closed[ni]) continue;
          if (ng < gScore[ni]) { gScore[ni] = ng; came[ni] = cur; fScore[ni] = ng + h(ni); heap.push(ni); }
        }
      }
      if (stamp[g] !== curStamp || (came[g] === undefined)) return null;
      if (g !== s && (stamp[g] !== curStamp || gScore[g] >= 1e9)) return null;
      const path = [];
      let c = g, guard = 0;
      while (c !== -1 && c !== s && guard++ < 5000) { path.push({ x: (c % N) + 0.5, y: ((c / N) | 0) + 0.5, i: c }); c = came[c]; }
      path.reverse();
      if (path.length) { path[path.length - 1].x = gx; path[path.length - 1].y = gy; }
      return path;
    };

    // Flow field (Dijkstra) from a target point, zombie costs
    W.makeFlow = () => ({ dist: new Float32Array(size).fill(1e9), tx: -1, ty: -1, ver: -1, t: 0 });
    W.computeFlow = (F, tx, ty, maxDist) => {
      const d = F.dist; d.fill(1e9);
      const s = idx(M.clamp(Math.floor(tx), 0, N - 1), M.clamp(Math.floor(ty), 0, N - 1));
      const openA = [s]; d[s] = 0;
      // bucketed Dijkstra (simple binary heap on dist)
      const hp = [s];
      const push = (i) => { hp.push(i); let k = hp.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (d[hp[p]] <= d[hp[k]]) break; [hp[p], hp[k]] = [hp[k], hp[p]]; k = p; } };
      const pop = () => { const top = hp[0]; const last = hp.pop(); if (hp.length) { hp[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < hp.length && d[hp[l]] < d[hp[m]]) m = l; if (r < hp.length && d[hp[r]] < d[hp[m]]) m = r; if (m === k) break; [hp[m], hp[k]] = [hp[k], hp[m]]; k = m; } } return top; };
      const seen = new Uint8Array(size);
      openA.length = 0;
      while (hp.length) {
        const cur = pop();
        if (seen[cur]) continue; seen[cur] = 1;
        if (d[cur] > (maxDist || 90)) break;
        const cx = cur % N, cy = (cur / N) | 0;
        for (const dd of DIRS) {
          const nx = cx + dd[0], ny = cy + dd[1];
          const c = W.navCost(nx, ny, true);
          if (!c) continue;
          if (dd[0] && dd[1] && (!W.navCost(cx + dd[0], cy, true) || !W.navCost(cx, cy + dd[1], true))) continue;
          const ni = idx(nx, ny);
          const nd = d[cur] + dd[2] * c;
          if (nd < d[ni]) { d[ni] = nd; push(ni); }
        }
      }
      F.tx = tx; F.ty = ty; F.ver = W.version;
    };
    // best next cell from position using flow field; returns {x,y} or null
    W.flowStep = (F, x, y) => {
      const cx = Math.floor(x), cy = Math.floor(y);
      if (cx < 0 || cy < 0 || cx >= N || cy >= N) return null;
      let best = F.dist[idx(cx, cy)], bx = -1, by = -1;
      for (const dd of DIRS) {
        const nx = cx + dd[0], ny = cy + dd[1];
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        if (dd[0] && dd[1] && (!W.navCost(cx + dd[0], cy, true) || !W.navCost(cx, cy + dd[1], true))) continue;
        const v = F.dist[idx(nx, ny)];
        if (v < best) { best = v; bx = nx; by = ny; }
      }
      if (bx < 0) return null;
      return { x: bx + 0.5, y: by + 0.5 };
    };

    // Roadable positions for truck recovery (tiles where truck-sized circle fits)
    const RF = DH.FLOOR;
    W.isRoadFloor = (x, y) => { const f = W.floor[idx(x, y)]; return f === RF.ROAD || f === RF.LOT || f === RF.GRAVEL || f === RF.FORECOURT || f === RF.QUAY || f === RF.DIRT; };
    W.isWater = (x, y) => { if (!W.inB(x, y)) return 0; const i = idx(x, y); return W.deep[i] ? 2 : W.floor[i] === RF.WATER ? 1 : 0; };
  };
})();

