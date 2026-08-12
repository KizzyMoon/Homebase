import { mkdirSync, writeFileSync } from 'node:fs';

// Exact Homebase laptop + heart artwork, stored as a PNG payload so the static
// GitHub Pages build can produce a real Apple touch icon (Safari does not
// reliably use the SVG for Add to Home Screen / bookmark artwork).
const icon180 = 'PLACEHOLDER';

mkdirSync('public', { recursive: true });
writeFileSync('public/apple-touch-icon.png', Buffer.from(icon180, 'base64'));
writeFileSync('public/favicon.png', Buffer.from(icon180, 'base64'));
console.log('Generated Homebase PNG app icons.');
