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

  function countyFilter() { return ['in', ['get', 'GEOID'], ['literal', APP_GEOIDS]]; }

  function applyFocus() {
    ['atlas-fema-layer', 'county-borders', 'county-labels', 'atlas-fema-dots-layer'].forEach(function (id) {
      if (map.getLayer(id)) { try { map.setFilter(id, countyFilter()); } catch (e) {} }
    });
    // County names are noise at the region overview; only reveal them once the
    // user zooms into a state/area. State + subregion labels carry the wide view.
    if (map.getLayer('county-labels')) { try { map.setLayerZoomRange('county-labels', 7, 24); } catch (e) {} }
    ['svi-tracts-layer', 'svi-tracts-outline'].forEach(function (id) {
      if (map.getLayer(id)) {
        try { map.setFilter(id, ['in', ['slice', ['get', 'GEOID'], 0, 2], ['literal', STATE_FIPS]]); } catch (e) {}
      }
    });
  }

  function frame() {
    map.fitBounds(BOUNDS, { padding: { top: 70, bottom: 30, left: 30, right: 30 }, duration: 0 });
  }

  // ----- Mute everything outside the region ---------------------------------
  function addMask() {
    if (map.getSource('app-mask')) return;
    map.addSource('app-mask', { type: 'geojson', data: 'data/appalachia_mask.geojson' });
    // Sits just under the choropleth (above the basemap fills) so the region
    // reads as the subject and the surrounding country fades back.
    map.addLayer({
      id: 'app-mask-fill', type: 'fill', source: 'app-mask',
      paint: { 'fill-color': '#eeece7', 'fill-opacity': 0.74 }
    }, map.getLayer('atlas-fema-layer') ? 'atlas-fema-layer' : undefined);
    // Hide the basemap's full-state labels; we place our own on the region.
    if (map.getLayer('state-label')) { try { map.setLayoutProperty('state-label', 'visibility', 'none'); } catch (e) {} }
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

  // ----- The 5 ARC subregions (division lines + labels) ---------------------
  // Loads from files built from the ARC county->subregion crosswalk; no-ops
  // gracefully if they aren't present yet.
  function addSubregions() {
    if (!map.getSource('app-subregion-lines')) {
      map.addSource('app-subregion-lines', { type: 'geojson', data: 'data/appalachia_subregion_lines.geojson' });
    }
    if (!map.getLayer('app-subregion-lines-casing')) {
      map.addLayer({
        id: 'app-subregion-lines-casing', type: 'line', source: 'app-subregion-lines',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 3.6, 'line-opacity': 0.7 }
      });
    }
    if (!map.getLayer('app-subregion-lines-layer')) {
      map.addLayer({
        id: 'app-subregion-lines-layer', type: 'line', source: 'app-subregion-lines',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#1b4b5a', 'line-width': 1.8, 'line-dasharray': [3, 2] }
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
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 11, 7, 16],
          'text-transform': 'uppercase', 'text-letter-spacing': 0.06,
          'text-line-height': 1.1, 'text-allow-overlap': false, 'text-padding': 6
        },
        paint: { 'text-color': '#123540', 'text-halo-color': '#ffffff', 'text-halo-width': 2.4 }
      });
    }
  }

  // ----- Per-state labels ----------------------------------------------------
  function addStateLabels() {
    if (!map.getSource('app-state-labels')) {
      map.addSource('app-state-labels', { type: 'geojson', data: 'data/appalachia_state_labels.geojson' });
    }
    if (!map.getLayer('app-state-labels-layer')) {
      map.addLayer({
        id: 'app-state-labels-layer', type: 'symbol', source: 'app-state-labels',
        minzoom: 4.4,
        layout: {
          'text-field': ['get', 'STATE_NAME'],
          'text-font': ['Apercu Pro Bold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 11, 8, 17],
          'text-transform': 'uppercase', 'text-letter-spacing': 0.12,
          'text-allow-overlap': false, 'text-padding': 4
        },
        paint: { 'text-color': '#2a2a2a', 'text-halo-color': '#ffffff', 'text-halo-width': 2.2 }
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
    ['app-state-lines', 'appalachia-boundary-casing', 'appalachia-boundary-line',
     'county-labels', 'app-subregion-lines-casing', 'app-subregion-lines-layer',
     'app-subregion-labels-layer', 'app-state-labels-layer'
    ].forEach(function (id) { if (map.getLayer(id)) map.moveLayer(id); });
  }

  // ----- boot ---------------------------------------------------------------
  function boot() {
    fetch('data/appalachia_geoids.json')
      .then(function (r) { return r.json(); })
      .then(function (ids) {
        APP_GEOIDS = ids;
        applyFocus();
        frame();
        addMask();
        addStateLines();
        addRegionOutline();
        addSubregions();
        addStateLabels();
        paintChoropleth();
        restack();
        // Dots + county labels are added by an async fetch in scripts.js;
        // re-apply the filter + restack a few times until they exist.
        var tries = 0;
        var iv = setInterval(function () {
          applyFocus(); restack();
          if (map.getLayer('county-labels') || ++tries > 12) clearInterval(iv);
        }, 350);
      })
      .catch(function (e) { console.error('[appalachia] geoid load failed', e); });
  }

  if (map.loaded()) boot(); else map.on('load', boot);
})();
