/**
 * Applies admin-assigned wear virtual slots from platform-sync manifest.
 */
(function (global) {
  "use strict";

  var MANIFEST_URL =
    "https://creator-engine.eazpire.workers.dev/apps/creator-dispatch?op=platform-sync-asset&file=wear-virtual-manifest.json";

  function applySlot(selector, entry) {
    if (!selector || !entry) return;
    var nodes = document.querySelectorAll(selector);
    if (!nodes.length) return;

    nodes.forEach(function (el) {
      if (entry.type === "emoji") {
        el.textContent = entry.value || el.textContent;
        el.removeAttribute("data-wear-img");
        var injected = el.querySelector("img[data-wear-img]");
        if (injected) injected.remove();
        return;
      }
      if (entry.type === "image" && entry.url) {
        if (el.tagName === "IMG") {
          el.src = entry.url;
          el.setAttribute("data-wear-img", "1");
          return;
        }
        var img = el.querySelector("img[data-wear-img]");
        if (!img) {
          img = document.createElement("img");
          img.alt = "";
          img.setAttribute("data-wear-img", "1");
          el.textContent = "";
          el.appendChild(img);
        }
        img.src = entry.url;
      }
    });
  }

  function applyManifest(manifest) {
    var slots = manifest && manifest.slots;
    if (!slots || typeof slots !== "object") return 0;
    var count = 0;
    Object.keys(slots).forEach(function (key) {
      var entry = slots[key];
      var selector = entry && (entry.selector || entry.css);
      if (!selector) return;
      applySlot(selector, entry);
      count++;
    });
    return count;
  }

  function loadOverrides() {
    var manifestPromise = fetch(MANIFEST_URL, { cache: "no-store", credentials: "omit" })
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (data) {
        if (!data) return 0;
        return applyManifest(data);
      })
      .catch(function () {
        return 0;
      });

    var coinPromise = fetch(
      "https://creator-engine.eazpire.workers.dev/apps/creator-dispatch?op=platform-asset-manifest&_t=" +
        Date.now(),
      { cache: "no-store", credentials: "omit" }
    )
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (data) {
        var url = data && data.ok && data.assets && data.assets.eazc_coin_logo;
        if (!url) return;
        document.querySelectorAll('[data-eaz-coin="eazc"]').forEach(function (img) {
          if (img && img.tagName === "IMG") img.src = url;
        });
      })
      .catch(function () {});

    return Promise.all([manifestPromise, coinPromise]).then(function (r) {
      return r[0] || 0;
    });
  }

  global.WearAssetOverrides = {
    load: loadOverrides,
    apply: applyManifest,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadOverrides);
  } else {
    loadOverrides();
  }
})(typeof window !== "undefined" ? window : globalThis);
