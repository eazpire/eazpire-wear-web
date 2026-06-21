/**
 * Wear hub — Android app download widget (Play Store or native app).
 */
(function () {
  "use strict";

  var PLAY_URL = "https://play.google.com/store/apps/details?id=com.eazpire.wear";
  var ANDROID_PKG = "com.eazpire.wear";

  function isAndroidMobile() {
    return /Android/i.test(navigator.userAgent || "");
  }

  function openWearAndroidApp(e) {
    if (!isAndroidMobile()) return;
    e.preventDefault();
    var fallback = encodeURIComponent(PLAY_URL);
    var intent =
      "intent://#Intent;scheme=https;package=" +
      ANDROID_PKG +
      ";action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;S.browser_fallback_url=" +
      fallback +
      ";end";
    var w = window.open("", "_blank", "noopener,noreferrer");
    if (w) {
      try {
        w.location.href = intent;
        return;
      } catch (err) {
        try {
          w.close();
        } catch (e2) {}
      }
    }
    window.open(PLAY_URL, "_blank", "noopener,noreferrer");
  }

  function bind() {
    var el = document.getElementById("wearAndroidDownload");
    if (!el || el.getAttribute("data-wear-android-bound") === "1") return;
    el.setAttribute("data-wear-android-bound", "1");
    el.addEventListener("click", openWearAndroidApp);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
