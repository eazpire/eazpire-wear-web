/**
 * Eazpire Wear boot splash — segmented loader until app init completes.
 */
(function (global) {
  "use strict";

  var SEGMENTS = 16;
  var MIN_MS = 850;
  var startedAt = Date.now();
  var progress = 0;
  var target = 0;
  var initDone = false;
  var windowLoaded = false;
  var tickTimer = null;

  var STATUS_LINES = [
    "Loading Wear Hub",
    "Syncing Artifacts",
    "Preparing Feed",
    "Almost ready",
  ];

  function qs(id) {
    return document.getElementById(id);
  }

  function buildBar() {
    var bar = qs("wearBootLoaderBar");
    if (!bar || bar.dataset.ready) return;
    bar.dataset.ready = "1";
    var html = "";
    for (var i = 0; i < SEGMENTS; i++) {
      html +=
        '<span class="wear-boot-loader__seg" data-seg="' +
        i +
        '"><span class="wear-boot-loader__seg-fill"></span></span>';
    }
    bar.innerHTML = html;
  }

  function renderProgress() {
    var bar = qs("wearBootLoaderBar");
    if (!bar) return;
    var segs = bar.querySelectorAll(".wear-boot-loader__seg");
    for (var i = 0; i < segs.length; i++) {
      var lit = i < progress;
      segs[i].classList.toggle("is-lit", lit);
      segs[i].classList.toggle("is-active", lit && i === progress - 1);
    }

    var status = qs("wearBootLoaderStatus");
    if (status) {
      var idx = Math.min(STATUS_LINES.length - 1, Math.floor((progress / SEGMENTS) * STATUS_LINES.length));
      status.textContent = STATUS_LINES[idx];
    }
  }

  function setTarget(next) {
    target = Math.max(target, Math.min(SEGMENTS, next));
  }

  function tick() {
    if (progress < target) {
      progress += 1;
      renderProgress();
    }
    if (progress >= SEGMENTS && initDone && windowLoaded && Date.now() - startedAt >= MIN_MS) {
      finish();
      return;
    }
    tickTimer = setTimeout(tick, progress < target ? 70 : 120);
  }

  function finish() {
    if (tickTimer) clearTimeout(tickTimer);
    var root = qs("wearBootLoader");
    if (!root) {
      document.body.classList.remove("is-boot-loading");
      return;
    }
    progress = SEGMENTS;
    renderProgress();
    root.classList.add("is-done");
    document.body.classList.remove("is-boot-loading");
    setTimeout(function () {
      if (root.parentNode) root.parentNode.removeChild(root);
    }, 480);
  }

  function bootTick() {
    if (!tickTimer) tick();
  }

  buildBar();
  setTarget(4);
  bootTick();

  document.addEventListener("DOMContentLoaded", function () {
    setTarget(8);
    bootTick();
  });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      setTarget(10);
      bootTick();
    });
  }

  window.addEventListener("load", function () {
    windowLoaded = true;
    setTarget(12);
    bootTick();
  });

  global.__wearBootLoaderDone = function () {
    initDone = true;
    setTarget(SEGMENTS);
    bootTick();
  };
})(window);
