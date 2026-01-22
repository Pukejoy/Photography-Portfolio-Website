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
      // Convert href to pathname so "/x/y.html" comparisons always work
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

  /* =========================
     FAQ page logic (safe-run)
     ========================= */
function initFaq() {
  const search = $("#faq-search-input");
  const empty = $("#faq-empty");

  const groups = $$(".faq-group");        // category sections
  const items = $$(".faq-item");          // each <details>

  // Not the FAQ page (or markup not present) => do nothing
  if (!search || !empty || groups.length === 0 || items.length === 0) return;

  // Accordion: keep only one open at a time (nice UX)
  items.forEach((d) => {
    d.addEventListener("toggle", () => {
      if (!d.open) return;
      items.forEach((other) => {
        if (other !== d) other.open = false;
      });
    });
  });

  const normalize = (s) => (s || "").toLowerCase().trim();

  function filter() {
    const q = normalize(search.value);
    let totalShown = 0;

    // No query => show everything
    if (!q) {
      groups.forEach((g) => (g.style.display = ""));
      items.forEach((d) => (d.style.display = ""));
      empty.hidden = true;
      return;
    }

    // Query present => filter items, then hide empty groups
    groups.forEach((group) => {
      const groupItems = $$(".faq-item", group);
      let groupShown = 0;

      groupItems.forEach((d) => {
        const text = normalize(d.innerText);
        const match = text.includes(q);

        d.style.display = match ? "" : "none";
        if (!match) d.open = false; // avoid open hidden items

        if (match) groupShown++;
      });

      // If the category has 0 matching questions, hide it
      group.style.display = groupShown > 0 ? "" : "none";

      totalShown += groupShown;
    });

    empty.hidden = totalShown !== 0;
  }

  // Live filtering
  search.addEventListener("input", filter);

  // Optional: run once in case the browser autofills the input
  filter();
}

  loadHeader();
  loadFooter();

  // Run page-specific logic after DOM is ready
  document.addEventListener("DOMContentLoaded", () => {
    initFaq();
  });
})();
