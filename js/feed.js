/**
 * Community Hub — Artifact Feed (social timeline).
 */
(function (global) {
  "use strict";

  var state = {
    cursor: null,
    loading: false,
    artifacts: [],
    pollTimer: null,
    proofStartedAt: {},
    postsById: {},
  };
  var PROOF_POLL_MS = 8000;
  var PROOF_LOAD_TIMEOUT_MS = 90000;

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

  function timeAgo(ts) {
    if (!ts) return "";
    var diff = Date.now() - Number(ts);
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + "m";
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + "h";
    return Math.floor(hrs / 24) + "d";
  }

  function avatarInitial(name) {
    var n = String(name || "?").replace(/^@/, "");
    return n.charAt(0).toUpperCase();
  }

  function proofLoadExpired(postId) {
    var started = state.proofStartedAt[postId];
    if (!started) return false;
    return Date.now() - started > PROOF_LOAD_TIMEOUT_MS;
  }

  function trackProofLoading(postId, hasProof) {
    if (hasProof) {
      delete state.proofStartedAt[postId];
      return;
    }
    if (!state.proofStartedAt[postId]) {
      state.proofStartedAt[postId] = Date.now();
    }
  }

  function proofMediaUrl(post) {
    return post.proof_video_url || post.proof_image_url || "";
  }

  function isVideoProof(post) {
    if (post.proof_media_type === "video") return true;
    return !!post.proof_video_url && !post.proof_image_url;
  }

  function selfieViewerContent(postId, post, artUrl) {
    var proofUrl = proofMediaUrl(post);
    trackProofLoading(postId, !!proofUrl);
    if (proofUrl && isVideoProof(post)) {
      return (
        '<video class="feed-viewer-img feed-viewer-img--selfie feed-viewer-video" src="' +
        escapeHtml(proofUrl) +
        '" controls playsinline loop muted></video>'
      );
    }
    if (proofUrl) {
      return (
        '<img class="feed-viewer-img feed-viewer-img--selfie" src="' +
        escapeHtml(proofUrl) +
        '" alt="Viewer proof" loading="lazy">'
      );
    }
    if (proofLoadExpired(postId)) {
      return (
        '<div class="feed-viewer-placeholder" aria-label="Selfie unavailable">' +
        '<span class="feed-viewer-placeholder-ico">👤</span>' +
        "<span>Selfie preview unavailable</span></div>"
      );
    }
    return (
      '<div class="feed-viewer-loading" aria-live="polite">' +
      '<span class="feed-viewer-loading-dot"></span>' +
      "<span>Generating selfie…</span></div>"
    );
  }

  function artifactViewerContent(artUrl) {
    if (!artUrl) {
      return (
        '<div class="feed-viewer-placeholder" aria-label="Artifact unavailable">' +
        '<span class="feed-viewer-placeholder-ico">💎</span>' +
        "<span>No artifact image</span></div>"
      );
    }
    return (
      '<img class="feed-viewer-img feed-viewer-img--artifact" src="' +
      escapeHtml(artUrl) +
      '" alt="Viewer Artifact" loading="lazy">'
    );
  }

  function renderProofStage(post) {
    var art = post.artifact;
    var artUrl = art && art.image_url ? art.image_url : "";
    var proofUrl = proofMediaUrl(post);
    if (!artUrl && !proofUrl) return "";

    var thumbArtifact = artUrl
      ? '<img class="feed-pip-thumb-img feed-pip-thumb-img--artifact" src="' +
        escapeHtml(artUrl) +
        '" alt="Artifact" loading="lazy">'
      : '<span class="feed-pip-thumb-fallback feed-pip-thumb-img--artifact">💎</span>';

    var thumbSelfie = proofUrl
      ? isVideoProof(post)
        ? '<span class="feed-pip-thumb-fallback feed-pip-thumb-img--selfie feed-pip-thumb-fallback--video">▶</span>'
        : '<img class="feed-pip-thumb-img feed-pip-thumb-img--selfie" src="' +
          escapeHtml(proofUrl) +
          '" alt="Proof" loading="lazy">'
      : '<span class="feed-pip-thumb-fallback feed-pip-thumb-img--selfie">👤</span>';

    var canOpenShop =
      art &&
      (art.design_id || art.instance_id || art.shopify_handle || art.image_url);

    return (
      '<div class="feed-proof" data-proof-root="' +
      post.id +
      '">' +
      '<div class="feed-pip-viewer mode-selfie" data-proof-stage="' +
      post.id +
      '">' +
      '<div class="feed-pip-frame">' +
      '<div class="feed-pip-main feed-pip-main--shop"' +
      (canOpenShop ? ' data-feed-product-open="' + post.id + '"' : ' data-feed-product-open-disabled="1"') +
      ' role="button" tabindex="0" aria-label="View product in shop">' +
      '<div class="feed-pip-layer feed-pip-layer--selfie" data-selfie-frame="' +
      post.id +
      '">' +
      selfieViewerContent(post.id, post, artUrl) +
      "</div>" +
      '<div class="feed-pip-layer feed-pip-layer--artifact">' +
      artifactViewerContent(artUrl) +
      "</div></div>" +
      '<button type="button" class="feed-pip-thumb" data-pip-toggle="' +
      post.id +
      '" aria-label="Switch between selfie and artifact">' +
      thumbArtifact +
      thumbSelfie +
      "</button></div></div></div>"
    );
  }

  function setProofMode(postId, mode) {
    var stage = document.querySelector('[data-proof-stage="' + postId + '"]');
    if (!stage) return;
    stage.classList.remove("mode-selfie", "mode-artifact");
    stage.classList.add(mode === "artifact" ? "mode-artifact" : "mode-selfie");
  }

  function toggleProofMode(postId) {
    var stage = document.querySelector('[data-proof-stage="' + postId + '"]');
    if (!stage) return;
    var next = stage.classList.contains("mode-artifact") ? "selfie" : "artifact";
    setProofMode(postId, next);
  }

  function patchProofFromPost(post) {
    var frame = document.querySelector('[data-selfie-frame="' + post.id + '"]');
    if (!frame) return;
    var proofUrl = proofMediaUrl(post);
    var artUrl = (post.artifact && post.artifact.image_url) || "";
    frame.innerHTML = selfieViewerContent(post.id, post, artUrl);

    var stage = document.querySelector('[data-proof-stage="' + post.id + '"]');
    if (stage && proofUrl) {
      var thumbSelfie = stage.querySelector(".feed-pip-thumb-img--selfie");
      if (thumbSelfie && thumbSelfie.tagName === "IMG" && !isVideoProof(post)) {
        thumbSelfie.src = proofUrl;
      } else if (isVideoProof(post)) {
        var fallback = stage.querySelector(".feed-pip-thumb-img--selfie");
        if (fallback && !fallback.classList.contains("feed-pip-thumb-fallback--video")) {
          var span = document.createElement("span");
          span.className =
            "feed-pip-thumb-fallback feed-pip-thumb-img--selfie feed-pip-thumb-fallback--video";
          span.textContent = "▶";
          fallback.replaceWith(span);
        }
      } else {
        var fallbackEl = stage.querySelector(".feed-pip-thumb-img--selfie.feed-pip-thumb-fallback");
        if (fallbackEl) {
          var img = document.createElement("img");
          img.className = "feed-pip-thumb-img feed-pip-thumb-img--selfie";
          img.src = proofUrl;
          img.alt = "Proof";
          fallbackEl.replaceWith(img);
        }
      }
    }
  }

  function patchPostsInPlace(posts) {
    posts.forEach(function (post) {
      patchProofFromPost(post);
      var likeBtn = document.querySelector('[data-like="' + post.id + '"]');
      if (likeBtn) {
        likeBtn.classList.toggle("is-liked", !!post.viewer_liked);
        var likeCount = likeBtn.querySelector(".feed-like-count");
        if (likeCount) likeCount.textContent = String(post.like_count || 0);
      }
      var commentBtn = document.querySelector('[data-comments="' + post.id + '"]');
      if (commentBtn) {
        var commentCount = commentBtn.querySelector(".feed-comment-count");
        if (commentCount) commentCount.textContent = String(post.comment_count || 0);
      }
    });
  }

  function verifyBadge(post) {
    if (post.is_demo) return "";
    var st = post.verify_status || "approved";
    if (st === "approved") return "";
    if (st === "rejected") return '<span class="badge red feed-verify-badge">Rejected</span>';
    return '<span class="badge orange feed-verify-badge">Pending verification</span>';
  }

  function renderPost(post) {
    var liked = post.viewer_liked ? " is-liked" : "";
    var proofHtml = renderProofStage(post);
    var claimBtn =
      post.can_claim_wear_earn
        ? '<button type="button" class="btn primary sm feed-claim-eaz" data-claim-eaz="' +
          post.id +
          '">Claim Free EAZ</button>'
        : "";

    return (
      '<article class="panel feed-post' +
      (post.verify_status === "rejected" ? " feed-post--rejected" : "") +
      (post.verify_status && post.verify_status !== "approved" && !post.is_demo
        ? " feed-post--pending"
        : "") +
      '" data-post-id="' +
      post.id +
      '">' +
      '<header class="feed-post-head">' +
      '<div class="feed-avatar" aria-hidden="true">' +
      escapeHtml(avatarInitial(post.author_username)) +
      "</div>" +
      '<div class="feed-post-meta">' +
      "<strong>" +
      escapeHtml(post.author_username || "@player") +
      "</strong>" +
      "<span>" +
      timeAgo(post.created_at) +
      " · Proof of ownership" +
      (post.is_demo ? " · Demo" : "") +
      "</span>" +
      verifyBadge(post) +
      "</div></header>" +
      '<p class="feed-post-body">' +
      escapeHtml(post.body_text) +
      "</p>" +
      proofHtml +
      '<div class="feed-post-actions">' +
      '<button type="button" class="feed-action feed-like' +
      liked +
      '" data-like="' +
      post.id +
      '" aria-label="Like">' +
      '<span class="feed-action-ico">♥</span><span class="feed-like-count">' +
      (post.like_count || 0) +
      "</span></button>" +
      '<button type="button" class="feed-action feed-comment-toggle" data-comments="' +
      post.id +
      '" aria-label="Comments">' +
      '<span class="feed-action-ico">💬</span><span class="feed-comment-count">' +
      (post.comment_count || 0) +
      "</span></button>" +
      claimBtn +
      "</div>" +
      '<div class="feed-comments" id="feedComments-' +
      post.id +
      '" hidden></div></article>'
    );
  }

  function scheduleProofPoll(pending) {
    if (state.pollTimer) {
      clearTimeout(state.pollTimer);
      state.pollTimer = null;
    }
    if (!pending) return;
    state.pollTimer = setTimeout(function () {
      loadStream(false, true);
    }, PROOF_POLL_MS);
  }

  async function loadStream(append, silent) {
    var stream = qs("feedStream");
    if (!stream) return;

    if (state.loading && !silent) return;
    state.loading = true;

    var canPatch = silent && !append && stream.querySelector(".feed-post");

    if (!append && !silent) {
      stream.innerHTML = '<div class="empty-state"><div class="big">🔥</div><p>Loading feed…</p></div>';
      state.cursor = null;
    }

    try {
      var res = await global.CommunityApi.feedList(20, append ? state.cursor : null);
      if (!res.ok) {
        if (!append && !silent) {
          stream.innerHTML =
            '<div class="empty-state"><p>Could not load feed (' +
            escapeHtml(res.error || "error") +
            "). Refresh the page.</p></div>";
        }
        return;
      }

      var posts = res.posts || [];
      state.cursor = res.next_cursor;
      posts.forEach(function (p) {
        state.postsById[p.id] = p;
        state.postsById[String(p.id)] = p;
      });

      if (!posts.length && !append) {
        stream.innerHTML =
          '<div class="empty-state feed-empty"><div class="big">👕</div><h3>Be the first voice</h3><p>Share your Product Artifact — scan, wear, post.</p></div>';
        return;
      }

      if (canPatch) {
        patchPostsInPlace(posts);
      } else {
        var html = posts.map(renderPost).join("");
        if (append) {
          stream.insertAdjacentHTML("beforeend", html);
        } else {
          stream.innerHTML = html;
        }
      }

      scheduleProofPoll(!!res.pending_proof);

      if (state.cursor) {
        var more = qs("feedLoadMore");
        if (!more) {
          stream.insertAdjacentHTML(
            "afterend",
            '<button type="button" class="btn ghost sm feed-load-more" id="feedLoadMore">Load more</button>'
          );
          qs("feedLoadMore").addEventListener("click", function () {
            loadStream(true, false);
          });
        }
      } else {
        var oldMore = qs("feedLoadMore");
        if (oldMore) oldMore.remove();
      }
    } catch (e) {
      if (!append && !silent) {
        stream.innerHTML =
          '<div class="empty-state"><p>Feed request failed. Check your connection and refresh.</p></div>';
      }
    } finally {
      state.loading = false;
    }
  }

  async function loadArtifactPicker() {
    var sel = qs("feedArtifactPick");
    if (!sel || !global.CommunityAuth.isLoggedIn()) return;

    var ownerId = global.CommunityAuth.ownerId();
    var inv = await global.CommunityApi.artifactsInventory(ownerId);
    if (!inv.ok) return;

    state.artifacts = (inv.slots || []).filter(function (s) {
      return s.artwork_url;
    });

    var opts = '<option value="">No artifact attached</option>';
    state.artifacts.forEach(function (a) {
      var label = a.product_title || a.serial || a.slot_type || "Artifact #" + a.id;
      opts += '<option value="' + a.id + '">' + escapeHtml(label) + "</option>";
    });
    sel.innerHTML = opts;
  }

  async function loadSpotlight() {
    var el = qs("feedSpotlight");
    if (!el) return;
    try {
      var res = await global.CommunityApi.artifactsShowcaseRecent(6);
      if (!res.ok || !res.items || !res.items.length) {
        el.innerHTML = '<p class="feed-aside-empty">No artifacts yet.</p>';
        return;
      }
      el.innerHTML = res.items
        .map(function (item) {
          var img = item.artwork_url
            ? '<img src="' + escapeHtml(item.artwork_url) + '" alt="" loading="lazy">'
            : "👕";
          return (
            '<div class="feed-spotlight-item">' +
            img +
            "<span>" +
            escapeHtml(item.product_title || item.slot_type || "Artifact") +
            "</span></div>"
          );
        })
        .join("");
    } catch (e) {
      el.innerHTML = "";
    }
  }

  async function submitPost() {
    if (!global.CommunityAuth.isLoggedIn()) {
      global.CommunityAuth.login();
      return;
    }
    var textEl = qs("feedComposeText");
    var pick = qs("feedArtifactPick");
    var text = textEl ? textEl.value.trim() : "";
    if (!text) {
      alert("Write something to share.");
      return;
    }
    if (!pick || !pick.value) {
      alert("Attach an Artifact from your vault.");
      return;
    }
    if (!global.CommunityFeedCamera || !global.CommunityFeedCamera.hasProof()) {
      alert("Capture camera proof wearing your product first.");
      if (global.CommunityFeedCamera) global.CommunityFeedCamera.openPanel();
      return;
    }

    var blob = global.CommunityFeedCamera.getProofBlob();
    var proofKind = global.CommunityFeedCamera.getProofKind
      ? global.CommunityFeedCamera.getProofKind()
      : "photo";
    var form = new FormData();
    form.append("body_text", text);
    form.append("artifact_instance_id", pick.value);
    if (proofKind === "video") {
      var ext = blob.type && blob.type.indexOf("mp4") >= 0 ? "mp4" : "webm";
      form.append("proof_video", blob, "proof." + ext);
    } else {
      form.append("proof_image", blob, "proof.jpg");
    }

    var btn = qs("feedPostBtn");
    if (btn) btn.disabled = true;
    try {
      var res = await global.CommunityApi.feedCreate(form);
      if (!res.ok) {
        alert(res.error || "Post failed");
        return;
      }
      if (textEl) textEl.value = "";
      if (pick) pick.value = "";
      if (global.CommunityFeedCamera) global.CommunityFeedCamera.closePanel();
      if (global.CommunityFeedComposeFloat) global.CommunityFeedComposeFloat.collapse();
      alert("Posted! Pending community verification.");
      await loadStream(false, false);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function toggleLike(postId, btn) {
    if (!global.CommunityAuth.isLoggedIn()) {
      global.CommunityAuth.login();
      return;
    }
    var res = await global.CommunityApi.feedLike(postId);
    if (!res.ok) {
      alert(res.error || "Like failed");
      return;
    }
    if (btn) {
      btn.classList.toggle("is-liked", res.liked);
      var countEl = btn.querySelector(".feed-like-count");
      if (countEl) countEl.textContent = String(res.like_count || 0);
    }
  }

  async function toggleComments(postId) {
    var box = qs("feedComments-" + postId);
    if (!box) return;
    if (!box.hidden) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.innerHTML = '<p class="feed-comments-loading">Loading…</p>';

    var res = await global.CommunityApi.feedComments(postId);
    if (!res.ok) {
      box.innerHTML = "<p>Could not load comments.</p>";
      return;
    }

    var list = (res.comments || [])
      .map(function (c) {
        return (
          '<div class="feed-comment"><strong>' +
          escapeHtml(c.author_username) +
          "</strong> " +
          escapeHtml(c.body_text) +
          '<span class="feed-comment-time">' +
          timeAgo(c.created_at) +
          "</span></div>"
        );
      })
      .join("");

    var compose = global.CommunityAuth.isLoggedIn()
      ? '<div class="feed-comment-compose">' +
        '<input type="text" class="feed-comment-input" maxlength="280" placeholder="Add a comment…" data-comment-input="' +
        postId +
        '">' +
        '<button type="button" class="btn sm" data-comment-send="' +
        postId +
        '">Send</button></div>'
      : '<p class="feed-comment-login"><button type="button" class="btn ghost sm" data-login>Sign in to comment</button></p>';

    box.innerHTML = (list || '<p class="feed-comments-empty">No comments yet.</p>') + compose;
  }

  async function sendComment(postId, input) {
    if (!global.CommunityAuth.isLoggedIn()) {
      global.CommunityAuth.login();
      return;
    }
    var text = input ? input.value.trim() : "";
    if (!text) return;
    var res = await global.CommunityApi.feedComment(postId, text);
    if (!res.ok) {
      alert(res.error || "Comment failed");
      return;
    }
    if (input) input.value = "";
    var toggle = document.querySelector('[data-comments="' + postId + '"]');
    if (toggle) {
      var countEl = toggle.querySelector(".feed-comment-count");
      if (countEl) countEl.textContent = String(res.comment_count || 0);
    }
    await toggleComments(postId);
    var box = qs("feedComments-" + postId);
    if (box) box.hidden = false;
  }

  async function claimWearEarn(postId, btn) {
    if (!global.CommunityAuth.isLoggedIn()) {
      global.CommunityAuth.login();
      return;
    }
    if (btn) btn.disabled = true;
    try {
      var res = await global.CommunityApi.wearEarnClaim("proof_upload", postId);
      if (res.ok) {
        alert("+" + res.eaz_credited + " Free EAZ credited.");
        if (global.CommunityAuth.refreshSession) global.CommunityAuth.refreshSession();
        if (typeof global.CommunityHubRefresh === "function") global.CommunityHubRefresh();
        if (btn) btn.remove();
      } else if (res.error === "verify_required") {
        alert("Community verification still pending.");
      } else if (res.error === "already_claimed") {
        alert("Already claimed for this proof today.");
        if (btn) btn.remove();
      } else {
        alert(res.error || "Claim failed");
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function resolvePostById(postId) {
    if (!postId) return null;
    if (state.postsById[postId]) return state.postsById[postId];
    if (state.postsById[String(postId)]) return state.postsById[String(postId)];
    return null;
  }

  function openProductModalForPost(postId) {
    var post = resolvePostById(postId);
    if (!post) return;
    if (global.CommunityFeedProductModal) global.CommunityFeedProductModal.open(post);
  }

  function bindStreamEvents() {
    var stream = qs("feedStream");
    if (!stream || stream.dataset.bound) return;
    stream.dataset.bound = "1";

    stream.addEventListener("click", function (e) {
      var tab = e.target.closest("[data-pip-toggle]");
      if (tab) {
        e.stopPropagation();
        toggleProofMode(Number(tab.getAttribute("data-pip-toggle")));
        return;
      }

      var productOpen = e.target.closest("[data-feed-product-open]");
      if (productOpen && !productOpen.hasAttribute("data-feed-product-open-disabled")) {
        e.preventDefault();
        openProductModalForPost(Number(productOpen.getAttribute("data-feed-product-open")));
        return;
      }
      var likeBtn = e.target.closest("[data-like]");
      if (likeBtn) {
        toggleLike(Number(likeBtn.getAttribute("data-like")), likeBtn);
        return;
      }
      var commentBtn = e.target.closest(".feed-comment-toggle");
      if (commentBtn) {
        toggleComments(Number(commentBtn.getAttribute("data-comments")));
        return;
      }
      var loginBtn = e.target.closest("[data-login]");
      if (loginBtn) {
        e.preventDefault();
        global.CommunityAuth.login();
        return;
      }
      var sendBtn = e.target.closest("[data-comment-send]");
      if (sendBtn) {
        var pid = Number(sendBtn.getAttribute("data-comment-send"));
        var input = document.querySelector('[data-comment-input="' + pid + '"]');
        sendComment(pid, input);
        return;
      }
      var claimBtn = e.target.closest("[data-claim-eaz]");
      if (claimBtn) {
        claimWearEarn(Number(claimBtn.getAttribute("data-claim-eaz")), claimBtn);
      }
    });

    stream.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var productOpen = e.target.closest("[data-feed-product-open]");
      if (productOpen && !productOpen.hasAttribute("data-feed-product-open-disabled")) {
        e.preventDefault();
        openProductModalForPost(Number(productOpen.getAttribute("data-feed-product-open")));
        return;
      }
      if (e.key !== "Enter") return;
      var input = e.target.closest(".feed-comment-input");
      if (!input) return;
      e.preventDefault();
      var pid = Number(input.getAttribute("data-comment-input"));
      sendComment(pid, input);
    });
  }

  function bindComposeFloat() {
    var floatBar = qs("feedComposeFloat");
    var floatBtn = qs("feedComposeFloatBtn");
    var collapseBtn = qs("feedComposeCollapseBtn");
    if (!floatBar || floatBar.dataset.bound) return;
    floatBar.dataset.bound = "1";

    var lastY = window.scrollY || document.documentElement.scrollTop || 0;
    var ticking = false;
    var scrollArmed = false;
    var floatShown = false;
    var expanded = false;
    var SCROLL_ARM_PX = 72;
    var SCROLL_DELTA_PX = 8;

    function isFeedActive() {
      return !!document.querySelector('.screen[data-page="feed"].active');
    }

    function syncVisibility() {
      var show = expanded || floatShown;
      floatBar.classList.toggle("is-visible", show);
      floatBar.classList.toggle("is-expanded", expanded);
      floatBar.setAttribute("aria-hidden", show ? "false" : "true");
      if (floatBtn) floatBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
    }

    function setFloatVisible(show) {
      floatShown = show;
      syncVisibility();
    }

    function setExpanded(on) {
      expanded = on;
      syncVisibility();
      if (on) {
        var textEl = qs("feedComposeText");
        if (textEl) {
          try {
            textEl.focus({ preventScroll: true });
          } catch (e) {
            textEl.focus();
          }
        }
      }
    }

    function onScroll() {
      if (!isFeedActive()) {
        if (!expanded) setFloatVisible(false);
        return;
      }
      if (expanded) return;

      var y = window.scrollY || document.documentElement.scrollTop || 0;
      var delta = y - lastY;

      if (y > SCROLL_ARM_PX) scrollArmed = true;

      if (Math.abs(delta) < SCROLL_DELTA_PX) return;

      if (delta > SCROLL_DELTA_PX) {
        setFloatVisible(false);
      } else if (delta < -SCROLL_DELTA_PX && scrollArmed) {
        setFloatVisible(true);
      }
      lastY = y;
    }

    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(function () {
            onScroll();
            ticking = false;
          });
        }
      },
      { passive: true }
    );

    if (floatBtn) {
      floatBtn.addEventListener("click", function () {
        setExpanded(true);
      });
    }
    if (collapseBtn) {
      collapseBtn.addEventListener("click", function () {
        setExpanded(false);
      });
    }

    global.CommunityFeedComposeFloat = {
      collapse: function () {
        setExpanded(false);
      },
      expand: function () {
        setFloatVisible(true);
        setExpanded(true);
      },
      isExpanded: function () {
        return expanded;
      },
    };
  }

  function bind() {
    var postBtn = qs("feedPostBtn");
    if (postBtn) postBtn.addEventListener("click", submitPost);
    var camBtn = qs("feedOpenCameraBtn");
    if (camBtn) {
      camBtn.addEventListener("click", function () {
        if (global.CommunityFeedCamera) global.CommunityFeedCamera.openPanel();
      });
    }
    if (global.CommunityFeedCamera) global.CommunityFeedCamera.bind();
    if (global.CommunityFeedProductModal) global.CommunityFeedProductModal.bind();
    bindStreamEvents();
    bindComposeFloat();
  }

  async function refresh() {
    bindStreamEvents();
    await loadStream(false, false);
    await Promise.all([loadArtifactPicker(), loadSpotlight()]);
  }

  global.CommunityFeed = {
    bind: bind,
    refresh: refresh,
  };
})(window);
