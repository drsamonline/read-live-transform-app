'use strict';
/**
 * The service worker's own tests.
 *
 * The worker is the one part of this app that decides WHICH BUILD A VISITOR
 * SEES, so it is tested rather than trusted. sw.js is loaded into a fake
 * ServiceWorkerGlobalScope (addEventListener, caches, fetch are stubs) and
 * driven through its real handlers.
 *
 * The load-bearing assertion is the cache name: it must be derived from the
 * bytes of docs/play/index.html. If someone edits the app and does not bump it,
 * this suite fails — which is the only thing standing between "the fix is
 * deployed" and "every returning visitor is still on the old build".
 *
 *   node tests/sw.test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const swSrc = fs.readFileSync(path.join(root, 'docs', 'play', 'sw.js'), 'utf8');
const appBytes = fs.readFileSync(path.join(root, 'docs', 'play', 'index.html'));

let passed = 0, failed = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + (extra ? '  <- ' + extra : '')); }
};
// keep the output readable: a long value is reported by length, never pasted
const short = v => {
  const j = JSON.stringify(v);
  return j && j.length > 80 ? '<' + j.length + ' chars>' : j;
};
const eq = (name, actual, expected) =>
  ok(name + ' = ' + short(expected), JSON.stringify(actual) === JSON.stringify(expected),
    'got ' + short(actual));

/* ---------- a fake ServiceWorkerGlobalScope ---------- */
function makeScope(fetchImpl) {
  const store = new Map();          // url -> body, shared by every cache
  const names = new Set();
  const deleted = [];
  const handlers = {};

  const cacheObj = {
    addAll: assets => { assets.forEach(a => store.set(a, 'CACHED:' + a)); return Promise.resolve(); },
    put: (req, res) => { store.set(typeof req === 'string' ? req : req.url, res.body); return Promise.resolve(); },
    match: req => {
      const k = typeof req === 'string' ? req : req.url;
      return Promise.resolve(store.has(k) ? { url: k, body: store.get(k) } : undefined);
    }
  };
  const caches = {
    open: name => { names.add(name); return Promise.resolve(cacheObj); },
    match: req => {
      const k = typeof req === 'string' ? req : req.url;
      return Promise.resolve(store.has(k) ? { url: k, body: store.get(k) } : undefined);
    },
    keys: () => Promise.resolve([...names]),
    delete: name => { deleted.push(name); names.delete(name); return Promise.resolve(true); }
  };
  const self = {
    addEventListener: (t, fn) => { (handlers[t] = handlers[t] || []).push(fn); },
    skipWaiting: () => {},
    clients: { claim: () => Promise.resolve() }
  };

  const sandbox = { self, caches, fetch: r => fetchImpl(r), Promise, console, URL, Set, Map };
  vm.createContext(sandbox);
  vm.runInContext(swSrc, sandbox);

  return { handlers, store, names, deleted, seed: (u, b) => store.set(u, b) };
}

function fire(scope, type, event) {
  const ev = Object.assign({ _responded: undefined, _waited: undefined }, event);
  ev.respondWith = p => { ev._responded = p; };
  ev.waitUntil = p => { ev._waited = p; };
  (scope.handlers[type] || []).forEach(fn => fn(ev));
  return ev;
}

const CACHE_NAME = (swSrc.match(/const CACHE = '([^']+)'/) || [])[1];

/* ------------------------------------------------------------------ */
console.log('\nthe cache name is the app');

const expectedName = 'rlt-' + crypto.createHash('sha256').update(appBytes).digest('hex').slice(0, 8);
eq('the cache name is derived from docs/play/index.html', CACHE_NAME, expectedName);
ok('the cache name is not the old pinned one', CACHE_NAME !== 'rlt-b32da261',
  'still ' + CACHE_NAME);

/* ------------------------------------------------------------------ */
console.log('\na navigation is the latest build, not the cached one');

(async () => {
  // The scope root './' is exactly what install pre-caches, so this is the
  // navigation a returning visitor makes: if the worker is cache-first for it,
  // they get the OLD build forever.
  const up = makeScope(() => Promise.resolve({ url: './', body: 'NEW-BUILD', clone() { return this; } }));
  up.seed('./', 'OLD-BUILD');
  up.seed('./index.html', 'OLD-BUILD');
  const nav = fire(up, 'fetch', { request: { method: 'GET', mode: 'navigate', url: './' } });
  ok('a navigation is answered at all', !!nav._responded);
  const res = await nav._responded;
  eq('an online navigation gets the NETWORK build, not the cached one', res && res.body, 'NEW-BUILD');
  eq('the fresh build is written back to the cache', up.store.get('./index.html'), 'NEW-BUILD');

  const down = makeScope(() => Promise.reject(new Error('offline')));
  down.seed('./', 'OLD-BUILD');
  down.seed('./index.html', 'OLD-BUILD');
  const nav2 = fire(down, 'fetch', { request: { method: 'GET', mode: 'navigate', url: './' } });
  const res2 = await nav2._responded;
  eq('an offline navigation still opens the app from the cache', res2 && res2.body, 'OLD-BUILD');

  /* ------------------------------------------------------------------ */
  console.log('\nassets are cache first, writes are left alone');

  const a = makeScope(() => Promise.resolve({ url: 'x', body: 'NET', clone() { return this; } }));
  a.seed('./icon-192.png', 'CACHED-ICON');
  const asset = fire(a, 'fetch', { request: { method: 'GET', mode: 'cors', url: './icon-192.png' } });
  const res3 = await asset._responded;
  eq('a cached asset is served from the cache', res3 && res3.body, 'CACHED-ICON');

  const post = fire(a, 'fetch', { request: { method: 'POST', mode: 'navigate', url: './save' } });
  ok('a POST is not intercepted', post._responded === undefined);

  /* ------------------------------------------------------------------ */
  console.log('\ninstall and activate');

  const i = makeScope(() => Promise.resolve({}));
  const inst = fire(i, 'install', {});
  await inst._waited;
  ok('install pre-caches the app shell', i.store.has('./index.html') && i.store.has('./manifest.webmanifest'));

  const act = makeScope(() => Promise.resolve({}));
  act.names.add('rlt-b32da261');   // the cache the previous build left behind
  act.names.add(CACHE_NAME);
  const ac = fire(act, 'activate', {});
  await ac._waited;
  ok('activate deletes the cache the old build left', act.deleted.indexOf('rlt-b32da261') >= 0,
    'deleted ' + JSON.stringify(act.deleted));
  ok('activate keeps the current cache', act.deleted.indexOf(CACHE_NAME) === -1);

  /* ------------------------------------------------------------------ */
  console.log('\nthe two copies of the app');

  const rootHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const playHtml = fs.readFileSync(path.join(root, 'docs', 'play', 'index.html'), 'utf8');
  ok('index.html and docs/play/index.html are identical', rootHtml === playHtml,
    rootHtml.length + ' vs ' + playHtml.length + ' bytes');
  ok('sw.js and docs/play/sw.js are identical',
    fs.readFileSync(path.join(root, 'sw.js'), 'utf8') === swSrc);

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
