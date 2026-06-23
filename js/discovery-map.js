/**
 * MapLibre fog map for World Discovery (wear-web)
 */
(function (global) {
  "use strict";

  var map = null;
  var mapLoaded = false;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) {
        resolve();
        return;
      }
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function loadCss(href) {
    if (document.querySelector('link[href="' + href + '"]')) return;
    var l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    document.head.appendChild(l);
  }

  async function ensureMapLibre() {
    loadCss("https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css");
    await loadScript("https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js");
    await loadScript("https://unpkg.com/h3-js@4.1.0/dist/h3-js.umd.js");
  }

  function h3ToFeature(h3Index) {
    var h3 = global.h3;
    if (!h3 || !h3.cellToBoundary) return null;
    var ring = h3.cellToBoundary(h3Index, true);
    return {
      type: "Feature",
      properties: { h3: h3Index },
      geometry: { type: "Polygon", coordinates: [ring] },
    };
  }

  async function initMap() {
    var container = document.getElementById("discoveryMap");
    if (!container || mapLoaded) return;

    await ensureMapLibre();
    var cfg = await global.CommunityApi.discoveryConfig();
    var styleUrl =
      (cfg.map && cfg.map.style_url) ||
      "https://demotiles.maplibre.org/style.json";

    var center = [8.5417, 47.3769];
    try {
      var st = await global.CommunityApi.discoveryStatus();
      if (st.home && st.home.lng && st.home.lat) {
        center = [st.home.lng, st.home.lat];
      }
    } catch (_) {}

    map = new global.maplibregl.Map({
      container: "discoveryMap",
      style: styleUrl,
      center: center,
      zoom: 13,
    });

    map.on("load", function () {
      map.addSource("discovered", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "discovered-fill",
        type: "fill",
        source: "discovered",
        paint: {
          "fill-color": "#22c55e",
          "fill-opacity": 0.42,
        },
      });
      mapLoaded = true;
      refreshCells();
    });
  }

  async function refreshCells() {
    if (!map || !mapLoaded) return;
    try {
      var data = await global.CommunityApi.discoveryMapTiles();
      var cells = data.cells || [];
      var features = cells
        .map(h3ToFeature)
        .filter(function (f) {
          return !!f;
        });
      var src = map.getSource("discovered");
      if (src) {
        src.setData({ type: "FeatureCollection", features: features });
      }
    } catch (_) {}
  }

  async function refresh() {
    var page = document.querySelector('[data-page="move"]');
    if (!page || !page.classList.contains("active")) return;
    if (!mapLoaded) await initMap();
    else await refreshCells();
  }

  global.CommunityDiscoveryMap = {
    refresh: refresh,
    initMap: initMap,
  };
})(window);
