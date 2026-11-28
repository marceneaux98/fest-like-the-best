// Fest like the Best — the "About this artist" sheet: photo, name, origin, genre, bio, links, the
// artist's other shows and an add/remove-from-plan button. A bottom sheet on phones, a dialog on
// wider screens (styles: .artist-sheet in brand.css). Shared by lineup.html and itinerary.html.
//
// Load after common.js. Exposes FIL.artist:
//   FIL.artist.setup({ perfs, isPicked(id), toggle(id) })
//                         once the schedule has loaded; perfs need .s/.e (minutes since midnight).
//                         toggle(id) is the page's own add/remove (lineup's asks "switch / keep both").
//   FIL.artist.has(p)     true when the performance has an artist to show (named events don't)
//   FIL.artist.button(p, cls)   HTML for the "Bio" button (artist icon + label) that opens the sheet ('' when !has(p)).
//                               Pages hide the .lbl text where there is no room; the icon and aria-label stay.
//   FIL.artist.open(id)   show the sheet for a performance id
//   FIL.artist.refresh()  update the open sheet after the plan changed (pages call it after redrawing)
//
// Any element with data-info="<performance id>" opens the sheet when clicked, so pages only add the
// attribute (button() does). Closing puts keyboard focus back on that element without scrolling.
// Artist details come from data/artists.json (data/preview/… with ?preview=1), fetched once.
(function () {
  var esc = FIL.esc;
  function T(k, v) { return I18N.t(k, v); }
  var preview = /[?&]preview=1\b/.test(location.search);
  var DATA_URL = (preview ? 'data/preview/' : 'data/') + 'artists.json';
  // Photos are files the feed wrote; anything else in the data is ignored.
  var PHOTO_PATH = /^(assets\/artists|data\/preview\/artists)\/[A-Za-z0-9_.-]+$/;

  var cfg = null, byId = {}, artists = null, loading = null;
  var dlg = null, current = null, shownPicked = null;

  var ICON = {
    // A person (the artist), not an "i": patrons read the circled i as a status mark, not as "about the artist"
    info: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="3.8"/><path d="M4.8 20.2c.9-3.9 3.8-6 7.2-6s6.3 2.1 7.2 6"/></svg>',
    website: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.3 6.7v.1" stroke-linecap="round" stroke-width="2.6"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M14.5 21v-7.5H17l.5-3.5h-3V7.8c0-1 .4-1.8 1.8-1.8h1.4V3.1A16 16 0 0 0 15.5 3c-2.7 0-4.4 1.6-4.4 4.6V10H8.5v3.5h2.6V21z"/></svg>',
    video: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="2.5" y="5" width="19" height="14" rx="4"/><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor"/></svg>'
  };
  var LINKS = [['website', 'art_website'], ['instagram', 'art_instagram'], ['facebook', 'art_facebook'], ['video', 'art_video']];

  function load() {
    if (!loading) {
      loading = fetch(DATA_URL, { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (d) { artists = (d && d.artists) || {}; }, function () { artists = null; });
    }
    return loading;
  }

  function setup(opts) {
    cfg = opts;
    byId = {};
    opts.perfs.forEach(function (p) { byId[p.id] = p; });
    load(); // small file; fetched now so the first tap opens the sheet at once
  }

  function has(p) { return !!(p && p.artists && p.artists.length); }

  function button(p, cls) {
    if (!has(p)) return '';
    var label = esc(T('art_about', { act: p.act }));
    return '<button type="button" class="info-btn' + (cls ? ' ' + cls : '') + '" data-info="' + esc(p.id) + '"' +
      ' aria-haspopup="dialog" aria-label="' + label + '" title="' + label + '">' + ICON.info +
      '<span class="lbl" aria-hidden="true">' + esc(T('art_bio_btn')) + '</span></button>';
  }

  // ---------- pieces of the sheet ----------
  function isHttp(u) { return typeof u === 'string' && /^https?:\/\//i.test(u); }
  function whenText(q) {
    var st = FIL.stageById[q.stage];
    return I18N.weekdayShort(q.date) + ' ' + I18N.monthDay(q.date) + ' · ' + FIL.timeRange(q.s, q.e) +
      (st ? ' · ' + st.name : '');
  }
  function sortByTime(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.s - b.s; }
  // The same artist's other performances (shared artist id; same name for entries without one)
  function otherShows(p) {
    var ids = p.artists || [];
    return cfg.perfs.filter(function (q) {
      if (q.id === p.id) return false;
      return ids.length ? (q.artists || []).some(function (a) { return ids.indexOf(a) >= 0; }) : q.act === p.act;
    }).sort(sortByTime);
  }
  function initials(name) {
    var words = String(name).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
    return words.slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('');
  }
  function placeholder(name) {
    return '<div class="as-photo as-ph" aria-hidden="true"><span>' + esc(initials(name)) + '</span></div>';
  }
  function photoHTML(a, name) {
    if (a && PHOTO_PATH.test(a.photo || '')) {
      return '<div class="as-photo"><img src="' + esc(a.photo) + '" alt="' + esc(T('art_photo_alt', { name: a.name || name })) +
        '" decoding="async"></div>';
    }
    return placeholder(name);
  }
  function bioHTML(text) {
    if (!text) return '<p class="as-nobio">' + esc(T('art_no_bio')) + '</p>';
    var paras = String(text).split(/\n\s*\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    var note = I18N.lang !== 'en' ? '<p class="as-bio-note">' + esc(T('art_bio_en')) + '</p>' : '';
    return note + '<div class="as-bio" lang="en">' + paras.map(function (s) {
      return '<p>' + linkify(esc(s)).replace(/\n/g, '<br>') + '</p>';
    }).join('') + '</div>';
  }
  // Web addresses written in a bio ("Read more… https://…") become links. Works on escaped text,
  // so only http(s) addresses match and nothing can break out of the href.
  function linkify(html) {
    return html.replace(/https?:\/\/[^\s<]+/gi, function (u) {
      var tail = (u.match(/(?:[.,;:!?)\]]|&quot;)+$/) || [''])[0];
      u = u.slice(0, u.length - tail.length);
      return '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + u + '</a>' + tail;
    });
  }
  function linksHTML(links) {
    links = links || {};
    var items = LINKS.filter(function (l) { return isHttp(links[l[0]]); }).map(function (l) {
      return '<li><a href="' + esc(links[l[0]]) + '" target="_blank" rel="noopener noreferrer">' + ICON[l[0]] +
        '<span>' + esc(T(l[1])) + '</span><span class="as-vh"> (' + esc(T('art_new_tab')) + ')</span></a></li>';
    });
    return items.length ? '<ul class="as-links" aria-label="' + esc(T('art_links')) + '">' + items.join('') + '</ul>' : '';
  }
  function metaText(a, p) {
    var bits = [];
    if (a && a.origin) bits.push(a.origin); else if (!a && p.origin) bits.push(p.origin);
    if (a && a.genre) bits.push(a.genre);
    return bits.join(' · ');
  }
  function chip() { return '<span class="as-chip">✓ ' + esc(T('art_in_plan')) + '</span>'; }
  function alsoHTML(p) {
    return otherShows(p).map(function (q) {
      return '<li><span>' + esc(whenText(q)) + '</span>' + (cfg.isPicked(q.id) ? chip() : '') + '</li>';
    }).join('');
  }

  function build() {
    var p = byId[current];
    var list = (p.artists || []).map(function (id) { return artists && artists[id]; }).filter(Boolean);
    var first = list[0] || null;
    var withPhoto = list.filter(function (a) { return PHOTO_PATH.test(a.photo || ''); })[0] || first;
    var h = photoHTML(withPhoto, p.act) + '<div class="as-body">' +
      '<h2 id="asTitle">' + esc(p.act) + '</h2>';
    var meta = list.length > 1 ? (p.origin || '') : metaText(first, p);
    if (meta) h += '<p class="as-meta">' + esc(meta) + '</p>';
    h += '<p class="as-when"><span>' + esc(whenText(p)) + '</span><span id="asState"></span></p>';

    if (!artists) {
      h += '<p class="as-nobio">' + esc(T('art_unavailable')) + '</p>';
    } else if (list.length > 1) {   // a shared bill: one block per artist
      list.forEach(function (a) {
        var m = metaText(a, p);
        h += '<section class="as-part"><h3>' + esc(a.name) + '</h3>' + (m ? '<p class="as-meta">' + esc(m) + '</p>' : '') +
          bioHTML(a.bio) + linksHTML(a.links) + '</section>';
      });
    } else {
      h += bioHTML(first && first.bio) + linksHTML(first && first.links);
    }
    if (otherShows(p).length) {
      h += '<section class="as-also" aria-labelledby="asAlsoTitle"><h3 id="asAlsoTitle">' + esc(T('art_also')) + '</h3>' +
        '<ul id="asAlso"></ul></section>';
    }
    h += '</div>';

    var scroll = dlg.querySelector('.as-scroll');
    scroll.innerHTML = h;
    scroll.scrollTop = 0;
    dlg.style.setProperty('--stage', FIL.stageColor(p.stage));
    var img = scroll.querySelector('.as-photo img');
    if (img) img.addEventListener('error', function () {   // a missing file looks like no photo, not a broken one
      img.parentNode.outerHTML = placeholder(p.act);
    });
    document.getElementById('asLive').textContent = '';
    shownPicked = null;
    refresh();
  }

  // The parts that change when the plan changes: the "in your plan" chip, the button, the other shows.
  function refresh() {
    if (!dlg || !dlg.open || !current || !byId[current]) return;
    var p = byId[current], on = cfg.isPicked(p.id);
    document.getElementById('asState').innerHTML = on ? chip() : '';
    var also = document.getElementById('asAlso');
    if (also) also.innerHTML = alsoHTML(p);
    var btn = document.getElementById('asToggle');
    btn.textContent = T(on ? 'art_remove' : 'art_add');
    btn.classList.toggle('on', on);
    if (shownPicked !== null && shownPicked !== on) {
      document.getElementById('asLive').textContent = T(on ? 'art_added' : 'art_removed');
    }
    shownPicked = on;
  }

  function mount() {
    dlg = document.createElement('dialog');
    dlg.className = 'artist-sheet';
    dlg.setAttribute('aria-labelledby', 'asTitle');
    // Close comes first so it gets the focus when the sheet opens (not a link halfway down the bio).
    dlg.innerHTML =
      '<button type="button" class="as-close" aria-label="' + esc(T('art_close')) + '" title="' + esc(T('art_close')) + '">' +
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<div class="as-scroll"></div>' +
      '<div class="as-foot"><button type="button" class="as-toggle" id="asToggle"></button>' +
        '<p class="as-vh" id="asLive" role="status"></p></div>';
    document.body.appendChild(dlg);
    dlg.querySelector('.as-close').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); }); // tap outside the sheet
    document.getElementById('asToggle').addEventListener('click', function () {
      if (!current) return;
      cfg.toggle(current);
      refresh(); // the page usually calls this too; harmless twice
    });
    dlg.addEventListener('close', function () {
      var id = current;
      current = null;
      // The page may have redrawn while the sheet was open: focus the button for this show again.
      var back = id && document.querySelector('[data-info="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
      if (back) back.focus({ preventScroll: true });
    });
  }

  function open(id) {
    if (!cfg || !byId[id]) return;
    if (!dlg) mount();
    current = id;
    load().then(function () {
      if (current !== id) return;
      build();
      if (!dlg.open) {
        if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      }
      refresh();
    });
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-info]');
    if (!b || (dlg && dlg.contains(b))) return;
    e.preventDefault();
    open(b.getAttribute('data-info'));
  });

  FIL.artist = { setup: setup, has: has, button: button, open: open, refresh: refresh, icon: ICON.info };
})();
