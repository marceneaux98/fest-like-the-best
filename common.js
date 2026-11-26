// Fest like the Best — shared helpers for every page.
//
// Load order on each page: i18n.js, routes.js (and schedule.js where needed), then this file,
// then the page's own script. Exposes window.FIL:
//
//   FIL.esc(text)                 HTML-escape text before putting it in innerHTML
//   FIL.toMin('19:45')            clock string -> minutes since midnight
//   FIL.store.get(key, fallback)  JSON read from localStorage (never throws)
//   FIL.store.set(key, value)     JSON write
//   FIL.store.raw(key) / FIL.store.setRaw(key, value)   plain strings
//   FIL.stages                    stages in display order: { id, name, color, lat, lng } from locations.json (via routes.js)
//   FIL.stageById[id]
//   FIL.stageColor(id)            colour for a stage id (falls back to brand purple)
//   FIL.ready(fn)                 loads data/schedule.json (data/preview/… with ?preview=1) into
//                                 window.SCHEDULE_DATA and, on map pages, the traced map routes into
//                                 window.POSTER_ROUTES, then calls fn(). Pages wrap their code in this.
//   FIL.stamp(iso)                "Nov 16, 7:37 PM" in the current language, for "schedule updated" lines
//
// The brand bar (logo, product name, page links) is built here from a placeholder:
//   <div class="brand-bar" data-page="lineup"></div>
// so the three pages share one copy. i18n.js fills in the link text and adds the language menu.
(function () {
  var R = window.ROUTE_DATA;
  var FALLBACK = '#542e91';

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function toMin(t) { var a = t.split(':'); return +a[0] * 60 + +a[1]; }

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    raw: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    setRaw: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  var stages = (R && R.locations ? R.locations : []).map(function (l) {
    return { id: l.id, name: l.name, color: l.color || FALLBACK, lat: l.lat, lng: l.lng };
  });
  var stageById = {};
  stages.forEach(function (s) { stageById[s.id] = s; });
  function stageColor(id) { return stageById[id] ? stageById[id].color : FALLBACK; }

  // ---------- brand bar ----------
  var PAGES = [
    { id: 'lineup', href: 'lineup.html', key: 'nav_lineup', label: 'Lineup' },
    { id: 'itinerary', href: 'itinerary.html', key: 'nav_myday', label: 'My day' },
    { id: 'planner', href: 'planner.html', key: 'nav_map', label: 'Stage map' }
  ];
  function mountBrandBar() {
    document.querySelectorAll('.brand-bar[data-page]').forEach(function (bar) {
      if (bar.children.length) return;
      var current = bar.getAttribute('data-page');
      bar.innerHTML =
        '<a class="brand-logo" href="lineup.html"><img src="assets/logo.png" alt="Festival International de Louisiane, presented by LFT Fiber"></a>' +
        '<span class="brand-tag">Fest like the Best</span>' +
        '<nav class="brand-nav" aria-label="Pages">' +
        PAGES.map(function (p) {
          return '<a href="' + p.href + '"' + (p.id === current ? ' aria-current="page"' : '') +
            ' data-i18n="' + p.key + '">' + p.label + '</a>';
        }).join('') +
        '</nav>';
    });
  }
  mountBrandBar();

  // ---------- schedule data ----------
  // The schedule is a JSON file written by build_feed.py, fetched at runtime so data and code can
  // change independently. ?preview=1 reads the local preview build (never on the public site).
  var preview = /[?&]preview=1\b/.test(location.search);
  var DATA_URL = (preview ? 'data/preview/' : 'data/') + 'schedule.json';
  var loading = null;
  function ready(fn) {
    if (!loading) {
      var schedule = fetch(DATA_URL, { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
        return r.json();
      }).then(function (d) { window.SCHEDULE_DATA = d; }, function (err) {
        window.SCHEDULE_DATA = null;
        window.SCHEDULE_ERROR = DATA_URL + ' — ' + (err && err.message || err);
      });
      // Pages with the festival map (overlay.js loaded) also need the routes traced on it.
      var routes = window.OVERLAY_CONFIG && window.OVERLAY_CONFIG.routes
        ? fetch(window.OVERLAY_CONFIG.routes, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) { window.POSTER_ROUTES = d; }, function () { window.POSTER_ROUTES = null; })
        : Promise.resolve();
      loading = Promise.all([schedule, routes]);
    }
    loading.then(fn);
  }
  var stampFmt = null;
  function stamp(iso) {
    if (!iso) return '';
    if (!stampFmt) stampFmt = new Intl.DateTimeFormat(window.I18N ? I18N.locale : undefined,
      { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    return stampFmt.format(new Date(iso));
  }

  window.FIL = { esc: esc, toMin: toMin, store: store, stages: stages, stageById: stageById, stageColor: stageColor,
                 ready: ready, stamp: stamp };
})();
