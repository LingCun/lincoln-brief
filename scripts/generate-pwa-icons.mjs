#!/usr/bin/env node
/**
 * Generate PWA raster icons (PNG) from public/icon.svg.
 * One-shot script — run when you change the source SVG.
 *
 *   npm install --no-save sharp
 *   node scripts/generate-pwa-icons.mjs
 *
 * Outputs:
 *   public/icons/icon-192.png         (manifest, any)
 *   public/icons/icon-512.png         (manifest, any)
 *   public/icons/icon-maskable-512.png (manifest, maskable)
 *   public/icons/apple-touch-icon.png  (iOS home screen, 180x180)
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PUBLIC = resolve(ROOT, 'public');
const OUT = resolve(PUBLIC, 'icons');

const SRC_ANY = resolve(PUBLIC, 'icon.svg');
const SRC_MASK = resolve(PUBLIC, 'icon-maskable.svg');

await mkdir(OUT, { recursive: true });

const anySvg = await readFile(SRC_ANY);
const maskSvg = await readFile(SRC_MASK);

const tasks = [
  { src: anySvg,  size: 192, name: 'icon-192.png' },
  { src: anySvg,  size: 512, name: 'icon-512.png' },
  { src: maskSvg, size: 512, name: 'icon-maskable-512.png' },
  { src: anySvg,  size: 180, name: 'apple-touch-icon.png', flatten: '#0a0907' },
];

for (const t of tasks) {
  let img = sharp(t.src, { density: 384 }).resize(t.size, t.size, { fit: 'contain', background: '#0a0907' });
  if (t.flatten) img = img.flatten({ background: t.flatten });
  const buf = await img.png({ compressionLevel: 9 }).toBuffer();
  await writeFile(resolve(OUT, t.name), buf);
  console.log(`✓ ${t.name} (${t.size}×${t.size}, ${(buf.length / 1024).toFixed(1)} KB)`);
}

console.log('\nDone. Icons in public/icons/.');
