-- Existing databases historically accepted 0; the application contract is 1..10.
-- Preflight with `npm run db:inspect` before applying: invalid_ratings must be 0.
alter table match_ratings
  drop constraint if exists match_ratings_rating_check;
-- statement-breakpoint
alter table match_ratings
  add constraint match_ratings_rating_check check (rating between 1 and 10);
