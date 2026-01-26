(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function init() {
    const grid = document.querySelector(".js-gallery-grid");
    const dataEl = document.getElementById("gallery-data");
    if (!grid || !dataEl) return;

    // Prevent double-init if script is loaded twice for some reason
    if (grid.dataset._gInit === "1") return;
    grid.dataset._gInit = "1";

    let data;
    try {
      data = JSON.parse(dataEl.textContent || "{}");
    } catch (e) {
      console.error("Invalid gallery JSON:", e);
      return;
    }

    const items = Array.isArray(data.items) ? data.items : [];
    const title = (data.title || "Галерия").toString();

    // Update counts (if present)
    document.querySelectorAll(".js-gallery-count").forEach(el => {
      el.textContent = String(items.length);
    });

    // Render thumbnails
    grid.innerHTML = "";
    const frag = document.createDocumentFragment();

    items.forEach((it, idx) => {
      const full = it.full || it.src;
      const thumb = it.thumb || it.full || it.src;
      if (!full || !thumb) return;

      const a = document.createElement("a");
      a.className = "gallery-item";
      a.href = full; // fallback if JS fails
      a.dataset.full = full;
      a.dataset.index = String(idx);
      a.dataset.title = title;
      a.dataset.alt = (it.alt || "").toString();

      const img = document.createElement("img");
      img.src = thumb;
      img.alt = (it.alt || "").toString();
      img.loading = "lazy";
      img.decoding = "async";

      // Thumb fallback: if thumbs/ doesn't exist, use full image instead
      img.addEventListener("error", () => {
        if (img.dataset._fallback === "1") return;
        img.dataset._fallback = "1";
        img.src = full;
      });

      a.appendChild(img);
      frag.appendChild(a);
    });

    grid.appendChild(frag);

    const links = $$(".gallery-item", grid);
    if (!links.length) return;

    const lb = ensureLightbox();
    lb.state.total = links.length;

    function openAt(index) {
      const i = (index + links.length) % links.length;
      const el = links[i];

      lb.state.index = i;
      lb.title.textContent = el.dataset.title || "Галерия";

      const alt = el.dataset.alt || "";
      lb.img.alt = alt;
      lb.caption.textContent = alt;
      lb.counter.textContent = `${i + 1} / ${links.length}`;

      // Keep a reference to restore focus after close
      lb.state.lastFocus = document.activeElement;

      // Loading class (optional visual)
      lb.card.classList.add("is-loading");

      lb.img.onload = () => {
        lb.card.classList.remove("is-loading");

        const isPortrait = lb.img.naturalHeight > lb.img.naturalWidth;
        lb.card.classList.toggle("is-portrait", isPortrait);
      };

      lb.img.src = el.dataset.full || "";

      // Preload neighbors
      preloadNeighbor(i - 1);
      preloadNeighbor(i + 1);

      showLightbox(lb);
    }

    function preloadNeighbor(index) {
      const i = (index + links.length) % links.length;
      const src = links[i].dataset.full;
      if (!src) return;
      const im = new Image();
      im.decoding = "async";
      im.src = src;
    }

    // Click thumbnails
    links.forEach(a => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const idx = parseInt(a.dataset.index || "0", 10);
        openAt(Number.isFinite(idx) ? idx : 0);
      });
    });

    // Buttons
    lb.prev.addEventListener("click", () => openAt(lb.state.index - 1));
    lb.next.addEventListener("click", () => openAt(lb.state.index + 1));
    lb.close.addEventListener("click", () => hideLightbox(lb));

    // Click outside card to close
    lb.root.addEventListener("click", (e) => {
      if (e.target === lb.root) hideLightbox(lb);
    });

    // Keyboard controls (wired once)
    if (!lb.root.dataset._kbd) {
      lb.root.dataset._kbd = "1";

      document.addEventListener("keydown", (e) => {
        if (lb.root.hidden) return;

        if (e.key === "Escape") hideLightbox(lb);
        if (e.key === "ArrowLeft") openAt(lb.state.index - 1);
        if (e.key === "ArrowRight") openAt(lb.state.index + 1);
      });
    }

    // Swipe support (mobile/tablet)
    if (!lb.media.dataset._swipe) {
      lb.media.dataset._swipe = "1";

      let startX = 0;
      let startY = 0;
      let active = false;

      lb.media.addEventListener("touchstart", (e) => {
        if (!e.touches || e.touches.length !== 1) return;
        active = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      }, { passive: true });

      lb.media.addEventListener("touchend", (e) => {
        if (!active) return;
        active = false;

        const t = e.changedTouches && e.changedTouches[0];
        if (!t) return;

        const dx = t.clientX - startX;
        const dy = t.clientY - startY;

        // Require mostly horizontal swipe
        if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;

        if (dx > 0) openAt(lb.state.index - 1);
        else openAt(lb.state.index + 1);
      }, { passive: true });
    }
  }

  function ensureLightbox() {
    let root = document.querySelector(".gallery-modal");

    // If an old modal exists from previous version, replace its inner HTML
    if (!root) {
      root = document.createElement("div");
      root.className = "gallery-modal";
      root.hidden = true;
      root.setAttribute("role", "dialog");
      root.setAttribute("aria-modal", "true");
      root.setAttribute("aria-label", "Преглед на снимка");
      root.tabIndex = -1;
      document.body.appendChild(root);
    }

    // Build/replace inner markup (single set of arrows)
    root.innerHTML = `
      <div class="gallery-lb" role="document">
        <div class="gallery-lb-top">
          <div class="gallery-lb-meta">
            <div class="gallery-lb-title">Галерия</div>
            <div class="gallery-lb-counter" aria-live="polite">1 / 1</div>
          </div>
          <button class="gallery-lb-close" type="button" aria-label="Затвори">✕</button>
        </div>

        <div class="gallery-lb-media">
          <button class="gallery-lb-arrow gallery-lb-prev" type="button" aria-label="Предишна снимка">‹</button>
          <img class="gallery-lb-img" src="" alt="" />
          <button class="gallery-lb-arrow gallery-lb-next" type="button" aria-label="Следваща снимка">›</button>
        </div>

        <div class="gallery-lb-bottom">
          <div class="gallery-lb-caption" data-caption></div>
        </div>
      </div>
    `;

    return {
      root,
      card: $(".gallery-lb", root),
      title: $(".gallery-lb-title", root),
      counter: $(".gallery-lb-counter", root),
      media: $(".gallery-lb-media", root),
      img: $(".gallery-lb-img", root),
      caption: $("[data-caption]", root),
      prev: $(".gallery-lb-prev", root),
      next: $(".gallery-lb-next", root),
      close: $(".gallery-lb-close", root),
      state: root._state || (root._state = { index: 0, total: 0, lastFocus: null, closing: false }),
    };
  }

  function showLightbox(lb) {
    lb.state.closing = false;
    lb.root.hidden = false;

    // Lock page scroll (but don't break your mobile menu lock logic)
    document.body.classList.add("no-scroll");

    // Fade in
    requestAnimationFrame(() => {
      lb.root.classList.add("is-open");
      lb.close && lb.close.focus();
    });
  }

  function hideLightbox(lb) {
    if (lb.state.closing) return;
    lb.state.closing = true;

    // Fade out
    lb.root.classList.remove("is-open");

    // Unlock scroll only if mobile menu isn't open
    const mobileMenuOpen = document.querySelector("#mobileMenu.open");
    if (!mobileMenuOpen) document.body.classList.remove("no-scroll");

    // Hide after transition
    window.setTimeout(() => {
      lb.root.hidden = true;
      lb.state.closing = false;

      // Restore focus
      const last = lb.state.lastFocus;
      if (last && typeof last.focus === "function" && document.contains(last)) {
        last.focus();
      }
      lb.state.lastFocus = null;
    }, 170);
  }

  // Expose a single stable API
  window.HK_Galleries = window.HK_Galleries || {};
  window.HK_Galleries.init = init;
})();
