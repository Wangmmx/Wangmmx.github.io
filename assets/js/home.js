(() => {
  "use strict";
  const root = document.getElementById("wangmmx-home");
  if (!root) return;
  const choices = Array.from(root.querySelectorAll("[data-theme-choice]"));
  const storageKey = "wangmmx-home-theme";
  const normalizeTheme = theme => ["black", "midnight"].includes(theme) ? "black" : "white";
  function applyTheme(theme) {
    const current = normalizeTheme(theme);
    document.documentElement.dataset.theme = current;
    choices.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.themeChoice === current)));
  }
  applyTheme(document.documentElement.dataset.theme);
  choices.forEach(button => button.addEventListener("click", () => {
    applyTheme(button.dataset.themeChoice);
    try { localStorage.setItem(storageKey, document.documentElement.dataset.theme); } catch (_) {}
  }));
  window.addEventListener("storage", event => { if (event.key === storageKey) applyTheme(event.newValue); });

  const documentsMenu = root.querySelector(".documents-menu");
  if (documentsMenu) {
    document.addEventListener("click", event => {
      if (!documentsMenu.contains(event.target)) documentsMenu.open = false;
    });
    documentsMenu.addEventListener("keydown", event => {
      if (event.key === "Escape" && documentsMenu.open) {
        event.preventDefault();event.stopPropagation();documentsMenu.open = false;
        documentsMenu.querySelector("summary").focus();
      }
    });
  }

  const intro = root.querySelector(".home-top main .intro");
  const detail = document.getElementById("neighborhood-detail");
  const triggers = Array.from(root.querySelectorAll("[data-section]"));
  const panels = Array.from(root.querySelectorAll(".expanded"));
  function closePanels() {
    panels.forEach(panel => { panel.hidden = true; });
    triggers.forEach(trigger => trigger.setAttribute("aria-expanded", "false"));
  }
  function resetSidebar() {
    closePanels();
    if (detail) detail.hidden = true;
    if (intro) intro.hidden = false;
    root.querySelectorAll("[data-place]").forEach(sign => sign.setAttribute("aria-expanded", "false"));
    window.dispatchEvent(new Event("home:panel-open"));
  }
  triggers.forEach(trigger => trigger.addEventListener("click", () => {
    const panel = document.getElementById(trigger.getAttribute("aria-controls"));
    const wasOpen = !panel.hidden;
    resetSidebar();
    if (!wasOpen) {
      panel.hidden = false;
      if (intro) intro.hidden = true;
      trigger.setAttribute("aria-expanded", "true");
    }
  }));
  window.addEventListener("home:shop-open", () => {
    closePanels();
    if (intro) intro.hidden = true;
  });
  panels.forEach(panel => {
    function close() {
      resetSidebar();
      const trigger = triggers.find(item => item.getAttribute("aria-controls") === panel.id);
      if (trigger) trigger.focus();
    }
    panel.querySelector(".close").addEventListener("click", close);
    panel.addEventListener("keydown", event => { if (event.key === "Escape") close(); });
  });
  const dialog = document.getElementById("gallery-lightbox");
  const gallery = Array.from(root.querySelectorAll("[data-gallery]"));
  if (dialog && gallery.length && typeof dialog.showModal === "function") {
    const largeImage = dialog.querySelector(".gallery-large-image");
    const title = dialog.querySelector("#gallery-lightbox-title");
    const counter = dialog.querySelector(".gallery-counter");
    const caption = dialog.querySelector(".gallery-caption");
    let index = 0, returnFocus = null;
    function showImage(next) {
      index = (next + gallery.length) % gallery.length;
      const link = gallery[index], image = link.querySelector("img");
      largeImage.src = link.href;
      largeImage.alt = image.alt;
      title.textContent = link.dataset.galleryTitle || image.alt;
      counter.textContent = `${index + 1} / ${gallery.length}`;
      caption.textContent = link.dataset.galleryDescription || "";
    }
    gallery.forEach((link, i) => link.addEventListener("click", event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      returnFocus = link;
      showImage(i);
      document.documentElement.classList.add("gallery-modal-open");
      dialog.showModal();
    }));
    dialog.querySelectorAll("[data-gallery-step]").forEach(button => {
      button.disabled = gallery.length < 2;
      button.addEventListener("click", () => showImage(index + Number(button.dataset.galleryStep)));
    });
    dialog.querySelector(".gallery-close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("keydown", event => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();event.stopPropagation();
        showImage(index + (event.key === "ArrowLeft" ? -1 : 1));
      }
    });
    dialog.addEventListener("click", event => {
      const box = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
    });
    dialog.addEventListener("close", () => {
      document.documentElement.classList.remove("gallery-modal-open");
      if (returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
    });
  }
})();
