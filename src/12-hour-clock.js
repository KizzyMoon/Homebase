(() => {
  function updateClock() {
    const clock = document.querySelector('.big-time');
    if (!clock) return;
    const now = new Date();
    clock.textContent = now.toLocaleTimeString('en-GB', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  updateClock();
  setInterval(updateClock, 1000);
})();
