// Festival site-map overlay for Leaflet maps (used by planner.html and itinerary.html).
// Needs: Leaflet, pdf.js, and overlay.js (window.OVERLAY_CONFIG) loaded first.
//
// The illustration is placed with a least-squares affine fit (rotate/scale/skew)
// through the control points in overlay.js, recomputed on every zoom.
// Add ?align to the page URL to see how far each control point lands from its real spot.
(function () {
  var style = document.createElement('style');
  style.textContent = '.site-overlay{position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:none}' +
    '.leaflet-zoom-anim .site-overlay{visibility:hidden}';
  document.head.appendChild(style);

  // Status messages go through i18n.js when it's on the page.
  var EN = {
    overlay_note: 'The illustrated map is approximate and not to scale.',
    overlay_loading: 'Loading site map…',
    overlay_server: 'The overlay needs the local server: run python serve.py',
    overlay_fail: 'Could not load the site map: {err}',
    overlay_unavailable: 'Overlay unavailable.'
  };
  function msg(key, vars) {
    if (window.I18N) return I18N.t(key, vars);
    return EN[key].replace('{err}', vars && vars.err || '');
  }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function recall(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

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

  // ui: { toggle, opacity, opacityVal, row, status } — DOM elements, any may be omitted.
  function attach(map, ui) {
    var OC = window.OVERLAY_CONFIG;
    var alignMode = /[?&]align\b/.test(location.search);
    var alignLayer = alignMode ? L.layerGroup().addTo(map) : null;
    function say(t) { if (ui.status) ui.status.textContent = t; }

    var SiteOverlay = L.Layer.extend({
      initialize: function (canvas) { this._canvas = canvas; },
      onAdd: function (m) {
        this._canvas.className = 'site-overlay';
        m.getPane('sitemap').appendChild(this._canvas);
        m.on('zoomend viewreset', this._reset, this);
        this._reset();
      },
      onRemove: function (m) {
        this._canvas.remove();
        m.off('zoomend viewreset', this._reset, this);
        if (alignLayer) alignLayer.clearLayers();
      },
      setOpacity: function (o) { this._canvas.style.opacity = o; },
      _reset: function () {
        var cv = this._canvas, m = this._map;
        var src = OC.controlPoints.map(function (p) { return [p.x * cv.width, p.y * cv.height]; });
        var dst = OC.controlPoints.map(function (p) { var lp = m.latLngToLayerPoint([p.lat, p.lng]); return [lp.x, lp.y]; });
        var t = fitAffine(src, dst);
        cv.style.transform = 'matrix(' + [t.a, t.b, t.c, t.d, t.e, t.f].join(',') + ')';
        if (alignMode) drawAlign(t, cv);
      }
    });

    map.createPane('sitemap');
    map.getPane('sitemap').style.zIndex = 350; // above tiles, below routes and pins
    map.getPane('sitemap').style.pointerEvents = 'none';

    var overlay = null, loading = null;
    function load() {
      if (loading) return loading;
      if (!window.pdfjsLib || !OC) { say(msg('overlay_unavailable')); return Promise.reject(); }
      if (location.protocol === 'file:') { say(msg('overlay_server')); return Promise.reject(); }
      say(msg('overlay_loading'));
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      loading = pdfjsLib.getDocument(OC.pdf).promise
        .then(function (pdf) { return pdf.getPage(OC.page || 1); })
        .then(function (page) {
          var vp = page.getViewport({ scale: OC.renderScale || 3 });
          var cv = document.createElement('canvas');
          cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
          return page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise.then(function () { return cv; });
        })
        .then(function (cv) { overlay = new SiteOverlay(cv); say(msg('overlay_note')); return overlay; })
        .catch(function (err) { loading = null; say(msg('overlay_fail', { err: err && err.message || err })); throw err; });
      return loading;
    }

    function drawAlign(t, cv) {
      alignLayer.clearLayers();
      OC.controlPoints.forEach(function (p) {
        var u = p.x * cv.width, v = p.y * cv.height;
        var placed = map.layerPointToLatLng([t.a*u + t.c*v + t.e, t.b*u + t.d*v + t.f]);
        var real = L.latLng(p.lat, p.lng);
        L.polyline([placed, real], { color: '#f58220', weight: 2, dashArray: '4 4' }).addTo(alignLayer);
        L.circleMarker(placed, { radius: 6, color: '#f58220', fillOpacity: 1 }).addTo(alignLayer)
          .bindTooltip(p.name + ': off by ' + Math.round(placed.distanceTo(real)) + ' m');
      });
    }

    function apply() {
      var on = ui.toggle ? ui.toggle.checked : true;
      var op = ui.opacity ? parseFloat(ui.opacity.value) : (OC && OC.defaultOpacity) || 0.75;
      if (ui.opacityVal) ui.opacityVal.textContent = Math.round(op * 100) + '%';
      if (ui.row) ui.row.classList.toggle('off', !on);
      if (on) {
        load().then(function (o) {
          var stillOn = ui.toggle ? ui.toggle.checked : true;
          if (stillOn) { o.addTo(map); o.setOpacity(ui.opacity ? parseFloat(ui.opacity.value) : op); }
        }, function () {});
      } else if (overlay) {
        map.removeLayer(overlay);
      }
    }

    if (ui.opacity) {
      ui.opacity.value = recall('overlayOpacity') || (OC && OC.defaultOpacity) || 0.75;
      ui.opacity.addEventListener('input', function () { store('overlayOpacity', ui.opacity.value); apply(); });
    }
    if (ui.toggle) {
      ui.toggle.checked = alignMode || recall('overlayOn') === '1';
      ui.toggle.addEventListener('change', function () { store('overlayOn', ui.toggle.checked ? '1' : '0'); apply(); });
    }
    apply();
  }

  window.SiteMapOverlay = { attach: attach };
})();
