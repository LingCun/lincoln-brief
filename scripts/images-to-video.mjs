#!/usr/bin/env node
/**
 * 폴더 안의 이미지들을 세로형(9:16) 슬라이드쇼 mp4 로 묶습니다.
 *
 * 이미지는 파일명 순서(자연 정렬: 1, 2, 10)대로 배치되고,
 * 가로 이미지는 같은 사진을 흐리게 확대한 배경 위에 얹어 여백을 채웁니다.
 * 컷 사이는 크로스페이드.
 *
 * Usage:
 *   node scripts/images-to-video.mjs                      # video-input/ → video-output/video-input.mp4
 *   node scripts/images-to-video.mjs --dir photos/0908
 *   node scripts/images-to-video.mjs --dir photos --out out.mp4 --seconds 4 --audio bgm.mp3
 *
 * Options:
 *   --dir <path>       이미지 폴더 (기본 video-input)
 *   --out <path>       출력 mp4 (기본 video-output/<폴더명>.mp4)
 *   --seconds <n>      이미지 한 장당 노출 시간, 초 (기본 3.5)
 *   --transition <n>   크로스페이드 길이, 초 (기본 0.6, --seconds 보다 작아야 함)
 *   --size <WxH>       해상도 (기본 1080x1920)
 *   --audio <path>     배경 음악 파일 (선택). 영상 길이에 맞춰 자르고 끝에서 페이드아웃.
 *   --force            출력 파일이 이미 있어도 덮어쓰기
 *
 * 요구사항: ffmpeg 가 PATH 에 있어야 합니다. (Windows: winget install Gyan.FFmpeg)
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

function parseArgs(argv) {
  // 키 목록이 곧 허용 옵션 목록 — out/audio 는 기본값 없이 null.
  const opts = { dir: 'video-input', out: null, seconds: 3.5, transition: 0.6, size: '1080x1920', audio: null, force: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--force') opts.force = true;
    else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (!(key in opts)) throw new Error(`알 수 없는 옵션: ${arg}`);
      const value = argv[++i];
      if (value === undefined) throw new Error(`${arg} 값이 없습니다`);
      opts[key] = key === 'seconds' || key === 'transition' ? Number(value) : value;
    } else throw new Error(`알 수 없는 인자: ${arg}`);
  }
  return opts;
}

/** 1, 2, 10 이 1, 10, 2 로 밀리지 않도록 숫자 부분을 숫자로 비교 */
function naturalSort(a, b) {
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
}

function buildFilter(count, { width, height, seconds, transition }) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    parts.push(
      `[${i}:v]split=2[raw${i}a][raw${i}b];` +
        // 배경: 화면을 꽉 채우도록 확대 후 잘라내고 블러
        `[raw${i}a]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=40:2[bg${i}];` +
        // 전경: 잘리지 않게 축소
        `[raw${i}b]scale=${width}:${height}:force_original_aspect_ratio=decrease[fg${i}];` +
        `[bg${i}][fg${i}]overlay=(W-w)/2:(H-h)/2,fps=30,format=yuv420p,setsar=1[v${i}]`
    );
  }

  // xfade 는 두 스트림씩 이어 붙인다. k 번째 전환은 앞 구간이 (seconds - transition) 씩
  // 겹치며 누적된 지점에서 시작.
  let last = '[v0]';
  for (let i = 1; i < count; i++) {
    const offset = (seconds - transition) * i;
    const out = i === count - 1 ? '[out]' : `[x${i}]`;
    parts.push(`${last}[v${i}]xfade=transition=fade:duration=${transition}:offset=${offset.toFixed(3)}${out}`);
    last = out;
  }
  return { filter: parts.join(';'), outLabel: count === 1 ? '[v0]' : '[out]' };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  const sizeMatch = /^(\d+)x(\d+)$/.exec(opts.size);
  if (!sizeMatch) throw new Error(`--size 형식은 1080x1920 처럼 주세요 (받은 값: ${opts.size})`);
  const [, width, height] = sizeMatch;

  if (!(opts.seconds > 0)) throw new Error('--seconds 는 0보다 커야 합니다');
  if (!(opts.transition >= 0) || opts.transition >= opts.seconds) {
    throw new Error('--transition 은 0 이상이면서 --seconds 보다 작아야 합니다');
  }

  const dir = path.resolve(ROOT, opts.dir);
  if (!fs.existsSync(dir)) throw new Error(`폴더가 없습니다: ${dir}`);
  const images = fs
    .readdirSync(dir)
    .filter((name) => IMAGE_EXT.test(name))
    .sort(naturalSort)
    .map((name) => path.join(dir, name));
  if (images.length === 0) throw new Error(`이미지가 없습니다 (jpg/png/webp): ${dir}`);

  const out = path.resolve(ROOT, opts.out ?? path.join('video-output', `${path.basename(dir)}.mp4`));
  if (fs.existsSync(out) && !opts.force) {
    throw new Error(`이미 있는 파일입니다: ${out}\n덮어쓰려면 --force 를 붙이세요.`);
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });

  const total = opts.seconds * images.length - opts.transition * (images.length - 1);
  const { filter, outLabel } = buildFilter(images.length, { width, height, ...opts });

  // -v error -stats: 배너/스트림 덤프는 감추고 에러와 진행률만 보여줌
  const args = ['-y', '-v', 'error', '-stats'];
  for (const image of images) args.push('-loop', '1', '-t', String(opts.seconds), '-i', image);
  if (opts.audio) args.push('-i', path.resolve(ROOT, opts.audio));
  args.push('-filter_complex', filter, '-map', outLabel);
  if (opts.audio) {
    const fade = Math.min(2, total);
    args.push(
      '-map', `${images.length}:a`,
      '-af', `afade=t=out:st=${(total - fade).toFixed(3)}:d=${fade}`,
      '-c:a', 'aac', '-b:a', '192k'
    );
  }
  args.push('-t', total.toFixed(3), '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out);

  console.log(`이미지 ${images.length}장 → ${width}x${height}, ${total.toFixed(1)}초`);
  images.forEach((image, i) => console.log(`  ${i + 1}. ${path.basename(image)}`));

  const result = spawnSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'] });
  if (result.error?.code === 'ENOENT') {
    throw new Error('ffmpeg 를 찾을 수 없습니다. 설치 후 PATH 에 추가하세요 (Windows: winget install Gyan.FFmpeg).');
  }
  if (result.status !== 0) throw new Error(`ffmpeg 실패 (exit ${result.status})`);

  console.log(`\n완료: ${out}`);
}

try {
  main();
} catch (error) {
  console.error(`\n[에러] ${error.message}`);
  process.exit(1);
}
