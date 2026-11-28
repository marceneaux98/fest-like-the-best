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
//   FIL.stages                    stages in display order: { id, name, color, ink, lat, lng } from locations.json (via routes.js)
//   FIL.stageById[id]
//   FIL.stageColor(id)            colour for a stage id (falls back to brand purple)
//   FIL.stageInk(id)              the same colour, darkened only as much as needed for white text to pass
//                                 WCAG AA (4.5:1): use it for fills that carry text (time bars, picked sets)
//   FIL.ready(fn)                 loads data/schedule.json (data/preview/… with ?preview=1) into
//                                 window.SCHEDULE_DATA and, on map pages, the traced map routes into
//                                 window.POSTER_ROUTES, then calls fn(). Pages wrap their code in this.
//   FIL.stamp(iso)                "Nov 16, 7:37 PM" in the current language, for "schedule updated" lines
//   FIL.timeRange(s, e)           "4–5:15 PM" from minutes since midnight (English drops the first AM/PM when both match)
//   FIL.plan.encode(edition, { picks, modes, merch, by }) / FIL.plan.decode(location.hash)
//                                 a whole plan in a share link (see "share links" below)
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

  // Poster colours like Fais Do Do orange are too light for small white text, so each stage also gets
  // an "ink" shade: the same hue, darkened step by step until white on it reaches 4.6:1.
  function inkOf(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return FALLBACK;
    var rgb = [0, 2, 4].map(function (i) { return parseInt(m[1].substr(i, 2), 16); });
    function lum(c) {
      var l = c.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
    }
    for (var k = 0; k <= 50; k++) {
      var d = rgb.map(function (v) { return Math.round(v * (1 - k / 50)); });
      if (1.05 / (lum(d) + 0.05) >= 4.6) return '#' + d.map(function (v) { return (v < 16 ? '0' : '') + v.toString(16); }).join('');
    }
    return '#000000';
  }
  var stages = (R && R.locations ? R.locations : []).map(function (l) {
    var color = l.color || FALLBACK;
    return { id: l.id, name: l.name, color: color, ink: inkOf(color), lat: l.lat, lng: l.lng };
  });
  var stageById = {};
  stages.forEach(function (s) { stageById[s.id] = s; });
  function stageColor(id) { return stageById[id] ? stageById[id].color : FALLBACK; }
  function stageInk(id) { return stageById[id] ? stageById[id].ink : FALLBACK; }

  // ---------- brand bar ----------
  var PAGES = [
    { id: 'lineup', href: 'lineup.html', key: 'nav_lineup', label: 'Lineup' },
    { id: 'itinerary', href: 'itinerary.html', key: 'nav_myday', label: 'My day' },
    { id: 'planner', href: 'planner.html', key: 'nav_map', label: 'Stage map' }
  ];
  // Preview strip: this is a prototype shared for feedback. The link opens the Monday feedback form and
  // tells it which page and language the person came from (hidden fields on the form).
  var FEEDBACK_URL = 'https://forms.monday.com/forms/d0d5bb45f9bd831a861b61a473bfdeea?r=use1';
  function feedbackHref(page) {
    var lang = window.I18N ? I18N.lang : 'en';
    return FEEDBACK_URL + '&page=' + encodeURIComponent(page || '') + '&lang=' + encodeURIComponent(lang);
  }
  function mountBrandBar() {
    document.querySelectorAll('.brand-bar[data-page]').forEach(function (bar) {
      if (bar.children.length) return;
      var current = bar.getAttribute('data-page');
      bar.innerHTML =
        '<p class="preview-note"><span data-i18n="preview_note">Preview · sample lineup from 2026</span> ' +
          '<a href="' + feedbackHref(current) + '" target="_blank" rel="noopener" data-i18n="preview_feedback">Tell us what you think</a></p>' +
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

  function timeRange(s, e) {
    var a = I18N.time(s, true), b = I18N.time(e, true);
    if (I18N.lang === 'en' && (s < 720) === (e < 720)) a = a.replace(/\s?(AM|PM)$/, '');
    return a + '–' + b;
  }

  // ---------- share links ----------
  // A patron's whole plan fits in the part of the link after '#', which browsers never send to a
  // server: nothing is stored online, and the link itself is the backup. Example:
  //   itinerary.html#e=2026&p=0423faisdodo1830.0423lafayette2000&o=0~1~h&m=0423~b~merch-pavillon&by=Sam
  //   e  edition (year); set ids are '<year>-<MM>-<DD>-<stage>-<HHMM>', so only MMDD+stage+HHMM is kept
  //   p  picks, '.'-separated
  //   o  overlap choices: pick index ~ pick index ~ e (leave early) | h (split) | s (stay to the end)
  //   m  shopping stop per day: MMDD~n (no thanks) | MMDD~b|a~shop (before first / after last set)
  //      | MMDD~i_j~shop (between picks i and j)
  //   by optional first name, shown to whoever opens the link
  // Only unreserved URL characters are used, so mail and chat apps keep the link in one piece.
  var MODE_CODE = { early: 'e', split: 'h', end: 's' }, CODE_MODE = { e: 'early', h: 'split', s: 'end' };
  var SLOT_CODE = { before: 'b', after: 'a' }, CODE_SLOT = { b: 'before', a: 'after' };
  function mmdd(date) { return date.slice(5, 7) + date.slice(8, 10); }
  function encodePlan(edition, plan) {
    var ids = plan.picks.slice().sort(), idx = {};
    ids.forEach(function (id, i) { idx[id] = i; });
    var p = ids.map(function (id) { var m = /^\d{4}-(\d\d)-(\d\d)-(.+)-(\d{4})$/.exec(id); return m[1] + m[2] + m[3] + m[4]; });
    var o = [];
    Object.keys(plan.modes || {}).forEach(function (k) {
      var ab = k.split('>');
      if (idx[ab[0]] != null && idx[ab[1]] != null && MODE_CODE[plan.modes[k]]) o.push(idx[ab[0]] + '~' + idx[ab[1]] + '~' + MODE_CODE[plan.modes[k]]);
    });
    var days = {}; ids.forEach(function (id) { days[id.slice(0, 10)] = 1; });
    var m = [];
    Object.keys(plan.merch || {}).forEach(function (date) {
      var c = plan.merch[date];
      if (!days[date] || !c) return;
      if (c === 'none') { m.push(mmdd(date) + '~n'); return; }
      var slot = SLOT_CODE[c.slot];
      if (!slot) { var ab = c.slot.split('>'); if (idx[ab[0]] == null || idx[ab[1]] == null) return; slot = idx[ab[0]] + '_' + idx[ab[1]]; }
      m.push(mmdd(date) + '~' + slot + '~' + c.booth);
    });
    var h = 'e=' + edition + '&p=' + p.join('.');
    if (o.length) h += '&o=' + o.join('.');
    if (m.length) h += '&m=' + m.join('.');
    var by = (plan.by || '').trim().slice(0, 30);
    if (by) h += '&by=' + encodeURIComponent(by);
    return h;
  }
  // -> null if the text isn't a plan link, else { edition, picks, modes, merch, by }
  function decodePlan(hash) {
    var q = {};
    String(hash || '').replace(/^#/, '').split('&').forEach(function (kv) {
      var i = kv.indexOf('='); if (i > 0) q[kv.slice(0, i)] = kv.slice(i + 1);
    });
    if (!/^\d{4}$/.test(q.e || '') || q.p == null) return null;
    var e = q.e, picks = [];
    q.p.split('.').forEach(function (t) {
      var m = /^(\d\d)(\d\d)([a-z0-9-]+?)(\d{4})$/.exec(t);
      if (m) picks.push(e + '-' + m[1] + '-' + m[2] + '-' + m[3] + '-' + m[4]);
    });
    var modes = {};
    (q.o || '').split('.').forEach(function (t) {
      var a = t.split('~');
      if (a.length === 3 && picks[a[0]] && picks[a[1]] && CODE_MODE[a[2]]) modes[picks[a[0]] + '>' + picks[a[1]]] = CODE_MODE[a[2]];
    });
    var merch = {};
    (q.m || '').split('.').forEach(function (t) {
      var a = t.split('~');
      if (!/^\d{4}$/.test(a[0] || '')) return;
      var date = e + '-' + a[0].slice(0, 2) + '-' + a[0].slice(2);
      if (a[1] === 'n') { merch[date] = 'none'; return; }
      if (a.length !== 3 || !a[2]) return;
      var slot = CODE_SLOT[a[1]];
      if (!slot) { var ij = a[1].split('_'); if (!picks[ij[0]] || !picks[ij[1]]) return; slot = picks[ij[0]] + '>' + picks[ij[1]]; }
      merch[date] = { slot: slot, booth: a[2] };
    });
    var by = '';
    try { by = decodeURIComponent(q.by || '').trim().slice(0, 30); } catch (err) {}
    return { edition: e, picks: picks, modes: modes, merch: merch, by: by };
  }

  window.FIL = { esc: esc, toMin: toMin, store: store, stages: stages, stageById: stageById, stageColor: stageColor, stageInk: stageInk,
                 ready: ready, stamp: stamp, timeRange: timeRange, plan: { encode: encodePlan, decode: decodePlan } };
})();
