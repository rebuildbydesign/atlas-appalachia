// =============================================================================
// APPALACHIA FOCUS  (add-on; loaded AFTER scripts.js)
// -----------------------------------------------------------------------------
// Turns the national Atlas into a fixed three-state Appalachia view for a
// slideshow: Kentucky, West Virginia, North Carolina. It
//   1. filters the county choropleth / borders / labels to those three states,
//   2. frames the map on the region,
//   3. draws the official ARC Appalachian Region outline on top, and
//   4. injects a per-state Atlas snapshot panel (full state vs. Appalachian
//      counties) built from data/appalachia_summary.json.
//
// Design notes:
//   * Reuses the existing global `map` and the layers scripts.js already adds.
//     Nothing in scripts.js's data logic is modified — this only setFilter()s
//     and adds two new layers + a panel.
//   * The dots / county-label layers are added inside an async fetch in
//     scripts.js, so applyFocus() is re-run a few times after load to catch
//     them once they exist.
// =============================================================================
(function () {
  'use strict';

  var FOCUS = ['Kentucky', 'West Virginia', 'North Carolina'];
  var FOCUS_FILTER = ['match', ['get', 'STATE_NAME'], FOCUS, true, false];
  // Bounding box of the three full states [W,S,E,N] -> [[W,S],[E,N]].
  var BOUNDS = [[-89.571, 33.88], [-75.698, 40.639]];

  function focusLayer(id) {
    if (map.getLayer(id)) { try { map.setFilter(id, FOCUS_FILTER); } catch (e) {} }
  }

  function applyFocus() {
    focusLayer('atlas-fema-layer');
    focusLayer('county-borders');
    focusLayer('atlas-fema-dots-layer');
    focusLayer('county-labels');
    // Tract SVI layers are national vector tiles; leaving them unfiltered is
    // fine because the camera is locked to the region, but clip via GEOID
    // prefix (21 = KY, 54 = WV, 37 = NC) so drilling into SVI stays on-region.
    ['svi-tracts-layer', 'svi-tracts-outline'].forEach(function (id) {
      if (map.getLayer(id)) {
        try {
          map.setFilter(id, ['any',
            ['==', ['slice', ['get', 'GEOID'], 0, 2], '21'],
            ['==', ['slice', ['get', 'GEOID'], 0, 2], '54'],
            ['==', ['slice', ['get', 'GEOID'], 0, 2], '37']
          ]);
        } catch (e) {}
      }
    });
  }

  function frame() {
    map.fitBounds(BOUNDS, { padding: { top: 90, bottom: 40, left: 40, right: 40 }, duration: 0 });
  }

  // ----- ARC Appalachian Region outline -------------------------------------
  function addBoundary() {
    if (map.getSource('appalachia-boundary')) return;
    map.addSource('appalachia-boundary', { type: 'geojson', data: 'data/appalachia_boundary.geojson' });
    // White casing underneath so the line reads over any choropleth color.
    map.addLayer({
      id: 'appalachia-boundary-casing', type: 'line', source: 'appalachia-boundary',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': 4.5, 'line-opacity': 0.85 }
    });
    map.addLayer({
      id: 'appalachia-boundary-line', type: 'line', source: 'appalachia-boundary',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#6d3410', 'line-width': 2.4, 'line-dasharray': [2, 1.3] }
    });
    // Keep county labels above the outline.
    if (map.getLayer('county-labels')) map.moveLayer('county-labels');
  }

  // ----- Per-state Atlas snapshot panel -------------------------------------
  function moneyAbbr(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  var money = function (n) { return (n === null || n === undefined) ? '—' : '$' + Math.round(n).toLocaleString(); };
  var mins = function (n) { return (n === null || n === undefined) ? '—' : Math.round(n).toLocaleString() + ' min'; };
  var dec2 = function (n) { return (n === null || n === undefined) ? '—' : Number(n).toFixed(2); };

  // One metric row: label, full-state value, Appalachian value.
  function row(label, full, app, note) {
    return '<tr><th>' + label + (note ? '<span class="ap-note">' + note + '</span>' : '') + '</th>'
      + '<td>' + full + '</td><td class="ap-col-app">' + app + '</td></tr>';
  }

  function stateCard(name, d) {
    var f = d.full, a = d.appalachia;
    var wholeState = (f.counties === a.counties); // WV: entirely Appalachian
    var rows = ''
      + row('Counties', f.counties, a.counties)
      + row('FEMA disaster declarations',
          f.state_declaration_count + ' <span class="ap-unit">statewide</span>',
          'median ' + a.decl_median + '/county <span class="ap-unit">(max ' + a.decl_max + ')</span>',
          'events are never summed across counties')
      + row('Counties declared 5+ times', f.decl_5plus_counties, a.decl_5plus_counties)
      + row('FEMA obligations (total)', moneyAbbr(f.fema_total), moneyAbbr(a.fema_total))
      + row('FEMA per capita', money(f.per_capita), money(a.per_capita))
      + row('Median social vulnerability (SVI)', dec2(f.svi_median), dec2(a.svi_median))
      + row('Counties SVI very high', f.svi_vhigh_share + '%', a.svi_vhigh_share + '%')
      + row('Median outage (SAIDI/yr)', mins(f.saidi_median), mins(a.saidi_median));

    return '<div class="ap-card">'
      + '<div class="ap-card-head">' + name
        + (wholeState ? '<span class="ap-badge">entirely Appalachian</span>' : '') + '</div>'
      + '<table class="ap-table"><thead><tr><th></th>'
        + '<th>Full state</th><th class="ap-col-app">Appalachian counties</th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table></div>';
  }

  function buildPanel(data) {
    var btn = document.createElement('button');
    btn.id = 'ap-toggle';
    btn.type = 'button';
    btn.innerHTML = '<i class="fas fa-mountain" aria-hidden="true"></i> State snapshots';

    var panel = document.createElement('div');
    panel.id = 'ap-panel';
    var cards = ['Kentucky', 'West Virginia', 'North Carolina']
      .filter(function (n) { return data[n]; })
      .map(function (n) { return stateCard(n, data[n]); }).join('');
    panel.innerHTML =
      '<div class="ap-panel-head">'
        + '<span class="ap-panel-title">Appalachia · Atlas Snapshot</span>'
        + '<button id="ap-close" type="button" aria-label="Close">&times;</button>'
      + '</div>'
      + '<div class="ap-panel-sub">FEMA declarations &amp; funding, social vulnerability, and energy '
        + 'reliability across the ARC Appalachian Region. Each state shows the whole state beside its '
        + 'Appalachian counties only.</div>'
      + '<div class="ap-cards">' + cards + '</div>'
      + '<div class="ap-foot">Region = Appalachian Regional Commission definition '
        + '(all 55 WV counties, 54 eastern KY, 31 western NC). Atlas of Accountability, Rebuild by Design, 2011–2024.</div>';

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    function open(v) { panel.classList.toggle('ap-open', v); btn.classList.toggle('ap-hidden', v); }
    btn.addEventListener('click', function () { open(true); });
    panel.querySelector('#ap-close').addEventListener('click', function () { open(false); });
  }

  // ----- boot ---------------------------------------------------------------
  function boot() {
    applyFocus();
    frame();
    addBoundary();
    // Dots + county labels are added by an async fetch in scripts.js; re-apply
    // the state filter a few times until they exist.
    var tries = 0;
    var iv = setInterval(function () {
      applyFocus();
      if (map.getLayer('county-labels') || ++tries > 12) clearInterval(iv);
    }, 350);

    fetch('data/appalachia_summary.json')
      .then(function (r) { return r.json(); })
      .then(buildPanel)
      .catch(function (e) { console.error('[appalachia] summary load failed', e); });
  }

  if (map.loaded()) boot(); else map.on('load', boot);
})();
