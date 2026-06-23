/**
 * Community hub API client — proxies via community worker /api/dispatch.
 */
(function (global) {
  "use strict";

  const API_BASE = "/api/dispatch";

  async function dispatch(op, options) {
    options = options || {};
    const method = options.method || "GET";
    const params = options.query || {};
    const url = new URL(API_BASE, global.location.origin);
    url.searchParams.set("op", op);
    Object.keys(params).forEach(function (k) {
      if (params[k] != null && params[k] !== "") url.searchParams.set(k, String(params[k]));
    });

    const init = {
      method: method,
      credentials: "include",
      cache: "no-store",
      headers: {},
    };
    if (options.body != null) {
      init.headers["content-type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }

    const res = await fetch(url.toString(), init);
    const data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok && !data.error) data.error = "request_failed";
    data._status = res.status;
    return data;
  }

  global.CommunityApi = {
    dispatch: dispatch,
    me: function () {
      return fetch("/auth/me", { credentials: "include", cache: "no-store" }).then(function (r) {
        return r.json();
      });
    },
    referralCode: function (ownerId) {
      return dispatch("get-referral-code", { query: { owner_id: ownerId } });
    },
    network: function (ownerId) {
      return dispatch("list-community-network", { query: { owner_id: ownerId } });
    },
    analyticsOverview: function (ownerId) {
      return dispatch("get-community-analytics-overview", {
        query: { owner_id: ownerId, range: "30d" },
      });
    },
    balance: function (ownerId) {
      return dispatch("get-balance", { query: { owner_id: ownerId } });
    },
    shopCredits: function (ownerId) {
      return dispatch("get-shop-credits-summary", { query: { owner_id: ownerId } });
    },
    accountUsername: function (ownerId) {
      return dispatch("get-account-username", { query: { owner_id: ownerId } });
    },
    accountProfile: function (ownerId) {
      return dispatch("get-customer-account-profile", { query: { owner_id: ownerId } });
    },
    customerEmail: function (ownerId) {
      return dispatch("get-customer-email", { query: { customer_id: ownerId } });
    },
    artifactsInventory: function (ownerId) {
      return dispatch("artifacts-inventory-list", { query: { owner_id: ownerId } });
    },
    artifactsShowcaseRecent: function (limit) {
      return dispatch("artifacts-showcase-recent", {
        query: { limit: limit != null ? limit : 24 },
      });
    },
    verifyCompleted: function (ownerId) {
      return dispatch("verify-completed-list", { query: { owner_id: ownerId, outcome: "all" } });
    },
    verifyBootstrap: function (entityType) {
      return dispatch("verify-bootstrap", {
        query: { entity_type: entityType || "ownership" },
      });
    },
    verifySubmitVote: function (body) {
      return dispatch("verify-submit-vote", { method: "POST", body: body });
    },
    characterEquipment: function (characterId) {
      return dispatch("artifacts-character-equipment-get", { query: { character_id: characterId } });
    },
    characterSwapPrepare: function (characterId, instanceId) {
      return dispatch("artifacts-character-swap-prepare", {
        method: "POST",
        body: { character_id: characterId, instance_id: instanceId },
      });
    },
    characterSwapCommit: function (characterId, instanceId, clientNonce) {
      return dispatch("artifacts-character-swap-commit", {
        method: "POST",
        body: {
          character_id: characterId,
          instance_id: instanceId,
          client_nonce: clientNonce || String(Date.now()),
        },
      });
    },
    rerenderQuestGet: function (characterId) {
      return dispatch("artifacts-rerender-quest-get", {
        query: characterId ? { character_id: characterId } : {},
      });
    },
    rerenderQuestProgress: function (questId, stepsDelta) {
      return dispatch("artifacts-rerender-quest-progress", {
        method: "POST",
        body: { quest_id: questId, steps_delta: stepsDelta },
      });
    },
    wearEarnStatus: function () {
      return dispatch("community-wear-earn-status", {});
    },
    wearEarnClaim: function (actionKey, postId) {
      var body = { action_key: actionKey };
      if (postId) body.post_id = postId;
      return dispatch("community-wear-earn-claim", {
        method: "POST",
        body: body,
      });
    },
    moveToEarnStatus: function () {
      return dispatch("move-to-earn-status", {});
    },
    moveToEarnSyncSteps: function (stepsDelta) {
      return dispatch("move-to-earn-sync-steps", {
        method: "POST",
        body: { steps_delta: stepsDelta },
      });
    },
    discoveryConfig: function () {
      return dispatch("discovery-config", {});
    },
    discoveryStatus: function () {
      return dispatch("discovery-status", {});
    },
    discoverySyncTrack: function (batchId, points, clientMeta) {
      return dispatch("discovery-sync-track", {
        method: "POST",
        body: { batch_id: batchId, points: points, client: clientMeta || {} },
      });
    },
    discoveryMapTiles: function (regionId) {
      var q = {};
      if (regionId) q.region_id = regionId;
      return dispatch("discovery-map-tiles", { query: q });
    },
    discoveryZones: function (regionId) {
      var q = {};
      if (regionId) q.region_id = regionId;
      return dispatch("discovery-zones", { query: q });
    },
    moveSessionStart: function () {
      return dispatch("move-session-start", { method: "POST", body: {} });
    },
    moveSessionStatus: function () {
      return dispatch("move-session-status", {});
    },
    moveSessionEnd: function () {
      return dispatch("move-session-end", { method: "POST", body: {} });
    },
    discoveryLootNearby: function () {
      return dispatch("discovery-loot-nearby", {});
    },
    discoveryLootClaim: function (lootId) {
      return dispatch("discovery-loot-claim", {
        method: "POST",
        body: { loot_id: lootId },
      });
    },
    discoveryBiomeStats: function (regionId) {
      var q = {};
      if (regionId) q.region_id = regionId;
      return dispatch("discovery-biome-stats", { query: q });
    },
    discoveryRankingsGlobal: function (limit) {
      return dispatch("discovery-rankings-global", {
        query: { limit: limit || 50 },
      });
    },
    discoveryRankingsRegion: function (regionId, limit) {
      return dispatch("discovery-rankings-region", {
        query: { region_id: regionId || "earth", limit: limit || 50 },
      });
    },
    discoveryRankingsMe: function () {
      return dispatch("discovery-rankings-me", {});
    },
    discoveryAchievements: function () {
      return dispatch("discovery-achievements", {});
    },
    feedList: function (limit, cursor) {
      var q = { limit: limit || 20 };
      if (cursor) q.cursor = cursor;
      return dispatch("community-feed-list", { query: q });
    },
    feedCreate: function (formData) {
      var url = new URL(API_BASE, global.location.origin);
      url.searchParams.set("op", "community-feed-create");
      return fetch(url.toString(), {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        body: formData,
      }).then(function (res) {
        return res.json().catch(function () {
          return { ok: false, error: "request_failed", _status: res.status };
        });
      });
    },
    feedLike: function (postId) {
      return dispatch("community-feed-like", { method: "POST", body: { post_id: postId } });
    },
    feedComments: function (postId) {
      return dispatch("community-feed-comments", { query: { post_id: postId } });
    },
    feedComment: function (postId, text) {
      return dispatch("community-feed-comment", {
        method: "POST",
        body: { post_id: postId, body_text: text },
      });
    },
    getPublishedByDesign: function (designId, ownerId) {
      return dispatch("get-published", {
        query: { design_id: designId, owner_id: ownerId || "" },
      });
    },
  };
})(window);
