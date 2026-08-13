const OLD_CC_HOST = "https://developing-wolverine-creatorcore-c7c5c977.koyeb.app";
const NEW_CC_HOST = "https://bright-carley-creatorcore-60c09cd3.koyeb.app";

// Keep all Homebase API calls pointed at the currently deployed CC Bot service,
// even if an older build still contains the previous Koyeb hostname.
const originalFetch = window.fetch.bind(window);

function weatherCondition(code) {
  const c = Number(code);
  if (c === 0) return "Clear sky";
  if (c === 1) return "Mainly sunny";
  if (c === 2) return "Partly cloudy";
  if (c === 3) return "Cloudy";
  if (c === 45 || c === 48) return "Foggy";
  if ([51,53,55,56,57].includes(c)) return "Drizzle";
  if ([61,63,65,66,67].includes(c)) return "Rain";
  if ([71,73,75,77].includes(c)) return "Snow";
  if ([80,81,82].includes(c)) return "Rain showers";
  if ([85,86].includes(c)) return "Snow showers";
  if ([95,96,99].includes(c)) return "Thunderstorms";
  return "Weather unavailable";
}

async function fetchReadingWeather() {
  const url = "https://api.open-meteo.com/v1/forecast?latitude=51.4543&longitude=-0.9781&current=temperature_2m,apparent_temperature,weather_code&hourly=precipitation_probability&forecast_days=1&timezone=Europe%2FLondon";
  const response = await originalFetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Weather ${response.status}`);
  const data = await response.json();
  const times = data?.hourly?.time || [];
  const probs = data?.hourly?.precipitation_probability || [];
  const currentTime = data?.current?.time;
  let rain = 0;
  if (times.length && probs.length) {
    let index = times.indexOf(currentTime);
    if (index < 0) index = Math.max(0, times.findIndex((t) => new Date(t).getHours() === new Date().getHours()));
    const value = Number(probs[index]);
    if (Number.isFinite(value)) rain = Math.round(value);
  }
  return new Response(JSON.stringify({
    temperature: Math.round(Number(data.current.temperature_2m)),
    feelsLike: Math.round(Number(data.current.apparent_temperature)),
    condition: weatherCondition(data.current.weather_code),
    rain: `${rain}%`
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

window.fetch = function homebaseApiHostFix(input, init) {
  try {
    const url = typeof input === "string" ? input : input?.url || "";
    if (url.includes("/api/homebase-weather")) return fetchReadingWeather();

    if (typeof input === "string" && input.startsWith(OLD_CC_HOST)) {
      input = NEW_CC_HOST + input.slice(OLD_CC_HOST.length);
    } else if (input instanceof Request && input.url.startsWith(OLD_CC_HOST)) {
      input = new Request(NEW_CC_HOST + input.url.slice(OLD_CC_HOST.length), input);
    }
  } catch (error) {
    console.warn("Homebase API host rewrite failed", error);
  }
  return originalFetch(input, init);
};

// Also migrate the saved Quick Link itself so the CC Hub card opens the live
// service and can use that page's favicon.
try {
  const key = "homebase.links";
  const raw = localStorage.getItem(key);
  if (raw) {
    const links = JSON.parse(raw);
    if (Array.isArray(links)) {
      let changed = false;
      const migrated = links.map((item) => {
        if (!item || typeof item !== "object" || typeof item.url !== "string") return item;
        if (!item.url.startsWith(OLD_CC_HOST)) return item;
        changed = true;
        return { ...item, url: NEW_CC_HOST + item.url.slice(OLD_CC_HOST.length) };
      });
      if (changed) localStorage.setItem(key, JSON.stringify(migrated));
    }
  }
} catch (error) {
  console.warn("Could not migrate the saved CC Hub link", error);
}

window.HOMEBASE_CC_API = NEW_CC_HOST;
