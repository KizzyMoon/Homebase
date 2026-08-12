function svgData(svg) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const HUB_ICONS = {
  'cc hub': svgData(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="13" fill="#080b08"/>
      <rect x="13" y="21" width="27" height="22" rx="5" fill="#b7ee00"/>
      <path d="M40 26.5 52 20v24L40 37.5z" fill="#b7ee00"/>
      <rect x="18" y="26" width="17" height="12" rx="2.5" fill="#132000"/>
    </svg>`),
  'ems hub': svgData(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="13" fill="#6a4d38"/>
      <g fill="#f2aeb7" transform="translate(32 32)">
        <ellipse rx="6" ry="18" transform="rotate(0)"/>
        <ellipse rx="6" ry="18" transform="rotate(45)"/>
        <ellipse rx="6" ry="18" transform="rotate(90)"/>
        <ellipse rx="6" ry="18" transform="rotate(135)"/>
      </g>
      <circle cx="32" cy="32" r="6" fill="#ffd7d2"/>
    </svg>`)
};

function cardLabelFor(img) {
  const card = img.closest('.link-card, a');
  if (!card) return '';
  const strong = card.querySelector('strong');
  const span = card.querySelector('span');
  return String(strong?.textContent || span?.textContent || '').trim().toLowerCase();
}

function improveQuickLinkFavicons(root = document) {
  root.querySelectorAll('.site-icon img').forEach((img) => {
    const label = cardLabelFor(img);

    // These two sites do not expose a normal /favicon.ico that Homebase can
    // reliably read, so use their actual visual site marks rather than the
    // generic globe returned by the favicon fallback service.
    if (HUB_ICONS[label]) {
      if (img.dataset.homebaseHubIcon === label) return;
      img.dataset.homebaseHubIcon = label;
      img.dataset.homebaseFaviconTried = '1';
      img.onerror = null;
      img.src = HUB_ICONS[label];
      return;
    }

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
