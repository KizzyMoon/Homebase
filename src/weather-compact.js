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

  const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=51.4543&longitude=-0.9781&current=temperature_2m,apparent_temperature,weather_code&hourly=precipitation_probability&forecast_days=1&timezone=Europe%2FLondon';

  function codeToCondition(code) {
    const map = {
      0:'Clear', 1:'Mainly clear', 2:'Partly cloudy', 3:'Overcast',
      45:'Fog', 48:'Rime fog', 51:'Light drizzle', 53:'Drizzle', 55:'Heavy drizzle',
      56:'Freezing drizzle', 57:'Heavy freezing drizzle', 61:'Light rain', 63:'Rain', 65:'Heavy rain',
      66:'Freezing rain', 67:'Heavy freezing rain', 71:'Light snow', 73:'Snow', 75:'Heavy snow',
      77:'Snow grains', 80:'Light showers', 81:'Showers', 82:'Heavy showers',
      85:'Snow showers', 86:'Heavy snow showers', 95:'Thunderstorm', 96:'Thunderstorm with hail', 99:'Severe thunderstorm with hail'
    };
    return map[code] || 'Weather unavailable';
  }

  function weatherEmoji(condition) {
    const c = String(condition || '').toLowerCase();
    if (/thunder/.test(c)) return '⛈️';
    if (/rain|shower|drizzle/.test(c)) return '🌧️';
    if (/snow/.test(c)) return '🌨️';
    if (/fog/.test(c)) return '🌫️';
    if (/cloud|overcast/.test(c)) return '⛅';
    if (/clear/.test(c)) return '☀️';
    return '🌤️';
  }

  function rainChanceForNow(data) {
    const times = data?.hourly?.time || [];
    const probs = data?.hourly?.precipitation_probability || [];
    if (!times.length || !probs.length) return null;
    const currentTime = data?.current?.time;
    let index = times.indexOf(currentTime);
    if (index < 0) {
      const now = new Date();
      const targetHour = now.getHours();
      index = times.findIndex((t) => new Date(t).getHours() === targetHour);
    }
    const value = probs[index];
    return Number.isFinite(Number(value)) ? Math.round(Number(value)) : null;
  }

  function renderWeather({ temperature, feelsLike, condition, rain }) {
    const card = document.querySelector('.clock-card');
    if (!card) return false;
    const line = card.querySelector('.weather-line');
    const meta = card.querySelector('.weather-meta');
    if (!line) return false;

    let emoji = line.querySelector('.weather-emoji');
    let content = line.querySelector(':scope > div');
    if (!emoji || !content) return false;

    emoji.textContent = weatherEmoji(condition);
    content.innerHTML = `
      <div class="weather-temp-row">
        <strong>${temperature == null ? '—' : `${temperature}°C`}</strong>
        <span class="weather-divider-pipe">|</span>
        <span class="weather-feels">Feels like ${feelsLike == null ? '—' : `${feelsLike}°C`}</span>
      </div>
      <span class="weather-condition-label">${condition || 'Weather unavailable'}</span>
      <span class="weather-rain-chance">Chance of rain ${rain == null ? '—' : `${rain}%`}</span>
    `;
    line.classList.add('homebase-weather-compact');
    if (meta) meta.classList.add('homebase-weather-meta-hidden');
    return true;
  }

  async function loadWeather() {
    try {
      const res = await fetch(WEATHER_URL, { cache:'no-store' });
      if (!res.ok) throw new Error(`Weather ${res.status}`);
      const data = await res.json();
      const current = data.current || {};
      const weather = {
        temperature: Number.isFinite(Number(current.temperature_2m)) ? Math.round(Number(current.temperature_2m)) : null,
        feelsLike: Number.isFinite(Number(current.apparent_temperature)) ? Math.round(Number(current.apparent_temperature)) : null,
        condition: codeToCondition(Number(current.weather_code)),
        rain: rainChanceForNow(data)
      };
      if (!renderWeather(weather)) setTimeout(() => renderWeather(weather), 500);
    } catch (error) {
      console.warn('Homebase weather failed:', error);
      renderWeather({ temperature:null, feelsLike:null, condition:'Weather unavailable', rain:null });
    }
  }

  const observer = new MutationObserver(() => {
    const line = document.querySelector('.clock-card .weather-line');
    if (line && !line.classList.contains('homebase-weather-compact')) loadWeather();
  });
  observer.observe(document.documentElement, { subtree:true, childList:true });

  window.addEventListener('DOMContentLoaded', loadWeather);
  window.addEventListener('load', loadWeather);
  setInterval(loadWeather, 15 * 60 * 1000);
  setTimeout(loadWeather, 0);
})();
