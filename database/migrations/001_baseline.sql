-- Baseline inferred from the current Neon runtime queries. Safe to re-run.
create table if not exists players (
  player_id text primary key,
  name text not null,
  normalized_name text not null,
  card_season text not null,
  position text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint players_normalized_name_unique unique (normalized_name)
);
-- statement-breakpoint

create table if not exists matches (
  match_id text primary key,
  match_date date not null,
  match_time time,
  match_datetime timestamptz,
  opponent_name text,
  my_score integer not null default 0 check (my_score >= 0),
  opponent_score integer not null default 0 check (opponent_score >= 0),
  result text not null check (result in ('WIN', 'DRAW', 'LOSE')),
  is_big_win boolean not null default false,
  is_big_loss boolean not null default false,
  note text,
  rating_version integer not null default 0 check (rating_version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- statement-breakpoint

create table if not exists match_ratings (
  match_id text not null references matches(match_id) on delete cascade,
  player_id text not null references players(player_id) on delete cascade,
  rating numeric(3,1) not null check (rating between 1 and 10),
  position text,
  yellow_cards integer not null default 0 check (yellow_cards >= 0),
  red_cards integer not null default 0 check (red_cards >= 0),
  fouls integer not null default 0 check (fouls >= 0),
  goals integer not null default 0 check (goals >= 0),
  assists integer not null default 0 check (assists >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (match_id, player_id)
);
-- statement-breakpoint

-- Match-history pagination and date filters/sorts.
create index if not exists matches_history_date_idx
  on matches (match_date desc, match_time desc, created_at desc);
-- statement-breakpoint
-- Player history/recommendation lookup; also supports EXISTS filters by player.
create index if not exists match_ratings_player_match_idx
  on match_ratings (player_id, match_id);
-- statement-breakpoint
-- Active squad listing. The unique constraint above serves duplicate-name lookup.
create index if not exists players_active_position_name_idx
  on players (position, name) where is_active = true;
-- statement-breakpoint

create or replace view v_player_match_history as
select
  r.player_id,
  p.name as player_name,
  p.card_season,
  p.position as player_position,
  r.match_id,
  m.match_date,
  m.match_time,
  m.match_datetime,
  m.opponent_name,
  m.my_score,
  m.opponent_score,
  case m.result when 'WIN' then 'Win' when 'DRAW' then 'Draw' else 'Loss' end as result,
  m.is_big_win, m.is_big_loss, r.rating, r.position as rated_position,
  r.yellow_cards, r.red_cards, r.fouls, r.goals, r.assists, r.note,
  r.created_at, r.updated_at
from match_ratings r
join players p on p.player_id = r.player_id
join matches m on m.match_id = r.match_id;
