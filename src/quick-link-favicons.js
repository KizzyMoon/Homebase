function improveQuickLinkFavicons(root = document) {
  root.querySelectorAll('.site-icon img').forEach((img) => {
    if (img.dataset.homebaseFaviconTried === '1') return;
    img.dataset.homebaseFaviconTried = '1';

    let host = '';
    try {
      const current = new URL(img.src);
      host = current.searchParams.get('domain') || '';
    } catch {}
    if (!host) return;

    const googleFallback = img.src;
    const direct = `https://${host}/favicon.ico`;
    img.onerror = () => {
      if (img.src !== googleFallback) {
        img.onerror = null;
        img.src = googleFallback;
      }
    };
    img.src = direct;
  });
}

const observer = new MutationObserver(() => improveQuickLinkFavicons());
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', () => improveQuickLinkFavicons());
setTimeout(() => improveQuickLinkFavicons(), 250);
