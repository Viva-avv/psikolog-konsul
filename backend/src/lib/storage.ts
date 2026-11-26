import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '../config/env';
import { notFound } from './errors';

const ROOT = path.resolve(env.UPLOAD_DIR);
const KEY_PATTERN = /^[a-f0-9]{32}\.(pdf|png|jpg)$/;

export async function saveFile(buffer: Buffer, ext: 'pdf' | 'png' | 'jpg'): Promise<string> {
  await fs.mkdir(ROOT, { recursive: true });
  const key = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  await fs.writeFile(path.join(ROOT, key), buffer, { flag: 'wx', mode: 0o600 });
  return key;
}

export async function openFile(key: string) {
  // Keys are generated server-side; the pattern check blocks path traversal.
  if (!KEY_PATTERN.test(key)) throw notFound('File tidak ditemukan');
  const filePath = path.join(ROOT, key);
  try {
    await fs.access(filePath);
  } catch {
    throw notFound('File tidak ditemukan');
  }
  return createReadStream(filePath);
}
