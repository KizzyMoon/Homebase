(function () {
  const style = document.createElement('style');
  style.textContent = `
    .clock-card .weather-line.homebase-weather-compact {
      display: grid !important;
      grid-template-columns: auto 1fr !important;
      column-gap: 10px !important;
      align-items: start !important;
    }
    .clock-card .weather-line.homebase-weather-compact > div {
      display: flex !important;
      flex-direction: column !important;
      gap: 3px !important;
      min-width: 0 !important;
    }
    .clock-card .weather-line.homebase-weather-compact .weather-temp-row {
      display: flex !important;
      align-items: baseline !important;
      gap: 7px !important;
      white-space: nowrap !important;
    }
    .clock-card .weather-line.homebase-weather-compact .weather-temp-row strong {
      font-size: inherit !important;
    }
    .clock-card .weather-line.homebase-weather-compact .weather-divider-pipe {
      opacity: .45;
    }
    .clock-card .weather-line.homebase-weather-compact .weather-feels,
    .clock-card .weather-line.homebase-weather-compact .weather-rain-chance {
      color: var(--muted, #c9aaa0);
      font-size: .82em;
    }
    .clock-card .weather-line.homebase-weather-compact .weather-condition-label {
      font-size: .92em;
    }
    .clock-card .weather-meta.homebase-weather-meta-hidden {
      display: none !important;
    }
  `;
  document.head.appendChild(style);

  function cleanRain(value) {
    const text = String(value || '').trim();
    if (!text) return '—';
    return text.replace(/^Rain\s*/i, '').replace(/^Chance of rain\s*/i, '').trim() || '—';
  }

  function applyWeatherLayout() {
    const card = document.querySelector('.clock-card');
    if (!card) return;
    const line = card.querySelector('.weather-line');
    const meta = card.querySelector('.weather-meta');
    if (!line || !meta) return;

    const current = line.querySelector('strong')?.textContent?.trim() || '—';
    const condition = line.querySelector('span:not(.weather-emoji)')?.textContent?.trim() || 'Weather unavailable';
    const metaText = meta.textContent || '';
    const feels = metaText.match(/Feels like\s*([^·]+)/i)?.[1]?.trim() || '—';
    const rain = cleanRain(metaText.match(/Rain\s*([^·]+)/i)?.[1]);

    const content = line.querySelector('div');
    if (!content) return;

    content.innerHTML = `
      <div class="weather-temp-row">
        <strong>${current}</strong>
        <span class="weather-divider-pipe">|</span>
        <span class="weather-feels">Feels like ${feels}</span>
      </div>
      <span class="weather-condition-label">${condition}</span>
      <span class="weather-rain-chance">Chance of rain ${rain}</span>
    `;

    line.classList.add('homebase-weather-compact');
    meta.classList.add('homebase-weather-meta-hidden');
  }

  let queued = false;
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      applyWeatherLayout();
    });
  };

  const observer = new MutationObserver(queue);
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  window.addEventListener('DOMContentLoaded', queue);
  setInterval(queue, 30000);
  queue();
})();
