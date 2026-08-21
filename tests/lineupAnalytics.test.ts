import { describe, expect, it } from 'vitest';
import { calculateFormationAnalytics, type FormationMatch } from '../lib/analytics/lineup-calculations';

function match(index:number,formation:string|null,result:FormationMatch['result']='DRAW'):FormationMatch{return {matchId:String(index),matchDate:`2026-08-${String(index).padStart(2,'0')}`,formation,result,myScore:result==='WIN'?2:result==='LOSE'?0:1,opponentScore:1,averageRating:7,goals:result==='WIN'?2:1,assists:1};}

describe('formation analytics',()=>{
  it('groups before taking the recent sample, preserving a formation scattered outside a global window',()=>{
    const matches:FormationMatch=[];
    for(let i=1;i<=20;i++) matches.push(match(i,[2,9,14].includes(i)?'4-3-3':'4-2-3-1',i===14?'WIN':'DRAW'));
    const rows=calculateFormationAnalytics(matches,10);
    expect(rows.find(row=>row.formation==='4-3-3')).toMatchObject({matches:3,wins:1,draws:2});
    expect(rows.find(row=>row.formation==='4-2-3-1')?.matches).toBe(10);
    expect(calculateFormationAnalytics(matches.slice(-5),10).some(row=>row.formation==='4-3-3')).toBe(false);
  });

  it('uses only the already-filtered season set before grouping',()=>{
    const season2026=[match(1,'4-3-3','WIN'),match(2,'4-3-3','DRAW')];
    const result=calculateFormationAnalytics(season2026,10)[0];
    expect(result).toMatchObject({matches:2,wins:1,draws:1,winRate:50});
  });

  it('warns for one or two matches and safely classifies missing legacy formations',()=>{
    const rows=calculateFormationAnalytics([match(1,null,'WIN'),match(2,'3-5-2','LOSE'),match(3,'3-5-2','DRAW')]);
    expect(rows.find(row=>row.formation==='Chưa phân loại')).toMatchObject({matches:1,insufficientData:true});
    expect(rows.find(row=>row.formation==='3-5-2')).toMatchObject({matches:2,insufficientData:true});
  });

  it('calculates displayed metrics from only the newest matches of that formation',()=>{
    const rows=calculateFormationAnalytics([match(1,'4-3-3','LOSE'),match(2,'4-3-3','WIN'),match(3,'4-3-3','WIN')],2);
    expect(rows[0]).toMatchObject({matches:2,wins:2,losses:0,winRate:100,goals:4,assists:2,goalDifference:2});
  });
});
