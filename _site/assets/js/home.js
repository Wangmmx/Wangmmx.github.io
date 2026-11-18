(() => {
  "use strict";
  const root = document.getElementById("wangmmx-home");
  if (!root) return;
  const picker = root.querySelector("#theme-picker");
  const themes = ["cream", "midnight", "white", "black"];
  const storageKey = "wangmmx-home-theme";
  function applyTheme(theme) {
    if (!themes.includes(theme)) theme = "cream";
    document.documentElement.dataset.theme = theme;
    picker.value = theme;
  }

  applyTheme(document.documentElement.dataset.theme);
  picker.addEventListener("change", () => {
    applyTheme(picker.value);
    try { localStorage.setItem(storageKey, picker.value); } catch (_) {
      // Switching themes still works when browser storage is unavailable.
    }
  });
  window.addEventListener("storage", (event) => {
    if (event.key === storageKey) applyTheme(event.newValue);
  });

  const triggers = Array.from(root.querySelectorAll("[data-section]"));
  const panels = Array.from(root.querySelectorAll(".expanded"));
  function closePanels() {
    panels.forEach((panel) => { panel.hidden = true; });
    triggers.forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
  }
  triggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const panel = document.getElementById(trigger.getAttribute("aria-controls"));
      const wasOpen = !panel.hidden;
      closePanels();
      if (!wasOpen) {
        panel.hidden = false;
        trigger.setAttribute("aria-expanded", "true");
      }
    });
  });
  panels.forEach((panel) => {
    function close() {
      const trigger = triggers.find((item) => item.getAttribute("aria-controls") === panel.id);
      closePanels();
      if (trigger) trigger.focus();
    }
    panel.querySelector(".close").addEventListener("click", close);
    panel.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
  });
})();
