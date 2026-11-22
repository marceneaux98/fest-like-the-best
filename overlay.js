// Festival site-map settings.
//
// The illustrated map (assets/sitemap.svg, built from the designer's vector PDF by
// build_sitemap.py) isn't to scale, so it's lined up by "control points": a spot on the
// illustration (x, y as a fraction of the page: 0 = left/top, 1 = right/bottom) paired with the
// real GPS position of that spot. The map fits the best rotate/scale/skew through all of them.
//
// To fine-tune: open planner.html?align — each point shows a dot where the illustration
// puts it and a line to where it really is. Nudge x/y here until the lines are short.
// For a new year's map: export the vector PDF to assets/, run tools/pdf2svg.html, then
// python build_sitemap.py, and re-check the points (same layout = same points).
window.OVERLAY_CONFIG = {
  svg: "assets/sitemap.svg",
  defaultStyle: "festival",   // 'festival' (illustration only), 'streets' (tiles only) or 'both'
  defaultOpacity: 0.75,       // illustration opacity in 'both'
  // Fractions of the 774 x 603 pt vector page. (The older raster PDF was 810 x 639 with an 18 pt
  // margin all round; its points were converted with x' = (x*810-18)/774, y' = (y*639-18)/603.)
  controlPoints: [
    { name: "Lafayette Stage (Scène Wellcare)", x: 0.3980, y: 0.1247, lat: 30.224638,  lng: -92.020794 },
    { name: "Biergarten",                       x: 0.5471, y: 0.2926, lat: 30.2255631, lng: -92.0189397 },
    { name: "Fais Do Do (Scène Ochsner)",       x: 0.0945, y: 0.7729, lat: 30.222427,  lng: -92.018832 },
    { name: "FrancoSphere (Scène CODOFIL)",     x: 0.4019, y: 0.7091, lat: 30.223562,  lng: -92.018800 },
    { name: "Pavillon de Cuisine",              x: 0.6177, y: 0.6284, lat: 30.224573,  lng: -92.017523 },
    { name: "Internationale (Scène LUS)",       x: 0.8074, y: 0.6923, lat: 30.225523,  lng: -92.016788 }
  ]
};
