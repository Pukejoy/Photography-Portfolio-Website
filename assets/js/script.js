(() => {
  "use strict";

  // Must match your CSS breakpoint
  const MQ = matchMedia("(max-width: 1300px)");
  const scriptSrc = document.currentScript?.src
    || document.querySelector('script[src*="assets/js/script.js"]')?.src;
  const scriptUrl = new URL(scriptSrc ?? window.location.href);
  const siteRootUrl = new URL("../..", scriptUrl);
  const HEADER_URL = new URL("components/header.html", siteRootUrl);
  const FOOTER_URL = new URL("components/footer.html", siteRootUrl);

  let wantedOpen = false;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Normalize paths like "/" -> "/index.html"
  const normalizePath = (p) => (p.endsWith("/") ? p + "index.html" : p);

  function setActiveLinks(root) {
    const current = normalizePath(location.pathname);

    // For sections: only top-most page should be active
    let target = current;
    if (current.startsWith("/galleries/")) target = "/galleries/galleries.html";
    if (current.startsWith("/services/")) target = "/services/services.html";

    // Clear old
    $$(".active", root).forEach(el => el.classList.remove("active"));

    // Only mark TOP links as active:
    // - desktop: .nav-link
    // - mobile:  .nav-mobile a
    const candidates = $$(".nav-link, .nav-mobile a", root);

    candidates.forEach(a => {
      const aPath = normalizePath(new URL(a.getAttribute("href"), location.origin).pathname);
      if (aPath === target) a.classList.add("active");
    });
  }

  function initMobileMenu(root) {
    const btn = $(".hamburger", root);
    const menu = $("#mobileMenu", root);
    const header = $(".site-header", root);
    if (!btn || !menu || !header) return;

    const isOpen = () => menu.classList.contains("open");
    const setPadTop = () => (menu.style.paddingTop = (header.offsetHeight + 16) + "px");

    function render(open, remember = false) {
      if (remember) wantedOpen = open;

      document.body.classList.toggle("no-scroll", open);
      btn.classList.toggle("is-active", open);

      if (open) {
        setPadTop();
        requestAnimationFrame(() => menu.classList.add("open"));
      } else {
        menu.classList.remove("open");
      }
    }

    // Click toggle
    btn.addEventListener("click", () => render(!isOpen(), true));

    // Close on link click
    $$("a", menu).forEach(a => a.addEventListener("click", () => render(false, true)));

    // Close on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") render(false, true);
    });

    // Keep state sane on breakpoint changes
    const sync = () => {
      if (!MQ.matches) render(false);       // Desktop: never stuck
      else render(wantedOpen);             // Mobile: restore intent
    };

    MQ.addEventListener("change", sync);

    // If menu is open and header height changes (rotation/resize), keep menu content below header
    window.addEventListener("resize", () => {
      if (isOpen()) setPadTop();
    });

    sync();
  }

  async function loadHeader() {
    const slot = $("#header-slot");
    if (!slot) return;

    try {
      const res = await fetch(HEADER_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error(`Header fetch failed: ${res.status}`);

      slot.innerHTML = await res.text();

      setActiveLinks(slot);
      initMobileMenu(slot);
    } catch (err) {
      console.error(err);
      // Fail gracefully (site still usable)
      slot.innerHTML = "";
    }
  }

  async function loadFooter() {
    const slot = $("#footer-slot");
    if (!slot) return;

    try {
      const res = await fetch(FOOTER_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error(`Footer fetch failed: ${res.status}`);

      slot.innerHTML = await res.text();

      // Footer year (safe on all pages that include the footer slot)
      const y = $("#year", slot);
      if (y) y.textContent = new Date().getFullYear();
    } catch (err) {
      console.error(err);
      // Fail gracefully
      slot.innerHTML = "";
    }
  }

  // ====== Smooth scroll (Home: "Скролни") ======
  function initHomeSmoothScroll() {
    const page = document.querySelector(".page-home");
    if (!page) return;

    const link = document.querySelector(".home-scroll[href^='#']");
    if (!link) return;

    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href") || "";
      if (!href.startsWith("#")) return;

      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });

      // Update the URL hash without causing an instant jump
      if (history && history.pushState) {
        history.pushState(null, "", href);
      } else {
        location.hash = href;
      }
    });
  }

  // ====== FAQ search (kept categories, but hides non-relevant groups + moves matching group(s) to top) ======
  function initFaqSearch() {
    const page = document.querySelector(".page-faq");
    if (!page) return;

    const input = page.querySelector(".faq-search input");
    const groups = Array.from(page.querySelectorAll(".faq-group"));
    const empty = page.querySelector(".faq-empty");

    if (!input || groups.length === 0) return;

    // Cache original order
    groups.forEach((g, i) => { g.dataset._order = String(i); });

    const normalize = (s) =>
      (s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .trim();

    function apply(qRaw) {
      const q = normalize(qRaw);
      const container = groups[0]?.parentElement;
      if (!container) return;

      // Reset if empty query
      if (!q) {
        groups
          .sort((a, b) => (parseInt(a.dataset._order, 10) - parseInt(b.dataset._order, 10)))
          .forEach(g => {
            g.hidden = false;

            // show all items
            const items = Array.from(g.querySelectorAll(".faq-item"));
            items.forEach(it => { it.hidden = false; });
          });

        if (empty) empty.hidden = true;
        return;
      }

      let anyVisible = false;

      // For each group: hide non-matching items; if none match, hide group
      const scored = groups.map((g) => {
        const items = Array.from(g.querySelectorAll(".faq-item"));
        let matches = 0;

        items.forEach((it) => {
          const text = normalize(it.textContent);
          const hit = text.includes(q);
          it.hidden = !hit;
          if (hit) matches++;
        });

        g.hidden = matches === 0;
        if (matches > 0) anyVisible = true;

        return { g, matches };
      });

      // Reorder: groups with matches first (descending by matches), then original order
      scored
        .sort((a, b) => {
          if (b.matches !== a.matches) return b.matches - a.matches;
          return parseInt(a.g.dataset._order, 10) - parseInt(b.g.dataset._order, 10);
        })
        .forEach(({ g }) => container.appendChild(g));

      if (empty) empty.hidden = anyVisible;
    }

    // initial
    apply(input.value);

    input.addEventListener("input", () => apply(input.value));
  }

  // ====== Recommendations filter (chips + card filtering) ======
  function initRecommendationsFilter() {
    const page = document.querySelector(".page-recs");
    if (!page) return;

    const toolbar = page.querySelector(".recs-toolbar");
    const buttons = toolbar ? Array.from(toolbar.querySelectorAll("[data-filter]")) : [];
    const cards = Array.from(page.querySelectorAll(".rec-card[data-cat]"));
    const empty = page.querySelector(".recs-empty");

    if (!toolbar || buttons.length === 0 || cards.length === 0) return;

    const setActive = (btn) => {
      buttons.forEach(b => b.classList.toggle("is-active", b === btn));
    };

    const apply = (filter) => {
      let visibleCount = 0;

      cards.forEach(card => {
        const cats = (card.dataset.cat || "").trim().split(/\s+/).filter(Boolean);
        const show = filter === "all" || cats.includes(filter);

        card.hidden = !show;
        if (show) visibleCount++;
      });

      if (empty) empty.hidden = visibleCount !== 0;
    };

    const defaultBtn = buttons.find(b => b.classList.contains("is-active")) || buttons[0];
    setActive(defaultBtn);
    apply(defaultBtn.dataset.filter);

    toolbar.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-filter]");
      if (!btn) return;

      setActive(btn);
      apply(btn.dataset.filter);
    });
  }

  // ====== Galleries (JSON-driven grid + lightbox) ======
  function initGalleries() {
    const grid = document.querySelector(".js-gallery-grid");
    const dataEl = document.getElementById("gallery-data");
    if (!grid || !dataEl) return;

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

    // Lightbox
    const lb = ensureGalleryLightbox();
    const links = Array.from(grid.querySelectorAll(".gallery-item"));

    function openAt(index) {
      if (!links.length) return;
      const i = (index + links.length) % links.length;
      const el = links[i];
      const full = el.dataset.full;
      const alt = el.dataset.alt || "";
      const pageTitle = el.dataset.title || "Галерия";

      lb.state.index = i;
      lb.title.textContent = pageTitle;

      lb.img.alt = alt;
      lb.caption.textContent = alt;

      // Toggle portrait styling after image loads
      lb.img.onload = () => {
        const isPortrait = lb.img.naturalHeight > lb.img.naturalWidth;
        if (lb.card) lb.card.classList.toggle("is-portrait", isPortrait);
      };

      lb.img.src = full;

      // Preload neighbors
      preloadNeighbor(i - 1);
      preloadNeighbor(i + 1);

      showLightbox(lb);
    }

    function preloadNeighbor(index) {
      if (!links.length) return;
      const i = (index + links.length) % links.length;
      const src = links[i].dataset.full;
      if (!src) return;
      const im = new Image();
      im.decoding = "async";
      im.src = src;
    }

    links.forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const idx = parseInt(a.dataset.index || "0", 10);
        openAt(Number.isFinite(idx) ? idx : 0);
      });
    });

    lb.prev.addEventListener("click", () => openAt(lb.state.index - 1));
    lb.next.addEventListener("click", () => openAt(lb.state.index + 1));
    lb.close.addEventListener("click", () => hideLightbox(lb));

    // Click outside card to close
    lb.root.addEventListener("click", (e) => {
      if (e.target === lb.root) hideLightbox(lb);
    });

    document.addEventListener("keydown", (e) => {
      if (lb.root.hidden) return;

      if (e.key === "Escape") hideLightbox(lb);
      if (e.key === "ArrowLeft") openAt(lb.state.index - 1);
      if (e.key === "ArrowRight") openAt(lb.state.index + 1);
    });
  }

  function ensureGalleryLightbox() {
    let root = document.querySelector(".gallery-modal");
    if (root) {
      return {
        root,
        card: root.querySelector(".gallery-modal-card"),
        title: root.querySelector(".gallery-modal-title"),
        img: root.querySelector("img"),
        caption: root.querySelector("[data-caption]"),
        prev: root.querySelector("[data-prev]"),
        next: root.querySelector("[data-next]"),
        close: root.querySelector("[data-close]"),
        state: root._state || (root._state = { index: 0 }),
      };
    }

    root = document.createElement("div");
    root.className = "gallery-modal";
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Преглед на снимка");
    root.tabIndex = -1;

    root.innerHTML = `
      <div class="gallery-modal-card" role="document">
        <div class="gallery-modal-top">
          <div class="gallery-modal-title">Галерия</div>
          <div class="gallery-modal-btns">
            <button class="gallery-icon-btn" type="button" data-prev aria-label="Предишна">←</button>
            <button class="gallery-icon-btn" type="button" data-next aria-label="Следваща">→</button>
            <button class="gallery-icon-btn" type="button" data-close aria-label="Затвори">✕</button>
          </div>
        </div>

        <div class="gallery-modal-media">
          <img src="" alt="" />
        </div>

        <div class="gallery-modal-bottom">
          <div data-caption style="font-size:1rem;color:rgba(0,0,0,0.65);line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></div>
          <div class="gallery-modal-nav">
            <button class="gallery-icon-btn" type="button" data-prev aria-label="Предишна">←</button>
            <button class="gallery-icon-btn" type="button" data-next aria-label="Следваща">→</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    const api = {
      root,
      card: root.querySelector(".gallery-modal-card"),
      title: root.querySelector(".gallery-modal-title"),
      img: root.querySelector("img"),
      caption: root.querySelector("[data-caption]"),
      close: root.querySelector("[data-close]"),
      state: (root._state = { index: 0 }),
    };

    // Wire duplicated prev/next (top + bottom)
    const prevBtns = root.querySelectorAll("[data-prev]");
    const nextBtns = root.querySelectorAll("[data-next]");

    api.prev = prevBtns[0];
    api.next = nextBtns[0];

    if (prevBtns[1]) prevBtns[1].addEventListener("click", () => api.prev.click());
    if (nextBtns[1]) nextBtns[1].addEventListener("click", () => api.next.click());

    return api;
  }

  function showLightbox(lb) {
    lb.root.hidden = false;

    // Don’t break your mobile menu lock
    document.body.classList.add("no-scroll");

    // Focus for accessibility
    lb.close && lb.close.focus();
  }

  function hideLightbox(lb) {
    lb.root.hidden = true;

    // Only unlock scroll if mobile menu isn't open
    const mobileMenuOpen = document.querySelector("#mobileMenu.open");
    if (!mobileMenuOpen) document.body.classList.remove("no-scroll");
  }

  // Boot
  loadHeader();
  loadFooter();
  initHomeSmoothScroll();
  initFaqSearch();
  initRecommendationsFilter();
  initGalleries();
})();
