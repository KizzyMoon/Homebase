const OLD_CC_HOST = "https://developing-wolverine-creatorcore-c7c5c977.koyeb.app";
const NEW_CC_HOST = "https://bright-carley-creatorcore-60c09cd3.koyeb.app";

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

window.HOMEBASE_CC_API = NEW_CC_HOST;
