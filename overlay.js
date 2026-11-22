// Festival site-map overlay settings.
//
// The illustrated map isn't to scale, so it's lined up by "control points":
// a spot on the illustration (x, y as a fraction of the page: 0 = left/top, 1 = right/bottom)
// paired with the real GPS position of that spot. The planner fits the best
// rotate/scale/skew through all of them.
//
// To fine-tune: open planner.html?align — each point shows a dot where the illustration
// puts it and a line to where it really is. Nudge x/y here until the lines are short.
// To swap in a revised map, replace assets/sitemap.pdf (same layout = same points).
window.OVERLAY_CONFIG = {
  pdf: "assets/sitemap.pdf",
  page: 1,
  renderScale: 3,        // higher = sharper but slower to load
  defaultOpacity: 0.75,
  controlPoints: [
    { name: "Lafayette Stage (Scène Wellcare)", x: 0.4025,  y: 0.1458, lat: 30.224638,  lng: -92.020794 },
    { name: "Biergarten",                       x: 0.5450,  y: 0.3043, lat: 30.2255631, lng: -92.0189397 },
    { name: "Fais Do Do (Scène Ochsner)",       x: 0.1125,  y: 0.7575, lat: 30.222427,  lng: -92.018832 },
    { name: "FrancoSphere (Scène CODOFIL)",     x: 0.40625, y: 0.6973, lat: 30.223562,  lng: -92.018800 },
    { name: "Pavillon de Cuisine",              x: 0.6125,  y: 0.6212, lat: 30.224573,  lng: -92.017523 },
    { name: "Internationale (Scène LUS)",       x: 0.79375, y: 0.6815, lat: 30.225523,  lng: -92.016788 }
  ]
};
