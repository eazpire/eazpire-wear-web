/**
 * Community Hub — Wear & Earn (Free EAZ).
 */
(function (global) {
  "use strict";

  function qs(id) {
    return document.getElementById(id);
  }

  function setQuestHint(text) {
    var hint = qs("questHint");
    if (hint) hint.textContent = text;
  }

  function setQuestPct(text) {
    var el = qs("questPct");
    if (el) el.textContent = text;
  }

  async function refreshWearEarn() {
    if (!global.CommunityAuth.isLoggedIn()) {
      setQuestPct("—");
      setQuestHint("Sign in for Wear & Earn activity EAZ.");
      return;
    }
    try {
      var status = await global.CommunityApi.wearEarnStatus();
      if (status.ok) {
        setQuestPct(String(status.remaining_claims != null ? status.remaining_claims : "—"));
        setQuestHint(
          "Free EAZ today: " +
            (status.claims_today || 0) +
            "/" +
            (status.daily_cap || 0) +
            " · +" +
            (status.reward_eaz || 0) +
            " EAZ per action"
        );
      }
    } catch (e) {}
  }

  async function claimWearEarn(actionKey) {
    if (!global.CommunityAuth.isLoggedIn()) {
      global.CommunityAuth.login();
      return;
    }
    try {
      var res = await global.CommunityApi.wearEarnClaim(actionKey || "daily_login");
      if (res.ok) {
        global.CommunityAuth.refreshSession();
        if (typeof global.CommunityHubRefresh === "function") global.CommunityHubRefresh();
        alert("+" + res.eaz_credited + " Free EAZ credited.");
      } else if (res.error === "already_claimed") {
        alert("Already claimed for this action today.");
      } else if (res.error === "daily_cap_reached") {
        alert("Daily Wear & Earn cap reached.");
      } else {
        alert(res.error || "Claim failed");
      }
    } catch (e) {
      alert("Claim failed");
    }
    refreshWearEarn();
  }

  function bind() {
    var dailyBtn = qs("wearEarnDailyBtn");
    if (dailyBtn) {
      dailyBtn.addEventListener("click", function () {
        claimWearEarn("daily_login");
      });
    }
  }

  global.CommunityWearEarn = {
    bind: bind,
    refresh: refreshWearEarn,
    claim: claimWearEarn,
  };
})(window);
