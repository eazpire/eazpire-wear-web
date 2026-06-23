/**
 * World Discovery — wear-web client
 */
(function (global) {
  "use strict";

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatMs(ms) {
    if (!ms || ms <= 0) return "0:00";
    var sec = Math.floor(ms / 1000);
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function showLootToast(message) {
    var el = document.createElement("div");
    el.className = "discovery-loot-toast";
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 4000);
  }

  async function renderBiomes(regionId) {
    var el = document.getElementById("discoveryBiomes");
    if (!el || !global.CommunityApi.discoveryBiomeStats) return;

    try {
      var res = await global.CommunityApi.discoveryBiomeStats(regionId);
      var biomes = res.biomes || [];
      var catalog = res.catalog || [];
      if (!biomes.length) {
        el.innerHTML = "";
        return;
      }
      var colorByKey = {};
      catalog.forEach(function (c) {
        colorByKey[c.biome_key] = c.color_hex || "#22c55e";
      });
      el.innerHTML =
        '<div class="discovery-biome-chips">' +
        biomes
          .map(function (b) {
            var color = colorByKey[b.biome_key] || "#22c55e";
            return (
              '<span class="discovery-biome-chip" style="border-color:' +
              escapeHtml(color) +
              '">' +
              escapeHtml(b.biome_key) +
              " · " +
              (b.cells_discovered || 0) +
              "</span>"
            );
          })
          .join("") +
        "</div>";
    } catch (e) {
      el.innerHTML = "";
    }
  }

  async function renderLoot() {
    var el = document.getElementById("discoveryLoot");
    if (!el || !global.CommunityApi.discoveryLootNearby) return;

    try {
      var res = await global.CommunityApi.discoveryLootNearby();
      var loots = res.loots || [];
      if (!loots.length) {
        el.innerHTML = '<p class="discovery-muted">No loot at the fog edge right now.</p>';
        return;
      }
      el.innerHTML = loots
        .map(function (loot) {
          return (
            '<div class="discovery-loot-item panel">' +
            "<span>Fog-edge loot</span> " +
            '<button type="button" class="btn primary sm" data-loot-id="' +
            escapeHtml(loot.id) +
            '">Claim</button></div>'
          );
        })
        .join("");

      el.querySelectorAll("[data-loot-id]").forEach(function (btn) {
        btn.addEventListener("click", async function () {
          var id = btn.getAttribute("data-loot-id");
          var claim = await global.CommunityApi.discoveryLootClaim(id);
          if (claim.ok) {
            showLootToast("Loot claimed!");
            renderLoot();
          } else {
            showLootToast(claim.error || "Claim failed");
          }
        });
      });
    } catch (e) {
      el.innerHTML = "";
    }
  }

  async function renderStatus() {
    var wrap = document.getElementById("discoveryStatus");
    if (!wrap || !global.CommunityApi.discoveryStatus) return;

    if (!global.CommunityAuth.isLoggedIn()) {
      wrap.innerHTML = '<p class="discovery-muted">Sign in to explore the world.</p>';
      return;
    }

    try {
      var st = await global.CommunityApi.discoveryStatus();
      if (!st.ok) {
        wrap.innerHTML = '<p class="discovery-muted">Could not load explorer status.</p>';
        return;
      }

      if (!st.unlocked) {
        wrap.innerHTML =
          '<div class="discovery-gate">' +
          "<strong>Character required</strong>" +
          "<p>Mint and activate a bound Character to unlock World Discovery.</p></div>";
        return;
      }

      var sessionHtml = "";
      if (st.session) {
        sessionHtml =
          '<p class="discovery-session">Session active · ' +
          formatMs(st.session.remaining_ms) +
          " left</p>";
      } else {
        sessionHtml =
          '<button type="button" class="btn primary sm" id="discoveryStartSession">Start Explore Session</button>';
      }

      wrap.innerHTML =
        '<div class="discovery-stats">' +
        sessionHtml +
        "<p>Cells discovered: <strong>" +
        (st.total_cells_discovered || 0) +
        "</strong></p>" +
        (st.home ? "<p>Home: " + escapeHtml(st.home.city_id || "") + "</p>" : "") +
        "</div>";

      var startBtn = document.getElementById("discoveryStartSession");
      if (startBtn) {
        startBtn.addEventListener("click", async function () {
          await global.CommunityApi.moveSessionStart();
          renderStatus();
          renderLoot();
        });
      }

      if (st.home && st.home.city_id) {
        renderBiomes(st.home.city_id);
      }
      if (st.session) renderLoot();
    } catch (e) {
      wrap.innerHTML = '<p class="discovery-muted">Explorer offline.</p>';
    }
  }

  async function renderRankings() {
    var el = document.getElementById("discoveryRankings");
    if (!el || !global.CommunityApi.discoveryRankingsGlobal) return;

    try {
      var res = await global.CommunityApi.discoveryRankingsGlobal(20);
      var rows = res.rankings || [];
      if (!rows.length) {
        el.innerHTML = '<p class="discovery-muted">No rankings yet — be the first explorer.</p>';
        return;
      }
      el.innerHTML =
        "<ol class=\"discovery-rank-list\">" +
        rows
          .map(function (r) {
            return (
              "<li><span class=\"discovery-rank-num\">#" +
              r.display_rank +
              "</span> " +
              escapeHtml(String(r.owner_id).slice(0, 12)) +
              " · " +
              r.cells_discovered +
              " cells</li>"
            );
          })
          .join("") +
        "</ol>";
    } catch (e) {
      el.innerHTML = "";
    }
  }

  async function refresh() {
    await Promise.all([renderStatus(), renderRankings()]);
    if (global.CommunityDiscoveryMap && global.CommunityDiscoveryMap.refresh) {
      await global.CommunityDiscoveryMap.refresh();
    }
  }

  global.CommunityDiscovery = {
    refresh: refresh,
    renderStatus: renderStatus,
  };
})(window);
