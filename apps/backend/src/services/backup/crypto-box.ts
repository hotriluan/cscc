import crypto from 'crypto';

/**
 * Seals small secrets (Drive credentials, backup passphrase) with AES-256-GCM using
 * BACKUP_MASTER_KEY. Format: `v1:<iv b64>:<tag b64>:<ciphertext b64>`.
 */

const VERSION = 'v1';

export class MasterKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MasterKeyError';
  }
}

export function getMasterKey(): Buffer {
  const raw = process.env.BACKUP_MASTER_KEY?.trim();
  if (!raw) {
    throw new MasterKeyError(
      'BACKUP_MASTER_KEY chưa được cấu hình trên máy chủ (tạo bằng: openssl rand -base64 32).'
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new MasterKeyError('BACKUP_MASTER_KEY phải là 32 byte mã hóa base64.');
  }
  return key;
}

export function isMasterKeyConfigured(): boolean {
  try {
    getMasterKey();
    return true;
  } catch {
    return false;
  }
}

export function sealSecret(plain: string, key: Buffer = getMasterKey()): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

export function openSecret(payload: string, key: Buffer = getMasterKey()): string {
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Định dạng dữ liệu mã hóa không hợp lệ.');
  }
  const iv = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  const ct = Buffer.from(parts[3], 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('Không giải mã được dữ liệu (sai khóa chủ hoặc dữ liệu bị hỏng).');
  }
}

export function hashPassphrase(passphrase: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(passphrase, salt, 32);
  return `scrypt:${salt.toString('base64')}:${hash.toString('base64')}`;
}

export function verifyPassphraseHash(passphrase: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'base64');
  const expected = Buffer.from(parts[2], 'base64');
  const actual = crypto.scryptSync(passphrase, salt, expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

