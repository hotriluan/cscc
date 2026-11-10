import crypto from 'crypto';
import { Transform, TransformCallback } from 'stream';

/**
 * Streaming AES-256-GCM container.
 * Layout: MAGIC(7) | salt(16) | iv(12) | ciphertext... | authTag(16)
 * The key is derived with scrypt from the passphrase and the per-file salt.
 */

export const MAGIC = Buffer.from('CSCCBK1', 'ascii');
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const HEADER_LEN = MAGIC.length + SALT_LEN + IV_LEN;

export class BackupDecryptError extends Error {
  constructor(message = 'Sai mật khẩu mã hóa hoặc file sao lưu bị hỏng.') {
    super(message);
    this.name = 'BackupDecryptError';
  }
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return crypto.scryptSync(passphrase, salt, 32);
}

export function createEncryptStream(passphrase: string): Transform {
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  let headerSent = false;
  return new Transform({
    transform(chunk: Buffer, _enc, cb: TransformCallback) {
      if (!headerSent) {
        headerSent = true;
        this.push(Buffer.concat([MAGIC, salt, iv]));
      }
      cb(null, cipher.update(chunk));
    },
    flush(cb: TransformCallback) {
      if (!headerSent) {
        headerSent = true;
        this.push(Buffer.concat([MAGIC, salt, iv]));
      }
      this.push(cipher.final());
      this.push(cipher.getAuthTag());
      cb();
    }
  });
}

export function createDecryptStream(passphrase: string): Transform {
  let header = Buffer.alloc(0);
  let decipher: crypto.DecipherGCM | null = null;
  let pending = Buffer.alloc(0);

  return new Transform({
    transform(chunk: Buffer, _enc, cb: TransformCallback) {
      try {
        let data = chunk;
        if (!decipher) {
          header = Buffer.concat([header, data]);
          if (header.length < HEADER_LEN) return cb();
          if (!header.subarray(0, MAGIC.length).equals(MAGIC)) {
            return cb(new BackupDecryptError('File không phải là bản sao lưu CSCC hợp lệ.'));
          }
          const salt = header.subarray(MAGIC.length, MAGIC.length + SALT_LEN);
          const iv = header.subarray(MAGIC.length + SALT_LEN, HEADER_LEN);
          decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
          data = header.subarray(HEADER_LEN);
          header = Buffer.alloc(0);
        }
        pending = Buffer.concat([pending, data]);
        if (pending.length > TAG_LEN) {
          const body = pending.subarray(0, pending.length - TAG_LEN);
          pending = pending.subarray(pending.length - TAG_LEN);
          return cb(null, decipher.update(body));
        }
        cb();
      } catch (err) {
        cb(err as Error);
      }
    },
    flush(cb: TransformCallback) {
      try {
        if (!decipher || pending.length !== TAG_LEN) {
          return cb(new BackupDecryptError('File sao lưu bị cắt cụt hoặc hỏng.'));
        }
        decipher.setAuthTag(pending);
        this.push(decipher.final());
        cb();
      } catch {
        cb(new BackupDecryptError());
      }
    }
  });
}

/** True when the first bytes of a file carry the backup magic. */
export function hasBackupMagic(head: Buffer): boolean {
  return head.length >= MAGIC.length && head.subarray(0, MAGIC.length).equals(MAGIC);
}

