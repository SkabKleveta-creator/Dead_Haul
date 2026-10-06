/* DEAD HAUL - keyboard, mouse and multi-touch input -> per-step intent */
(function () {
  'use strict';
  const DH = window.DH;
  const M = DH.M, G = DH.G;
  const I = (DH.Input = {
    keys: new Set(), pressed: new Set(), mouse: { x: 0, y: 0, down: false, inside: false, moved: false },
    touch: { move: { x: 0, y: 0 }, aim: { x: 0, y: 0, active: false }, held: new Set() },
    mode: 'kbm', sprintToggle: false, lastAimDir: null,
  });
  const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'KeyE', 'KeyF', 'KeyR', 'KeyQ', 'KeyG', 'KeyH', 'KeyC', 'KeyX', 'KeyV', 'ShiftLeft', 'ShiftRight', 'Digit1', 'Digit2', 'Digit3', 'Enter', 'Escape', 'KeyM', 'Backquote']);

  I.clear = () => { I.keys.clear(); I.pressed.clear(); I.mouse.down = false; I.touch.held.clear(); I.touch.move.x = I.touch.move.y = 0; I.touch.aim.active = false; I.sticks = {}; DH.bus.emit('inputCleared'); };

  I.init = (canvas) => {
    try { if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches) I.mode = 'touch'; } catch (e) { /* */ }
    window.addEventListener('keydown', (e) => {
      const inGame = G.state === 'play' || G.state === 'paused' || G.state === 'map';
      if (inGame && GAME_KEYS.has(e.code) && !(e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT'))) e.preventDefault();
      if (e.repeat) return;
      I.mode = 'kbm';
      I.keys.add(e.code);
      I.pressed.add(e.code);
      DH.bus.emit('key', e.code, e);
    }, { passive: false });
    window.addEventListener('keyup', (e) => { I.keys.delete(e.code); });
    window.addEventListener('blur', () => I.clear());
    document.addEventListener('visibilitychange', () => { if (document.hidden) I.clear(); });
    // Pointer events tell mouse from touch. Taps on phones also emit legacy mouse events,
    // which must never switch the game out of touch mode (that hid the touch controls).
    canvas.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; I.mouse.x = e.clientX; I.mouse.y = e.clientY; I.mouse.inside = true; I.mouse.moved = true; });
    canvas.addEventListener('pointerdown', (e) => {
      DH.Audio.init();
      if (e.pointerType !== 'mouse') { I.mode = 'touch'; return; }
      I.mode = 'kbm';
      I.mouse.x = e.clientX; I.mouse.y = e.clientY;
      if (e.button === 0) { I.mouse.down = true; I.pressed.add('Mouse0'); }
      if (e.button === 2) I.pressed.add('Mouse2');
    });
    window.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse' && e.button === 0) I.mouse.down = false; });
    window.addEventListener('pointercancel', (e) => { if (e.pointerType === 'mouse') I.mouse.down = false; });
    // any touch anywhere restores touch mode (e.g. after a Bluetooth keyboard press)
    window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' || e.pointerType === 'pen') I.mode = 'touch'; }, true);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mouseleave', () => { I.mouse.inside = false; });
  };

  // ---------- Touch sticks (pointer events on zones) ----------
  I.sticks = {};
  I.bindStick = (zone, which, knobEl, baseEl) => {
    const st = { id: null, ox: 0, oy: 0, x: 0, y: 0, R: 60 };
    const update = (e) => {
      const dx = e.clientX - st.ox, dy = e.clientY - st.oy;
      const d = Math.hypot(dx, dy), R = st.R;
      const k = d > R ? R / d : 1;
      st.x = (dx * k) / R; st.y = (dy * k) / R;
      knobEl.style.transform = 'translate(' + dx * k + 'px,' + dy * k + 'px)';
      if (which === 'move') { I.touch.move.x = st.x; I.touch.move.y = st.y; }
      else { I.touch.aim.x = st.x; I.touch.aim.y = st.y; I.touch.aim.active = true; }
    };
    const end = (e) => {
      if (e && st.id !== e.pointerId) return;
      st.id = null; st.x = st.y = 0;
      knobEl.style.transform = 'translate(0,0)';
      baseEl.classList.remove('on');
      if (which === 'move') { I.touch.move.x = 0; I.touch.move.y = 0; } else { I.touch.aim.active = false; I.touch.aim.x = I.touch.aim.y = 0; }
    };
    zone.addEventListener('pointerdown', (e) => {
      if (st.id !== null) return;
      e.preventDefault();
      I.mode = 'touch';
      DH.Audio.init();
      st.id = e.pointerId;
      try { zone.setPointerCapture(e.pointerId); } catch (er) { /* */ }
      const r = zone.getBoundingClientRect();
      st.R = Math.max(44, Math.min(70, r.height * 0.22));
      st.ox = M.clamp(e.clientX, r.left + st.R, r.right - st.R); st.oy = M.clamp(e.clientY, r.top + st.R, r.bottom - st.R);
      baseEl.style.left = st.ox - r.left + 'px'; baseEl.style.top = st.oy - r.top + 'px';
      baseEl.classList.add('on');
      update(e);
    }, { passive: false });
    zone.addEventListener('pointermove', (e) => { if (e.pointerId === st.id) { e.preventDefault(); update(e); } }, { passive: false });
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('lostpointercapture', end);
    I.sticks[which] = { st, end: () => end(null) };
    DH.bus.on('inputCleared', () => { st.id = null; end({ pointerId: null }); });
  };
  // Touch buttons: hold + press semantics, cleared on up/cancel/leave
  I.bindButton = (el, act) => {
    const down = (e) => { e.preventDefault(); e.stopPropagation(); I.mode = 'touch'; DH.Audio.init(); I.touch.held.add(act); I.pressed.add('T:' + act); el.classList.add('down'); try { el.setPointerCapture(e.pointerId); } catch (er) { /* */ } };
    const up = (e) => { I.touch.held.delete(act); el.classList.remove('down'); };
    el.addEventListener('pointerdown', down, { passive: false });
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    DH.bus.on('inputCleared', () => el.classList.remove('down'));
  };

  const k = (c) => I.keys.has(c);
  const p = (c) => I.pressed.has(c);
  const th = (a) => I.touch.held.has(a);
  const tp = (a) => I.pressed.has('T:' + a);

  // Build the intent for one sim step. consume=true clears latched presses.
  I.sample = (consume) => {
    const run = G.run;
    const inTruck = run && run.player.inTruck;
    let mx = 0, my = 0;
    if (k('KeyA') || k('ArrowLeft')) mx -= 1;
    if (k('KeyD') || k('ArrowRight')) mx += 1;
    if (k('KeyW') || k('ArrowUp')) my -= 1;
    if (k('KeyS') || k('ArrowDown')) my += 1;
    if (I.touch.move.x || I.touch.move.y) {
      // thumbs rarely reach the rim: full walking speed from ~55% deflection, small dead zone
      const tm = Math.hypot(I.touch.move.x, I.touch.move.y);
      const k = tm > 0.12 ? Math.min(1, (tm - 0.12) / 0.43) / tm : 0;
      mx = I.touch.move.x * k; my = I.touch.move.y * k;
    }
    const intent = {
      move: { x: inTruck ? 0 : mx, y: inTruck ? 0 : my },
      aimWorld: null, aimDir: null, aimZombie: null,
      fire: false, firePressed: false,
      melee: p('KeyF') || tp('melee'),
      reload: p('KeyR') || tp('reload'),
      swap: p('KeyQ') || tp('swap'),
      interactPressed: p('KeyE') || tp('interact'),
      interactHeld: k('KeyE') || th('interact'),
      throwN: p('KeyG') || tp('noise'),
      heal: p('KeyH') || tp('heal'),
      command: p('KeyC') || tp('command'),
      sprint: k('ShiftLeft') || k('ShiftRight') || I.sprintToggle || Math.hypot(I.touch.move.x, I.touch.move.y) > 0.94,
      drop: p('KeyX') || tp('drop'),
      alt: [p('Digit1') || tp('alt1'), p('Digit2') || tp('alt2'), p('Digit3') || tp('alt3')],
      // the prompts on screen are last frame's candidates: carry their ids so a press runs the action that was shown
      primaryId: DH.Interact && DH.Interact.primary ? DH.Interact.primary.id : null,
      altIds: DH.Interact && DH.Interact.alts ? DH.Interact.alts.map((a) => a.id) : [],
      depart: p('Enter') || tp('depart'),
      recover: p('KeyV') || tp('recover'),
      drive: { throttle: 0, brake: 0, steer: 0, handbrake: false },
    };
    // driving
    if (inTruck) {
      const t = intent.drive;
      t.throttle = (k('KeyW') || k('ArrowUp') || th('gas')) ? 1 : 0;
      t.brake = (k('KeyS') || k('ArrowDown') || th('brake')) ? 1 : 0;
      t.steer = ((k('KeyD') || k('ArrowRight') || th('right')) ? 1 : 0) - ((k('KeyA') || k('ArrowLeft') || th('left')) ? 1 : 0);
      t.handbrake = k('Space') || th('handbrake');
      intent.interactPressed = p('KeyE') || tp('exit') || tp('interact');
    }
    // aiming
    if (run && !inTruck) {
      if (I.mode === 'touch') {
        const a = I.touch.aim;
        const mag = Math.hypot(a.x, a.y);
        if (a.active && mag > 0.22) {
          const w = DH.iso.inputToWorld(a.x, a.y);
          intent.aimDir = Math.atan2(w.y, w.x);
          I.lastAimDir = intent.aimDir;
          intent.fire = mag > 0.62;
          intent.firePressed = intent.fire && !I._wasFiring;
        }
        I._wasFiring = intent.fire;
      } else if (DH.R && DH.R.Wb) {
        const zt = DH.R.pickZombie(I.mouse.x, I.mouse.y);
        intent.aimZombie = zt;
        intent.aimWorld = zt ? { x: zt.x, y: zt.y } : DH.R.screenToWorld(I.mouse.x, I.mouse.y, 1.15);
        intent.fire = I.mouse.down;
        intent.firePressed = p('Mouse0');
      }
    }
    if (consume) I.pressed.clear();
    return intent;
  };
})();
