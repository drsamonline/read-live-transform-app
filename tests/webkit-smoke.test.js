'use strict';
/**
 * Read. Live. Transform. - headless DOM smoke suite.
 *
 * Drives the real app in happy-dom and asserts that progress persists through
 * web-kit's Loom.storage, that the app's own store API (load/save/s) is
 * unchanged, and that progress saved *before* the retrofit (the legacy
 * `rlt.v2` key) is migrated into Loom.storage with no data loss.
 *
 *   node tests/webkit-smoke.test.js [path-to-index.html]
 */
const fs = require('fs');
const path = require('path');
const { Window } = require('happy-dom');

const root = path.join(__dirname, '..');
const file = process.argv[2] || path.join(root, 'index.html');
const html = fs.readFileSync(file, 'utf8');
const wkPath = path.join(path.dirname(file), 'web-kit.js');
const wk = fs.existsSync(wkPath) ? fs.readFileSync(wkPath, 'utf8') : '';

// inline <script> blocks (the app), and the page with executable scripts stripped.
// The app's data lives in <script id="bookdata" type="application/json"> - keep it.
const jsonData = [...html.matchAll(/<script[^>]*type="application\/json"[^>]*>[\s\S]*?<\/script>/g)].map(m => m[0]);
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let htmlNoScripts = html.replace(/<script[\s\S]*?<\/script>/g, '');
htmlNoScripts = htmlNoScripts.replace('</body>', jsonData.join('\n') + '\n</body>');

const results = [];
const ok = (name, cond, extra = '') => results.push({ name, pass: !!cond, extra });

function boot(seed) {
  const w = new Window({ url: 'https://local.test/' });
  for (const [k, v] of Object.entries(seed || {})) { try { w.localStorage.setItem(k, v); } catch (e) {} }
  w.document.write(htmlNoScripts);
  if (wk) w.eval(wk);
  // the app's top-level bindings are lexical, so expose its store API on window
  // from within the same evaluation, then drive it through window.__store.
  w.eval(inline.join('\n') + '\n;window.__store = (typeof store !== "undefined") ? store : null;');
  return w;
}
function snapshot(w) {
  const out = {};
  for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); out[k] = w.localStorage.getItem(k); }
  return out;
}

(function main() {
  // 1. the app boots and renders
  let w = boot();
  ok('app rendered: web-kit loaded (Loom present)', w.eval('typeof Loom') === 'object');
  ok('app rendered: the view has content', w.document.getElementById('view') && w.document.getElementById('view').innerHTML.length > 0);
  ok('app exposes its own store API (load/save/s)', w.eval('typeof (window.__store && window.__store.load)') === 'function' && w.eval('typeof (window.__store && window.__store.save)') === 'function');

  // 2. progress is written to Loom.storage (namespaced), via the app's own API
  w.eval("window.__store.load(); window.__store.s.xp = 123; window.__store.s.streak = 4; window.__store.save();");
  const snap = snapshot(w);
  ok('progress is persisted under the Loom namespace (loom:rlt)', typeof snap['loom:rlt'] === 'string', JSON.stringify(Object.keys(snap)));
  ok('nothing is written to the raw legacy key on save', !('rlt.v2' in snap));

  // 3. it survives a reload
  let w2 = boot(snap);
  ok('xp persists across reload', w2.eval("window.__store.load().xp") === 123, String(w2.eval("window.__store.load().xp")));
  ok('streak persists across reload', w2.eval("window.__store.load().streak") === 4);

  // 4. progress saved BEFORE the retrofit (legacy key) is migrated, not lost
  const legacy = { 'rlt.v2': JSON.stringify({ read: { 1: true }, xp: 55, streak: 9 }) };
  let w3 = boot(legacy);
  ok('legacy progress is read after the retrofit (xp)', w3.eval("window.__store.load().xp") === 55, String(w3.eval("window.__store.load().xp")));
  ok('legacy progress is read after the retrofit (read map)', w3.eval("Object.keys(window.__store.load().read).length") === 1);
  const snap3 = snapshot(w3);
  ok('legacy key is migrated into Loom.storage', typeof snap3['loom:rlt'] === 'string');
  ok('legacy key is removed after migration', !('rlt.v2' in snap3));

  // 5. a fresh install starts clean
  let w4 = boot();
  ok('fresh install starts at xp 0', w4.eval("window.__store.load().xp") === 0);

  // 6. the export path, with NO kit.
  //
  //    This app was built without one, and its export has never been a file: the
  //    "Copy my practice" action builds a text summary and puts it on the
  //    clipboard. An export retrofit was later inlined here - which the estate's
  //    kit rule forbids, kits being one-way - and it brought with it a
  //    window.__exportAll hook that this suite then asserted against. Removing the
  //    retrofit removed the hook, so these assertions now check what the app
  //    actually does, and check that the kit has not crept back in.
  ok('export is the clipboard summary, not a file',
     /act==='export'/.test(html) && /navigator\.clipboard/.test(html));
  ok('...and the summary carries the practice, not just a name',
     html.indexOf('MY MOVES') !== -1 && /Rank \$\{/.test(html.replace(/\\/g, '')));
  ok('no export-kit is shipped in the page', html.indexOf('export-kit') === -1);

  let pass = 0, fail = 0;
  for (const r of results) {
    if (r.pass) { pass++; console.log('PASS  ' + r.name); }
    else { fail++; console.log('FAIL  ' + r.name + (r.extra ? '  ' + r.extra : '')); }
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
