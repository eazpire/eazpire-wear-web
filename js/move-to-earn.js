/**
 * Community Hub — Move to Earn landing page + live artifact gallery.
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

  function formatSlotLabel(slot) {
    return String(slot || "artifact").replace(/_/g, " ");
  }

  function renderArtifactTile(item) {
    var title = item.product_title || formatSlotLabel(item.slot_type);
    var slot = item.slot_type || "";
    var serial = item.serial || "#" + item.id;
    var niches = Array.isArray(item.niches) ? item.niches.slice(0, 2).join(" · ") : "";
    var img = item.artwork_url
      ? '<img class="move-artifact-img" src="' +
        escapeHtml(item.artwork_url) +
        '" alt="" loading="lazy" onerror="this.classList.add(\'is-broken\')">'
      : '<span class="move-artifact-fallback">👕</span>';

    return (
      '<article class="move-artifact-card panel">' +
      '<div class="move-artifact-visual">' +
      img +
      '<div class="move-artifact-tags">' +
      (slot ? '<span class="badge orange">' + escapeHtml(formatSlotLabel(slot)) + "</span>" : "") +
      (item.status === "bound" ? '<span class="badge purple">Equipped</span>' : "") +
      "</div></div>" +
      '<div class="move-artifact-body">' +
      "<h3>" +
      escapeHtml(title) +
      "</h3>" +
      (niches ? '<p class="move-artifact-niche">' + escapeHtml(niches) + "</p>" : "") +
      '<div class="meta">' +
      escapeHtml(serial) +
      "</div></div></article>"
    );
  }

  async function loadGallery() {
    var grid = qs("moveArtifactGallery");
    var countEl = qs("moveGalleryCount");
    if (!grid) return;

    try {
      var res = await global.CommunityApi.artifactsShowcaseRecent(36);
      if (!res.ok || !res.items || !res.items.length) {
        grid.innerHTML =
          '<div class="empty-state" style="grid-column:1/-1"><div class="big">💎</div><p>No Product Artifacts minted yet. Scan a QR on your eazpire piece to appear here first.</p></div>';
        if (countEl) countEl.textContent = "0 live";
        return;
      }
      grid.innerHTML = res.items.map(renderArtifactTile).join("");
      if (countEl) countEl.textContent = res.items.length + " live";
    } catch (e) {
      grid.innerHTML =
        '<div class="empty-state" style="grid-column:1/-1"><p>Could not load artifact gallery.</p></div>';
      if (countEl) countEl.textContent = "—";
    }
  }

  async function renderUserStatus() {
    var wrap = qs("moveUserStatus");
    if (!wrap) return;

    if (!global.CommunityAuth.isLoggedIn()) {
      wrap.innerHTML =
        '<div class="move-status-card move-status-card--guest">' +
        '<strong>Join the movement</strong>' +
        "<p>Sign in to track your Character unlock and preview earned EAZ from steps.</p>" +
        '<button type="button" class="btn primary sm" data-login>Sign in</button>' +
        "</div>";
      return;
    }

    try {
      var st = await global.CommunityApi.moveToEarnStatus();
      if (!st.ok) {
        wrap.innerHTML = '<p class="move-status-loading">Could not load status.</p>';
        return;
      }

      if (!st.unlocked) {
        var reason =
          st.reason === "legacy_character"
            ? "Your active Character uses the legacy craft model. New bound Characters unlock Move to Earn."
            : "Mint a bound Character from your outfit on eazpire.com and set it active.";
        wrap.innerHTML =
          '<div class="move-status-card move-status-card--locked">' +
          '<span class="move-status-badge">🔒 Locked</span>' +
          "<h3>Character required</h3>" +
          "<p>" +
          escapeHtml(reason) +
          "</p>" +
          '<div class="move-status-actions">' +
          '<button type="button" class="btn sm" data-go="vault">Open Vault</button>' +
          '<a class="btn ghost sm" href="https://www.eazpire.com" target="_blank" rel="noopener">Get Artifacts</a>' +
          "</div></div>";
        return;
      }

      var mode = st.move_earn_mode || "eaz_stub";
      if (mode === "eaz_stub") {
        wrap.innerHTML =
          '<div class="move-status-card move-status-card--unlocked">' +
          '<span class="move-status-badge move-status-badge--live">Beta</span>' +
          "<h3>Move to Earn — preview</h3>" +
          "<p>Today: <strong>" +
          (st.eaz_earned_today || 0) +
          " / " +
          (st.daily_cap_eaz || 0) +
          "</strong> earned EAZ · Health sync coming soon.</p>" +
          '<button type="button" class="btn primary sm" id="moveSyncStepsBtn">Sync 1k steps (beta stub)</button>' +
          "</div>";

        var btn = qs("moveSyncStepsBtn");
        if (btn) {
          btn.addEventListener("click", async function () {
            var r = await global.CommunityApi.moveToEarnSyncSteps(1000);
            if (r.ok && r.eaz_credited > 0) {
              alert("+" + r.eaz_credited + " earned EAZ credited (locked until payout rules apply).");
            } else if (r.ok) {
              alert("Steps synced. Daily cap may be reached.");
            } else {
              alert(r.error || "Sync failed");
            }
            renderUserStatus();
          });
        }
        return;
      }

      var score = st.activity_score || {};
      var capped = score.capped_score || 0;
      var simHtml = "";
      try {
        var sim = await global.CommunityApi.economySimulatedPoolShare();
        if (sim && sim.ok) {
          var cents = sim.projected_shop_credit_cents || 0;
          simHtml =
            '<p class="move-status-sim">Projected Shop Credit this week: <strong>' +
            (cents / 100).toFixed(2) +
            " EUR</strong> (simulation)</p>";
        }
      } catch (_) {}

      wrap.innerHTML =
        '<div class="move-status-card move-status-card--unlocked">' +
        '<span class="move-status-badge move-status-badge--live">' +
        (mode === "shop_credit" ? "Shop Credit" : "Activity Score") +
        "</span>" +
        "<h3>Move, explore, earn Shop Credit</h3>" +
        "<p>Today's activity score: <strong>" +
        capped +
        "</strong>. Walk, discovery, and community actions count toward the weekly pool.</p>" +
        simHtml +
        '<p class="move-status-note">Shop Credit is for eazpire products only — not withdrawable as cash.</p>' +
        '<button type="button" class="btn primary sm" id="moveSyncStepsBtn">Sync 1k steps</button>' +
        "</div>";

      var syncBtn = qs("moveSyncStepsBtn");
      if (syncBtn) {
        syncBtn.addEventListener("click", async function () {
          var r = await global.CommunityApi.moveToEarnSyncSteps(1000);
          if (r.ok) {
            alert("Steps synced. Activity score updated.");
          } else {
            alert(r.error || "Sync failed");
          }
          renderUserStatus();
        });
      }
    } catch (e) {
      wrap.innerHTML = '<p class="move-status-loading">Could not load status.</p>';
    }
  }

  async function refresh() {
    await Promise.all([loadGallery(), renderUserStatus()]);
  }

  global.CommunityMoveToEarn = {
    refresh: refresh,
    loadGallery: loadGallery,
  };
})(window);
