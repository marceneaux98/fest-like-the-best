// Festival map settings.
//
// The map patrons see IS the festival's illustrated site map (assets/sitemap.svg, built from the
// designer's vector PDF by build_sitemap.py), shown upright exactly as printed. Everything on it is
// placed in poster coordinates: x and y as fractions of the page (0 = left/top, 1 = right/bottom).
//
//   stages   where each stage's pin sits on the poster (ids as in locations.json)
//   routes   walking routes between stages, traced along the drawn streets by
//            tools/poster-routes.html and saved to assets/poster-routes.json
//
// Walking distances and times still come from real street distances (routes.js), not the poster,
// because the illustration is not to scale.
//
// To move a pin: change its x/y here, then re-run tools/poster-routes.html (it starts each route
// from the nearest street to the pin) and save.
window.OVERLAY_CONFIG = {
  svg: "assets/sitemap.svg",
  routes: "assets/poster-routes.json",
  width: 774,          // poster page size in points (viewBox of sitemap.svg)
  height: 603,
  stages: {
    internationale: [0.8074, 0.6923],
    faisdodo:       [0.0945, 0.7729],
    lafayette:      [0.3980, 0.1247],
    biergarten:     [0.5471, 0.2926],
    francosphere:   [0.4019, 0.7091],
    pavillon:       [0.6177, 0.6284],
    jeunes:         [0.0700, 0.0780]   // the "Sonic Scène des Jeunes" box at top left
  }
};
