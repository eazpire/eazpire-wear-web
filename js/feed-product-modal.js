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
    selectedViewIndex: 0,
    selectedViewKey: null,
    refCode: null,
  };

  var swipeState = { startX: 0, startY: 0, tracking: false };

  /** English source — future i18n via wear translation layer. */
  var CAROUSEL_LABELS = [
    "Like this design? Discover more products with it.",
    "Love the look? See it on more products.",
    "Same vibe, different products — explore more.",
    "Like the design? Find it on other products.",
  ];

  function pickCarouselLabel() {
    return CAROUSEL_LABELS[Math.floor(Math.random() * CAROUSEL_LABELS.length)];
  }

  function applyCarouselLabel() {
    var el = qs("feedProductModalGridLabel");
    if (el) el.textContent = pickCarouselLabel();
  }

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
        view_images: [{ key: "front", label: "Front", image_url: img }],
      },
    ];
  }

  function colorNamesMatch(a, b) {
    return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
  }

  function draftMockupEntryForColor(colors, colorName) {
    if (!colors || !colorName) return null;
    if (colors[colorName] && colors[colorName].image_url) return colors[colorName];
    var keys = Object.keys(colors || {});
    for (var i = 0; i < keys.length; i++) {
      if (colorNamesMatch(keys[i], colorName) && colors[keys[i]].image_url) return colors[keys[i]];
    }
    return null;
  }

  function buildViewsFromDraftMockupsClient(draftMockups, colorName) {
    var byView = draftMockups || {};
    var viewOrder = { front: 10, back: 20, "back-2": 20, right: 35, left: 36, lifestyle: 40 };
    var viewKeys = Object.keys(byView).sort(function (a, b) {
      var sa = viewOrder[String(a).toLowerCase()] || 50;
      var sb = viewOrder[String(b).toLowerCase()] || 50;
      return sa - sb;
    });
    var views = [];
    for (var i = 0; i < viewKeys.length; i++) {
      var viewKey = viewKeys[i];
      var entry = draftMockupEntryForColor(byView[viewKey], colorName);
      if (!entry || !entry.image_url) continue;
      var label = viewKey.charAt(0).toUpperCase() + viewKey.slice(1).replace(/-/g, " ");
      if (String(viewKey).toLowerCase() === "back-2") label = "Back";
      views.push({
        key: String(viewKey).trim().toLowerCase(),
        label: label,
        image_url: entry.image_url,
      });
      if (views.length >= 4) break;
    }
    return views;
  }

  function getVariantViews(variant, item) {
    if (variant && Array.isArray(variant.view_images) && variant.view_images.length) {
      return variant.view_images.slice(0, 4);
    }
    if (item && item.draft_mockups && variant && (variant.color || variant.label)) {
      var fromDraft = buildViewsFromDraftMockupsClient(item.draft_mockups, variant.color || variant.label);
      if (fromDraft.length) return fromDraft;
    }
    var fallback = artifactFallbackImage();
    var img = variantImage(item, variant, fallback);
    if (img) return [{ key: "front", label: "Front", image_url: img }];
    return [];
  }

  function resolveViewIndex(views, preferredKey) {
    if (!views || !views.length) return 0;
    if (preferredKey) {
      for (var i = 0; i < views.length; i++) {
        if (views[i].key === preferredKey) return i;
      }
    }
    return 0;
  }

  function applyViewIndexForVariant(preferredViewKey) {
    var views = getVariantViews(findSelectedVariant(), findSelectedProduct());
    var key = preferredViewKey != null ? preferredViewKey : modalState.selectedViewKey;
    modalState.selectedViewIndex = resolveViewIndex(views, key);
    var active = views[modalState.selectedViewIndex];
    modalState.selectedViewKey = active ? active.key : null;
  }

  function getActiveViewImage(variant, item) {
    var views = getVariantViews(variant, item);
    var idx = modalState.selectedViewIndex;
    if (views[idx] && views[idx].image_url) return views[idx].image_url;
    if (views[0] && views[0].image_url) return views[0].image_url;
    return variantImage(item, variant, artifactFallbackImage());
  }

  function renderViewThumbsHtml(views, selectedIndex, thumbClass) {
    if (!views || views.length <= 1) return "";
    return views
      .slice(0, 4)
      .map(function (v, i) {
        var active = i === selectedIndex ? " is-active" : "";
        return (
          '<button type="button" class="' +
          thumbClass +
          active +
          '" data-view-index="' +
          i +
          '" aria-label="' +
          escapeHtml(v.label || "View") +
          '"><img src="' +
          escapeHtml(v.image_url) +
          '" alt="" loading="lazy"></button>'
        );
      })
      .join("");
  }

  function selectView(index) {
    var views = getVariantViews(findSelectedVariant(), findSelectedProduct());
    if (index < 0 || index >= views.length) return;
    modalState.selectedViewIndex = index;
    modalState.selectedViewKey = views[index].key;
    renderMainPreview();
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

  function getCurrentPreviewMeta() {
    var item = findSelectedProduct();
    if (!item) return null;
    var variant = findSelectedVariant();
    var src = getActiveViewImage(variant, item);
    if (!src) return null;
    var title = productTitle(item);
    var variantLabel = variant && (variant.label || variant.color) ? String(variant.label || variant.color) : "";
    var views = getVariantViews(variant, item);
    var view = views[modalState.selectedViewIndex];
    var viewLabel = view && view.label ? String(view.label) : "";
    var caption = title + (variantLabel ? " · " + variantLabel : "");
    if (viewLabel) caption += " · " + viewLabel;
    return {
      src: src,
      alt: title + (variantLabel ? " — " + variantLabel : "") + (viewLabel ? " — " + viewLabel : ""),
      caption: caption,
      views: views,
      selectedViewIndex: modalState.selectedViewIndex,
    };
  }

  function isLightboxOpen() {
    var lb = qs("feedProductLightbox");
    return !!(lb && lb.classList.contains("open"));
  }

  function updateLightboxNav() {
    var prev = qs("feedProductLightboxPrev");
    var next = qs("feedProductLightboxNext");
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

  function syncLightboxContent() {
    if (!isLightboxOpen()) return;
    var meta = getCurrentPreviewMeta();
    var img = qs("feedProductLightboxImg");
    var caption = qs("feedProductLightboxCaption");
    var thumbs = qs("feedProductLightboxViewThumbs");
    if (!meta || !img) {
      closeLightbox();
      return;
    }
    img.src = meta.src;
    img.alt = meta.alt;
    if (caption) caption.textContent = meta.caption;
    if (thumbs) {
      var multi = meta.views && meta.views.length > 1;
      thumbs.hidden = !multi;
      thumbs.innerHTML = multi
        ? renderViewThumbsHtml(meta.views, meta.selectedViewIndex, "feed-product-lightbox__view-thumb")
        : "";
    }
    updateLightboxNav();
  }

  function openLightbox() {
    var meta = getCurrentPreviewMeta();
    if (!meta) return;
    var lb = qs("feedProductLightbox");
    if (!lb) return;
    lb.classList.add("open");
    lb.setAttribute("aria-hidden", "false");
    syncLightboxContent();
  }

  function closeLightbox() {
    var lb = qs("feedProductLightbox");
    if (!lb) return;
    lb.classList.remove("open");
    lb.setAttribute("aria-hidden", "true");
  }

  function renderMainPreview() {
    var mainEl = qs("feedProductModalMain");
    var titleEl = qs("feedProductModalTitle");
    if (!mainEl) return;

    var item = findSelectedProduct();
    if (!item) return;

    var variant = findSelectedVariant();
    var src = getActiveViewImage(variant, item);
    var title = productTitle(item);
    var variantLabel = variant && (variant.label || variant.color) ? String(variant.label || variant.color) : "";
    var views = getVariantViews(variant, item);
    var thumbsHtml = renderViewThumbsHtml(
      views,
      modalState.selectedViewIndex,
      "feed-product-modal__view-thumb"
    );
    var multiViews = views.length > 1;

    if (src) {
      mainEl.innerHTML =
        '<div class="feed-product-modal__preview-layout' +
        (multiViews ? "" : " feed-product-modal__preview-layout--single") +
        '">' +
        (multiViews
          ? '<div class="feed-product-modal__view-thumbs" id="feedProductModalViewThumbs">' + thumbsHtml + "</div>"
          : "") +
        '<button type="button" class="feed-product-modal__zoom" data-feed-product-zoom aria-label="View larger preview">' +
        '<img src="' +
        escapeHtml(src) +
        '" alt="' +
        escapeHtml(title + (variantLabel ? " — " + variantLabel : "")) +
        '" loading="lazy">' +
        "</button></div>";
    } else {
      mainEl.innerHTML =
        '<div class="feed-product-modal-main-fallback"><span aria-hidden="true">👕</span><p>' +
        escapeHtml(title) +
        (variantLabel ? '<span class="feed-product-modal-muted">' + escapeHtml(variantLabel) + "</span>" : "") +
        "</p></div>";
    }
    if (titleEl) titleEl.textContent = title;
    updateNavButtons();
    syncLightboxContent();
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
      updateCreateButton();
      return;
    }
    shopBtn.href = buildShopViewUrl(handle, modalState.refCode, findSelectedVariant());
    shopBtn.hidden = false;
    updateCreateButton();
  }

  function updateCreateButton() {
    var createBtn = qs("feedProductModalCreateBtn");
    if (!createBtn) return;
    var show = modalState.products.length > 0 && !!findSelectedProduct();
    createBtn.hidden = !show;
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
    applyViewIndexForVariant(null);
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
    applyViewIndexForVariant(modalState.selectedViewKey);
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
    applyCarouselLabel();
    modalState.post = post;
    modalState.products = [];
    modalState.selectedKey = null;
    modalState.selectedIndex = 0;
    modalState.selectedVariantIndex = 0;
    modalState.selectedViewIndex = 0;
    modalState.selectedViewKey = null;
    modalState.refCode = null;

    var mainEl = qs("feedProductModalMain");
    var grid = qs("feedProductModalGrid");
    var shopBtn = qs("feedProductModalShopBtn");
    var createBtn = qs("feedProductModalCreateBtn");
    if (mainEl) {
      mainEl.innerHTML =
        '<div class="feed-product-modal-loading"><span class="feed-viewer-loading-dot"></span><span>Loading products…</span></div>';
    }
    if (grid) grid.innerHTML = "";
    if (shopBtn) shopBtn.hidden = true;
    if (createBtn) createBtn.hidden = true;
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
    closeLightbox();
    closeModalShell();
    modalState.post = null;
    modalState.products = [];
    modalState.selectedKey = null;
    modalState.selectedIndex = 0;
    modalState.selectedVariantIndex = 0;
    modalState.selectedViewIndex = 0;
    modalState.selectedViewKey = null;
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

  function bindLightbox() {
    var lb = qs("feedProductLightbox");
    if (!lb || lb.dataset.bound) return;
    lb.dataset.bound = "1";

    lb.querySelectorAll("[data-feed-lightbox-close]").forEach(function (el) {
      el.addEventListener("click", closeLightbox);
    });

    var prev = qs("feedProductLightboxPrev");
    var next = qs("feedProductLightboxNext");
    if (prev) prev.addEventListener("click", function () { navigateVariant(-1); });
    if (next) next.addEventListener("click", function () { navigateVariant(1); });

    var stage = lb.querySelector(".feed-product-lightbox__stage");
    if (stage) {
      stage.addEventListener(
        "touchstart",
        function (e) {
          if (!e.touches || !e.touches.length) return;
          swipeState.tracking = true;
          swipeState.startX = e.touches[0].clientX;
          swipeState.startY = e.touches[0].clientY;
        },
        { passive: true }
      );
      stage.addEventListener(
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
    bindLightbox();

    var mainEl = qs("feedProductModalMain");
    if (mainEl) {
      mainEl.addEventListener("click", function (e) {
        var viewThumb = e.target.closest("[data-view-index]");
        if (viewThumb) {
          e.stopPropagation();
          selectView(Number(viewThumb.getAttribute("data-view-index")));
          return;
        }
        if (e.target.closest("[data-feed-product-zoom]")) openLightbox();
      });
    }

    var lb = qs("feedProductLightbox");
    if (lb) {
      lb.addEventListener("click", function (e) {
        var viewThumb = e.target.closest("[data-view-index]");
        if (viewThumb) {
          e.stopPropagation();
          selectView(Number(viewThumb.getAttribute("data-view-index")));
        }
      });
    }

    document.addEventListener("keydown", function (e) {
      if (!modal.classList.contains("open") && !isLightboxOpen()) return;
      if (e.key === "Escape") {
        if (isLightboxOpen()) {
          closeLightbox();
          return;
        }
        close();
        return;
      }
      if (!modal.classList.contains("open")) return;
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
