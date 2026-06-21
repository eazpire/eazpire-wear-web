/**
 * Eazpire Wear sign-in modal — dark game UI, no storefront copy.
 */
(function (global) {
  "use strict";

  var modalEl = null;
  var OAUTH_START = "/auth/login";

  function qs(id) {
    return document.getElementById(id);
  }

  function open() {
    if (!modalEl) modalEl = qs("communityLoginModal");
    if (!modalEl) return;
    modalEl.classList.add("open");
    modalEl.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function close() {
    if (!modalEl) modalEl = qs("communityLoginModal");
    if (!modalEl) return;
    modalEl.classList.remove("open");
    modalEl.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function startOAuth() {
    close();
    global.location.href = OAUTH_START;
  }

  function bind() {
    modalEl = qs("communityLoginModal");
    if (!modalEl) return;

    qs("communityLoginClose").addEventListener("click", close);
    modalEl.addEventListener("click", function (e) {
      if (e.target === modalEl) close();
    });

    modalEl.querySelectorAll("[data-oauth-start]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        startOAuth();
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modalEl.classList.contains("open")) close();
    });
  }

  global.CommunityLoginModal = {
    open: open,
    close: close,
    startOAuth: startOAuth,
    bind: bind,
  };
})(window);
