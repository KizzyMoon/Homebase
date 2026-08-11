const OLD_CC_HOST = "https://developing-wolverine-creatorcore-c7c5c977.koyeb.app";
const NEW_CC_HOST = "https://bright-carley-creatorcore-60c09cd3.koyeb.app";

// Keep all Homebase API calls pointed at the currently deployed CC Bot service,
// even if an older build still contains the previous Koyeb hostname.
const originalFetch = window.fetch.bind(window);
window.fetch = function homebaseApiHostFix(input, init) {
  try {
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
