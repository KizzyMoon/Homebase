const EMS_HEX = '#f8a2a2';

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const value = parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function calendarColour(name, fallbackClass = '') {
  const normalized = String(name || '').trim().toLowerCase();
  if (normalized === 'ems') return EMS_HEX;
  if (fallbackClass.includes('cal-blue')) return '#8fb7ff';
  if (fallbackClass.includes('cal-green')) return '#9ed7a7';
  if (fallbackClass.includes('cal-purple')) return '#c7a2f6';
  return '#d8b2a5';
}

function applyCalendarKey() {
  const list = document.querySelector('.settings-calendar-list');
  const key = document.querySelector('.calendar-key');
  if (!list || !key) return;

  const rows = [...list.querySelectorAll('.settings-calendar-row')];
  const calendars = rows.map((row) => {
    const name = row.querySelector('strong')?.textContent?.trim();
    if (!name) return null;
    const colour = calendarColour(name, row.className);

    if (name.toLowerCase() === 'ems') {
      row.style.color = colour;
      row.style.background = hexToRgba(colour, 0.12);
      row.style.borderColor = hexToRgba(colour, 0.38);
      const dot = row.querySelector('.calendar-dot');
      if (dot) dot.style.background = colour;
    }

    return { name, colour };
  }).filter(Boolean);

  key.replaceChildren(...calendars.map(({ name, colour }) => {
    const tag = document.createElement('span');
    tag.textContent = name;
    tag.style.color = colour;
    tag.style.background = hexToRgba(colour, 0.10);
    tag.style.borderColor = hexToRgba(colour, 0.42);
    return tag;
  }));
}

let scheduled = false;
function scheduleApply() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    applyCalendarKey();
  });
}

new MutationObserver(scheduleApply).observe(document.documentElement, {
  subtree: true,
  childList: true,
  characterData: true
});

window.addEventListener('storage', (event) => {
  if (event.key === 'homebase.calendarLinks') scheduleApply();
});

document.addEventListener('DOMContentLoaded', scheduleApply);
scheduleApply();
