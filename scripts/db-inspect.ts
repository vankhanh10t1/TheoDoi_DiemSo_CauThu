import { neon } from '@neondatabase/serverless';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Missing DATABASE_URL');
const sql = neon(databaseUrl);

async function main() {
  const columns = await sql.query(`
    select table_name, ordinal_position, column_name, data_type, is_nullable
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('players', 'matches', 'match_ratings', 'v_player_match_history')
    order by table_name, ordinal_position
  `);
  const constraints = await sql.query(`
    select conrelid::regclass::text as table_name, conname, contype,
           pg_get_constraintdef(oid) as definition
    from pg_constraint
    where connamespace = 'public'::regnamespace
      and conrelid::regclass::text in ('players', 'matches', 'match_ratings')
    order by table_name, conname
  `);
  const indexes = await sql.query(`
    select tablename as table_name, indexname, indexdef
    from pg_indexes
    where schemaname = 'public'
      and tablename in ('players', 'matches', 'match_ratings')
    order by tablename, indexname
  `);
  const view = await sql.query(`
    select pg_get_viewdef('public.v_player_match_history'::regclass, true) as definition
  `);
  const counts = await sql.query(`
    select
      (select count(*)::int from players) as players,
      (select count(*)::int from matches) as matches,
      (select count(*)::int from match_ratings) as match_ratings
  `);
  const integrity = await sql.query(`
    select
      (select count(*)::int from match_ratings where rating < 1 or rating > 10) as invalid_ratings,
      (select count(*)::int from players group by normalized_name having count(*) > 1 limit 1) as duplicate_name_group,
      (select count(*)::int
       from match_ratings r left join players p on p.player_id = r.player_id
       where p.player_id is null) as orphan_players,
      (select count(*)::int
       from match_ratings r left join matches m on m.match_id = r.match_id
       where m.match_id is null) as orphan_matches
  `);

  console.log('\n[db:inspect] Columns');
  console.table(columns);
  console.log('\n[db:inspect] Constraints');
  console.table(constraints);
  console.log('\n[db:inspect] Indexes');
  console.table(indexes);
  console.log('\n[db:inspect] View definition');
  console.log(view[0]?.definition);
  console.log('\n[db:inspect] Counts');
  console.table(counts);
  console.log('\n[db:inspect] Integrity');
  console.table(integrity);
}

main().catch((error) => {
  console.error('[db:inspect] Failed:', error);
  process.exitCode = 1;
});
