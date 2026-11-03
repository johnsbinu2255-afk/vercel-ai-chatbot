// Decode any audio file to stereo floats at 48 kHz using Remotion's bundled ffmpeg
// (it can write WAV but not raw float, so we read the WAV ourselves).
import { spawnSync } from 'node:child_process';
import path from 'node:path';

export const remotionBin = (root) => path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'remotion.cmd' : 'remotion');

export function decodeAudio(bin, file, rate = 48000) {
  const r = spawnSync(bin, ['ffmpeg', '-v', 'error', '-i', file, '-vn', '-ac', '2', '-ar', String(rate), '-c:a', 'pcm_s24le', '-f', 'wav', 'pipe:1'], {
    maxBuffer: 1 << 30,
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) throw new Error(`could not decode ${file}:\n${r.stderr}`);
  const buf = r.stdout;
  let off = 12;
  let bits = 24;
  let channels = 2;
  let data = -1;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') {
      channels = buf.readUInt16LE(off + 10);
      bits = buf.readUInt16LE(off + 22);
    }
    if (id === 'data') {
      data = off + 8;
      break;
    }
    off += 8 + size + (size % 2);
  }
  if (data < 0 || bits !== 24) throw new Error(`unexpected WAV from ffmpeg for ${file}`);
  const frames = Math.floor((buf.length - data) / (3 * channels));
  const out = [new Float64Array(frames), new Float64Array(frames)];
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < 2; c++) {
      const o = data + (i * channels + Math.min(c, channels - 1)) * 3;
      let v = buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16);
      if (v & 0x800000) v -= 0x1000000;
      out[c][i] = v / 8388608;
    }
  }
  return out;
}
