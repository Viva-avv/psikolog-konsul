import multer from 'multer';
import { badRequest } from '../lib/errors';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 10 },
}).single('file');

const SIGNATURES: Array<{ ext: 'pdf' | 'png' | 'jpg'; mime: string; bytes: number[] }> = [
  { ext: 'pdf', mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { ext: 'png', mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { ext: 'jpg', mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
];

/** Detects file type from magic bytes; the client-supplied mimetype is not trusted. */
export function detectFileType(file: Express.Multer.File | undefined) {
  if (!file) throw badRequest('File wajib diunggah');
  const match = SIGNATURES.find((s) => s.bytes.every((b, i) => file.buffer[i] === b));
  if (!match) throw badRequest('Format file harus PDF, PNG, atau JPG', 'INVALID_FILE_TYPE');
  return match;
}
