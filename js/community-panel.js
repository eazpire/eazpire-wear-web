/**
 * Squad / community panel — referral link + network stats (real APIs).
 */
(function (global) {
  "use strict";

  var FLAG_EMOJI = { DE: "🇩🇪", AT: "🇦🇹", CH: "🇨🇭", US: "🇺🇸", FR: "🇫🇷", ES: "🇪🇸", IT: "🇮🇹", GB: "🇬🇧", NL: "🇳🇱", PL: "🇵🇱", TR: "🇹🇷", SE: "🇸🇪" };

  function setStat(name, value) {
    document.querySelectorAll('[data-cp-stat="' + name + '"]').forEach(function (el) {
      el.textContent = value != null && value !== "" ? String(value) : "0";
    });
  }

  function renderLevel1Countries(level) {
    var grid = document.getElementById("cpLevel1Grid");
    if (!grid || !level || !Array.isArray(level.partners)) {
      if (grid) grid.innerHTML = '<p class="cp-footnote" style="margin:0">No direct partners yet.</p>';
      return;
    }
    var counts = {};
    level.partners.forEach(function (p) {
      var c = (p.country || "DE").toUpperCase();
      counts[c] = (counts[c] || 0) + 1;
    });
    var entries = Object.entries(counts).sort(function (a, b) {
      return b[1] - a[1];
    });
    if (!entries.length) {
      grid.innerHTML = '<p class="cp-footnote" style="margin:0">No direct partners yet.</p>';
      return;
    }
    grid.innerHTML = entries
      .slice(0, 10)
      .map(function (pair) {
        var code = pair[0];
        var count = pair[1];
        return (
          '<div class="cp-country"><span class="cp-country-flag">' +
          (FLAG_EMOJI[code] || "🌍") +
          '</span><span class="cp-cname">' +
          code +
          '</span><span class="cp-ccount">' +
          count +
          "</span></div>"
        );
      })
      .join("");
    var pct = document.getElementById("cpLevel1Count");
    if (pct) pct.textContent = String(level.partners.length);
  }

  async function loadPanel(ownerId) {
    var refInput = document.getElementById("refInput");
    if (!ownerId) return;

    var ref = await global.CommunityApi.referralCode(ownerId);
    if (ref.ok && ref.url && refInput) refInput.value = ref.url;

    var net = await global.CommunityApi.network(ownerId);
    if (!net.ok) return;

    var network = net.network || {};
    var networkStats = network.stats || {};
    var directStats = network.me || {};

    setStat("partners", networkStats.partners);
    setStat("designs", networkStats.designs);
    setStat("products", networkStats.products);
    setStat("sales", networkStats.sales);
    setStat("profit", networkStats.profit != null ? networkStats.profit : "–");

    setStat("du-designs", directStats.designs);
    setStat("du-products", directStats.products);
    setStat("du-sales", directStats.sales);
    setStat("du-profit", directStats.profit != null ? directStats.profit : "–");

    renderLevel1Countries({ partners: (network.level1 || []).map(function (p) {
      return { country: p.country };
    }) });
  }

  function bindShareModal() {
    var shareModal = document.getElementById("shareModal");
    var shareSocial = {
      whatsapp: "https://wa.me/?text=",
      x: "https://twitter.com/intent/tweet?url=",
      telegram: "https://t.me/share/url?url=",
      email: "mailto:?body=",
    };

    function openShare(url) {
      var input = document.getElementById("shareModalInput");
      if (input) input.value = url || "";
      shareModal.classList.add("open");
      shareModal.setAttribute("aria-hidden", "false");
    }
    function closeShare() {
      shareModal.classList.remove("open");
      shareModal.setAttribute("aria-hidden", "true");
    }

    var shareBtn = document.getElementById("shareRef");
    if (shareBtn) {
      shareBtn.addEventListener("click", function () {
        var url = (document.getElementById("refInput") || {}).value || "";
        if (global.navigator.share) {
          global.navigator
            .share({ title: "Eazpire", text: "Join me on Eazpire", url: url })
            .catch(function () {
              openShare(url);
            });
        } else {
          openShare(url);
        }
      });
    }
    document.querySelectorAll("[data-share-close]").forEach(function (el) {
      el.addEventListener("click", closeShare);
    });
    var copyBtn = document.getElementById("shareModalCopy");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var input = document.getElementById("shareModalInput");
        var val = input && input.value ? input.value : "";
        if (global.navigator.clipboard) global.navigator.clipboard.writeText(val);
        global.CommunityApp.toast("Copied", "Link copied to clipboard");
      });
    }
    document.querySelectorAll("[data-share-social]").forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        var input = document.getElementById("shareModalInput");
        var val = encodeURIComponent(input && input.value ? input.value : "");
        var id = link.getAttribute("data-share-social");
        var base = shareSocial[id] || "";
        var finalUrl =
          id === "email"
            ? "mailto:?subject=" + encodeURIComponent("Eazpire") + "&body=" + val
            : base + val;
        global.open(finalUrl, "_blank", "noopener,noreferrer,width=600,height=400");
      });
    });
    var refInput = document.getElementById("refInput");
    if (refInput) {
      refInput.addEventListener("click", function () {
        this.select();
      });
    }
  }

  global.CommunityPanel = {
    load: loadPanel,
    bindShareModal: bindShareModal,
  };
})(window);
