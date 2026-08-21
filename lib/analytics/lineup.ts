import { sql } from '../db';
import { calculateFormationAnalytics, FORMATION_ANALYSIS_RECENT_MATCH_LIMIT, type FormationAnalyticsRow, type FormationMatch } from './lineup-calculations';
export { calculateFormationAnalytics, FORMATION_ANALYSIS_RECENT_MATCH_LIMIT } from './lineup-calculations';

export type LineupAnalyticsFilters = { season?: string; competition?: string; matchType?: string; dateFrom?: string; dateTo?: string };
export type LineupAnalytics = {
  positionWindow: 5|10|20; formationMatchLimit:number;
  positions: Array<{ position:string; appearances:number; minutes:number; averageRating:number; goals:number; assists:number; wins:number; draws:number; losses:number; insufficientData:boolean }>;
  formations: FormationAnalyticsRow[];
};

function filterSql(filters:LineupAnalyticsFilters,startIndex:number){
  const clauses:string[]=[],values:string[]=[];
  const add=(column:string,value?:string)=>{if(!value)return;values.push(value);clauses.push(`${column} = $${startIndex+values.length-1}`)};
  add('lower(m.season)',filters.season?.toLowerCase()); add('lower(m.competition)',filters.competition?.toLowerCase()); add('lower(m.match_type)',filters.matchType?.toLowerCase());
  if(filters.dateFrom){values.push(filters.dateFrom);clauses.push(`m.match_date >= $${startIndex+values.length-1}::date`)}
  if(filters.dateTo){values.push(filters.dateTo);clauses.push(`m.match_date <= $${startIndex+values.length-1}::date`)}
  return {clause:clauses.length?`where ${clauses.join(' and ')}`:'',values};
}

export async function getLineupAnalytics(positionWindow:5|10|20,filters:LineupAnalyticsFilters={}):Promise<LineupAnalytics>{
  const pf=filterSql(filters,2);
  const positionRows=await sql.query(`with recent as (select match_id from matches m ${pf.clause} order by match_date desc, created_at desc limit $1)
    select coalesce(r.position,'Chưa phân loại') position,count(*)::int appearances,coalesce(sum(r.minutes_played),0)::int minutes,
      round(avg(r.rating)::numeric,2)::float average_rating,sum(r.goals)::int goals,sum(r.assists)::int assists,
      count(*) filter(where m.result='WIN')::int wins,count(*) filter(where m.result='DRAW')::int draws,count(*) filter(where m.result='LOSE')::int losses
    from match_ratings r join matches m using(match_id) join recent x using(match_id) group by r.position order by appearances desc,position`,[positionWindow,...pf.values]) as Array<Record<string,number|string>>;
  const ff=filterSql(filters,1);
  const rows=await sql.query(`select m.match_id,m.match_date::text,m.created_at::text,m.formation,m.result,m.my_score,m.opponent_score,
      coalesce(round(avg(r.rating)::numeric,2),0)::float average_rating,coalesce(sum(r.goals),0)::int goals,coalesce(sum(r.assists),0)::int assists
    from matches m left join match_ratings r using(match_id) ${ff.clause}
    group by m.match_id,m.match_date,m.created_at,m.formation,m.result,m.my_score,m.opponent_score order by m.match_date desc,m.created_at desc`,ff.values) as Array<Record<string,number|string|null>>;
  return {positionWindow,formationMatchLimit:FORMATION_ANALYSIS_RECENT_MATCH_LIMIT,
    positions:positionRows.map(r=>({position:String(r.position),appearances:Number(r.appearances),minutes:Number(r.minutes),averageRating:Number(r.average_rating),goals:Number(r.goals),assists:Number(r.assists),wins:Number(r.wins),draws:Number(r.draws),losses:Number(r.losses),insufficientData:Number(r.appearances)<3})),
    formations:calculateFormationAnalytics(rows.map(r=>({matchId:String(r.match_id),matchDate:String(r.match_date),createdAt:String(r.created_at??''),formation:r.formation==null?null:String(r.formation),result:String(r.result) as FormationMatch['result'],myScore:Number(r.my_score),opponentScore:Number(r.opponent_score),averageRating:Number(r.average_rating),goals:Number(r.goals),assists:Number(r.assists)})))};
}
