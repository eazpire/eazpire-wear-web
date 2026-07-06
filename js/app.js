/**
 * Eazpire Wear — main app controller.
 */
(function (global) {
  "use strict";

  var titles = {
    home: "Game Hub",
    feed: "Live Artifact Feed",
    wallet: "EAZC Wallet",
    community: "Your Squad",
    vault: "Artifact Vault",
    move: "Move to Earn",
  };

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toast(title, text) {
    var el = document.getElementById("toast");
    document.getElementById("tTitle").textContent = title;
    document.getElementById("tText").textContent = text;
    el.classList.add("show");
    setTimeout(function () {
      el.classList.remove("show");
    }, 2400);
  }

  function go(name) {
    document.querySelectorAll(".screen").forEach(function (s) {
      s.classList.toggle("active", s.dataset.page === name);
    });
    document.querySelectorAll("[data-go]").forEach(function (b) {
      var on = b.dataset.go === name;
      b.classList.toggle("active", on);
      b.classList.toggle("on", on);
    });
    var titleEl = document.getElementById("screenTitle");
    if (titleEl) titleEl.textContent = titles[name] || "Eazpire Community";
    if (name === "move" && global.CommunityMoveToEarn) {
      global.CommunityMoveToEarn.refresh();
    }
    if (name === "move" && global.CommunityDiscovery) {
      global.CommunityDiscovery.refresh();
    }
    if (name === "feed" && global.CommunityFeed) {
      global.CommunityFeed.refresh();
    }
    if (name === "wallet" && global.CommunityWallet) {
      global.CommunityWallet.refresh();
    }
  }

  function renderArtifactCard(item) {
    var emoji = item.emoji || "👕";
    var title = item.title || item.display_name || "Artifact";
    var slot = item.slot_type || item.slot || "";
    var level = item.level != null ? "Lv." + item.level : "";
    var meta = item.serial || item.id || "";
    var visual = item.artwork_url
      ? '<img class="nft-img" src="' +
        escapeHtml(item.artwork_url) +
        '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling&&(this.nextElementSibling.style.display=\'grid\')">' +
        '<span class="nft-emoji" style="display:none">' +
        emoji +
        "</span>"
      : '<span class="nft-emoji">' + emoji + "</span>";
    return (
      '<article class="panel nft-card">' +
      '<div class="nft-visual big"><div class="nft-tags">' +
      (slot ? '<span class="badge orange">' + escapeHtml(slot) + "</span>" : "") +
      (level ? '<span class="badge purple">' + escapeHtml(level) + "</span>" : "") +
      '</div>' +
      visual +
      '</div><div class="nft-body"><h3>' +
      escapeHtml(title) +
      '</h3><div class="meta">' +
      escapeHtml(String(meta)) +
      "</div></div></article>"
    );
  }

  function emptyArtifactsHtml(message) {
    return (
      '<div class="empty-state" style="grid-column:1/-1"><div class="big">💎</div><p>' +
      (message || "No artifacts yet. Scan a product QR to claim your first Artifact.") +
      "</p></div>"
    );
  }

  async function loadArtifacts(ownerId) {
    var featured = document.getElementById("featuredArtifacts");
    var vaultGrid = document.getElementById("vaultGrid");
    if (!ownerId) {
      if (featured) featured.innerHTML = emptyArtifactsHtml("Sign in to see your artifacts.");
      if (vaultGrid) vaultGrid.innerHTML = emptyArtifactsHtml("Sign in to open your vault.");
      return;
    }

    var inv = await global.CommunityApi.artifactsInventory(ownerId);
    if (!inv.ok) {
      var msg = inv.error === "auth_required" ? "Sign in to see your artifacts." : "Could not load artifacts.";
      if (featured) featured.innerHTML = emptyArtifactsHtml(msg);
      if (vaultGrid) vaultGrid.innerHTML = emptyArtifactsHtml(msg);
      return;
    }

    var items = [];
    (inv.slots || []).forEach(function (s) {
      items.push({
        title: s.product_title || s.display_name || s.catalog_name || s.slot_type,
        slot_type: s.slot_type,
        level: s.level,
        id: s.id,
        serial: s.serial,
        artwork_url: s.artwork_url,
        emoji: slotEmoji(s.slot_type),
      });
    });
    (inv.characters || []).forEach(function (c) {
      items.push({
        title: c.serial || "Character",
        slot_type: c.rarity || "Character",
        level: c.archetype,
        id: c.id,
        serial: c.serial,
        artwork_url: c.image_url,
        emoji: "🐉",
      });
    });

    if (!items.length) {
      if (featured) featured.innerHTML = emptyArtifactsHtml();
      if (vaultGrid) vaultGrid.innerHTML = emptyArtifactsHtml();
      return;
    }

    var featuredHtml = items.slice(0, 3).map(renderArtifactCard).join("");
    var vaultHtml = items.map(renderArtifactCard).join("");
    if (featured) featured.innerHTML = featuredHtml;
    if (vaultGrid) vaultGrid.innerHTML = vaultHtml;
  }

  function slotEmoji(slot) {
    var map = { upper: "👕", head: "🧢", lower: "👖", feet: "🧦", accessory: "💍" };
    var key = String(slot || "").toLowerCase();
    return map[key] || "👕";
  }

  async function loadActivityEaz(ownerId) {
    var el = document.getElementById("energyValAmount") || document.getElementById("energyVal");
    if (!el) return;
    if (!ownerId) {
      el.textContent = "— EAZC";
      return;
    }
    var bal = await global.CommunityApi.balance(ownerId);
    if (!bal.ok) {
      el.textContent = "— EAZC";
      return;
    }
    var free =
      Number(bal.balance_free || bal.balance_total || bal.balance_eaz || 0) || 0;
    el.textContent = Math.round(free * 100) / 100 + " EAZC";
  }

  async function refreshData() {
    var ownerId = global.CommunityAuth.ownerId();
    await Promise.all([
      loadActivityEaz(ownerId),
      loadArtifacts(ownerId),
      global.CommunityPanel.load(ownerId),
    ]);
    if (global.CommunityWearEarn) {
      await global.CommunityWearEarn.refresh();
    }
    if (global.CommunityMoveToEarn) await global.CommunityMoveToEarn.refresh();
    if (global.CommunityWallet) await global.CommunityWallet.refresh();
    if (global.CommunityFeed) await global.CommunityFeed.refresh();
    if (global.CommunityCharacterCraft) global.CommunityCharacterCraft.refresh();
    global.CommunityProfile.invalidate();
  }

  global.CommunityHubRefresh = refreshData;

  function bindNavigation() {
    document.querySelectorAll("[data-go]").forEach(function (b) {
      b.addEventListener("click", function () {
        go(b.dataset.go);
      });
    });
  }

  function bindQuestModal() {
    var step = 0;
    var steps = [
      { icon: "📦", text: "Choose an Artifact from your vault" },
      { icon: "📷", text: "Take a camera selfie wearing your product" },
      { icon: "✓", text: "Wait for 2 community verifications (3 votes)" },
      { icon: "🎉", text: "Claim Free EAZC after approval" },
    ];
    var modal = document.getElementById("modal");

    function renderStep() {
      document.getElementById("mIcon").textContent = steps[step].icon;
      document.getElementById("mText").textContent = steps[step].text;
      document.querySelectorAll("#mSteps i").forEach(function (el, i) {
        el.className = i < step ? "done" : i === step ? "now" : "";
      });
      document.getElementById("mNext").textContent =
        step >= steps.length - 1 ? "Open Feed" : step === 0 ? "Go to Feed" : "Continue";
    }

    function openModal() {
      if (!global.CommunityAuth.isLoggedIn()) {
        global.CommunityAuth.login();
        return;
      }
      step = 0;
      renderStep();
      modal.classList.add("open");
    }
    function closeModal() {
      modal.classList.remove("open");
    }

    ["startQuest"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("click", openModal);
    });
    document.getElementById("modalX").addEventListener("click", closeModal);
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeModal();
    });
    document.getElementById("mBack").addEventListener("click", function () {
      if (step > 0) {
        step--;
        renderStep();
      } else closeModal();
    });
    document.getElementById("mNext").addEventListener("click", function () {
      if (step < steps.length - 1) {
        step++;
        renderStep();
        if (step === 1) {
          closeModal();
          go("feed");
          if (global.CommunityFeedCamera) {
            setTimeout(function () {
              global.CommunityFeedCamera.openPanel();
            }, 400);
          }
          return;
        }
      } else {
        closeModal();
        go("feed");
      }
    });
  }

  async function init() {
    bindNavigation();
    global.CommunityPanel.bindShareModal();
    if (global.CommunityLoginModal) global.CommunityLoginModal.bind();
    global.CommunityProfile.bind();
    bindQuestModal();
    if (global.CommunityWearEarn) global.CommunityWearEarn.bind();
    if (global.CommunityCharacterCraft) global.CommunityCharacterCraft.bind();
    if (global.CommunityFeed) global.CommunityFeed.bind();

    if (global.CommunityAuth.init) await global.CommunityAuth.init();
    else await global.CommunityAuth.refreshSession();
    await refreshData();
    go("home");
    if (global.__wearBootLoaderDone) global.__wearBootLoaderDone();
  }

  global.CommunityApp = {
    init: init,
    refreshData: refreshData,
    toast: toast,
    go: go,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
