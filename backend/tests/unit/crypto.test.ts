import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { decrypt, decryptJson, encrypt, encryptJson, hashIp } from '../../src/lib/crypto';

describe('field encryption (AES-256-GCM)', () => {
  it('round-trips text with the current key version', () => {
    const c = encrypt('cerita rahasia ✓');
    expect(c.startsWith('v2:')).toBe(true);
    expect(decrypt(c)).toBe('cerita rahasia ✓');
  });

  it('uses a fresh IV per encryption', () => {
    expect(encrypt('sama')).not.toBe(encrypt('sama'));
  });

  it('still decrypts data written with an older key (rotation)', () => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.alloc(32, 7), iv);
    const ct = Buffer.concat([cipher.update('lama', 'utf8'), cipher.final()]);
    const payload = `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${ct.toString('base64')}`;
    expect(decrypt(payload)).toBe('lama');
  });

  it('rejects tampered ciphertext', () => {
    const [v, iv, tag, ct] = encrypt('data').split(':');
    const flipped = Buffer.from(ct, 'base64');
    flipped[0] ^= 0xff;
    expect(() => decrypt([v, iv, tag, flipped.toString('base64')].join(':'))).toThrow();
  });

  it('rejects unknown key versions', () => {
    const [, iv, tag, ct] = encrypt('data').split(':');
    expect(() => decrypt(['v9', iv, tag, ct].join(':'))).toThrow();
  });

  it('round-trips JSON', () => {
    expect(decryptJson(encryptJson({ score: 12, answers: [1, 2] }))).toEqual({ score: 12, answers: [1, 2] });
  });

  it('hashes IPs irreversibly and consistently', () => {
    expect(hashIp('1.2.3.4')).toBe(hashIp('1.2.3.4'));
    expect(hashIp('1.2.3.4')).not.toContain('1.2.3.4');
    expect(hashIp(undefined)).toBeNull();
  });
});
