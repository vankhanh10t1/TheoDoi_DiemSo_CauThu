# Database lifecycle

Neon/PostgreSQL is the runtime database. SQL migrations in `database/migrations` are the version-controlled source of truth. Apply them in filename order with `npm run db:migrate`; the runner records each applied filename in `schema_migrations`. Use `npm run db:status` to compare the repository with a target database.

## Bootstrap and deploy

1. Create an empty Neon database/branch and set `DATABASE_URL` locally. Never commit the URL.
2. Run `npm run db:migrate`, then `npm run db:status`.
3. Optionally seed an isolated non-production database with `ALLOW_DATABASE_SEED=true npm run db:seed`.
4. Run `npm test` and `npm run build` before deployment.
5. For production, take a backup or restore point first, apply migrations once from a controlled job, verify status/counts/key screens, then deploy app code.

The baseline contains only indexes justified by current filters and sorts: match date/time pagination, player-rating history lookup, and active squad listing. The `(match_id, player_id)` primary key prevents duplicate ratings; normalized player names are unique. `v_player_match_history` centralizes the history/analytics join. Add indexes only after checking real query plans with `EXPLAIN (ANALYZE, BUFFERS)`.

## Backup and restore

Use a Neon restore point/branch where the plan supports it, or standard PostgreSQL tools:

```bash
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" --file fcon-backup.dump
pg_restore --clean --if-exists --no-owner --no-acl --dbname "$RESTORE_DATABASE_URL" fcon-backup.dump
```

Restore into a new/empty database first, verify table counts and application smoke tests, then switch the application connection deliberately. Exact Neon retention and point-in-time restore controls depend on the active plan: **Cần xác minh thêm** in the Neon console before a production change.

## Rollback policy

Migrations are forward-only. For additive changes, deploy a compensating migration. For destructive changes, use expand/migrate/contract across separate releases; do not drop or rewrite data in the same release that stops reading it. If a migration fails, stop deployment, preserve logs, and restore the tested backup/restore point when a forward fix is unsafe. Never edit an applied migration or run destructive SQL without a verified backup.
