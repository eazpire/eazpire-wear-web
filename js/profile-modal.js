/**
 * Player Profile modal — Shopify account + community stats.
 */
(function (global) {
  "use strict";

  var modalEl = null;
  var loadedFor = null;
  var cache = null;

  function qs(id) {
    return document.getElementById(id);
  }

  function openModal() {
    if (!modalEl) modalEl = qs("profileModal");
    if (!modalEl) return;
    modalEl.classList.add("open");
    modalEl.setAttribute("aria-hidden", "false");
    loadProfile();
  }

  function closeModal() {
    if (!modalEl) modalEl = qs("profileModal");
    if (!modalEl) return;
    modalEl.classList.remove("open");
    modalEl.setAttribute("aria-hidden", "true");
  }

  function formatEaz(val) {
    var n = Number(val);
    if (!Number.isFinite(n)) return "0";
    return String(Math.round(n * 100) / 100);
  }

  function locationLine(profile) {
    if (!profile) return "";
    var parts = [profile.city, profile.country].filter(Boolean);
    return parts.join(", ");
  }

  function avatarInitial(profile, emailStr, handle) {
    if (profile && profile.first_name) {
      return String(profile.first_name).trim().charAt(0).toUpperCase();
    }
    if (emailStr) return String(emailStr).trim().charAt(0).toUpperCase();
    if (handle && handle.charAt(0) === "@") return handle.charAt(1).toUpperCase();
    return "?";
  }

  function renderAvatar(data) {
    var img = qs("profileAvatarImg");
    var fallback = qs("profileAvatarFallback");
    if (!img || !fallback) return;

    var url = data.avatarUrl ? String(data.avatarUrl).trim() : "";
    if (url) {
      img.src = url;
      img.hidden = false;
      fallback.hidden = true;
      fallback.textContent = "";
      return;
    }

    img.hidden = true;
    img.removeAttribute("src");
    fallback.hidden = false;
    fallback.textContent = data.avatarInitial || "?";
  }

  function setAuthUi(loggedIn) {
    qs("profileLoginBtn").hidden = loggedIn;
    qs("profileFoot").hidden = loggedIn;
    qs("profileEmailRow").hidden = !loggedIn;
    qs("profileLogoutBtn").hidden = !loggedIn;
  }

  async function loadProfile() {
    var auth = global.CommunityAuth;
    var loggedIn = auth.isLoggedIn();
    var ownerId = auth.ownerId();

    setAuthUi(loggedIn);

    if (!loggedIn) {
      qs("profileUsername").textContent = "@guest";
      qs("profileSubtitle").textContent = "Sign in to see your stats";
      qs("profileEmail").textContent = "";
      qs("profilePosts").textContent = "—";
      qs("profileVotes").textContent = "—";
      qs("profileEaz").textContent = "—";
      qs("profileProductArtifacts").textContent = "—";
      qs("profileCharacterNfts").textContent = "—";
      qs("profileBadge").hidden = true;
      renderAvatar({ avatarUrl: "", avatarInitial: "?" });
      return;
    }

    if (loadedFor === ownerId && cache) {
      renderProfile(cache);
      return;
    }

    qs("profileSubtitle").textContent = "Loading…";

    var results = await Promise.all([
      global.CommunityApi.accountUsername(ownerId),
      global.CommunityApi.customerEmail(ownerId),
      global.CommunityApi.accountProfile(ownerId),
      global.CommunityApi.artifactsInventory(ownerId),
      global.CommunityApi.verifyCompleted(ownerId),
      global.CommunityApi.balance(ownerId),
    ]);

    var username = results[0];
    var email = results[1];
    var profileRes = results[2];
    var artifacts = results[3];
    var votes = results[4];
    var balance = results[5];

    var profile = profileRes.ok ? profileRes.profile : null;
    var handle = username.ok && username.username ? "@" + username.username : "@player" + ownerId.slice(-4);
    var emailStr = email.ok && email.email ? email.email : "";
    var productArtifacts = 0;
    var characterNfts = 0;
    if (artifacts.ok) {
      productArtifacts = Array.isArray(artifacts.slots) ? artifacts.slots.length : 0;
      characterNfts = Array.isArray(artifacts.characters) ? artifacts.characters.length : 0;
    }
    var artifactCount = productArtifacts + characterNfts;
    var voteCount = votes.ok && Array.isArray(votes.items) ? votes.items.length : 0;
    var eazTotal = 0;
    if (balance.ok) {
      eazTotal =
        Number(balance.balance_free || balance.balance_total || balance.balance_eaz || 0) || 0;
    }

    cache = {
      handle: handle,
      email: emailStr,
      avatarUrl: profile && profile.profile_picture_url ? profile.profile_picture_url : "",
      avatarInitial: avatarInitial(profile, emailStr, handle),
      subtitleParts: [
        artifactCount + " artifact" + (artifactCount === 1 ? "" : "s"),
        voteCount + " verify vote" + (voteCount === 1 ? "" : "s"),
        locationLine(profile),
      ].filter(Boolean),
      posts: artifactCount,
      votes: voteCount,
      eaz: eazTotal,
      productArtifacts: productArtifacts,
      characterNfts: characterNfts,
      active: artifactCount > 0,
    };
    loadedFor = ownerId;
    renderProfile(cache);
  }

  function renderProfile(data) {
    qs("profileUsername").textContent = data.handle;
    qs("profileSubtitle").textContent = data.subtitleParts.join(" · ");
    qs("profileEmail").textContent = data.email || "Email unavailable";
    qs("profilePosts").textContent = String(data.posts);
    qs("profileVotes").textContent = String(data.votes);
    qs("profileEaz").textContent = formatEaz(data.eaz);
    qs("profileProductArtifacts").textContent = String(data.productArtifacts);
    qs("profileCharacterNfts").textContent = String(data.characterNfts);
    qs("profileBadge").hidden = !data.active;
    renderAvatar(data);
  }

  function bind() {
    modalEl = qs("profileModal");
    document.querySelectorAll("[data-profile]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        openModal();
      });
    });
    document.querySelectorAll("[data-login]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        global.CommunityAuth.login();
      });
    });
    qs("profileClose").addEventListener("click", closeModal);
    qs("profileLoginBtn").addEventListener("click", function () {
      closeModal();
      global.CommunityAuth.login();
    });
    qs("profileLogoutBtn").addEventListener("click", function () {
      closeModal();
      global.CommunityAuth.logout();
    });
    modalEl.addEventListener("click", function (e) {
      if (e.target === modalEl) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modalEl.classList.contains("open")) closeModal();
    });
  }

  global.CommunityProfile = {
    open: openModal,
    close: closeModal,
    bind: bind,
    invalidate: function () {
      loadedFor = null;
      cache = null;
    },
  };
})(window);
