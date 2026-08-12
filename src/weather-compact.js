(function () {
  const style = document.createElement('style');
  style.textContent = `
    .clock-card .weather-line.homebase-weather-compact {
      display:grid!important;
      grid-template-columns:auto minmax(0,1fr)!important;
      column-gap:10px!important;
      align-items:start!important;
    }
    .clock-card .weather-line.homebase-weather-compact > div {
      display:flex!important;
      flex-direction:column!important;
      gap:3px!important;
      min-width:0!important;
    }
    .clock-card .weather-line.homebase-weather-compact .weather-temp-row {
      display:flex!important;
      align-items:baseline!important;
      gap:6px!important;
      white-space:nowrap!important;
    }
    .clock-card .weather-line.homebase-weather-compact .weather-temp-row strong,
    .clock-card .weather-line.homebase-weather-compact .weather-feels {
      font-size:1em!important;
      line-height:1.2!important;
    }
    .clock-card .weather-line.homebase-weather-compact .weather-divider-pipe { opacity:.5; }
    .clock-card .weather-line.homebase-weather-compact .weather-condition-label,
    .clock-card .weather-line.homebase-weather-compact .weather-rain-chance {
      font-size:.88em!important;
      line-height:1.25!important;
    }
    .clock-card .weather-line.homebase-weather-compact .weather-rain-chance {
      color:var(--muted,#c9aaa0)!important;
    }
    .clock-card .weather-meta.homebase-weather-meta-hidden { display:none!important; }
  `;
  document.head.appendChild(style);

  let applying = false;

  function readOriginalWeather(line, meta) {
    const content = line.querySelector(':scope > div');
    if (!content) return null;

    /* If our compact markup is still intact, do not parse our own output again. */
    if (content.querySelector('.weather-temp-row')) return null;

    const current = content.querySelector('strong')?.textContent?.trim() || '—';
    const condition = [...content.children]
      .find((el) => el.tagName === 'SPAN')?.textContent?.trim() || 'Weather unavailable';
    const metaText = meta?.textContent || '';
    const feels = metaText.match(/Feels like\s*([^·]+)/i)?.[1]?.trim() || '—';
    const rain = metaText.match(/Rain\s*([^·]+)/i)?.[1]?.trim() || '—';

    return { content, current, condition, feels, rain };
  }

  function applyWeatherLayout() {
    if (applying) return;

    const card = document.querySelector('.clock-card');
    if (!card) return;
    const line = card.querySelector('.weather-line');
    const meta = card.querySelector('.weather-meta');
    if (!line) return;

    const data = readOriginalWeather(line, meta);
    if (!data) return;

    applying = true;
    const { content, current, condition, feels, rain } = data;

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
    if (meta) meta.classList.add('homebase-weather-meta-hidden');

    requestAnimationFrame(() => { applying = false; });
  }

  let queued = false;
  function queue() {
    if (queued || applying) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      applyWeatherLayout();
    });
  }

  const observer = new MutationObserver(queue);
  observer.observe(document.documentElement, {
    subtree:true,
    childList:true,
    characterData:true
  });

  window.addEventListener('DOMContentLoaded', queue);
  window.addEventListener('load', queue);
  setInterval(queue, 30000);
  queue();
})();
