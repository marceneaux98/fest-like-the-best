// Festival site map for Leaflet maps (used by planner.html and itinerary.html).
// Needs: Leaflet, i18n.js and overlay.js (window.OVERLAY_CONFIG) loaded first.
//
// The illustrated map is assets/sitemap.svg (built from the designer's vector PDF by
// build_sitemap.py). It is inlined into the map so its layers (streets, zones, icons, labels,
// legend, logo) can be shown or hidden, and placed with a least-squares affine fit (rotate/scale/
// skew) through the control points in overlay.js, recomputed on every zoom.
//
// Map styles: 'festival' = the illustration on its own (no street tiles, navy background),
// 'streets' = street tiles only, 'both' = tiles with the illustration on top at the chosen opacity.
// Add ?align to the page URL to see how far each control point lands from its real spot.
(function () {
  var style = document.createElement('style');
  style.textContent = '.site-overlay{position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:none;overflow:visible}' +
    '.leaflet-zoom-anim .site-overlay{visibility:hidden}' +
    '.map-festival .leaflet-tile-pane{display:none}' +
    '.map-layers{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:8px}' +
    '.map-layers label{display:inline-flex;align-items:center;gap:5px;font-size:.82rem;color:var(--ink,#1c1b22);cursor:pointer;text-transform:none;letter-spacing:0;margin:0}' +
    '.map-layers input{accent-color:var(--fil-purple,#542e91);width:15px;height:15px;margin:0}' +
    '.map-layers.off{opacity:.4;pointer-events:none}';
  document.head.appendChild(style);

  var LAYERS = ['streets', 'zones', 'features', 'labels', 'legend', 'logo'];
  var DEFAULT_LAYERS = { streets: true, zones: true, features: true, labels: true, legend: false, logo: false };
  var FESTIVAL_BG = '#162061';

  var EN = {
    overlay_note: 'The illustrated map is approximate and not to scale.',
    overlay_loading: 'Loading site map…',
    overlay_server: 'The overlay needs the local server: run python serve.py',
    overlay_fail: 'Could not load the site map: {err}',
    overlay_unavailable: 'Overlay unavailable.',
    layer_streets: 'Streets', layer_zones: 'Areas', layer_features: 'Icons & vendors',
    layer_labels: 'Labels', layer_legend: 'Legend', layer_logo: 'Logo'
  };
  function msg(key, vars) {
    if (window.I18N) return I18N.t(key, vars);
    return (EN[key] || key).replace('{err}', vars && vars.err || '');
  }
  function store(k, v) { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) {} }
  function recall(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function recallJSON(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }

  // Solve x = a*u + c*v + e and y = b*u + d*v + f by least squares.
  function fitAffine(src, dst) {
    function det(m) { return m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1]) - m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0]) + m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]); }
    function solve3(M, r) {
      var D = det(M), out = [];
      for (var i = 0; i < 3; i++) { var Mi = M.map(function (row, j) { var c = row.slice(); c[i] = r[j]; return c; }); out.push(det(Mi) / D); }
      return out;
    }
    var S = [[0,0,0],[0,0,0],[0,0,0]], rx = [0,0,0], ry = [0,0,0];
    src.forEach(function (p, i) {
      var row = [p[0], p[1], 1];
      for (var j = 0; j < 3; j++) { for (var k = 0; k < 3; k++) S[j][k] += row[j]*row[k]; rx[j] += row[j]*dst[i][0]; ry[j] += row[j]*dst[i][1]; }
    });
    var X = solve3(S, rx), Y = solve3(S, ry);
    return { a: X[0], c: X[1], e: X[2], b: Y[0], d: Y[1], f: Y[2] };
  }

  // ui: { styleSelect, opacity, opacityVal, opacityRow, layersBox, status, tiles } — any may be omitted.
  // tiles: the Leaflet tile layer, so 'festival' style can hide it.
  function attach(map, ui) {
    var OC = window.OVERLAY_CONFIG;
    var alignMode = /[?&]align\b/.test(location.search);
    var alignLayer = alignMode ? L.layerGroup().addTo(map) : null;
    function say(t) { if (ui.status) ui.status.textContent = t; }

    var SiteOverlay = L.Layer.extend({
      initialize: function (svg, w, h) { this._svg = svg; this._w = w; this._h = h; },
      onAdd: function (m) {
        this._svg.classList.add('site-overlay');
        m.getPane('sitemap').appendChild(this._svg);
        m.on('zoomend viewreset', this._reset, this);
        this._reset();
      },
      onRemove: function (m) {
        this._svg.remove();
        m.off('zoomend viewreset', this._reset, this);
        if (alignLayer) alignLayer.clearLayers();
      },
      setOpacity: function (o) { this._svg.style.opacity = o; },
      _reset: function () {
        var w = this._w, h = this._h, m = this._map;
        var src = OC.controlPoints.map(function (p) { return [p.x * w, p.y * h]; });
        var dst = OC.controlPoints.map(function (p) { var lp = m.latLngToLayerPoint([p.lat, p.lng]); return [lp.x, lp.y]; });
        var t = fitAffine(src, dst);
        this._svg.style.transform = 'matrix(' + [t.a, t.b, t.c, t.d, t.e, t.f].join(',') + ')';
        if (alignMode) drawAlign(t, w, h);
      }
    });

    map.createPane('sitemap');
    map.getPane('sitemap').style.zIndex = 350; // above tiles, below routes and pins
    map.getPane('sitemap').style.pointerEvents = 'none';

    var overlay = null, loading = null;
    function load() {
      if (loading) return loading;
      if (!OC || !OC.svg) { say(msg('overlay_unavailable')); return Promise.reject(); }
      if (location.protocol === 'file:') { say(msg('overlay_server')); return Promise.reject(); }
      say(msg('overlay_loading'));
      loading = fetch(OC.svg).then(function (r) {
        if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
        return r.text();
      }).then(function (text) {
        var doc = new DOMParser().parseFromString(text, 'image/svg+xml');
        var svg = doc.documentElement;
        if (!svg || svg.nodeName.toLowerCase() !== 'svg') throw new Error('not an SVG');
        var vb = (svg.getAttribute('viewBox') || '0 0 774 603').split(/\s+/).map(Number);
        var w = vb[2], h = vb[3];
        svg = document.importNode(svg, true);
        svg.setAttribute('width', w); svg.setAttribute('height', h);
        overlay = new SiteOverlay(svg, w, h);
        applyLayers();
        say(msg('overlay_note'));
        return overlay;
      }).catch(function (err) { loading = null; say(msg('overlay_fail', { err: err && err.message || err })); throw err; });
      return loading;
    }

    function drawAlign(t, w, h) {
      alignLayer.clearLayers();
      window.ALIGN_ERRORS = [];
      OC.controlPoints.forEach(function (p) {
        var u = p.x * w, v = p.y * h;
        var placed = map.layerPointToLatLng([t.a*u + t.c*v + t.e, t.b*u + t.d*v + t.f]);
        var real = L.latLng(p.lat, p.lng), off = Math.round(placed.distanceTo(real));
        window.ALIGN_ERRORS.push(p.name + ': ' + off + ' m');
        L.polyline([placed, real], { color: '#f58220', weight: 2, dashArray: '4 4' }).addTo(alignLayer);
        L.circleMarker(placed, { radius: 6, color: '#f58220', fillOpacity: 1 }).addTo(alignLayer)
          .bindTooltip(p.name + ': off by ' + off + ' m');
      });
    }

    // ---------- layers (streets, zones, icons…) ----------
    var layersOn = recallJSON('fil-maplayers', null) || DEFAULT_LAYERS;
    function applyLayers() {
      if (!overlay) return;
      LAYERS.forEach(function (name) {
        var g = overlay._svg.querySelector('#layer-' + name);
        if (g) g.style.display = layersOn[name] === false ? 'none' : '';
      });
    }
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

    // ---------- map style ----------
    var mapStyle = recall('fil-mapstyle') || (OC && OC.defaultStyle) || 'festival';
    function apply() {
      var showSvg = mapStyle !== 'streets';
      var op = mapStyle === 'both' ? (ui.opacity ? parseFloat(ui.opacity.value) : (OC && OC.defaultOpacity) || 0.75) : 1;
      if (ui.opacityVal) ui.opacityVal.textContent = Math.round((ui.opacity ? parseFloat(ui.opacity.value) : op) * 100) + '%';
      if (ui.opacityRow) ui.opacityRow.classList.toggle('off', mapStyle !== 'both');
      if (ui.layersBox) ui.layersBox.classList.toggle('off', !showSvg);
      var el = map.getContainer();
      el.classList.toggle('map-festival', mapStyle === 'festival');
      el.style.background = mapStyle === 'festival' ? FESTIVAL_BG : '';
      if (ui.tiles) { if (mapStyle === 'festival') { if (map.hasLayer(ui.tiles)) map.removeLayer(ui.tiles); } else if (!map.hasLayer(ui.tiles)) ui.tiles.addTo(map); }
      if (showSvg) {
        load().then(function (o) {
          if (mapStyle === 'streets') return;
          if (!map.hasLayer(o)) o.addTo(map);
          o.setOpacity(mapStyle === 'both' ? (ui.opacity ? parseFloat(ui.opacity.value) : op) : 1);
        }, function () {});
      } else if (overlay && map.hasLayer(overlay)) {
        map.removeLayer(overlay);
      }
    }

    if (ui.opacity) {
      ui.opacity.value = recall('overlayOpacity') || (OC && OC.defaultOpacity) || 0.75;
      ui.opacity.addEventListener('input', function () { store('overlayOpacity', ui.opacity.value); apply(); });
    }
    if (ui.styleSelect) {
      if (alignMode) mapStyle = 'both';
      ui.styleSelect.value = mapStyle;
      if (ui.styleSelect.value !== mapStyle) { mapStyle = 'festival'; ui.styleSelect.value = mapStyle; }
      ui.styleSelect.addEventListener('change', function () { mapStyle = ui.styleSelect.value; store('fil-mapstyle', mapStyle); apply(); });
    }
    apply();
    return { setStyle: function (s) { mapStyle = s; if (ui.styleSelect) ui.styleSelect.value = s; apply(); } };
  }

  window.SiteMapOverlay = { attach: attach };
})();
