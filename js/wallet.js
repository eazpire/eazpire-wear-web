/**
 * Eazpire Wear — EAZ Wallet (balances + Shop Credit conversion).
 */
(function (global) {
  "use strict";

  function qs(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatEaz(val) {
    var n = Number(val);
    if (!Number.isFinite(n)) return "0";
    return String(Math.round(n * 100) / 100);
  }

  function setText(id, text) {
    var el = qs(id);
    if (el) el.textContent = text;
  }

  async function renderConvertPanel(st) {
    var panel = qs("walletConvertPanel");
    if (!panel) return;

    if (!global.CommunityAuth.isLoggedIn()) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;

    if (!st || !st.ok || !st.unlocked) {
      panel.innerHTML =
        '<div class="wallet-convert-locked">' +
        '<span class="wallet-convert-locked-ico" aria-hidden="true">🔒</span>' +
        "<h3>Move to Earn locked</h3>" +
        "<p>Mint and activate a bound Character to earn Move EAZ and convert to Shop Credit.</p>" +
        '<button type="button" class="btn sm" data-go="vault">Open Vault</button>' +
        "</div>";
      return;
    }

    var wallet = st.move_to_earn_wallet;
    if (!wallet && global.CommunityApi.moveToEarnWallet) {
      try {
        var w = await global.CommunityApi.moveToEarnWallet();
        if (w.ok) wallet = w.wallet;
      } catch (_) {}
    }

    var avail = wallet ? Number(wallet.balance_eazc_available || 0) : 0;
    var locked = wallet ? Number(wallet.balance_eazc_locked || 0) : 0;
    var minEaz = wallet ? Number(wallet.min_convert_eaz || 1) : 1;

    panel.innerHTML =
      '<div class="wallet-convert-head">' +
      "<h3>Convert to Shop Credit</h3>" +
      "<p>Use earned Move EAZ for eazpire products only — not withdrawable as cash.</p>" +
      "</div>" +
      '<div class="wallet-convert-balances">' +
      '<div class="wallet-convert-stat"><span>Available</span><strong id="walletM2eAvail">' +
      formatEaz(avail) +
      " EAZC</strong></div>" +
      (locked > 0
        ? '<div class="wallet-convert-stat wallet-convert-stat--muted"><span>Locked</span><strong>' +
          formatEaz(locked) +
          " EAZC</strong></div>"
        : "") +
      "</div>" +
      '<div class="wallet-convert-row">' +
      '<input type="number" min="' +
      minEaz +
      '" step="0.01" id="walletConvertAmount" class="input sm wallet-convert-input" placeholder="' +
      minEaz +
      '" aria-label="Amount to convert" />' +
      '<button type="button" class="btn primary" id="walletConvertBtn">Convert to Shop Credit</button>' +
      "</div>" +
      '<p class="wallet-convert-note">Minimum ' +
      minEaz +
      " EAZC · conversion available here only</p>";

    var convertBtn = qs("walletConvertBtn");
    var amountInput = qs("walletConvertAmount");
    if (convertBtn) {
      convertBtn.addEventListener("click", async function () {
        var raw = amountInput && amountInput.value ? Number(amountInput.value) : avail;
        var amount = raw > 0 ? raw : avail;
        if (amount < minEaz) {
          if (global.CommunityApp && global.CommunityApp.toast) {
            global.CommunityApp.toast("Minimum", minEaz + " EAZC required");
          } else {
            alert("Minimum " + minEaz + " EAZC");
          }
          return;
        }
        convertBtn.disabled = true;
        try {
          var r = await global.CommunityApi.moveToEarnConvertToShopCredit(amount, "wear_web");
          if (r.ok) {
            var msg =
              "Converted " +
              r.eazc_debited +
              " EAZC to Shop Credit (" +
              (r.shop_credit_cents / 100).toFixed(2) +
              " " +
              (r.shop_credit_currency || "EUR") +
              ").";
            if (global.CommunityApp && global.CommunityApp.toast) {
              global.CommunityApp.toast("Shop Credit added", msg);
            } else {
              alert(msg);
            }
            refresh();
            if (global.CommunityHubRefresh) global.CommunityHubRefresh();
          } else {
            var err = r.error || r.message || "Convert failed";
            if (global.CommunityApp && global.CommunityApp.toast) {
              global.CommunityApp.toast("Convert failed", err);
            } else {
              alert(err);
            }
          }
        } finally {
          convertBtn.disabled = false;
        }
      });
    }
  }

  async function refresh() {
    var guest = qs("walletGuestCta");
    var owner = qs("walletOwnerContent");
    if (!global.CommunityAuth.isLoggedIn()) {
      if (guest) guest.hidden = false;
      if (owner) owner.hidden = true;
      setText("walletActivityEaz", "—");
      setText("walletM2eToday", "—");
      setText("walletM2eTotal", "—");
      return;
    }

    if (guest) guest.hidden = true;
    if (owner) owner.hidden = false;

    var ownerId = global.CommunityAuth.ownerId();
    var st = null;

    try {
      var bal = await global.CommunityApi.balance(ownerId);
      var free = Number(bal.balance_free || bal.balance_total || bal.balance_eaz || 0) || 0;
      setText("walletActivityEaz", formatEaz(free) + " EAZC");
    } catch (_) {
      setText("walletActivityEaz", "— EAZC");
    }

    try {
      st = await global.CommunityApi.moveToEarnStatus();
      if (st.ok) {
        setText("walletM2eToday", formatEaz(st.eaz_earned_today || 0) + " EAZC");
        var cap = st.daily_cap_eaz ? " / " + formatEaz(st.daily_cap_eaz) : "";
        setText("walletM2eTodayCap", cap ? "Daily cap" + cap : "Earned today from steps");
        var wallet = st.move_to_earn_wallet;
        if (!wallet && global.CommunityApi.moveToEarnWallet) {
          try {
            var w = await global.CommunityApi.moveToEarnWallet();
            if (w.ok) wallet = w.wallet;
          } catch (_) {}
        }
        var total = wallet
          ? Number(wallet.balance_eazc_available || 0) + Number(wallet.balance_eazc_locked || 0)
          : 0;
        setText("walletM2eTotal", formatEaz(total) + " EAZC");
        var locked = wallet ? Number(wallet.balance_eazc_locked || 0) : 0;
        setText(
          "walletM2eLockedNote",
          locked > 0 ? formatEaz(locked) + " EAZC locked until payout rules apply" : "All Move earnings unlocked"
        );
      } else {
        setText("walletM2eToday", "—");
        setText("walletM2eTotal", "—");
      }
    } catch (_) {
      setText("walletM2eToday", "—");
      setText("walletM2eTotal", "—");
    }

    await renderConvertPanel(st);
  }

  global.CommunityWallet = { refresh: refresh };
})(window);
