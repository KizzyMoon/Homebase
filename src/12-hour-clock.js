(() => {
  function formatNow() {
    return new Date().toLocaleTimeString('en-GB', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  function updateClock() {
    const clock = document.querySelector('.big-time');
    if (!clock) return;
    const next = formatNow();
    if (clock.textContent !== next) clock.textContent = next;
  }

  const observer = new MutationObserver(() => queueMicrotask(updateClock));
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  updateClock();
  setInterval(updateClock, 250);
})();
