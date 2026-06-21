/**
 * Feed product preview modal — same-design shop products + ref link to shop PDP.
 * Main preview arrows/swipe cycle color variants of the selected carousel product.
 */
(function (global) {
  "use strict";

  var modalState = {
    post: null,
    products: [],
    selectedKey: null,
    selectedIndex: 0,
    selectedVariantIndex: 0,
    refCode: null,
  };

  var swipeState = { startX: 0, startY: 0, tracking: false };

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

  function productKey(item) {
    if (item.shopify_handle) return String(item.shopify_handle);
    if (item.id != null) return "draft-" + String(item.id);
    if (item.product_key) return String(item.product_key);
    return String(item.id || "");
  }

  function productHandle(item) {
    if (item.shopify_handle) return String(item.shopify_handle);
    var key = productKey(item);
    if (/^draft-\d+$/.test(key)) return key;
    return null;
  }

  function productImage(item, fallback) {
    var draftMockups = item.draft_mockups || {};
    return (
      (item.printify && item.printify.preview_image) ||
      draftMockups.front ||
      draftMockups.Front ||
      draftMockups.primary ||
      fallback ||
      ""
    );
  }

  function productTitle(item) {
    return item.product_name || item.title || "Product";
  }

  function artifactFallbackImage() {
    return modalState.post && modalState.post.artifact ? modalState.post.artifact.image_url : "";
  }

  function getProductVariants(item) {
    if (!item) return [];
    if (Array.isArray(item.color_variants) && item.color_variants.length) {
      return item.color_variants;
    }
    var fallback = artifactFallbackImage();
    var img = productImage(item, fallback);
    if (!img) return [];
    return [
      {
        key: "default",
        label: "",
        color: "",
        preview_image: img,
        shopify_variant_id: null,
        printify_variant_id: null,
        option_values: [],
      },
    ];
  }

  function findSelectedProduct() {
    return modalState.products.find(function (p) {
      return productKey(p) === modalState.selectedKey;
    });
  }

  function findSelectedIndex() {
    if (!modalState.products.length) return -1;
    var idx = modalState.products.findIndex(function (p) {
      return productKey(p) === modalState.selectedKey;
    });
    return idx >= 0 ? idx : modalState.selectedIndex;
  }

  function findSelectedVariant() {
    var item = findSelectedProduct();
    if (!item) return null;
    var variants = getProductVariants(item);
    if (!variants.length) return null;
    var idx = modalState.selectedVariantIndex;
    if (idx < 0 || idx >= variants.length) idx = 0;
    return variants[idx] || variants[0];
  }

  function variantImage(item, variant, fallback) {
    if (variant && variant.preview_image) return variant.preview_image;
    return productImage(item, fallback);
  }

  function isMobileUa() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  }

  function buildShopViewUrl(handle, refCode, variant) {
    var h = encodeURIComponent(handle);
    var params = [];
    if (refCode) params.push("ref=" + encodeURIComponent(refCode));
    if (variant) {
      if (variant.shopify_variant_id != null && variant.shopify_variant_id !== "") {
        params.push("variant=" + encodeURIComponent(String(variant.shopify_variant_id)));
        params.push("eaz_variant_id=" + encodeURIComponent(String(variant.shopify_variant_id)));
      }
      if (variant.color) {
        params.push("eaz_variant_color=" + encodeURIComponent(String(variant.color)));
      }
    }
    var qs = params.length ? "?" + params.join("&") : "";

    if (isMobileUa()) {
      return "https://www.eazpire.com/products/" + h + qs;
    }
    var url = "https://www.eazpire.com/?eaz_open_pdp=" + h;
    if (params.length) url += "&" + params.join("&");
    return url;
  }

  function updateNavButtons() {
    var prev = qs("feedProductModalPrev");
    var next = qs("feedProductModalNext");
    var item = findSelectedProduct();
    var variants = item ? getProductVariants(item) : [];
    var count = variants.length;
    var idx = modalState.selectedVariantIndex;
    var show = count > 1;
    if (prev) prev.hidden = !show;
    if (next) next.hidden = !show;
    if (prev) prev.disabled = idx <= 0;
    if (next) next.disabled = idx >= count - 1;
  }

  function scrollGridToActive() {
    var grid = qs("feedProductModalGrid");
    if (!grid) return;
    var active = grid.querySelector(".feed-product-modal-grid-item.is-active");
    if (active && active.scrollIntoView) {
      active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }

  function renderMainPreview() {
    var mainEl = qs("feedProductModalMain");
    var titleEl = qs("feedProductModalTitle");
    if (!mainEl) return;

    var item = findSelectedProduct();
    if (!item) return;

    var fallback = artifactFallbackImage();
    var variant = findSelectedVariant();
    var src = variantImage(item, variant, fallback);
    var title = productTitle(item);
    var variantLabel = variant && (variant.label || variant.color) ? String(variant.label || variant.color) : "";

    if (src) {
      mainEl.innerHTML =
        '<img src="' +
        escapeHtml(src) +
        '" alt="' +
        escapeHtml(title + (variantLabel ? " — " + variantLabel : "")) +
        '" loading="lazy">';
    } else {
      mainEl.innerHTML =
        '<div class="feed-product-modal-main-fallback"><span aria-hidden="true">👕</span><p>' +
        escapeHtml(title) +
        (variantLabel ? '<span class="feed-product-modal-muted">' + escapeHtml(variantLabel) + "</span>" : "") +
        "</p></div>";
    }
    if (titleEl) titleEl.textContent = title;
    updateNavButtons();
  }

  function renderCarousel() {
    var grid = qs("feedProductModalGrid");
    if (!grid) return;

    var fallback = artifactFallbackImage();

    grid.innerHTML = modalState.products
      .map(function (item) {
        var key = productKey(item);
        var active = key === modalState.selectedKey ? " is-active" : "";
        var variants = getProductVariants(item);
        var thumbVariant = key === modalState.selectedKey && variants.length ? variants[modalState.selectedVariantIndex] || variants[0] : variants[0];
        var src = variantImage(item, thumbVariant, fallback);
        var thumb = src
          ? '<img src="' + escapeHtml(src) + '" alt="" loading="lazy">'
          : '<span class="feed-product-modal-grid-fallback" aria-hidden="true">👕</span>';
        return (
          '<button type="button" class="feed-product-modal-grid-item' +
          active +
          '" data-product-key="' +
          escapeHtml(key) +
          '">' +
          thumb +
          '<span class="feed-product-modal-grid-label">' +
          escapeHtml(productTitle(item)) +
          "</span></button>"
        );
      })
      .join("");

    scrollGridToActive();
  }

  function updateShopButton() {
    var shopBtn = qs("feedProductModalShopBtn");
    if (!shopBtn) return;
    var item = findSelectedProduct();
    var handle = item ? productHandle(item) : null;
    if (!handle) {
      shopBtn.hidden = true;
      return;
    }
    shopBtn.href = buildShopViewUrl(handle, modalState.refCode, findSelectedVariant());
    shopBtn.hidden = false;
  }

  function resolveVariantIndexForProduct(item, preferredColor) {
    var variants = getProductVariants(item);
    if (!variants.length) return 0;
    if (!preferredColor) return 0;
    var needle = String(preferredColor).trim().toLowerCase();
    for (var i = 0; i < variants.length; i++) {
      var v = variants[i];
      var label = String(v.label || v.color || "").trim().toLowerCase();
      if (label && label === needle) return i;
    }
    return 0;
  }

  function selectProduct(key, preferredColor) {
    var idx = modalState.products.findIndex(function (p) {
      return productKey(p) === key;
    });
    var item = idx >= 0 ? modalState.products[idx] : null;
    if (!item) return;

    var keepColor = preferredColor;
    if (keepColor == null) {
      var prevVariant = findSelectedVariant();
      if (prevVariant && (prevVariant.color || prevVariant.label)) {
        keepColor = prevVariant.color || prevVariant.label;
      }
    }

    modalState.selectedKey = key;
    modalState.selectedIndex = idx;
    modalState.selectedVariantIndex = resolveVariantIndexForProduct(item, keepColor);
    renderMainPreview();
    renderCarousel();
    updateShopButton();
  }

  function navigateVariant(delta) {
    var item = findSelectedProduct();
    if (!item) return;
    var variants = getProductVariants(item);
    if (variants.length <= 1) return;
    var next = modalState.selectedVariantIndex + delta;
    if (next < 0 || next >= variants.length) return;
    modalState.selectedVariantIndex = next;
    renderMainPreview();
    renderCarousel();
    updateShopButton();
  }

  async function loadProducts(post) {
    var art = post.artifact || {};
    var designId = art.design_id;
    var handle = art.shopify_handle;
    var fallbackImg = art.image_url || "";

    if (designId) {
      var res = await global.CommunityApi.getPublishedByDesign(designId, post.owner_id);
      if (res.ok && Array.isArray(res.published) && res.published.length) {
        return res.published.filter(function (p) {
          return p.shopify_handle || p.storefront_url || p.product_name || p.id != null;
        });
      }
    }

    if (handle) {
      return [
        {
          shopify_handle: handle,
          product_name: art.title || "Product",
          printify: { preview_image: fallbackImg || null },
          color_variants: fallbackImg
            ? [
                {
                  key: "default",
                  label: "",
                  color: "",
                  preview_image: fallbackImg,
                  shopify_variant_id: null,
                  printify_variant_id: null,
                  option_values: [],
                },
              ]
            : [],
        },
      ];
    }

    return [];
  }

  function openModalShell() {
    var modal = qs("feedProductModal");
    if (!modal) return;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModalShell() {
    var modal = qs("feedProductModal");
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  async function open(post) {
    if (!post || !post.artifact) return;

    openModalShell();
    modalState.post = post;
    modalState.products = [];
    modalState.selectedKey = null;
    modalState.selectedIndex = 0;
    modalState.selectedVariantIndex = 0;
    modalState.refCode = null;

    var mainEl = qs("feedProductModalMain");
    var grid = qs("feedProductModalGrid");
    var shopBtn = qs("feedProductModalShopBtn");
    if (mainEl) {
      mainEl.innerHTML =
        '<div class="feed-product-modal-loading"><span class="feed-viewer-loading-dot"></span><span>Loading products…</span></div>';
    }
    if (grid) grid.innerHTML = "";
    if (shopBtn) shopBtn.hidden = true;
    updateNavButtons();

    try {
      var refRes = await global.CommunityApi.referralCode(post.owner_id);
      if (refRes.ok && refRes.code) modalState.refCode = refRes.code;

      modalState.products = await loadProducts(post);

      if (!modalState.products.length) {
        if (mainEl) {
          mainEl.innerHTML =
            '<div class="feed-product-modal-main-fallback"><span aria-hidden="true">💎</span><p>' +
            escapeHtml(post.artifact.title || "Product") +
            '</p><p class="feed-product-modal-muted">No shop listings found for this design yet.</p></div>';
        }
        updateNavButtons();
        return;
      }

      var preferred = modalState.products[0];
      var artifactProductId = post.artifact.product_id;
      if (artifactProductId) {
        var match = modalState.products.find(function (p) {
          return (
            String(p.product_key || "") === String(artifactProductId) ||
            String(p.shopify_product_id || "") === String(artifactProductId) ||
            String(p.printify_product_id || "") === String(artifactProductId)
          );
        });
        if (match) preferred = match;
      }

      selectProduct(productKey(preferred), null);
    } catch (e) {
      if (mainEl) {
        mainEl.innerHTML =
          '<div class="feed-product-modal-main-fallback"><p>Could not load products.</p></div>';
      }
      updateNavButtons();
    }
  }

  function close() {
    closeModalShell();
    modalState.post = null;
    modalState.products = [];
    modalState.selectedKey = null;
    modalState.selectedIndex = 0;
    modalState.selectedVariantIndex = 0;
    modalState.refCode = null;
  }

  function bindMainSwipe() {
    var wrap = qs("feedProductModalMainWrap");
    if (!wrap || wrap.dataset.swipeBound) return;
    wrap.dataset.swipeBound = "1";

    wrap.addEventListener(
      "touchstart",
      function (e) {
        if (!e.touches || !e.touches.length) return;
        swipeState.tracking = true;
        swipeState.startX = e.touches[0].clientX;
        swipeState.startY = e.touches[0].clientY;
      },
      { passive: true }
    );

    wrap.addEventListener(
      "touchend",
      function (e) {
        if (!swipeState.tracking || !e.changedTouches || !e.changedTouches.length) return;
        swipeState.tracking = false;
        var dx = e.changedTouches[0].clientX - swipeState.startX;
        var dy = e.changedTouches[0].clientY - swipeState.startY;
        if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
        if (dx < 0) navigateVariant(1);
        else navigateVariant(-1);
      },
      { passive: true }
    );
  }

  function bind() {
    var modal = qs("feedProductModal");
    if (!modal || modal.dataset.bound) return;
    modal.dataset.bound = "1";

    modal.querySelectorAll("[data-feed-product-close]").forEach(function (el) {
      el.addEventListener("click", close);
    });

    var prevBtn = qs("feedProductModalPrev");
    var nextBtn = qs("feedProductModalNext");
    if (prevBtn) prevBtn.addEventListener("click", function () { navigateVariant(-1); });
    if (nextBtn) nextBtn.addEventListener("click", function () { navigateVariant(1); });

    var grid = qs("feedProductModalGrid");
    if (grid) {
      grid.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-product-key]");
        if (!btn) return;
        selectProduct(btn.getAttribute("data-product-key"));
      });
    }

    bindMainSwipe();

    document.addEventListener("keydown", function (e) {
      if (!modal.classList.contains("open")) return;
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigateVariant(-1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        navigateVariant(1);
      }
    });
  }

  global.CommunityFeedProductModal = {
    bind: bind,
    open: open,
    close: close,
  };
})(window);
