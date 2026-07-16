import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('Missing required environment variable: DATABASE_URL');
}

export const sql = neon(process.env.DATABASE_URL);

export function getMissingDatabaseEnvNames(): string[] {
  return process.env.DATABASE_URL ? [] : ['DATABASE_URL'];
}
