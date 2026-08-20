alter table matches add column if not exists formation text;
-- statement-breakpoint
alter table match_ratings add column if not exists is_starter boolean not null default true;
-- statement-breakpoint
alter table match_ratings add column if not exists minutes_played integer check (minutes_played between 0 and 120);
-- statement-breakpoint
alter table match_ratings add column if not exists substitution_minute integer check (substitution_minute between 0 and 120);
-- statement-breakpoint
create index if not exists matches_formation_date_idx on matches (formation, match_date desc);
-- statement-breakpoint
create index if not exists match_ratings_position_player_idx on match_ratings (position, player_id);
-- statement-breakpoint
create or replace view v_player_match_history as
select
  r.player_id, p.name as player_name, p.card_season, p.position as player_position,
  r.match_id, m.match_date, m.match_time, m.match_datetime, m.opponent_name,
  m.my_score, m.opponent_score,
  case m.result when 'WIN' then 'Win' when 'DRAW' then 'Draw' else 'Loss' end as result,
  m.is_big_win, m.is_big_loss, r.rating, r.position as rated_position,
  r.yellow_cards, r.red_cards, r.fouls, r.goals, r.assists, r.note,
  r.created_at, r.updated_at, m.formation, r.is_starter, r.minutes_played, r.substitution_minute
from match_ratings r
join players p on p.player_id = r.player_id
join matches m on m.match_id = r.match_id;
