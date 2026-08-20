import { neon } from '@neondatabase/serverless';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Missing DATABASE_URL');
if (process.env.ALLOW_DATABASE_SEED !== 'true') {
  throw new Error('Refusing to seed. Set ALLOW_DATABASE_SEED=true for an isolated dev/test database.');
}
if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to seed a production environment.');
}

const sql = neon(databaseUrl);

async function main() {
  const now = new Date().toISOString();
  const players = [
    ['dev-player-01', 'Cầu thủ mẫu 01', 'DEV', 'GK'],
    ['dev-player-02', 'Cầu thủ mẫu 02', 'DEV', 'CM'],
    ['dev-player-03', 'Cầu thủ mẫu 03', 'DEV', 'ST']
  ] as const;

  for (const [playerId, name, cardSeason, position] of players) {
    await sql`
      insert into players (player_id, name, normalized_name, card_season, position, created_at, updated_at)
      values (${playerId}, ${name}, ${name.toLocaleLowerCase('vi-VN')}, ${cardSeason}, ${position}, ${now}, ${now})
      on conflict (player_id) do nothing
    `;
  }
  console.log('[db:seed] Added anonymous development players (existing rows were preserved).');
}

main().catch((error) => {
  console.error('[db:seed] Failed:', error);
  process.exitCode = 1;
});
