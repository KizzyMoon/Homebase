const CC_BASE = "https://developing-wolverine-creatorcore-c7c5c977.koyeb.app";
const nativeFetch = window.fetch.bind(window);

function parseDate(value) {
  const text = String(value || "").trim();
  let m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12, 0, 0, 0);
  m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function histories(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  if (Array.isArray(raw.history)) return raw.history;
  if (Array.isArray(raw.loas)) return raw.loas;
  if (raw.start || raw.end) return [raw];
  return [];
}

function activeLoasFrom(raw) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const rows = [];
  for (const [name, entry] of Object.entries(raw || {})) {
    for (const loa of histories(entry)) {
      const start = parseDate(loa?.start);
      const end = parseDate(loa?.end);
      if (start && end && start <= today && today <= end) {
        rows.push({ name, start: loa.start || "", end: loa.end || "" });
        break;
      }
    }
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

function warningRowsFrom(raw) {
  const rows = [];
  for (const [discordId, entry] of Object.entries(raw || {})) {
    if (!entry || typeof entry !== "object") continue;
    const count = Number(entry.warnings || entry.activeWarnings || 0);
    if (count >= 2) rows.push({
      discordId,
      name: String(entry.discord_name || entry.discordName || entry.name || discordId),
      count
    });
  }
  return rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

async function jsonOrThrow(url) {
  const response = await nativeFetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${new URL(url).pathname} returned HTTP ${response.status}`);
  return response.json();
}

async function legacySummary() {
  const [loas, creators] = await Promise.all([
    jsonOrThrow(`${CC_BASE}/api/loas`),
    jsonOrThrow(`${CC_BASE}/api/ccs`)
  ]);
  return {
    loas: activeLoasFrom(loas),
    warnings: warningRowsFrom(creators),
    generatedAt: new Date().toISOString(),
    version: "legacy-fallback"
  };
}

window.fetch = async function homebaseFetch(input, init) {
  const url = typeof input === "string" ? input : input?.url;
  if (!url || !String(url).includes("/api/homebase-summary")) {
    return nativeFetch(input, init);
  }

  try {
    const response = await nativeFetch(input, init);
    if (response.ok) return response;
    console.warn("Homebase combined CC endpoint failed; trying legacy endpoints", response.status);
  } catch (error) {
    console.warn("Homebase combined CC endpoint unavailable; trying legacy endpoints", error);
  }

  try {
    const data = await legacySummary();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  } catch (error) {
    console.error("Homebase CC fallback failed:", error);
    return new Response(JSON.stringify({ error: String(error?.message || error) }), {
      status: 503,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  }
};
