import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

mkdirSync('public', { recursive: true });

const svg = readFileSync('public/homebase-icon.svg');

async function render(size, path) {
  const png = await sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'contain' })
    .png()
    .toBuffer();
  writeFileSync(path, png);
}

await render(180, 'public/apple-touch-icon.png');
await render(180, 'public/favicon.png');
await render(512, 'public/homebase-icon-512.png');

console.log('Generated complete Homebase PNG icons from the SVG source.');
