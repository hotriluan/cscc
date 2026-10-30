import crypto from 'crypto';
import { UserAccount, UserRole } from '@cscc/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'cscc-alkana-jwt-secret-key-2026';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface JwtPayload {
  sub: string;
  email: string;
  fullName: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface DefaultSeedUser {
  id: string;
  email: string;
  fullName: string;
  passwordPlain: string;
  role: UserRole;
}

export const DEFAULT_SEED_USERS: DefaultSeedUser[] = [
  {
    id: 'user-leader-01',
    email: 'leader@alkana.vn',
    fullName: 'Nguyễn Văn Quản Lý (Project Leader)',
    passwordPlain: '123456',
    role: 'PROJECT_LEADER'
  },
  {
    id: 'user-sales-01',
    email: 'sales@alkana.vn',
    fullName: 'Trần Thị Kinh Doanh (Sales / Báo giá)',
    passwordPlain: '123456',
    role: 'SALES'
  },
  {
    id: 'user-tech-01',
    email: 'tech@alkana.vn',
    fullName: 'Lê Văn Kỹ Thuật (Technical TA)',
    passwordPlain: '123456',
    role: 'TECHNICAL'
  },
  {
    id: 'user-admin-01',
    email: 'admin@alkana.vn',
    fullName: 'Quản Trị Hệ Thống (System Admin)',
    passwordPlain: '123456',
    role: 'ADMIN'
  }
];

export function hashPassword(password: string, salt?: string): string {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return `${actualSalt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derivedKey = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derivedKey.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derivedKey, keyBuf);
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64').toString('utf-8');
}

export function signJwtToken(user: UserAccount): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    iat: nowSec,
    exp: nowSec + TOKEN_TTL_SECONDS
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(signingInput)
    .digest();
  const encodedSig = base64UrlEncode(signature);
  return `${signingInput}.${encodedSig}`;
}

export function verifyJwtToken(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, encodedSig] = parts;
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSig = base64UrlEncode(
      crypto.createHmac('sha256', JWT_SECRET).update(signingInput).digest()
    );

    const sigBuf = Buffer.from(encodedSig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as JwtPayload;
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSec) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

