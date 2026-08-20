import { sql } from '../db';

export type LineupAnalytics = {
  positions: Array<{ position:string; appearances:number; minutes:number; averageRating:number; goals:number; assists:number; wins:number; draws:number; losses:number; insufficientData:boolean }>;
  formations: Array<{ formation:string; matches:number; wins:number; draws:number; losses:number; averageRating:number; goals:number; assists:number; standoutPlayer?:string; insufficientData:boolean }>;
};

export async function getLineupAnalytics(window: 5|10|20): Promise<LineupAnalytics> {
  const positionRows = await sql.query(`with recent as (select match_id from matches order by match_date desc, created_at desc limit $1)
    select coalesce(r.position,'Chưa nhập') position, count(*)::int appearances, coalesce(sum(r.minutes_played),0)::int minutes,
      round(avg(r.rating)::numeric,2)::float average_rating, sum(r.goals)::int goals, sum(r.assists)::int assists,
      count(*) filter(where m.result='WIN')::int wins, count(*) filter(where m.result='DRAW')::int draws, count(*) filter(where m.result='LOSE')::int losses
    from match_ratings r join matches m using(match_id) join recent x using(match_id)
    group by r.position order by appearances desc, position`, [window]) as Array<Record<string, number|string>>;
  const formationRows = await sql.query(`with recent as (select match_id from matches order by match_date desc, created_at desc limit $1), stats as (
      select coalesce(m.formation,'Chưa nhập') formation, count(distinct m.match_id)::int matches,
      count(distinct m.match_id) filter(where m.result='WIN')::int wins, count(distinct m.match_id) filter(where m.result='DRAW')::int draws,
      count(distinct m.match_id) filter(where m.result='LOSE')::int losses, round(avg(r.rating)::numeric,2)::float average_rating,
      coalesce(sum(r.goals),0)::int goals, coalesce(sum(r.assists),0)::int assists
      from matches m join recent x using(match_id) left join match_ratings r using(match_id) group by m.formation)
    select * from stats order by matches desc, formation`, [window]) as Array<Record<string, number|string>>;
  return {
    positions: positionRows.map(r=>({position:String(r.position),appearances:Number(r.appearances),minutes:Number(r.minutes),averageRating:Number(r.average_rating),goals:Number(r.goals),assists:Number(r.assists),wins:Number(r.wins),draws:Number(r.draws),losses:Number(r.losses),insufficientData:Number(r.appearances)<3})),
    formations: formationRows.map(r=>({formation:String(r.formation),matches:Number(r.matches),wins:Number(r.wins),draws:Number(r.draws),losses:Number(r.losses),averageRating:Number(r.average_rating)||0,goals:Number(r.goals),assists:Number(r.assists),insufficientData:Number(r.matches)<3}))
  };
}
