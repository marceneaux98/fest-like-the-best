// The festival map (used by planner.html and itinerary.html).
// Needs: Leaflet, i18n.js and overlay.js (window.OVERLAY_CONFIG) loaded first, and
// window.POSTER_ROUTES (assets/poster-routes.json, loaded by FIL.ready in common.js).
//
// The map IS the festival's illustrated site map (assets/sitemap.svg), shown upright as printed,
// with pan and zoom. There are no street tiles. Pins and routes are placed in poster coordinates
// (points on the 774 x 603 page): Leaflet's "simple" coordinate system with lat = -y, lng = x.
//
//   var sm = SiteMap.create('map', { layersBox, status });
//   sm.map                      the Leaflet map
//   sm.pt(stageId)              LatLng of a stage's pin
//   sm.shape(a, b)              { lines: [[LatLng…]], hops: [[LatLng, LatLng]…], all: [LatLng…] }
//                               lines = route along the drawn streets (solid), hops = pin <-> street (dotted)
//   SiteMap.join(s1, s2)        one shape from two (a merch detour)
//   sm.draw(shape, group, opts) draws a shape into a layer group; returns a FeatureGroup of the solid
//                               lines (for highlighting / fitting)
(function () {
  var style = document.createElement('style');
  style.textContent =
    '.site-map{background:#162061}' +
    '.map-layers{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:8px}' +
    '.map-layers label{display:inline-flex;align-items:center;gap:5px;font-size:.82rem;color:var(--ink,#1c1b22);cursor:pointer;text-transform:none;letter-spacing:0;margin:0}' +
    '.map-layers input{accent-color:var(--fil-purple,#542e91);width:15px;height:15px;margin:0}';
  document.head.appendChild(style);

  var LAYERS = ['streets', 'zones', 'features', 'labels', 'legend', 'logo'];
  var DEFAULT_LAYERS = { streets: true, zones: true, features: true, labels: true, legend: false, logo: false };

  function msg(key, vars) { return window.I18N ? I18N.t(key, vars) : key; }
  function recallJSON(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function create(el, ui) {
    ui = ui || {};
    var OC = window.OVERLAY_CONFIG, PR = window.POSTER_ROUTES || { routes: {}, entrances: {} };
    var W = OC.width, H = OC.height;
    function ll(p) { return L.latLng(-p[1], p[0]); }        // poster point [x, y] -> LatLng
    var bounds = L.latLngBounds([[-H, 0], [0, W]]);

    var map = L.map(el, { crs: L.CRS.Simple, zoomSnap: 0.25, zoomDelta: 0.5, minZoom: -3, maxZoom: 3,
                          attributionControl: false, maxBounds: bounds.pad(0.25), maxBoundsViscosity: 0.9 });
    map.getContainer().classList.add('site-map');
    map.createPane('sitemap');
    map.getPane('sitemap').style.zIndex = 350;              // below routes (400) and pins (600)
    map.getPane('sitemap').style.pointerEvents = 'none';
    function fitAll() {
      map.fitBounds(bounds, { padding: [8, 8] });
      map.setMinZoom(map.getZoom() - 0.5);
    }
    fitAll();

    // ---------- the illustration ----------
    var svgEl = null;
    var layersOn = recallJSON('fil-maplayers', null) || DEFAULT_LAYERS;
    function applyLayers() {
      if (!svgEl) return;
      LAYERS.forEach(function (name) {
        var g = svgEl.querySelector('#layer-' + name);
        if (g) g.style.display = layersOn[name] === false ? 'none' : '';
      });
    }
    if (ui.status) ui.status.textContent = msg('overlay_loading');
    fetch(OC.svg).then(function (r) {
      if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
      return r.text();
    }).then(function (text) {
      var doc = new DOMParser().parseFromString(text, 'image/svg+xml');
      if (!doc.documentElement || doc.documentElement.nodeName.toLowerCase() !== 'svg') throw new Error('not an SVG');
      svgEl = document.importNode(doc.documentElement, true);
      svgEl.setAttribute('preserveAspectRatio', 'none');
      L.svgOverlay(svgEl, bounds, { pane: 'sitemap', interactive: false }).addTo(map);
      applyLayers();
      if (ui.status) ui.status.textContent = msg('overlay_note');
    }).catch(function (err) {
      if (ui.status) ui.status.textContent = msg('overlay_fail', { err: err && err.message || err });
    });

    if (ui.layersBox) {
      ui.layersBox.classList.add('map-layers');
      LAYERS.forEach(function (name) {
        var l = document.createElement('label'), cb = document.createElement('input');
        cb.type = 'checkbox'; cb.checked = layersOn[name] !== false; cb.dataset.layer = name;
        cb.addEventListener('change', function () { layersOn[name] = cb.checked; store('fil-maplayers', layersOn); applyLayers(); });
        l.appendChild(cb); l.appendChild(document.createTextNode(msg('layer_' + name)));
        ui.layersBox.appendChild(l);
      });
    }

    // ---------- pins and routes ----------
    // Pins placed in the route editor (poster-routes.json) win over the defaults in overlay.js.
    function pinPoint(id) {
      if (PR.pins && PR.pins[id]) return PR.pins[id];
      var f = OC.stages[id] || [0.5, 0.5]; return [f[0] * W, f[1] * H];
    }
    function pt(id) { return ll(pinPoint(id)); }
    // A route runs between the two stages' entrances (a stage can have several; the route file already
    // picked the pair with the shortest walk). The dotted hops join each pin to the route's ends.
    function shape(a, b) {
      if (a === b) return { lines: [], hops: [], all: [] };
      var pts = PR.routes && PR.routes[a + '|' + b], rev = false;
      if (!pts) { pts = PR.routes && PR.routes[b + '|' + a]; rev = !!pts; }
      if (pts) pts = rev ? pts.slice().reverse() : pts;
      else pts = [pinPoint(a), pinPoint(b)];                  // no traced route yet: straight line
      var line = pts.map(ll);
      var hops = [[pt(a), line[0]], [line[line.length - 1], pt(b)]].filter(function (h) { return h[0].distanceTo(h[1]) > 1; });
      return { lines: [line], hops: hops, all: [pt(a)].concat(line, [pt(b)]) };
    }

    // opts: { color, weight, opacity, casing (bool), dash (for the whole line, e.g. merch) }
    function draw(s, group, opts) {
      opts = opts || {};
      var solid = L.featureGroup();
      s.hops.forEach(function (h) {
        L.polyline(h, { color: '#fff', weight: 2.5, opacity: 0.95, dashArray: '2 6', lineCap: 'round', interactive: false }).addTo(group);
      });
      s.lines.forEach(function (line) {
        if (opts.casing !== false) L.polyline(line, { color: '#fff', weight: (opts.weight || 5) + 4, opacity: 0.9, interactive: false }).addTo(group);
        L.polyline(line, { color: opts.color || '#542e91', weight: opts.weight || 5, opacity: opts.opacity || 0.95,
                           dashArray: opts.dash || null, lineJoin: 'round' }).addTo(solid);
      });
      solid.addTo(group);
      return solid;
    }

    return { map: map, pt: pt, shape: shape, draw: draw, fitAll: fitAll, bounds: bounds };
  }

  function join(s1, s2) {
    return { lines: s1.lines.concat(s2.lines), hops: s1.hops.concat(s2.hops), all: s1.all.concat(s2.all) };
  }

  window.SiteMap = { create: create, join: join };
})();
