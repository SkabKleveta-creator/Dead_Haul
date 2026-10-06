// Loads the simulation sources into a Node context (no DOM) for deterministic tests.
const fs = require('fs'), path = require('path'), vm = require('vm');
const SIM = ['core', 'map', 'l1', 'l2', 'l3', 'l4', 'l5', 'story', 'nav', 'cargo', 'save', 'game', 'player', 'zombies', 'truck', 'survivor', 'world', 'interact'];
function load(opts) {
  const store = (opts && opts.store) || {};
  const fakeLS = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  let MathObj = Math;
  if (opts && opts.seedMath != null) { let st = (opts.seedMath * 2654435761) >>> 0 || 1; MathObj = Object.create(Math); MathObj.random = () => { st ^= st << 13; st >>>= 0; st ^= st >>> 17; st ^= st << 5; st >>>= 0; return st / 4294967296; }; }
  const ctx = { console, Math: MathObj, Date, JSON, Map, Set, Float32Array, Uint8Array, Int8Array, Int16Array, Int32Array, Uint32Array, Array, Object, Number, String, isFinite, Error };
  ctx.window = ctx;
  ctx.localStorage = (opts && opts.noStorage) ? undefined : fakeLS;
  if (opts && opts.noStorage) Object.defineProperty(ctx, 'localStorage', { get() { throw new Error('SecurityError'); } });
  vm.createContext(ctx);
  for (const f of SIM) if (fs.existsSync(path.join(__dirname, '../src', f + '.js'))) vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
  ctx.__store = store;
  return ctx;
}
function blankInput() { return { move: { x: 0, y: 0 }, aimWorld: null, aimDir: null, fire: false, firePressed: false, melee: false, reload: false, swap: false, interactPressed: false, interactHeld: false, throwN: false, heal: false, command: false, sprint: false, drop: false, alt: [false, false, false], drive: { throttle: 0, brake: 0, steer: 0, handbrake: false }, depart: false, recover: false }; }
module.exports = { load, blankInput };
