(function () {
  const style = document.createElement("style");
  style.textContent = `
    .homebase-account {
      display: none !important;
    }

    .homebase-account.homebase-settings-sync-visible {
      display: flex !important;
      position: fixed !important;
      top: 18px !important;
      right: 18px !important;
      z-index: 1000 !important;
    }

    @media (max-width: 700px) {
      .homebase-account.homebase-settings-sync-visible {
        top: 10px !important;
        right: 10px !important;
      }
    }
  `;
  document.head.appendChild(style);

  function settingsIsOpen() {
    const active = document.querySelector(".nav-item.active");
    return String(active?.textContent || "").trim().toLowerCase() === "settings";
  }

  function updateVisibility() {
    const control = document.querySelector("[data-homebase-account]");
    if (!control) return;
    control.classList.toggle("homebase-settings-sync-visible", settingsIsOpen());
  }

  const observer = new MutationObserver(updateVisibility);
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
