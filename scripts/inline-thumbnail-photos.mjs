#!/usr/bin/env node
/**
 * 썸네일 SVG 안의 <image href="/thumbnails/photos/xxx.jpg"> 참조를
 * base64 data URI 로 변환합니다.
 *
 * 이유: SVG 를 <img src=...> 로 임베드하면 브라우저가
 * SVG 내부의 <image href> 외부 참조를 보안 정책상 차단합니다 (SVG-as-image).
 * base64 임베드 시 SVG 가 self-contained 가 되어 동일하게 렌더됩니다.
 *
 * Usage:
 *   node scripts/inline-thumbnail-photos.mjs
 *
 * idempotent — 이미 base64인 경우 스킵.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const THUMBS_DIR = path.join(ROOT, 'public/thumbnails');
const PHOTOS_DIR = path.join(THUMBS_DIR, 'photos');

async function inlineSvg(svgPath) {
  const original = await fs.readFile(svgPath, 'utf8');
  const name = path.basename(svgPath);

  // /thumbnails/photos/xxx.jpg 패턴 매칭
  const photoRefs = [...original.matchAll(/href="\/thumbnails\/photos\/([^"]+\.(jpg|jpeg|png))"/g)];
  if (photoRefs.length === 0) {
    console.log(`[skip] ${name} — no photo href`);
    return false;
  }

  let updated = original;
  let replaced = 0;
  for (const match of photoRefs) {
    const fullMatch = match[0];
    const filename = match[1];
    const photoPath = path.join(PHOTOS_DIR, filename);
    try {
      const buf = await fs.readFile(photoPath);
      const mime = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';
      const dataUri = `href="data:${mime};base64,${buf.toString('base64')}"`;
      updated = updated.replace(fullMatch, dataUri);
      replaced++;
    } catch (e) {
      console.warn(`[warn] ${name}: photo not found at ${photoPath}`);
    }
  }

  if (replaced > 0) {
    await fs.writeFile(svgPath, updated, 'utf8');
    console.log(`[ok]   ${name} — inlined ${replaced} photo(s), new size ${(updated.length / 1024).toFixed(0)} KB`);
    return true;
  }
  return false;
}

async function main() {
  const entries = await fs.readdir(THUMBS_DIR);
  const svgs = entries.filter((e) => e.endsWith('.svg') && !e.startsWith('_template'));
  console.log(`[scan] ${svgs.length} thumbnails to process`);

  let totalReplaced = 0;
  for (const svg of svgs) {
    const ok = await inlineSvg(path.join(THUMBS_DIR, svg));
    if (ok) totalReplaced++;
  }
  console.log(`\n[done] inlined photos in ${totalReplaced} svg file(s)`);
}

main().catch((e) => {
  console.error('[fail]', e);
  process.exit(1);
});
