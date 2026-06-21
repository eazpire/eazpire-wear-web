/**
 * Community session — OAuth via account.eazpire.com (no www bridge).
 */
(function (global) {
  "use strict";

  const LOGOUT_URL = "/auth/logout";

  const state = {
    loggedIn: false,
    ownerId: null,
  };

  function setAuth(loggedIn, ownerId) {
    state.loggedIn = !!loggedIn;
    state.ownerId = ownerId ? String(ownerId) : null;
    document.body.dataset.role = state.loggedIn ? "owner" : "guest";
  }

  function showToast(title, text) {
    var toast = document.getElementById("toast");
    var tTitle = document.getElementById("tTitle");
    var tText = document.getElementById("tText");
    if (!toast || !tTitle || !tText) return;
    tTitle.textContent = title;
    tText.textContent = text;
    toast.classList.add("show");
    setTimeout(function () {
      toast.classList.remove("show");
    }, 4200);
  }

  function handleAuthQuery() {
    try {
      var params = new URLSearchParams(global.location.search);
      if (params.get("auth") === "ok") {
        params.delete("auth");
        var next = global.location.pathname + (params.toString() ? "?" + params.toString() : "") + global.location.hash;
        global.history.replaceState({}, "", next);
        showToast("Signed in", "Welcome back to Eazpire Wear.");
      } else if (params.get("auth_error")) {
        var err = params.get("auth_error");
        params.delete("auth_error");
        var nextErr =
          global.location.pathname + (params.toString() ? "?" + params.toString() : "") + global.location.hash;
        global.history.replaceState({}, "", nextErr);
        showToast("Sign-in failed", err.replace(/_/g, " "));
      }
    } catch (e) {}
  }

  async function refreshSession() {
    try {
      var me = await global.CommunityApi.me();
      setAuth(me.logged_in, me.owner_id);
      if (global.CommunityProfile && typeof global.CommunityProfile.invalidate === "function") {
        global.CommunityProfile.invalidate();
      }
      return me;
    } catch (e) {
      setAuth(false, null);
      return { logged_in: false };
    }
  }

  function login() {
    if (global.CommunityLoginModal && typeof global.CommunityLoginModal.open === "function") {
      global.CommunityLoginModal.open();
      return;
    }
    global.location.href = "/auth/login";
  }

  function logout() {
    global.location.href = LOGOUT_URL;
  }

  async function init() {
    handleAuthQuery();
    await refreshSession();
  }

  global.CommunityAuth = {
    state: state,
    refreshSession: refreshSession,
    login: login,
    logout: logout,
    setAuth: setAuth,
    isLoggedIn: function () {
      return state.loggedIn;
    },
    ownerId: function () {
      return state.ownerId;
    },
    init: init,
  };
})(window);
