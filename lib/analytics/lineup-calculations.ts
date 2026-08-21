export const FORMATION_ANALYSIS_RECENT_MATCH_LIMIT = 10;
export const FORMATION_SMALL_SAMPLE_THRESHOLD = 3;
export const UNCLASSIFIED_FORMATION = 'Chưa phân loại';

export type FormationMatch = { matchId:string; matchDate:string; createdAt?:string; formation?:string|null; result:'WIN'|'DRAW'|'LOSE'; myScore:number; opponentScore:number; averageRating:number; goals:number; assists:number };
export type FormationAnalyticsRow = { formation:string; matches:number; wins:number; draws:number; losses:number; winRate:number; averageRating:number; goals:number; assists:number; goalDifference:number; insufficientData:boolean };

/** Group first, then independently take the newest N matches of every formation. */
export function calculateFormationAnalytics(matches: FormationMatch[], limit = FORMATION_ANALYSIS_RECENT_MATCH_LIMIT): FormationAnalyticsRow[] {
  const groups = new Map<string, FormationMatch[]>();
  for (const match of matches) { const name=match.formation?.trim()||UNCLASSIFIED_FORMATION; groups.set(name,[...(groups.get(name)??[]),match]); }
  return [...groups.entries()].map(([formation,group])=>{
    const used=group.sort((a,b)=>`${b.matchDate}|${b.createdAt??''}`.localeCompare(`${a.matchDate}|${a.createdAt??''}`)).slice(0,limit);
    const wins=used.filter(m=>m.result==='WIN').length,draws=used.filter(m=>m.result==='DRAW').length,losses=used.filter(m=>m.result==='LOSE').length;
    const rated=used.filter(m=>Number.isFinite(m.averageRating)&&m.averageRating>0);
    return {formation,matches:used.length,wins,draws,losses,winRate:used.length?Number((wins/used.length*100).toFixed(1)):0,
      averageRating:rated.length?Number((rated.reduce((s,m)=>s+m.averageRating,0)/rated.length).toFixed(2)):0,
      goals:used.reduce((s,m)=>s+m.goals,0),assists:used.reduce((s,m)=>s+m.assists,0),goalDifference:used.reduce((s,m)=>s+m.myScore-m.opponentScore,0),
      insufficientData:used.length<FORMATION_SMALL_SAMPLE_THRESHOLD};
  }).sort((a,b)=>b.matches-a.matches||a.formation.localeCompare(b.formation,'vi'));
}
