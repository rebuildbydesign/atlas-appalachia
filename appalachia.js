// =============================================================================
// APPALACHIA FOCUS  (add-on; loaded AFTER scripts.js)
// -----------------------------------------------------------------------------
// Turns the national Atlas into a view of the full ARC Appalachian Region:
// all 423 Appalachian counties across 13 states, colored by the Atlas data,
// with the rest of the country muted. It:
//   1. filters the county choropleth / borders / labels to the 423 ARC
//      Appalachian counties (data/appalachia_geoids.json),
//   2. fades everything outside the region with a mask,
//   3. draws clear state boundary lines, the overall region outline, the 5 ARC
//      subregion divisions + labels, and per-state labels,
//   4. frames the map on the region.
//
// Design notes:
//   * Reuses the global `map` and the layers scripts.js already adds; only
//     setFilter()s them and adds new overlay layers. scripts.js data logic is
//     untouched.
//   * The county choropleth's GeoJSON source intermittently fails to tile on
//     the initial lazy-render load, so paintChoropleth() re-sets its data.
// =============================================================================
(function () {
  'use strict';

  // Full-region bounding box [W,S,E,N] -> [[W,S],[E,N]].
  var BOUNDS = [[-90.199, 32.232], [-74.17, 42.908]];
  // 13 Appalachian state FIPS (for clipping the national SVI tract tiles).
  var STATE_FIPS = ['01', '13', '21', '24', '28', '36', '37', '39', '42', '45', '47', '51', '54'];
  var APP_GEOIDS = [];   // 423 county GEOIDs, loaded from data/appalachia_geoids.json
  var SUB_GEOIDS = {};   // {subregion: [geoids]}, loaded from data/appalachia_subregion_geoids.json
  var STATE_GEOIDS = {}; // {state name: [geoids]}, loaded from data/appalachia_state_geoids.json
  // Multi-select checkbox filters. Empty = no filter (show the whole region).
  // The shown counties = union of the checked states' and subregions' counties.
  var selectedStates = [];  // array of checked state names
  var selectedSubs = [];    // array of checked subregion names

  // SVI resolution: county by default, census-tract on demand (scripts.js reads this).
  window.SVI_TRACT_DETAIL = false;

  // Per-subregion color, for both the boundary lines and the labels.
  var SUBREGION_COLOR = ['match', ['get', 'subregion'],
    'Northern', '#2166ac',
    'North Central', '#762a83',
    'Central', '#1b7837',
    'South Central', '#e08214',
    'Southern', '#c51b8a',
    '#555555'];

  // The GEOIDs currently shown: the whole region if nothing is checked, else
  // the union of every checked state's and subregion's counties.
  function activeGeoids() {
    if (!selectedStates.length && !selectedSubs.length) return APP_GEOIDS;
    var set = Object.create(null);
    selectedStates.forEach(function (s) { (STATE_GEOIDS[s] || []).forEach(function (g) { set[g] = 1; }); });
    selectedSubs.forEach(function (s) { (SUB_GEOIDS[s] || []).forEach(function (g) { set[g] = 1; }); });
    return Object.keys(set);
  }
  function countyFilter() { return ['in', ['get', 'GEOID'], ['literal', activeGeoids()]]; }

  function applyFocus() {
    ['atlas-fema-layer', 'app-county-borders', 'county-labels', 'atlas-fema-dots-layer'].forEach(function (id) {
      if (map.getLayer(id)) { try { map.setFilter(id, countyFilter()); } catch (e) {} }
    });
    // County names are noise at the region overview; only reveal them once the
    // user zooms into a state/area. State + subregion labels carry the wide view.
    if (map.getLayer('county-labels')) { try { map.setLayerZoomRange('county-labels', 7, 24); } catch (e) {} }
    // SVI tracts: clip to the 13 states (no filter) or the shown counties.
    var noFilter = !selectedStates.length && !selectedSubs.length;
    var tractFilter = noFilter
      ? ['in', ['slice', ['get', 'GEOID'], 0, 2], ['literal', STATE_FIPS]]
      : ['in', ['slice', ['get', 'GEOID'], 0, 5], ['literal', activeGeoids()]];
    ['svi-tracts-layer', 'svi-tracts-outline'].forEach(function (id) {
      if (map.getLayer(id)) { try { map.setFilter(id, tractFilter); } catch (e) {} }
    });
  }

  function frame() {
    map.fitBounds(BOUNDS, { padding: { top: 70, bottom: 30, left: 30, right: 30 }, duration: 0 });
  }

  // ----- Mute everything outside the region ---------------------------------
  function addMask() {
    if (map.getSource('app-mask')) return;
    map.addSource('app-mask', { type: 'geojson', data: 'data/appalachia_mask.geojson' });
    // Inserted BELOW the base 'water' fill so surrounding LAND is muted but the
    // water keeps its blue (the base style's water is #d9eff2). Falls back to
    // just under the choropleth if 'water' isn't found.
    var before = map.getLayer('water') ? 'water'
      : (map.getLayer('atlas-fema-layer') ? 'atlas-fema-layer' : undefined);
    map.addLayer({
      id: 'app-mask-fill', type: 'fill', source: 'app-mask',
      paint: { 'fill-color': '#eeece7', 'fill-opacity': 0.72 }
    }, before);
    // Basemap state labels stay ON (they render above the mask) so states in
    // AND around the region are labeled for navigation.
  }

  // ----- White county borders, from a REGION-ONLY source --------------------
  // scripts.js adds a `county-borders` layer on the NATIONAL county source, so
  // before its filter is applied it can draw county lines outside Appalachia.
  // We draw our own from the 423-county file (can never render outside the
  // region) and hide the national one.
  function addCountyBorders() {
    if (!map.getSource('app-counties')) {
      map.addSource('app-counties', { type: 'geojson', data: 'data/appalachia_counties.geojson' });
    }
    if (!map.getLayer('app-county-borders')) {
      map.addLayer({
        id: 'app-county-borders', type: 'line', source: 'app-counties',
        paint: {
          'line-color': '#ffffff',
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.4, 7, 0.8, 10, 1.2, 13, 1.8],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.55, 7, 0.8, 10, 0.95]
        }
      });
    }
    if (map.getLayer('county-borders')) {
      try { map.setLayoutProperty('county-borders', 'visibility', 'none'); } catch (e) {}
    }
  }

  // ----- Clear state boundary lines -----------------------------------------
  function addStateLines() {
    if (!map.getSource('app-states')) {
      map.addSource('app-states', { type: 'geojson', data: 'data/appalachia_states.geojson' });
    }
    if (!map.getLayer('app-state-lines')) {
      map.addLayer({
        id: 'app-state-lines', type: 'line', source: 'app-states',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#3f3f3f',
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.1, 7, 2.2]
        }
      });
    }
  }

  // ----- Overall region outline ---------------------------------------------
  function addRegionOutline() {
    if (!map.getSource('appalachia-boundary')) {
      map.addSource('appalachia-boundary', { type: 'geojson', data: 'data/appalachia_boundary.geojson' });
    }
    if (!map.getLayer('appalachia-boundary-casing')) {
      map.addLayer({
        id: 'appalachia-boundary-casing', type: 'line', source: 'appalachia-boundary',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 5, 'line-opacity': 0.85 }
      });
    }
    if (!map.getLayer('appalachia-boundary-line')) {
      map.addLayer({
        id: 'appalachia-boundary-line', type: 'line', source: 'appalachia-boundary',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#3d2b1f', 'line-width': 2.8 }
      });
    }
  }

  // ----- The 5 ARC subregions (color-coded outlines + labels) ---------------
  // Each subregion's boundary + label is drawn in its own color for legibility.
  // Selectable via the "Subregions" radio group (all / solo one).
  function addSubregions() {
    if (!map.getSource('app-subregions')) {
      map.addSource('app-subregions', { type: 'geojson', data: 'data/appalachia_subregions.geojson' });
    }
    if (!map.getLayer('app-subregion-casing')) {
      map.addLayer({
        id: 'app-subregion-casing', type: 'line', source: 'app-subregions',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 5, 'line-opacity': 0.9 }
      });
    }
    if (!map.getLayer('app-subregion-line')) {
      map.addLayer({
        id: 'app-subregion-line', type: 'line', source: 'app-subregions',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': SUBREGION_COLOR, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.8, 7, 3.2] }
      });
    }
    if (!map.getSource('app-subregion-labels')) {
      map.addSource('app-subregion-labels', { type: 'geojson', data: 'data/appalachia_subregion_labels.geojson' });
    }
    if (!map.getLayer('app-subregion-labels-layer')) {
      map.addLayer({
        id: 'app-subregion-labels-layer', type: 'symbol', source: 'app-subregion-labels',
        layout: {
          'text-field': ['concat', ['get', 'subregion'], '\nAppalachia'],
          'text-font': ['Apercu Pro Bold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 12, 7, 18],
          'text-transform': 'uppercase', 'text-letter-spacing': 0.06,
          'text-line-height': 1.1, 'text-padding': 6,
          // The 5 subregions are the featured overlay — always draw them.
          'text-allow-overlap': true, 'text-ignore-placement': true
        },
        paint: { 'text-color': SUBREGION_COLOR, 'text-halo-color': '#ffffff', 'text-halo-width': 2.8 }
      });
    }
  }

  // Grey wash over the region counties that are NOT in the current selection,
  // so the checked states/subregions read in color and the rest fade back.
  // Uses the county choropleth's own source; a filter that matches nothing
  // (i.e. when nothing is checked) means no dimming.
  function addNonselDim() {
    if (map.getLayer('app-nonsel-dim')) return;
    if (!map.getSource('atlas-fema')) return;  // added by scripts.js
    map.addLayer({
      id: 'app-nonsel-dim', type: 'fill', source: 'atlas-fema',
      filter: ['==', ['get', 'GEOID'], '__none__'],
      paint: { 'fill-color': '#eeece7', 'fill-opacity': 0.78 }
    });
  }

  // Recompute the view from the checked states + subregions.
  function applySelection() {
    var hasFilter = selectedStates.length > 0 || selectedSubs.length > 0;
    applyFocus();  // choropleth / borders / county labels / tracts -> activeGeoids()

    // Dim the region counties that are NOT shown (empty selection -> dim none).
    if (map.getLayer('app-nonsel-dim')) {
      var shown = activeGeoids();
      var dimFilter = hasFilter
        ? ['all',
            ['in', ['get', 'GEOID'], ['literal', APP_GEOIDS]],
            ['!', ['in', ['get', 'GEOID'], ['literal', shown]]]]
        : ['==', ['get', 'GEOID'], '__none__'];
      try { map.setFilter('app-nonsel-dim', dimFilter); } catch (e) {}
    }

    // Subregion overlay: show the checked subregions; if only states are
    // checked, hide it (state-focused view); if nothing is checked, show all 5.
    var srVis, srFilter;
    if (selectedSubs.length) { srVis = 'visible'; srFilter = ['in', ['get', 'subregion'], ['literal', selectedSubs]]; }
    else if (selectedStates.length) { srVis = 'none'; srFilter = null; }
    else { srVis = 'visible'; srFilter = null; }
    ['app-subregion-casing', 'app-subregion-line', 'app-subregion-labels-layer'].forEach(function (id) {
      if (map.getLayer(id)) {
        try { map.setFilter(id, srFilter); } catch (e) {}
        map.setLayoutProperty(id, 'visibility', srVis);
      }
    });

    // The overall region outline only makes sense in the unfiltered full view.
    ['appalachia-boundary-casing', 'appalachia-boundary-line'].forEach(function (id) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', hasFilter ? 'none' : 'visible');
    });
    restack();
  }

  function readChecked(selector) {
    return Array.prototype.slice.call(document.querySelectorAll(selector))
      .filter(function (c) { return c.checked; })
      .map(function (c) { return c.value; });
  }

  // Summarize a dropdown's checked state in its trigger label.
  function updateMsLabel(dd) {
    var label = dd.querySelector('.ms-label');
    if (!label) return;
    var checked = Array.prototype.filter.call(
      dd.querySelectorAll('input[type="checkbox"]'), function (c) { return c.checked; });
    if (!checked.length) label.textContent = dd.getAttribute('data-all') || 'All';
    else if (checked.length === 1) label.textContent = checked[0].value;
    else label.textContent = checked.length + ' selected';
  }

  // ----- Control-panel wiring (dropdown selectors, checkboxes, SVI toggle) ---
  function wireControls() {
    document.querySelectorAll('.state-check, .subregion-check').forEach(function (c) {
      if (c._wired) return;
      c._wired = true;
      c.addEventListener('change', function () {
        selectedStates = readChecked('.state-check');
        selectedSubs = readChecked('.subregion-check');
        applySelection();
        document.querySelectorAll('.ms-dropdown').forEach(updateMsLabel);
      });
    });

    // Collapsible multi-select dropdowns.
    document.querySelectorAll('.ms-dropdown').forEach(function (dd) {
      var trigger = dd.querySelector('.ms-trigger');
      var panel = dd.querySelector('.ms-panel');
      if (trigger && !trigger._wired) {
        trigger._wired = true;
        trigger.addEventListener('click', function (e) {
          e.stopPropagation();
          var open = dd.classList.toggle('ms-open');
          trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
      }
      if (panel && !panel._wired) {
        panel._wired = true;
        panel.addEventListener('click', function (e) { e.stopPropagation(); }); // stay open while checking
      }
      updateMsLabel(dd);
    });
    if (!document._msOutside) {
      document._msOutside = true;
      document.addEventListener('click', function () {
        document.querySelectorAll('.ms-dropdown.ms-open').forEach(function (dd) {
          dd.classList.remove('ms-open');
          var t = dd.querySelector('.ms-trigger');
          if (t) t.setAttribute('aria-expanded', 'false');
        });
      });
    }

    var sviToggle = document.getElementById('svi-tract-toggle');
    if (sviToggle && !sviToggle._wired) {
      sviToggle._wired = true;
      sviToggle.addEventListener('change', function (e) {
        window.SVI_TRACT_DETAIL = e.target.checked;
        if (window.applyAtlasStyling) window.applyAtlasStyling();
        applyFocus();  // re-apply the tract filter after the restyle
      });
    }
  }

  // The choropleth's GeoJSON source occasionally fails to tile on the initial
  // lazy-render load. Force it: re-set the data (browser-cached) and repaint
  // once the new data has finished tiling.
  function paintChoropleth() {
    fetch('data/Atlas_FEMA_V2.geojson')
      .then(function (r) { return r.json(); })
      .then(function (geo) {
        var src = map.getSource('atlas-fema');
        if (!src) return;
        src.setData(geo);
        applyFocus();
        var onData = function (e) {
          if (e.sourceId === 'atlas-fema' && e.isSourceLoaded) {
            applyFocus();
            map.triggerRepaint();
            map.off('sourcedata', onData);
          }
        };
        map.on('sourcedata', onData);
        map.triggerRepaint();
      })
      .catch(function (e) { console.error('[appalachia] choropleth reload failed', e); });
  }

  // Keep the label/line overlays above the choropleth after async layers land.
  // Order matters: later = on top = higher label collision priority. County
  // names sit BELOW the state + subregion labels so the wide-view labels win.
  function restack() {
    ['app-county-borders', 'app-state-lines', 'appalachia-boundary-casing', 'appalachia-boundary-line',
     'county-labels', 'app-subregion-casing', 'app-subregion-line',
     'app-subregion-labels-layer'
    ].forEach(function (id) { if (map.getLayer(id)) map.moveLayer(id); });
  }

  // ----- boot ---------------------------------------------------------------
  function boot() {
    Promise.all([
      fetch('data/appalachia_geoids.json').then(function (r) { return r.json(); }),
      fetch('data/appalachia_subregion_geoids.json').then(function (r) { return r.json(); }),
      fetch('data/appalachia_state_geoids.json').then(function (r) { return r.json(); })
    ])
      .then(function (res) {
        APP_GEOIDS = res[0];
        SUB_GEOIDS = res[1];
        STATE_GEOIDS = res[2];
        applyFocus();
        frame();
        addMask();
        addCountyBorders();
        addStateLines();
        addRegionOutline();
        addSubregions();
        addNonselDim();
        wireControls();
        paintChoropleth();
        restack();
        // Dots + county labels are added by a slow async fetch in scripts.js
        // (after the 5MB geojson downloads). Keep re-applying the filter,
        // zoom range, and restack until county-labels exists AND its minzoom
        // has been raised — then stop. Capped so it can't run forever.
        var tries = 0;
        var iv = setInterval(function () {
          applyFocus(); restack();
          var cl = map.getLayer('county-labels');
          if ((cl && cl.minzoom >= 7) || ++tries > 40) clearInterval(iv);
        }, 350);
      })
      .catch(function (e) { console.error('[appalachia] geoid load failed', e); });
  }

  // Legend collapse/expand (pure DOM — works even before the map loads).
  function wireLegendToggle() {
    var lt = document.getElementById('legend-toggle');
    if (!lt || lt._wired) return;
    lt._wired = true;
    lt.addEventListener('click', function () {
      var lg = document.getElementById('legend');
      var collapsed = lg.classList.toggle('legend-collapsed');
      lt.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      var icon = lt.querySelector('.legend-toggle-icon');
      if (icon) icon.textContent = collapsed ? '+' : '−';
    });
  }
  wireLegendToggle();

  if (map.loaded()) boot(); else map.on('load', boot);
})();
