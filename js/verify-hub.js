/**
 * Community Hub — Verify tab (ownership queue for feed proof).
 */
(function (global) {
  "use strict";

  var state = { entityType: "ownership", item: null, rejectReasons: [] };

  function qs(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function setQueueActive(queue) {
    document.querySelectorAll("[data-queue]").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-queue") === queue);
    });
    state.entityType =
      queue === "product" ? "product" : queue === "design" ? "design" : "ownership";
  }

  function renderEmpty(msg) {
    var card = qs("verifyCardBody");
    if (!card) return;
    card.innerHTML =
      '<div class="verify-empty"><div class="big">✓</div><p>' +
      escapeHtml(msg || "Nothing to verify right now.") +
      "</p></div>";
  }

  function renderItem(item) {
    var card = qs("verifyCardBody");
    if (!card || !item) return;

    var proof = item.proof_video_url || item.proof_image_url || item.image_url;
    var isVideo = item.proof_media_type === "video" || (!!item.proof_video_url && !item.proof_image_url);
    var proofMarkup = proof
      ? isVideo
        ? '<video src="' +
          escapeHtml(proof) +
          '" controls playsinline loop muted class="verify-proof-video"></video>'
        : '<img src="' + escapeHtml(proof) + '" alt="Camera proof">'
      : '<div class="verify-shot-empty">No proof</div>';

    card.innerHTML =
      '<div class="verify-ownership">' +
      '<p class="verify-caption">' +
      escapeHtml(item.body_text || item.title || "Ownership proof") +
      "</p>" +
      '<div class="verify-dual">' +
      '<div class="verify-shot"><span class="verify-shot-label">Proof</span>' +
      proofMarkup +
      "</div>" +
      '<div class="verify-shot"><span class="verify-shot-label">Artifact</span>' +
      (item.artifact_image_url
        ? '<img src="' + escapeHtml(item.artifact_image_url) + '" alt="Artifact">'
        : '<div class="verify-shot-empty">No artifact</div>') +
      "</div></div>" +
      '<div class="vote-row">' +
      '<button type="button" class="btn primary sm" id="verifyApproveBtn">Verify ✓</button>' +
      '<button type="button" class="btn ghost sm" id="verifyNotSureBtn">Not sure</button>' +
      '<button type="button" class="btn red sm" id="verifyRejectBtn">Reject</button>' +
      "</div>" +
      '<div id="verifyRejectPanel" class="verify-reject-panel" hidden>' +
      '<p>Select a reason:</p>' +
      '<div class="verify-reject-reasons" id="verifyRejectReasons"></div>' +
      '<button type="button" class="btn red sm" id="verifyRejectConfirm">Submit reject</button>' +
      "</div></div>";

    var reasonsEl = qs("verifyRejectReasons");
    if (reasonsEl) {
      reasonsEl.innerHTML = state.rejectReasons
        .map(function (r) {
          return (
            '<label class="verify-reason"><input type="checkbox" value="' +
            escapeHtml(r) +
            '"> ' +
            escapeHtml(r.replace(/_/g, " ")) +
            "</label>"
          );
        })
        .join("");
    }

    var approveBtn = qs("verifyApproveBtn");
    var notSureBtn = qs("verifyNotSureBtn");
    var rejectBtn = qs("verifyRejectBtn");
    var rejectConfirm = qs("verifyRejectConfirm");

    if (approveBtn) {
      approveBtn.addEventListener("click", function () {
        submitVote("approve");
      });
    }
    if (notSureBtn) {
      notSureBtn.addEventListener("click", function () {
        submitVote("not_sure");
      });
    }
    if (rejectBtn) {
      rejectBtn.addEventListener("click", function () {
        var panel = qs("verifyRejectPanel");
        if (panel) panel.hidden = false;
      });
    }
    if (rejectConfirm) {
      rejectConfirm.addEventListener("click", function () {
        var picked = [];
        document.querySelectorAll("#verifyRejectReasons input:checked").forEach(function (el) {
          picked.push(el.value);
        });
        if (!picked.length) {
          alert("Pick at least one reason.");
          return;
        }
        submitVote("reject", picked);
      });
    }
  }

  async function submitVote(vote, rejectReasons) {
    if (!global.CommunityAuth.isLoggedIn()) {
      global.CommunityAuth.login();
      return;
    }
    if (!state.item) return;

    var res = await global.CommunityApi.verifySubmitVote({
      item_id: state.item.id,
      vote: vote,
      reject_reasons: rejectReasons || [],
    });

    if (!res.ok) {
      alert(res.error || "Vote failed");
      return;
    }

    if (vote === "approve" || vote === "reject") {
      try {
        await global.CommunityApi.wearEarnClaim("verify_vote");
      } catch (e) {}
    }

    await loadNext();
  }

  async function loadNext() {
    if (!global.CommunityAuth.isLoggedIn()) {
      renderEmpty("Sign in to verify community proofs.");
      return;
    }

    var boot = await global.CommunityApi.verifyBootstrap(state.entityType);
    if (!boot.ok) {
      renderEmpty("Could not load verify queue.");
      return;
    }
    if (!boot.terms_accepted) {
      renderEmpty("Accept verify terms on eazpire.com first (Eazy Verify tab).");
      return;
    }

    state.rejectReasons = boot.reject_reasons || [];
    state.item = boot.item;
    if (!state.item) {
      renderEmpty("Queue empty — check back later.");
      return;
    }
    renderItem(state.item);
  }

  function bind() {
    document.querySelectorAll("[data-queue]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setQueueActive(btn.getAttribute("data-queue"));
        loadNext();
      });
    });
  }

  global.CommunityVerifyHub = {
    bind: bind,
    refresh: loadNext,
  };
})(window);
