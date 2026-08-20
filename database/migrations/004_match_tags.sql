alter table matches add column if not exists season text;
-- statement-breakpoint
alter table matches add column if not exists competition text;
-- statement-breakpoint
alter table matches add column if not exists match_type text;
-- statement-breakpoint
alter table matches add constraint matches_season_length check (season is null or char_length(season) <= 80);
-- statement-breakpoint
alter table matches add constraint matches_competition_length check (competition is null or char_length(competition) <= 80);
-- statement-breakpoint
alter table matches add constraint matches_match_type_length check (match_type is null or char_length(match_type) <= 80);
-- statement-breakpoint
create index if not exists matches_tags_date_idx on matches (lower(season), lower(competition), lower(match_type), match_date desc);
-- statement-breakpoint
create or replace view v_player_match_history as
select
  r.player_id, p.name as player_name, p.card_season, p.position as player_position,
  r.match_id, m.match_date, m.match_time, m.match_datetime, m.opponent_name,
  m.my_score, m.opponent_score,
  case m.result when 'WIN' then 'Win' when 'DRAW' then 'Draw' else 'Loss' end as result,
  m.is_big_win, m.is_big_loss, r.rating, r.position as rated_position,
  r.yellow_cards, r.red_cards, r.fouls, r.goals, r.assists, r.note,
  r.created_at, r.updated_at, m.formation, r.is_starter, r.minutes_played, r.substitution_minute,
  m.season, m.competition, m.match_type
from match_ratings r
join players p on p.player_id = r.player_id
join matches m on m.match_id = r.match_id;
