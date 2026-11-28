// Fest like the Best — offline support (service worker).
//
// After a patron's first visit the whole site is kept on their phone (about 0.6 MB compressed), so it
// opens with no signal on the festival grounds. common.js registers this file.
//
//   Schedule + map data (data/*.json, assets/poster-routes.json): network first, so changes on the day
//     (weather, set times) show up; if there is no answer within a few seconds the saved copy is used
//     and marked with an X-FIL-Saved header (the time it was saved), which the pages show as a note.
//   Everything else (pages, scripts, styles, the map, icons, fonts, artist photos): the saved copy
//     straight away, refreshed in the background, so the next visit has the newest version.
//   Not handled: tools/ (the route editor and other maintenance pages), data/preview/, anything that
//     is not a GET, and other websites apart from the map library and the fonts.
//
// When you add a file every page needs, add it to CORE and raise VERSION; old saved copies are then
// cleared the next time the patron opens the site with signal. Editing an existing file needs neither.
var VERSION = 'fil-v1';
var CORE = [
  './', 'index.html', 'lineup.html', 'itinerary.html', 'planner.html', 'print.html',
  'brand.css', 'i18n.js', 'routes.js', 'common.js', 'artist.js', 'overlay.js', 'site-overlay.js',
  'data/schedule.json', 'data/artists.json', 'assets/poster-routes.json', 'assets/sitemap.svg',
  'assets/logo.png', 'assets/swirl.png', 'manifest.json', 'assets/icons/icon-192.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
];
var OTHER_SITES = /^https:\/\/(cdnjs\.cloudflare\.com\/ajax\/libs\/leaflet\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/)/;
var NETWORK_WAIT = 3500; // ms to wait for fresh schedule data before using the saved copy

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (cache) {
    // One by one, so a single missing file doesn't stop the rest from being saved.
    return Promise.all(CORE.map(function (url) {
      return fetch(new Request(url, { cache: 'reload' })).then(function (r) {
        if (r.ok) return cache.put(url, r);
      }).catch(function () {});
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('fil-') === 0 && k !== VERSION; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// The pages send the files they loaded before this worker took over (fonts, photos), to save them too.
self.addEventListener('message', function (e) {
  var d = e.data || {};
  if (d.type !== 'save' || !Array.isArray(d.urls)) return;
  e.waitUntil(caches.open(VERSION).then(function (cache) {
    return Promise.all(d.urls.filter(handled).map(function (url) {
      return cache.match(url).then(function (hit) {
        if (hit) return;
        return fetch(url, { mode: sameSite(url) ? 'same-origin' : 'cors' }).then(function (r) {
          if (r.ok) return cache.put(url, r);
        }).catch(function () {});
      });
    }));
  }));
});

function sameSite(url) { return url.indexOf(self.registration.scope) === 0; }
function handled(url) {
  if (sameSite(url)) {
    var path = url.slice(self.registration.scope.length).split(/[?#]/)[0];
    return !/^(tools|data\/preview|tests|\.)/.test(path) && path !== 'sw.js';
  }
  return OTHER_SITES.test(url);
}
// Pages are saved without their ?lang=… / ?day=… part, so one saved copy serves every variant.
function key(req) {
  if (req.mode === 'navigate' || /\.html$|\/$/.test(req.url.split('?')[0])) return req.url.split('?')[0];
  return req.url;
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || !handled(req.url)) return;
  var path = sameSite(req.url) ? req.url.slice(self.registration.scope.length).split('?')[0] : '';
  if (/^data\/[^/]+\.json$|^assets\/poster-routes\.json$/.test(path)) e.respondWith(networkFirst(req, e));
  else e.respondWith(savedFirst(req, e));
});

function save(k, r) {
  if (!r || !r.ok) return Promise.resolve();
  var copy = r.clone();
  return caches.open(VERSION).then(function (cache) { return cache.put(k, copy); });
}

// Each strategy starts the network request and registers saving it (e.waitUntil) straight away, so the
// copy is saved even when the page was already answered from the saved one.
function fetchAndSave(req, k, e) {
  var fresh = fetch(req);
  e.waitUntil(fresh.then(function (r) { return save(k, r); }).catch(function () {}));
  return fresh;
}

function savedFirst(req, e) {
  var k = key(req), fresh = fetchAndSave(req, k, e);
  return caches.match(k).then(function (hit) {
    if (hit) return hit;
    return fresh.catch(function () {
      // Offline and never saved: for a page, fall back to the Lineup page rather than an error.
      return req.mode === 'navigate'
        ? caches.match(self.registration.scope + 'lineup.html').then(function (r) { return r || Response.error(); })
        : Response.error();
    });
  });
}

function networkFirst(req, e) {
  var k = req.url.split('?')[0];
  var fresh = fetchAndSave(req, k, e);
  var fallback = new Promise(function (resolve) {
    var timer = setTimeout(resolve, NETWORK_WAIT);
    fresh.catch(function () { clearTimeout(timer); resolve(); });
  }).then(function () {
    return caches.match(k).then(function (hit) {
      if (!hit) return fresh;   // nothing saved yet: keep waiting for the network
      var h = new Headers(hit.headers);
      h.set('X-FIL-Saved', hit.headers.get('Date') || '');
      return hit.blob().then(function (b) { return new Response(b, { status: 200, headers: h }); });
    });
  });
  return Promise.race([fresh.then(function (r) { return r.ok ? r : fallback; }, function () { return fallback; }), fallback]);
}
