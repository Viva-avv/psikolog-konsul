import crypto from 'crypto';
import { env } from '../config/env';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;

const keys = new Map<number, Buffer>(
  env.DATA_ENCRYPTION_KEYS.split(',').map((entry) => {
    const [version, b64] = entry.split(':');
    const key = Buffer.from(b64, 'base64');
    if (key.length !== 32) throw new Error(`Encryption key v${version} must be 32 bytes`);
    return [Number(version), key];
  }),
);

if (!keys.has(env.DATA_ENCRYPTION_KEY_CURRENT)) {
  throw new Error('DATA_ENCRYPTION_KEY_CURRENT does not match any key in DATA_ENCRYPTION_KEYS');
}

/** Output format: v{version}:{iv}:{authTag}:{ciphertext}, all base64. */
export function encrypt(plaintext: string): string {
  const version = env.DATA_ENCRYPTION_KEY_CURRENT;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, keys.get(version)!, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v${version}:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

export function decrypt(payload: string): string {
  const [v, ivB64, tagB64, ctB64] = payload.split(':');
  const key = keys.get(Number(v?.slice(1)));
  if (!key || !ivB64 || !tagB64 || ctB64 === undefined) throw new Error('Malformed ciphertext');
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
}

export const encryptJson = (value: unknown) => encrypt(JSON.stringify(value));
export const decryptJson = <T>(payload: string): T => JSON.parse(decrypt(payload)) as T;

export const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

export const randomToken = (bytes = 48) => crypto.randomBytes(bytes).toString('base64url');

export const hashIp = (ip: string | undefined) =>
  ip ? crypto.createHmac('sha256', env.IP_HASH_SALT).update(ip).digest('hex').slice(0, 32) : null;
