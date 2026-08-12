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
    .clock-card .weather-line.homebase-weather-compact .weather-rain-chance { color:var(--muted,#c9aaa0)!important; }
    .clock-card .weather-meta.homebase-weather-meta-hidden { display:none!important; }
    .clock-card .weather-line.homebase-weather-compact small { display:none!important; }
  `;
  document.head.appendChild(style);

  function extractWeather() {
    const card = document.querySelector('.clock-card');
    if (!card) return null;
    const line = card.querySelector('.weather-line');
    const meta = card.querySelector('.weather-meta');
    if (!line) return null;

    const current = line.querySelector('strong')?.textContent?.trim() || '—';
    const conditionNode = [...line.querySelectorAll('span')].find((el) => !el.classList.contains('weather-emoji'));
    const condition = conditionNode?.textContent?.trim() || 'Weather unavailable';
    const metaText = meta?.textContent || '';
    const feelsMatch = metaText.match(/Feels like\s*([^·]+)/i);
    const rainMatch = metaText.match(/Rain\s*([^·]+)/i);
    const feels = feelsMatch?.[1]?.trim() || '—';
    const rain = rainMatch?.[1]?.trim() || '—';
    return { card, line, meta, current, condition, feels, rain };
  }

  function applyWeatherLayout() {
    const data = extractWeather();
    if (!data) return;
    const { line, meta, current, condition, feels, rain } = data;
    const content = line.querySelector('div');
    if (!content) return;

    const wanted = `${current}|${feels}|${condition}|${rain}`;
    if (content.dataset.weatherCompactState === wanted) return;

    content.innerHTML = `
      <div class="weather-temp-row">
        <strong>${current}</strong>
        <span class="weather-divider-pipe">|</span>
        <span class="weather-feels">Feels like ${feels}</span>
      </div>
      <span class="weather-condition-label">${condition}</span>
      <span class="weather-rain-chance">Chance of rain ${rain}</span>
    `;
    content.dataset.weatherCompactState = wanted;
    line.classList.add('homebase-weather-compact');
    if (meta) meta.classList.add('homebase-weather-meta-hidden');
  }

  const queue = () => requestAnimationFrame(applyWeatherLayout);
  const observer = new MutationObserver(queue);
  observer.observe(document.documentElement, { subtree:true, childList:true, characterData:true });
  window.addEventListener('DOMContentLoaded', queue);
  window.addEventListener('load', queue);
  setInterval(queue, 2000);
  queue();
})();
