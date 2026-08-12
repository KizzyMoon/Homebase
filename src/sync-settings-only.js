(function () {
  const style = document.createElement("style");
  style.textContent = `
    .homebase-account { display: none !important; }

    #homebase-sync-slot {
      width: 100%;
      margin: 0 0 18px;
    }

    #homebase-sync-slot .homebase-account.homebase-settings-sync-visible {
      display: flex !important;
      position: static !important;
      inset: auto !important;
      width: 100% !important;
      max-width: none !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      z-index: auto !important;
    }

    @media (max-width: 700px) {
      #homebase-sync-slot { margin-bottom: 14px; }
      #homebase-sync-slot .homebase-account.homebase-settings-sync-visible {
        gap: 10px !important;
        padding: 12px !important;
      }
      #homebase-sync-slot .homebase-account-copy {
        flex: 1 1 auto;
        min-width: 0;
      }
      #homebase-sync-slot .homebase-account button { flex: 0 0 auto; }
    }
  `;
  document.head.appendChild(style);

  function settingsIsOpen() {
    const active = document.querySelector(".nav-item.active");
    return String(active?.textContent || "").trim().toLowerCase() === "settings";
  }

  function getSettingsPage() {
    if (!settingsIsOpen()) return null;
    return document.querySelector(".page-shell .subpage");
  }

  function ensureSlot() {
    const page = getSettingsPage();
    if (!page) return null;
    let slot = page.querySelector("#homebase-sync-slot");
    if (slot) return slot;
    slot = document.createElement("div");
    slot.id = "homebase-sync-slot";
    const firstPanel = page.querySelector(".manage-panel");
    if (firstPanel) page.insertBefore(slot, firstPanel);
    else page.appendChild(slot);
    return slot;
  }

  function updateVisibility() {
    const control = document.querySelector("[data-homebase-account]");
    if (!control) return;
    const open = settingsIsOpen();
    if (open) {
      const slot = ensureSlot();
      if (slot && control.parentElement !== slot) slot.appendChild(control);
    }
    control.classList.toggle("homebase-settings-sync-visible", open);
  }

  const observer = new MutationObserver(() => requestAnimationFrame(updateVisibility));
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class"]
  });

  document.addEventListener("click", () => requestAnimationFrame(updateVisibility), true);
  window.addEventListener("load", updateVisibility);
  requestAnimationFrame(updateVisibility);
})();
