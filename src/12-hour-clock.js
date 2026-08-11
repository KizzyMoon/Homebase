(() => {
  let writing = false;

  function formatNow() {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(new Date());
  }

  function updateClock() {
    if (writing) return;
    const clock = document.querySelector('.big-time');
    if (!clock) return;
    const next = formatNow();
    if (clock.textContent === next) return;
    writing = true;
    clock.textContent = next;
    writing = false;
  }

  const observer = new MutationObserver(() => {
    if (!writing) requestAnimationFrame(updateClock);
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });

  updateClock();
  setInterval(updateClock, 100);
})();
