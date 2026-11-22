// Fest like the Best — interface languages.
//
// Order in the language menu: French first, then English (the default), Spanish, Vietnamese.
// To add a language: add it to LANGS and add a dictionary below; any missing key falls back to English.
// Translations are a first draft — have a native speaker review them before launch.
//
// Usage in pages:
//   I18N.t('key', {var: value})       text with {placeholders}
//   I18N.tn('key', n, {...})          picks key_one / key_other by the language's plural rules ({n} is filled in)
//   I18N.time(minutes, compact)       clock time in the language's style (7:45 PM · 19 h 45 · 19:45)
//   I18N.weekday(date) / weekdayShort(date) / monthDay(date)   from 'YYYY-MM-DD'
//   I18N.dur(minutes)                 1h 15m · 1 h 15 · 1 giờ 15 phút
// Static HTML: data-i18n (text), data-i18n-html, data-i18n-ph (placeholder), data-i18n-aria, data-i18n-title.
(function () {
  var LANGS = [
    { code: 'fr', name: 'Français',   locale: 'fr-CA' },
    { code: 'en', name: 'English',    locale: 'en-US' },
    { code: 'es', name: 'Español',    locale: 'es-US' },
    { code: 'vi', name: 'Tiếng Việt', locale: 'vi-VN' }
  ];
  var DEFAULT = 'en';
  var PRODUCT = 'Fest like the Best';

  var D = {};

  D.en = {
    lang_label: 'Language',
    nav_lineup: 'Lineup', nav_myday: 'My day', nav_map: 'Stage map',
    dur_hm: '{h}h {m}m', dur_h: '{h}h', dur_m: '{m} min', min: '{n} min',
    sets_one: '{n} set', sets_other: '{n} sets',
    overlapping_one: '{n} overlapping', overlapping_other: '{n} overlapping',
    no_overlaps: 'no overlaps',
    crowd_factor: 'Crowd factor',
    overlay_note: 'The illustrated map is approximate and not to scale.',
    overlay_loading: 'Loading site map…',
    overlay_server: 'The overlay needs the local server: run py serve.py',
    overlay_fail: 'Could not load the site map: {err}',
    overlay_unavailable: 'Overlay unavailable.',

    lu_doc_title: 'Lineup',
    lu_title: 'Lineup 2026',
    lu_sub: 'Pick the sets you want to see',
    lu_days_aria: 'Festival days',
    lu_search_ph: 'Search artists, countries, stages…',
    lu_search_aria: 'Search',
    lu_view_aria: 'View',
    lu_grid: 'Grid', lu_list: 'List', lu_only: 'Only my picks',
    lu_total_one: '<b>{n}</b> set picked across the festival',
    lu_total_other: '<b>{n}</b> sets picked across the festival',
    lu_total_none: 'Tap any set to add it to your plan',
    lu_empty_day: 'No performances listed for this day.',
    lu_empty_picks: 'No picks on this day yet.',
    lu_empty_search: 'Nothing matches your search on this day.',
    lu_overlaps: 'Overlaps {acts}',
    lu_also: 'Also: {list}',
    lu_my_day: 'My {weekday}',
    lu_nothing_day: 'Nothing picked for this day yet.',
    lu_tap_build: 'Tap sets to build your day.',
    lu_plan_btn: 'Plan my route →',
    lu_hint_need: 'Pick at least two sets to plan a route.',
    lu_hint_ok: 'Walk times, when to leave, and how to handle overlaps.',
    lu_clear_day: 'Clear this day',
    lu_remove: 'Remove {act}',
    lu_dock_count: '{sets} on {weekday}',
    lu_dock_none: 'No picks on {weekday}',
    lu_dock_add: 'Tap a set to add it',
    lu_dock_review: 'Tap to review your picks',
    lu_dock_overlap_one: '{n} overlapping · tap to review',
    lu_dock_overlap_other: '{n} overlapping · tap to review',
    lu_dock_aria: 'Review my picks for this day',

    dup_title: 'Already in your schedule',
    dup_body: '{act} is already in your plan:',
    dup_this: 'This show: {when}',
    dup_swap: 'Switch to this show',
    dup_keep: 'Keep both',
    dup_cancel: 'Cancel',
    dup_badge: 'In your plan · {when}',

    it_doc_title: 'My Day',
    it_title: 'My day plan',
    it_title_day: 'My {weekday}',
    it_edit: '← Edit picks',
    it_days_aria: 'Days with picks',
    it_settings: 'Walking & map settings',
    it_buffer: 'Arrive early by',
    it_shop: 'Merch shopping time',
    it_overlay: 'Site map overlay',
    it_opacity: 'Overlay opacity',
    it_settings_note: 'Walk times assume ~5 km/h × the crowd factor. Barriers and closures aren’t included.',
    it_stat_sets: 'Sets', it_stat_music: 'Of music', it_stat_walk: 'Walking · {dist}',
    it_missed_one: '{n} set can’t be reached with this plan — try another choice below or drop a pick.',
    it_missed_other: '{n} sets can’t be reached with this plan — try another choice below or drop a pick.',
    it_tight_one: '{n} tight connection — pick how you want to handle it below.',
    it_tight_other: '{n} tight connections — pick how you want to handle each below.',
    it_all_fits: 'Everything fits — you can see every set in full.',
    it_empty: 'You haven’t picked any sets yet.',
    it_empty_link: 'Pick the bands you want to see →',
    it_miss_all: 'You’d miss this set entirely with this plan',
    it_full: 'Full set · {dur}',
    it_catch: 'Catch {a} of {b} · {bits}',
    it_miss_first: 'miss the first {dur}',
    it_miss_last: 'miss the last {dur}',
    it_be_at: 'Be at {stage} by {time}',
    it_stay_at: 'Stay at {stage}',
    it_leave: 'Leave {time}',
    it_walk_arrive: '→ {n} min walk ({m} m) → arrive {time}',
    it_late: 'Arrive {dur} after {act} starts',
    it_free_go: '{dur} free before you need to head over',
    it_free_break: '{dur} break between sets',
    it_free_food: ' — time for food or a drink',
    it_why_overlap: 'These sets overlap.',
    it_why_tight: 'Not enough time to see all of {act} and walk over.',
    it_choose: 'Choose:',
    it_opt_early: 'Catch start of<br>{act}',
    it_opt_split: 'Split<br>the difference',
    it_opt_end: 'Stay to end of<br>{act}',
    it_merch_title: 'Festival merch',
    it_merch_none: 'No merch stop planned for today.',
    it_merch_find: 'Find a time to shop',
    it_merch_set: 'Merch stop at {time} at {booth}, {where}.',
    it_merch_change: 'Change time',
    it_merch_remove: 'Remove',
    it_merch_best_fit: 'Best time to shop: {time} at {booth}, {where} — fits your break with {n} min to spare.',
    it_merch_best_nofit: 'Best time to shop: {time} at {booth}, {where} (no break today is long enough to shop without missing music).',
    it_merch_add: 'Add to my plan', it_merch_other: 'Other times', it_merch_no: 'No thanks',
    it_booth: 'the {stage} merch booth',
    it_booth_name: '{stage} merch booth',
    it_where_before: 'before {act}', it_where_between: 'between {a} and {b}', it_where_after: 'after {act}',
    it_spare: '{n} min to spare',
    it_to_booth: '→ {n} min walk to the merch booth',
    it_booth_here: 'the merch booth is right here',
    it_shop_line: 'Shop {a}–{b} · {booth}',
    it_walk_to: '→ {n} min walk to {stage}',
    it_stay_to: '→ stay at {stage}',
    it_arrive: ' → arrive {time}',
    it_merch_stop: 'Merch stop',
    it_merch_about: '{booth} · about {n} min',
    it_then: 'Then',
    it_stage_here: 'the stage is right here',

    pl_doc_title: 'Stage Map',
    pl_title_html: 'Stage <span>Map</span>',
    pl_sub: 'Walking time between any two stages. Pick two, or tap pins on the map.',
    pl_from: 'From', pl_to: 'To', pl_swap: 'Swap',
    pl_choose: 'Choose two different locations',
    pl_pick_diff: 'Pick two different locations',
    pl_min_walk: 'min walk',
    pl_meta: '{m} m ({mi} mi) · {n} min at normal pace',
    pl_crowd_hint: '1.0× = normal walking pace (~5 km/h). Raise it for festival crowds.',
    pl_overlay: 'Festival site map overlay',
    pl_matrix: 'All walk times (min, with crowd factor)',
    pl_foot: 'Routes from OpenStreetMap walking data, built {date}. Street closures and festival barriers are not included.'
  };

  D.fr = {
    lang_label: 'Langue',
    nav_lineup: 'Programme', nav_myday: 'Ma journée', nav_map: 'Carte',
    dur_hm: '{h} h {mm}', dur_h: '{h} h', dur_m: '{m} min', min: '{n} min',
    sets_one: '{n} concert', sets_other: '{n} concerts',
    overlapping_one: '{n} chevauchement', overlapping_other: '{n} chevauchements',
    no_overlaps: 'aucun chevauchement',
    crowd_factor: 'Facteur foule',
    overlay_note: 'La carte illustrée est approximative et n’est pas à l’échelle.',
    overlay_loading: 'Chargement de la carte du site…',
    overlay_server: 'La superposition nécessite le serveur local : lancez py serve.py',
    overlay_fail: 'Impossible de charger la carte du site : {err}',
    overlay_unavailable: 'Superposition indisponible.',

    lu_doc_title: 'Programmation',
    lu_title: 'Programmation 2026',
    lu_sub: 'Choisissez les concerts que vous voulez voir',
    lu_days_aria: 'Jours du festival',
    lu_search_ph: 'Rechercher artistes, pays, scènes…',
    lu_search_aria: 'Rechercher',
    lu_view_aria: 'Affichage',
    lu_grid: 'Grille', lu_list: 'Liste', lu_only: 'Seulement mes choix',
    lu_total_one: '<b>{n}</b> concert choisi pour le festival',
    lu_total_other: '<b>{n}</b> concerts choisis pour le festival',
    lu_total_none: 'Touchez un concert pour l’ajouter à votre plan',
    lu_empty_day: 'Aucun spectacle prévu ce jour-là.',
    lu_empty_picks: 'Aucun choix pour ce jour pour l’instant.',
    lu_empty_search: 'Rien ne correspond à votre recherche ce jour-là.',
    lu_overlaps: 'Chevauche {acts}',
    lu_also: 'Aussi : {list}',
    lu_my_day: 'Mon {weekday}',
    lu_nothing_day: 'Rien de choisi pour ce jour pour l’instant.',
    lu_tap_build: 'Touchez des concerts pour composer votre journée.',
    lu_plan_btn: 'Planifier mon trajet →',
    lu_hint_need: 'Choisissez au moins deux concerts pour planifier un trajet.',
    lu_hint_ok: 'Temps de marche, heure de départ et gestion des chevauchements.',
    lu_clear_day: 'Effacer cette journée',
    lu_remove: 'Retirer {act}',
    lu_dock_count: '{sets} le {weekday}',
    lu_dock_none: 'Aucun choix le {weekday}',
    lu_dock_add: 'Touchez un concert pour l’ajouter',
    lu_dock_review: 'Touchez pour revoir vos choix',
    lu_dock_overlap_one: '{n} chevauchement · touchez pour revoir',
    lu_dock_overlap_other: '{n} chevauchements · touchez pour revoir',
    lu_dock_aria: 'Revoir mes choix pour ce jour',

    dup_title: 'Déjà dans votre programme',
    dup_body: '{act} est déjà dans votre plan :',
    dup_this: 'Ce concert : {when}',
    dup_swap: 'Choisir plutôt ce concert',
    dup_keep: 'Garder les deux',
    dup_cancel: 'Annuler',
    dup_badge: 'Dans votre plan · {when}',

    it_doc_title: 'Ma journée',
    it_title: 'Ma journée',
    it_title_day: 'Mon {weekday}',
    it_edit: '← Modifier mes choix',
    it_days_aria: 'Jours avec des choix',
    it_settings: 'Réglages de marche et de carte',
    it_buffer: 'Arriver en avance de',
    it_shop: 'Temps à la boutique',
    it_overlay: 'Carte du site superposée',
    it_opacity: 'Opacité de la carte',
    it_settings_note: 'Les temps de marche supposent ~5 km/h × le facteur foule. Les barrières et fermetures ne sont pas incluses.',
    it_stat_sets: 'Concerts', it_stat_music: 'De musique', it_stat_walk: 'Marche · {dist}',
    it_missed_one: '{n} concert est inatteignable avec ce plan — essayez un autre choix ci-dessous ou retirez un concert.',
    it_missed_other: '{n} concerts sont inatteignables avec ce plan — essayez un autre choix ci-dessous ou retirez un concert.',
    it_tight_one: '{n} correspondance serrée — choisissez comment la gérer ci-dessous.',
    it_tight_other: '{n} correspondances serrées — choisissez comment gérer chacune ci-dessous.',
    it_all_fits: 'Tout s’enchaîne — vous pouvez voir chaque concert en entier.',
    it_empty: 'Vous n’avez encore choisi aucun concert.',
    it_empty_link: 'Choisissez les groupes que vous voulez voir →',
    it_miss_all: 'Vous manqueriez ce concert entièrement avec ce plan',
    it_full: 'Concert complet · {dur}',
    it_catch: 'Vous verrez {a} sur {b} · {bits}',
    it_miss_first: 'vous manquerez les {dur} du début',
    it_miss_last: 'vous manquerez les {dur} de la fin',
    it_be_at: 'Soyez à {stage} avant {time}',
    it_stay_at: 'Restez à {stage}',
    it_leave: 'Partez à {time}',
    it_walk_arrive: '→ {n} min de marche ({m} m) → arrivée {time}',
    it_late: 'Arrivée {dur} après le début de {act}',
    it_free_go: '{dur} de libre avant de partir',
    it_free_break: '{dur} de pause entre les concerts',
    it_free_food: ' — le temps de manger ou de prendre un verre',
    it_why_overlap: 'Ces concerts se chevauchent.',
    it_why_tight: 'Pas assez de temps pour voir {act} en entier et vous déplacer.',
    it_choose: 'Choisissez :',
    it_opt_early: 'Voir le début de<br>{act}',
    it_opt_split: 'Couper la poire<br>en deux',
    it_opt_end: 'Rester jusqu’à la fin de<br>{act}',
    it_merch_title: 'Boutique du festival',
    it_merch_none: 'Aucun arrêt à la boutique prévu aujourd’hui.',
    it_merch_find: 'Trouver un moment pour la boutique',
    it_merch_set: 'Arrêt boutique à {time} au {booth}, {where}.',
    it_merch_change: 'Changer l’heure',
    it_merch_remove: 'Retirer',
    it_merch_best_fit: 'Meilleur moment pour la boutique : {time} au {booth}, {where} — ça entre dans votre pause avec {n} min de marge.',
    it_merch_best_nofit: 'Meilleur moment pour la boutique : {time} au {booth}, {where} (aucune pause aujourd’hui n’est assez longue sans manquer de musique).',
    it_merch_add: 'Ajouter à mon plan', it_merch_other: 'Autres moments', it_merch_no: 'Non merci',
    it_booth: 'kiosque boutique de {stage}',
    it_booth_name: 'Kiosque boutique de {stage}',
    it_where_before: 'avant {act}', it_where_between: 'entre {a} et {b}', it_where_after: 'après {act}',
    it_spare: '{n} min de marge',
    it_to_booth: '→ {n} min de marche jusqu’au kiosque',
    it_booth_here: 'le kiosque est juste là',
    it_shop_line: 'Boutique {a}–{b} · {booth}',
    it_walk_to: '→ {n} min de marche jusqu’à {stage}',
    it_stay_to: '→ restez à {stage}',
    it_arrive: ' → arrivée {time}',
    it_merch_stop: 'Arrêt boutique',
    it_merch_about: '{booth} · environ {n} min',
    it_then: 'Ensuite',
    it_stage_here: 'la scène est juste là',

    pl_doc_title: 'Carte des scènes',
    pl_title_html: 'Carte des <span>scènes</span>',
    pl_sub: 'Temps de marche entre deux scènes. Choisissez-en deux ou touchez les repères sur la carte.',
    pl_from: 'De', pl_to: 'À', pl_swap: 'Inverser',
    pl_choose: 'Choisissez deux lieux différents',
    pl_pick_diff: 'Choisissez deux lieux différents',
    pl_min_walk: 'min de marche',
    pl_meta: '{m} m ({mi} mi) · {n} min à vitesse normale',
    pl_crowd_hint: '1,0× = vitesse de marche normale (~5 km/h). Augmentez-le pour la foule du festival.',
    pl_overlay: 'Superposer la carte du festival',
    pl_matrix: 'Tous les temps de marche (min, avec facteur foule)',
    pl_foot: 'Itinéraires basés sur les données piétonnes d’OpenStreetMap, générés le {date}. Les fermetures de rues et les barrières du festival ne sont pas incluses.'
  };

  D.es = {
    lang_label: 'Idioma',
    nav_lineup: 'Programa', nav_myday: 'Mi día', nav_map: 'Mapa',
    dur_hm: '{h} h {m} min', dur_h: '{h} h', dur_m: '{m} min', min: '{n} min',
    sets_one: '{n} concierto', sets_other: '{n} conciertos',
    overlapping_one: '{n} superpuesto', overlapping_other: '{n} superpuestos',
    no_overlaps: 'sin superposiciones',
    crowd_factor: 'Factor multitud',
    overlay_note: 'El mapa ilustrado es aproximado y no está a escala.',
    overlay_loading: 'Cargando el mapa del sitio…',
    overlay_server: 'La superposición necesita el servidor local: ejecuta py serve.py',
    overlay_fail: 'No se pudo cargar el mapa del sitio: {err}',
    overlay_unavailable: 'Superposición no disponible.',

    lu_doc_title: 'Programa',
    lu_title: 'Programa 2026',
    lu_sub: 'Elige los conciertos que quieres ver',
    lu_days_aria: 'Días del festival',
    lu_search_ph: 'Buscar artistas, países, escenarios…',
    lu_search_aria: 'Buscar',
    lu_view_aria: 'Vista',
    lu_grid: 'Cuadrícula', lu_list: 'Lista', lu_only: 'Solo mis elecciones',
    lu_total_one: '<b>{n}</b> concierto elegido en el festival',
    lu_total_other: '<b>{n}</b> conciertos elegidos en el festival',
    lu_total_none: 'Toca un concierto para añadirlo a tu plan',
    lu_empty_day: 'No hay presentaciones este día.',
    lu_empty_picks: 'Aún no has elegido nada para este día.',
    lu_empty_search: 'Nada coincide con tu búsqueda este día.',
    lu_overlaps: 'Se superpone con {acts}',
    lu_also: 'También: {list}',
    lu_my_day: 'Mi {weekday}',
    lu_nothing_day: 'Aún no has elegido nada para este día.',
    lu_tap_build: 'Toca conciertos para armar tu día.',
    lu_plan_btn: 'Planear mi ruta →',
    lu_hint_need: 'Elige al menos dos conciertos para planear una ruta.',
    lu_hint_ok: 'Tiempos a pie, cuándo salir y cómo manejar superposiciones.',
    lu_clear_day: 'Borrar este día',
    lu_remove: 'Quitar {act}',
    lu_dock_count: '{sets} el {weekday}',
    lu_dock_none: 'Nada elegido el {weekday}',
    lu_dock_add: 'Toca un concierto para añadirlo',
    lu_dock_review: 'Toca para revisar tus elecciones',
    lu_dock_overlap_one: '{n} superpuesto · toca para revisar',
    lu_dock_overlap_other: '{n} superpuestos · toca para revisar',
    lu_dock_aria: 'Revisar mis elecciones de este día',

    dup_title: 'Ya está en tu agenda',
    dup_body: '{act} ya está en tu plan:',
    dup_this: 'Este concierto: {when}',
    dup_swap: 'Cambiar a este concierto',
    dup_keep: 'Mantener ambos',
    dup_cancel: 'Cancelar',
    dup_badge: 'En tu plan · {when}',

    it_doc_title: 'Mi día',
    it_title: 'Mi día',
    it_title_day: 'Mi {weekday}',
    it_edit: '← Editar elecciones',
    it_days_aria: 'Días con elecciones',
    it_settings: 'Ajustes de caminata y mapa',
    it_buffer: 'Llegar antes por',
    it_shop: 'Tiempo de compras',
    it_overlay: 'Superponer mapa del sitio',
    it_opacity: 'Opacidad del mapa',
    it_settings_note: 'Los tiempos a pie suponen ~5 km/h × el factor multitud. No incluyen barreras ni cierres.',
    it_stat_sets: 'Conciertos', it_stat_music: 'De música', it_stat_walk: 'A pie · {dist}',
    it_missed_one: '{n} concierto no se alcanza con este plan: prueba otra opción abajo o quita una elección.',
    it_missed_other: '{n} conciertos no se alcanzan con este plan: prueba otra opción abajo o quita una elección.',
    it_tight_one: '{n} conexión ajustada: elige cómo manejarla abajo.',
    it_tight_other: '{n} conexiones ajustadas: elige cómo manejar cada una abajo.',
    it_all_fits: 'Todo encaja: puedes ver cada concierto completo.',
    it_empty: 'Aún no has elegido ningún concierto.',
    it_empty_link: 'Elige las bandas que quieres ver →',
    it_miss_all: 'Te perderías este concierto por completo con este plan',
    it_full: 'Concierto completo · {dur}',
    it_catch: 'Verás {a} de {b} · {bits}',
    it_miss_first: 'te pierdes los primeros {dur}',
    it_miss_last: 'te pierdes los últimos {dur}',
    it_be_at: 'Llega a {stage} antes de {time}',
    it_stay_at: 'Quédate en {stage}',
    it_leave: 'Salida {time}',
    it_walk_arrive: '→ {n} min a pie ({m} m) → llegada {time}',
    it_late: 'Llegas {dur} después de que empiece {act}',
    it_free_go: '{dur} libres antes de salir',
    it_free_break: '{dur} de descanso entre conciertos',
    it_free_food: ' — tiempo para comer o tomar algo',
    it_why_overlap: 'Estos conciertos se superponen.',
    it_why_tight: 'No hay tiempo para ver todo {act} y caminar.',
    it_choose: 'Elige:',
    it_opt_early: 'Ver el inicio de<br>{act}',
    it_opt_split: 'Dividir<br>la diferencia',
    it_opt_end: 'Quedarse hasta el final de<br>{act}',
    it_merch_title: 'Tienda del festival',
    it_merch_none: 'No hay parada en la tienda planeada para hoy.',
    it_merch_find: 'Buscar un momento para comprar',
    it_merch_set: 'Parada en la tienda: {time} en {booth}, {where}.',
    it_merch_change: 'Cambiar hora',
    it_merch_remove: 'Quitar',
    it_merch_best_fit: 'Mejor momento para comprar: {time} en {booth}, {where}; cabe en tu descanso con {n} min de margen.',
    it_merch_best_nofit: 'Mejor momento para comprar: {time} en {booth}, {where} (hoy ningún descanso alcanza para comprar sin perder música).',
    it_merch_add: 'Añadir a mi plan', it_merch_other: 'Otros horarios', it_merch_no: 'No, gracias',
    it_booth: 'el puesto de mercancía de {stage}',
    it_booth_name: 'Puesto de mercancía de {stage}',
    it_where_before: 'antes de {act}', it_where_between: 'entre {a} y {b}', it_where_after: 'después de {act}',
    it_spare: '{n} min de margen',
    it_to_booth: '→ {n} min a pie hasta el puesto',
    it_booth_here: 'el puesto está aquí mismo',
    it_shop_line: 'Compras {a}–{b} · {booth}',
    it_walk_to: '→ {n} min a pie hasta {stage}',
    it_stay_to: '→ quédate en {stage}',
    it_arrive: ' → llegada {time}',
    it_merch_stop: 'Parada en la tienda',
    it_merch_about: '{booth} · unos {n} min',
    it_then: 'Después',
    it_stage_here: 'el escenario está aquí mismo',

    pl_doc_title: 'Mapa de escenarios',
    pl_title_html: 'Mapa de <span>escenarios</span>',
    pl_sub: 'Tiempo a pie entre dos escenarios. Elige dos o toca los marcadores del mapa.',
    pl_from: 'Desde', pl_to: 'Hasta', pl_swap: 'Intercambiar',
    pl_choose: 'Elige dos lugares distintos',
    pl_pick_diff: 'Elige dos lugares distintos',
    pl_min_walk: 'min a pie',
    pl_meta: '{m} m ({mi} mi) · {n} min a paso normal',
    pl_crowd_hint: '1.0× = paso normal (~5 km/h). Súbelo para las multitudes del festival.',
    pl_overlay: 'Superponer mapa del festival',
    pl_matrix: 'Todos los tiempos a pie (min, con factor multitud)',
    pl_foot: 'Rutas con datos peatonales de OpenStreetMap, generadas el {date}. No incluyen cierres de calles ni barreras del festival.'
  };

  D.vi = {
    lang_label: 'Ngôn ngữ',
    nav_lineup: 'Lịch diễn', nav_myday: 'Ngày của tôi', nav_map: 'Bản đồ',
    dur_hm: '{h} giờ {m} phút', dur_h: '{h} giờ', dur_m: '{m} phút', min: '{n} phút',
    sets_one: '{n} buổi diễn', sets_other: '{n} buổi diễn',
    overlapping_one: '{n} trùng giờ', overlapping_other: '{n} trùng giờ',
    no_overlaps: 'không trùng giờ',
    crowd_factor: 'Hệ số đông người',
    overlay_note: 'Bản đồ minh họa chỉ mang tính tương đối, không theo tỷ lệ.',
    overlay_loading: 'Đang tải bản đồ khu vực…',
    overlay_server: 'Lớp phủ cần máy chủ cục bộ: chạy py serve.py',
    overlay_fail: 'Không tải được bản đồ khu vực: {err}',
    overlay_unavailable: 'Không có lớp phủ.',

    lu_doc_title: 'Lịch diễn',
    lu_title: 'Lịch diễn 2026',
    lu_sub: 'Chọn các buổi diễn bạn muốn xem',
    lu_days_aria: 'Các ngày lễ hội',
    lu_search_ph: 'Tìm nghệ sĩ, quốc gia, sân khấu…',
    lu_search_aria: 'Tìm kiếm',
    lu_view_aria: 'Chế độ xem',
    lu_grid: 'Lưới', lu_list: 'Danh sách', lu_only: 'Chỉ mục đã chọn',
    lu_total_one: 'Đã chọn <b>{n}</b> buổi diễn trong lễ hội',
    lu_total_other: 'Đã chọn <b>{n}</b> buổi diễn trong lễ hội',
    lu_total_none: 'Chạm vào một buổi diễn để thêm vào kế hoạch',
    lu_empty_day: 'Không có buổi diễn nào trong ngày này.',
    lu_empty_picks: 'Chưa chọn buổi nào trong ngày này.',
    lu_empty_search: 'Không có kết quả phù hợp trong ngày này.',
    lu_overlaps: 'Trùng giờ với {acts}',
    lu_also: 'Cũng diễn: {list}',
    lu_my_day: '{weekday} của tôi',
    lu_nothing_day: 'Chưa chọn buổi nào trong ngày này.',
    lu_tap_build: 'Chạm vào các buổi diễn để lên lịch cho ngày của bạn.',
    lu_plan_btn: 'Lập lộ trình →',
    lu_hint_need: 'Chọn ít nhất hai buổi diễn để lập lộ trình.',
    lu_hint_ok: 'Thời gian đi bộ, lúc nào nên đi và cách xử lý trùng giờ.',
    lu_clear_day: 'Xóa ngày này',
    lu_remove: 'Bỏ {act}',
    lu_dock_count: '{sets} vào {weekday}',
    lu_dock_none: 'Chưa chọn gì vào {weekday}',
    lu_dock_add: 'Chạm vào một buổi diễn để thêm',
    lu_dock_review: 'Chạm để xem lại lựa chọn',
    lu_dock_overlap_one: '{n} trùng giờ · chạm để xem lại',
    lu_dock_overlap_other: '{n} trùng giờ · chạm để xem lại',
    lu_dock_aria: 'Xem lại lựa chọn của ngày này',

    dup_title: 'Đã có trong lịch của bạn',
    dup_body: '{act} đã có trong kế hoạch của bạn:',
    dup_this: 'Buổi này: {when}',
    dup_swap: 'Đổi sang buổi này',
    dup_keep: 'Giữ cả hai',
    dup_cancel: 'Hủy',
    dup_badge: 'Trong kế hoạch · {when}',

    it_doc_title: 'Ngày của tôi',
    it_title: 'Ngày của tôi',
    it_title_day: '{weekday} của tôi',
    it_edit: '← Sửa lựa chọn',
    it_days_aria: 'Các ngày đã chọn',
    it_settings: 'Cài đặt đi bộ và bản đồ',
    it_buffer: 'Đến sớm',
    it_shop: 'Thời gian mua sắm',
    it_overlay: 'Lớp phủ bản đồ khu vực',
    it_opacity: 'Độ mờ lớp phủ',
    it_settings_note: 'Thời gian đi bộ tính theo ~5 km/h × hệ số đông người. Chưa tính rào chắn và đường bị chặn.',
    it_stat_sets: 'Buổi diễn', it_stat_music: 'Âm nhạc', it_stat_walk: 'Đi bộ · {dist}',
    it_missed_one: '{n} buổi diễn không kịp đến với kế hoạch này — hãy thử lựa chọn khác bên dưới hoặc bỏ bớt.',
    it_missed_other: '{n} buổi diễn không kịp đến với kế hoạch này — hãy thử lựa chọn khác bên dưới hoặc bỏ bớt.',
    it_tight_one: '{n} chặng chuyển gấp — hãy chọn cách xử lý bên dưới.',
    it_tight_other: '{n} chặng chuyển gấp — hãy chọn cách xử lý từng chặng bên dưới.',
    it_all_fits: 'Mọi thứ đều vừa — bạn có thể xem trọn vẹn từng buổi diễn.',
    it_empty: 'Bạn chưa chọn buổi diễn nào.',
    it_empty_link: 'Chọn các ban nhạc bạn muốn xem →',
    it_miss_all: 'Với kế hoạch này bạn sẽ lỡ toàn bộ buổi diễn',
    it_full: 'Trọn buổi · {dur}',
    it_catch: 'Xem được {a} trên {b} · {bits}',
    it_miss_first: 'lỡ {dur} đầu',
    it_miss_last: 'lỡ {dur} cuối',
    it_be_at: 'Có mặt tại {stage} trước {time}',
    it_stay_at: 'Ở lại {stage}',
    it_leave: 'Rời đi lúc {time}',
    it_walk_arrive: '→ đi bộ {n} phút ({m} m) → đến lúc {time}',
    it_late: 'Đến muộn {dur} sau khi {act} bắt đầu',
    it_free_go: 'Rảnh {dur} trước khi phải đi',
    it_free_break: 'Nghỉ {dur} giữa các buổi',
    it_free_food: ' — có thời gian ăn uống',
    it_why_overlap: 'Các buổi diễn này trùng giờ.',
    it_why_tight: 'Không đủ thời gian xem hết {act} rồi đi bộ sang.',
    it_choose: 'Chọn:',
    it_opt_early: 'Xem phần đầu của<br>{act}',
    it_opt_split: 'Chia đôi<br>thời gian',
    it_opt_end: 'Ở lại đến hết<br>{act}',
    it_merch_title: 'Đồ lưu niệm lễ hội',
    it_merch_none: 'Hôm nay chưa có điểm dừng mua đồ lưu niệm.',
    it_merch_find: 'Tìm thời gian mua sắm',
    it_merch_set: 'Ghé quầy lúc {time} tại {booth}, {where}.',
    it_merch_change: 'Đổi giờ',
    it_merch_remove: 'Bỏ',
    it_merch_best_fit: 'Thời điểm tốt nhất để mua: {time} tại {booth}, {where} — vừa với giờ nghỉ, còn dư {n} phút.',
    it_merch_best_nofit: 'Thời điểm tốt nhất để mua: {time} tại {booth}, {where} (hôm nay không có giờ nghỉ nào đủ dài mà không lỡ nhạc).',
    it_merch_add: 'Thêm vào kế hoạch', it_merch_other: 'Giờ khác', it_merch_no: 'Không, cảm ơn',
    it_booth: 'quầy lưu niệm {stage}',
    it_booth_name: 'Quầy lưu niệm {stage}',
    it_where_before: 'trước {act}', it_where_between: 'giữa {a} và {b}', it_where_after: 'sau {act}',
    it_spare: 'dư {n} phút',
    it_to_booth: '→ đi bộ {n} phút đến quầy lưu niệm',
    it_booth_here: 'quầy lưu niệm ở ngay đây',
    it_shop_line: 'Mua sắm {a}–{b} · {booth}',
    it_walk_to: '→ đi bộ {n} phút đến {stage}',
    it_stay_to: '→ ở lại {stage}',
    it_arrive: ' → đến lúc {time}',
    it_merch_stop: 'Ghé quầy lưu niệm',
    it_merch_about: '{booth} · khoảng {n} phút',
    it_then: 'Sau đó',
    it_stage_here: 'sân khấu ở ngay đây',

    pl_doc_title: 'Bản đồ sân khấu',
    pl_title_html: 'Bản đồ <span>sân khấu</span>',
    pl_sub: 'Thời gian đi bộ giữa hai sân khấu bất kỳ. Chọn hai nơi, hoặc chạm vào điểm trên bản đồ.',
    pl_from: 'Từ', pl_to: 'Đến', pl_swap: 'Đổi chiều',
    pl_choose: 'Chọn hai địa điểm khác nhau',
    pl_pick_diff: 'Chọn hai địa điểm khác nhau',
    pl_min_walk: 'phút đi bộ',
    pl_meta: '{m} m ({mi} mi) · {n} phút ở tốc độ bình thường',
    pl_crowd_hint: '1.0× = tốc độ đi bộ bình thường (~5 km/h). Tăng lên khi lễ hội đông người.',
    pl_overlay: 'Lớp phủ bản đồ lễ hội',
    pl_matrix: 'Tất cả thời gian đi bộ (phút, có hệ số đông người)',
    pl_foot: 'Lộ trình dựa trên dữ liệu đi bộ của OpenStreetMap, tạo ngày {date}. Chưa tính đường bị chặn và rào chắn của lễ hội.'
  };

  // ---------- current language ----------
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function recall(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function known(c) { return LANGS.some(function (l) { return l.code === c; }); }
  var fromUrl = new URLSearchParams(location.search).get('lang');
  var lang = known(fromUrl) ? fromUrl : (known(recall('fil-lang')) ? recall('fil-lang') : DEFAULT);
  if (known(fromUrl)) store('fil-lang', fromUrl);
  var L = LANGS.filter(function (l) { return l.code === lang; })[0];
  document.documentElement.lang = lang;

  var plural = new Intl.PluralRules(L.locale);
  function t(key, vars) {
    var s = D[lang][key];
    if (s == null) s = D.en[key];
    if (s == null) return key;
    return s.replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] != null ? vars[k] : m; });
  }
  function tn(key, n, vars) {
    var v = { n: n }; for (var k in vars) v[k] = vars[k];
    return t(key + (plural.select(n) === 'one' ? '_one' : '_other'), v);
  }

  // ---------- dates & times ----------
  var timeFmt = new Intl.DateTimeFormat(L.locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
  var hourFmt = new Intl.DateTimeFormat(L.locale, { hour: 'numeric', timeZone: 'UTC' });
  var wdLong = new Intl.DateTimeFormat(L.locale, { weekday: 'long', timeZone: 'UTC' });
  var wdShort = new Intl.DateTimeFormat(L.locale, { weekday: 'short', timeZone: 'UTC' });
  var mdFmt = new Intl.DateTimeFormat(L.locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  function asDate(date) { return new Date(date + 'T12:00:00Z'); }
  // minutes since midnight -> clock time; compact drops ":00" on the hour (7 PM, 19 h)
  function time(min, compact) {
    min = Math.round(min);
    var d = new Date(Date.UTC(2026, 0, 1, Math.floor(min / 60) % 24, ((min % 60) + 60) % 60));
    return (compact && min % 60 === 0 ? hourFmt : timeFmt).format(d);
  }
  function dur(m) {
    m = Math.round(m);
    var h = Math.floor(m / 60), r = m % 60;
    // {m} = minutes, {mm} = two-digit minutes (French writes 5 h 04)
    return h ? (r ? t('dur_hm', { h: h, m: r, mm: (r < 10 ? '0' : '') + r }) : t('dur_h', { h: h })) : t('dur_m', { m: r });
  }

  // ---------- static page text & the language menu ----------
  function applyStatic(root) {
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    root.querySelectorAll('[data-i18n-html]').forEach(function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    root.querySelectorAll('[data-i18n-ph]').forEach(function (el) { el.placeholder = t(el.getAttribute('data-i18n-ph')); });
    root.querySelectorAll('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
    root.querySelectorAll('[data-i18n-title]').forEach(function (el) { el.title = t(el.getAttribute('data-i18n-title')); });
    var dt = document.querySelector('meta[name="i18n-title"]');
    if (dt) document.title = t(dt.content) + ' · ' + PRODUCT;
  }
  function mountPicker() {
    document.querySelectorAll('.brand-bar').forEach(function (bar) {
      if (bar.querySelector('.lang-pick')) return;
      var wrap = document.createElement('label');
      wrap.className = 'lang-pick';
      wrap.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>';
      var sel = document.createElement('select');
      sel.setAttribute('aria-label', t('lang_label'));
      LANGS.forEach(function (l) {
        var o = document.createElement('option');
        o.value = l.code; o.textContent = l.name; o.lang = l.code;
        if (l.code === lang) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', function () {
        store('fil-lang', sel.value);
        var u = new URL(location.href); u.searchParams.delete('lang');
        location.replace(u.toString());
      });
      wrap.appendChild(sel);
      bar.appendChild(wrap);
    });
  }
  function init() { applyStatic(document); mountPicker(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.I18N = {
    lang: lang, locale: L.locale, langs: LANGS, product: PRODUCT,
    t: t, tn: tn, time: time, dur: dur,
    weekday: function (d) { return wdLong.format(asDate(d)); },
    weekdayShort: function (d) { return wdShort.format(asDate(d)); },
    monthDay: function (d) { return mdFmt.format(asDate(d)); },
    applyStatic: applyStatic
  };
})();
