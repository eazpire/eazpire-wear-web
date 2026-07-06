/**
 * Community Hub — Character craft UI (equipment, blueprints, swap).
 */
(function (global) {
  "use strict";

  var state = { characterId: null, freeSlots: [] };

  function qs(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function findBoundCharacter(characters) {
    if (!Array.isArray(characters)) return null;
    for (var i = 0; i < characters.length; i++) {
      if (characters[i].craft_model === "bound_v1") return characters[i];
    }
    return characters[0] || null;
  }

  async function loadVaultCraft() {
    var panel = qs("vaultCraftPanel");
    if (!panel) return;
    if (!global.CommunityAuth.isLoggedIn()) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;

    var ownerId = global.CommunityAuth.ownerId();
    var inv = await global.CommunityApi.artifactsInventory(ownerId);
    if (!inv.ok) {
      panel.innerHTML = "<p class=\"empty-state\">Could not load character data.</p>";
      return;
    }

    state.freeSlots = (inv.slots || []).filter(function (s) {
      return !s.bound_character_id;
    });
    var character = findBoundCharacter(inv.characters);
    if (!character) {
      panel.innerHTML =
        '<div class="craft-panel"><h3>Character Craft</h3><p>Mint a Character from your outfit on eazpire.com to unlock swaps, blueprints and Move to Earn.</p></div>';
      return;
    }

    state.characterId = character.id;
    var eq = await global.CommunityApi.characterEquipment(character.id);
    if (!eq.ok) {
      panel.innerHTML = "<p class=\"empty-state\">Could not load equipment.</p>";
      return;
    }

    renderCraftPanel(eq, character);
  }

  function renderCraftPanel(eq, character) {
    var panel = qs("vaultCraftPanel");
    if (!panel) return;

    var html =
      '<div class="craft-panel">' +
      '<div class="craft-head">' +
      '<img class="craft-char-img" src="' +
      escapeHtml(character.image_url || "") +
      '" alt="" onerror="this.style.display=\'none\'">' +
      "<div><h3>" +
      escapeHtml(character.serial || "Character") +
      "</h3>" +
      "<p>" +
      escapeHtml(character.rarity) +
      " · " +
      escapeHtml(character.set_theme || "") +
      (eq.craft_model === "bound_v1" ? ' · <span class="badge green">Craft v1</span>' : "") +
      "</p></div></div>";

    if (eq.active_rerender_quest) {
      var q = eq.active_rerender_quest;
      var pct = Math.min(100, Math.round((q.progress_steps / q.target_steps) * 100));
      html +=
        '<div class="craft-quest"><strong>Re-render quest</strong><p>' +
        q.progress_steps +
        " / " +
        q.target_steps +
        ' steps · slot ' +
        escapeHtml(q.swap_slot_type || "") +
        '</p><div class="craft-quest-bar"><i style="width:' +
        pct +
        '%"></i></div>' +
        '<button type="button" class="btn sm primary" id="questProgressBtn">Add 500 steps (dev)</button></div>';
    }

    html += '<h4 class="craft-sub">Active loadout</h4><div class="craft-slots">';
    var slots = eq.equipment || {};
    Object.keys(slots).forEach(function (key) {
      var s = slots[key];
      html +=
        '<div class="craft-slot"><span class="badge orange">' +
        escapeHtml(key) +
        "</span> " +
        escapeHtml(s.product_title || s.serial) +
        ' <button type="button" class="btn sm ghost craft-swap-btn" data-slot="' +
        escapeHtml(key) +
        '">Swap</button></div>';
    });
    html += "</div>";

    html += '<h4 class="craft-sub">Blueprint gallery</h4><div class="craft-blueprints">';
    (eq.blueprints || []).forEach(function (bp) {
      html +=
        '<div class="craft-bp"><span class="badge">' +
        escapeHtml(bp.kind) +
        "</span> " +
        escapeHtml(bp.slot_type) +
        " · " +
        escapeHtml((bp.instance && bp.instance.product_title) || bp.instance.serial) +
        "</div>";
    });
    if (!(eq.blueprints || []).length) html += "<p class=\"muted\">No blueprints yet.</p>";
    html += "</div></div>";

    panel.innerHTML = html;

    panel.querySelectorAll(".craft-swap-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openSwapPicker(btn.getAttribute("data-slot"));
      });
    });

    var prog = qs("questProgressBtn");
    if (prog && eq.active_rerender_quest) {
      prog.addEventListener("click", async function () {
        var r = await global.CommunityApi.rerenderQuestProgress(eq.active_rerender_quest.id, 500);
        if (r.ok && r.completed) {
          alert("Character image updated!");
        }
        loadVaultCraft();
      });
    }
  }

  function openSwapPicker(slotType) {
    var matches = state.freeSlots.filter(function (s) {
      return s.slot_type === slotType;
    });
    if (!matches.length) {
      alert("No free " + slotType + " artifact in your vault. Claim one via QR first.");
      return;
    }
    var pick = matches[0];
    if (
      !confirm(
        "Swap to " +
          (pick.product_title || pick.serial) +
          "? EAZC will be charged and a re-render quest starts."
      )
    ) {
      return;
    }
    global.CommunityApi.characterSwapCommit(state.characterId, pick.id).then(function (res) {
      if (res.ok) {
        alert("Swap complete. Complete the step quest to refresh your character image.");
        loadVaultCraft();
        if (typeof global.CommunityHubRefresh === "function") global.CommunityHubRefresh();
      } else {
        alert(res.error || "Swap failed");
      }
    });
  }

  function bind() {
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('[data-go="vault"]')) {
        setTimeout(loadVaultCraft, 50);
      }
    });
  }

  global.CommunityCharacterCraft = {
    bind: bind,
    refresh: loadVaultCraft,
  };
})(window);
