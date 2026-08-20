import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Missing DATABASE_URL');

const sql = neon(databaseUrl);
const migrationsDirectory = join(process.cwd(), 'database', 'migrations');
const statementBreakpoint = '-- statement-breakpoint';

async function ensureMigrationTable() {
  await sql.query(`create table if not exists schema_migrations (
    version text primary key,
    applied_at timestamptz not null default now()
  )`);
}

async function main() {
  await ensureMigrationTable();
  const files = readdirSync(migrationsDirectory).filter((file) => /^\d+.*\.sql$/.test(file)).sort();
  const rows = await sql.query('select version from schema_migrations order by version');
  const applied = new Set((rows as Array<{ version: string }>).map((row) => row.version));

  if (process.argv.includes('--status')) {
    console.table(files.map((version) => ({ version, status: applied.has(version) ? 'applied' : 'pending' })));
    return;
  }

  for (const version of files) {
    if (applied.has(version)) continue;
    const body = readFileSync(join(migrationsDirectory, version), 'utf8');
    // Explicit breakpoints avoid corrupting comments, strings, or procedural SQL
    // that legitimately contain semicolons.
    const statements = body.split(statementBreakpoint).map((statement) => statement.trim()).filter(Boolean);
    console.log(`[db:migrate] Applying ${version}`);
    await sql.transaction((tx) => [
      ...statements.map((statement) => tx.query(statement)),
      tx`insert into schema_migrations (version) values (${version})`
    ]);
  }
  console.log('[db:migrate] Database schema is up to date.');
}

main().catch((error) => {
  console.error('[db:migrate] Failed:', error);
  process.exitCode = 1;
});
