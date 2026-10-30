import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Try loading from apps/backend/.env or workspace root .env if not already in process.env
  const envCandidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'apps/backend/.env'),
    path.resolve(__dirname, '../../.env')
  ];

  for (const envPath of envCandidates) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
      if (process.env.DATABASE_URL) {
        return process.env.DATABASE_URL;
      }
    }
  }

  const fallbackUrl =
    'postgresql://postgres:password123@localhost:5432/cscc_db?schema=public';
  process.env.DATABASE_URL = fallbackUrl;
  return fallbackUrl;
}

const databaseUrl = resolveDatabaseUrl();

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl
    }
  }
});

