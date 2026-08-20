'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { DetailedPosition, Match, PlayerMatchRatingDetail, PlayerSummary, PositionGroup } from '../lib/types';
import { useAppContext } from './app-context';
import { fetchWithDebug } from '../lib/client-api';
import { formatMatchDateValue } from '../lib/match-history';
import { ConfirmationDialog } from './confirmation-dialog';

const MAX_RATINGS = 49;
const GROUPS: PositionGroup[] = ['GK', 'DF', 'MF', 'FW'];
const POSITION_GROUP: Record<string, PositionGroup> = { GK:'GK', CB:'DF', LB:'DF', LWB:'DF', RB:'DF', RWB:'DF', CDM:'MF', CM:'MF', CAM:'MF', LM:'MF', RM:'MF', ST:'FW', CF:'FW', LW:'FW', RW:'FW' };
type Step = 1 | 2 | 3;
type Notice = { type: 'success' | 'error' | 'info'; text: string };
type Row = { playerId:string; name:string; cardSeason:string; position:string; positionGroup:PositionGroup; participating:boolean; rating:string; yellowCards:number; redCards:number; fouls:number; goals:number; assists:number; note:string };
type Draft = { version:1; matchId:string; savedAt:string; step:Step; rows:Row[] };
interface Props { match:Match; initialRatings?:PlayerMatchRatingDetail[]; mode?:'create'|'edit'; onRatingsSaved?:(result:{created:number;updated:number})=>void; onCancel?:()=>void }

const positionGroup = (value:unknown):PositionGroup => POSITION_GROUP[typeof value === 'string' ? value.trim().toUpperCase() : ''] ?? 'FW';
const playerName = (player:PlayerSummary) => player.name?.trim() || player.playerId;
const emptyRow = (player:PlayerSummary|Row):Row => ({ playerId:player.playerId, name:playerName(player), cardSeason:player.cardSeason??'', position:player.position??'', positionGroup:positionGroup(player.position), participating:false, rating:'', yellowCards:0, redCards:0, fouls:0, goals:0, assists:0, note:'' });
const keyFor = (matchId:string) => `fcon:rating-draft:${matchId}`;
const isValidRating = (value:string) => { const n=Number(value); return value.trim()!=='' && Number.isFinite(n) && n>=1 && n<=10 && Math.abs(n*10-Math.round(n*10))<1e-9; };

export default function BulkRatingInputForm({ match, initialRatings=[], mode='create', onRatingsSaved, onCancel }:Props) {
  const { players, playersError, loadPlayers } = useAppContext();
  const [rows,setRows]=useState<Row[]>([]), [step,setStep]=useState<Step>(1), [search,setSearch]=useState('');
  const [loading,setLoading]=useState(false), [copying,setCopying]=useState(false), [notice,setNotice]=useState<Notice|null>(null);
  const [savedDraft,setSavedDraft]=useState<Draft|null>(null), [copyCandidate,setCopyCandidate]=useState<string[]|null>(null);
  const initialized=useRef(false), submitting=useRef(false);

  useEffect(()=>{ if(!players.length&&!playersError) void loadPlayers(); },[players.length,playersError,loadPlayers]);
  useEffect(()=>{
    if(!players.length||initialized.current)return;
    const existing=new Map(initialRatings.map(r=>[r.playerId.toLowerCase(),r]));
    const sorted=[...players].sort((a,b)=>GROUPS.indexOf(positionGroup(a.position))-GROUPS.indexOf(positionGroup(b.position))||playerName(a).localeCompare(playerName(b),'vi'));
    setRows(sorted.map(player=>{const base=emptyRow(player), saved=existing.get(player.playerId.toLowerCase()); return saved?{...base,participating:true,rating:String(saved.rating),position:saved.position??base.position,yellowCards:saved.yellowCards??0,redCards:saved.redCards??0,fouls:saved.fouls??0,goals:saved.goals??0,assists:saved.assists??0,note:saved.note??''}:base;}));
    initialized.current=true;
    if(mode==='edit'&&initialRatings.length)setStep(2);
    if(mode==='create')try{const raw=localStorage.getItem(keyFor(match.id)), parsed=raw?JSON.parse(raw) as Draft:null;if(parsed?.version===1&&parsed.matchId===match.id&&Array.isArray(parsed.rows))setSavedDraft(parsed);}catch{}
  },[players,initialRatings,match.id,mode]);
  useEffect(()=>{if(!initialized.current||mode==='edit'||!rows.length||savedDraft)return;const timer=window.setTimeout(()=>{try{localStorage.setItem(keyFor(match.id),JSON.stringify({version:1,matchId:match.id,savedAt:new Date().toISOString(),step,rows} satisfies Draft));}catch{}},400);return()=>window.clearTimeout(timer);},[rows,step,match.id,mode,savedDraft]);

  const selected=useMemo(()=>rows.filter(r=>r.participating),[rows]), missing=selected.filter(r=>!isValidRating(r.rating));
  const visible=rows.filter(r=>`${r.name} ${r.cardSeason} ${r.position}`.toLowerCase().includes(search.trim().toLowerCase()));
  const update=(id:string,patch:Partial<Row>)=>setRows(old=>old.map(r=>r.playerId===id?{...r,...patch}:r));
  const numberUpdate=(id:string,k:'yellowCards'|'redCards'|'fouls'|'goals'|'assists',v:string)=>update(id,{[k]:Math.max(0,parseInt(v,10)||0)});
  const removeDraft=()=>{try{localStorage.removeItem(keyFor(match.id));}catch{}setSavedDraft(null);};
  const restoreDraft=()=>{if(!savedDraft)return;const saved=new Map(savedDraft.rows.map(r=>[r.playerId.toLowerCase(),r]));setRows(old=>old.map(r=>saved.get(r.playerId.toLowerCase())??r));setStep(savedDraft.step);setSavedDraft(null);setNotice({type:'success',text:'Đã khôi phục bản nháp.'});};
  const reset=()=>{setRows(old=>old.map(emptyRow));setStep(1);removeDraft();setNotice({type:'info',text:'Đã xóa dữ liệu nhập và bản nháp.'});};
  const applyLineup=(ids:string[])=>{const lineup=new Set(ids.map(id=>id.toLowerCase()));setRows(old=>old.map(r=>({...r,participating:lineup.has(r.playerId.toLowerCase()),rating:'',yellowCards:0,redCards:0,fouls:0,goals:0,assists:0,note:''})));setCopyCandidate(null);setNotice({type:'success',text:`Đã sao chép ${ids.length} cầu thủ; không sao chép rating và chỉ số.`});};
  async function copyLineup(){setCopying(true);setNotice(null);try{const response=await fetchWithDebug('/api/matches?page=1&pageSize=100&sortBy=date&sortOrder=desc',undefined,{caller:'BulkRatingInputForm.copyLineup'}),data=await response.json();if(!response.ok)throw new Error(data.error);const candidates=((data.items??data.matches??[]) as Match[]).filter(m=>m.id!==match.id&&(m.ratingCount??0)>0);let ids:string[]=[];for(const candidate of candidates){const detail=await fetchWithDebug(`/api/matches/${candidate.id}/ratings`,undefined,{caller:'BulkRatingInputForm.copyLineupDetail'}),body=await detail.json();if(detail.ok&&body.ratings?.length){ids=body.ratings.map((r:PlayerMatchRatingDetail)=>r.playerId);break;}}if(!ids.length){setNotice({type:'info',text:'Chưa có trận trước đó chứa đội hình để sao chép.'});return;}const hasInput=selected.some(r=>r.rating||r.goals||r.assists||r.yellowCards||r.redCards||r.fouls||r.note);hasInput?setCopyCandidate(ids):applyLineup(ids);}catch(error){setNotice({type:'error',text:error instanceof Error?error.message:'Không thể tải đội hình gần nhất.'});}finally{setCopying(false);}}
  async function submit(){if(submitting.current||!selected.length||selected.length>MAX_RATINGS||missing.length)return;submitting.current=true;setLoading(true);setNotice(null);try{const response=await fetchWithDebug(`/api/matches/${match.id}/ratings`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ratings:selected.map(r=>({playerId:r.playerId,rating:Number(r.rating),position:r.position as DetailedPosition,yellowCards:r.yellowCards,redCards:r.redCards,fouls:r.fouls,goals:r.goals,assists:r.assists,note:r.note.trim()||undefined}))})},{caller:'BulkRatingInputForm.submit'}),data=await response.json();if(!response.ok)throw new Error(data.error||'Không thể lưu đánh giá. Vui lòng thử lại.');removeDraft();setNotice({type:'success',text:data.message||`Đã lưu ${data.created+data.updated} đánh giá.`});onRatingsSaved?.({created:data.created,updated:data.updated});}catch(error){setNotice({type:'error',text:error instanceof Error?error.message:'Không thể lưu đánh giá. Vui lòng thử lại.'});}finally{setLoading(false);submitting.current=false;}}

  if(!players.length&&!playersError)return <div className="inline-message">Đang tải danh sách cầu thủ...</div>;
  if(playersError)return <div className="inline-message error">{playersError}</div>;
  return <div className="rating-wizard">
    <div className="rating-wizard-heading"><div><p className="panel-kicker">{mode==='edit'?'Chỉnh sửa đánh giá':'Nhập đánh giá'}</p><h3>{formatMatchDateValue(match)} · {match.opponentName||'Không rõ đối thủ'}</h3></div><span className="player-pill">{selected.length}/{MAX_RATINGS} cầu thủ</span></div>
    <ol className="rating-steps">{['Chọn cầu thủ','Nhập chỉ số','Xác nhận'].map((label,index)=><li key={label} className={step===index+1?'active':step>index+1?'done':''}><span>{index+1}</span>{label}</li>)}</ol>
    <p className={`rating-limit ${selected.length>=45?'warning':''}`}>Tối đa 49 cầu thủ/rating cho mỗi lần lưu.{selected.length>=45?` Bạn còn ${MAX_RATINGS-selected.length} vị trí.`:''}</p>
    {notice&&<div className={`inline-message ${notice.type}`}>{notice.text}</div>}
    {savedDraft&&<div className="draft-banner"><div><strong>Tìm thấy bản nháp</strong><span>Lưu lúc {new Date(savedDraft.savedAt).toLocaleString('vi-VN')}.</span></div><button className="primary-button" onClick={restoreDraft}>Khôi phục</button><button className="tertiary-button" onClick={()=>{removeDraft();setNotice({type:'info',text:'Đã xóa bản nháp.'});}}>Xóa</button></div>}
    {step===1&&<section className="rating-step-panel"><div className="rating-toolbar"><input aria-label="Tìm cầu thủ" placeholder="Tìm tên, mùa thẻ hoặc vị trí..." value={search} onChange={e=>setSearch(e.target.value)}/><button className="secondary-button" onClick={()=>setRows(old=>old.map(r=>({...r,participating:true})))}>Chọn tất cả</button><button className="tertiary-button" onClick={()=>setRows(old=>old.map(r=>({...r,participating:false})))}>Bỏ chọn tất cả</button><button className="secondary-button" onClick={()=>void copyLineup()} disabled={copying}>{copying?'Đang tải...':'Copy đội hình trận gần nhất'}</button></div><div className="player-picker">{visible.length?visible.map(r=><label key={r.playerId} className={r.participating?'selected':''}><input type="checkbox" checked={r.participating} onChange={e=>update(r.playerId,{participating:e.target.checked})}/><span><strong>{r.name}</strong><small>{r.cardSeason||'Không có mùa thẻ'} · {r.position||'N/A'}</small></span></label>):<p className="tracking-state">Không tìm thấy cầu thủ phù hợp.</p>}</div></section>}
    {step===2&&<section className="rating-step-panel"><div className="rating-entry-list">{selected.map(r=><article key={r.playerId} className={`rating-entry-card ${!isValidRating(r.rating)?'invalid':''}`}><div className="rating-entry-player"><div><strong>{r.name}</strong><span>{r.cardSeason} · {r.position}</span></div>{!isValidRating(r.rating)&&<em>Chưa nhập rating hợp lệ</em>}</div><div className="rating-field-grid"><label>Rating *<input type="number" min="1" max="10" step="0.1" value={r.rating} onChange={e=>update(r.playerId,{rating:e.target.value})} placeholder="1–10"/></label>{([['goals','Bàn thắng'],['assists','Kiến tạo'],['yellowCards','Thẻ vàng'],['redCards','Thẻ đỏ'],['fouls','Lỗi']] as const).map(([k,label])=><label key={k}>{label}<input type="number" min="0" step="1" value={r[k]} onChange={e=>numberUpdate(r.playerId,k,e.target.value)}/></label>)}<label className="rating-note-field">Ghi chú<input value={r.note} maxLength={500} onChange={e=>update(r.playerId,{note:e.target.value})} placeholder="Không bắt buộc"/></label></div></article>)}</div>{missing.length>0&&<p className="inline-message error">Còn {missing.length} cầu thủ chưa có rating hợp lệ từ 1 đến 10 (tối đa 1 chữ số thập phân).</p>}</section>}
    {step===3&&<section className="rating-step-panel"><div className="rating-review"><table><thead><tr><th>Cầu thủ</th><th>Rating</th><th>Bàn</th><th>Kiến tạo</th><th>Thẻ</th><th>Lỗi</th><th>Ghi chú</th></tr></thead><tbody>{selected.map(r=><tr key={r.playerId} className={!isValidRating(r.rating)?'invalid':''}><td><strong>{r.name}</strong><small>{r.position}</small></td><td>{r.rating||'Thiếu'}</td><td>{r.goals}</td><td>{r.assists}</td><td>{r.yellowCards}V · {r.redCards}Đ</td><td>{r.fouls}</td><td>{r.note||'—'}</td></tr>)}</tbody></table></div>{missing.length>0&&<p className="inline-message error">Không thể lưu: còn {missing.length} rating thiếu hoặc không hợp lệ.</p>}</section>}
    <div className="rating-wizard-actions">{step>1&&<button className="secondary-button" onClick={()=>setStep((step-1) as Step)} disabled={loading}>Quay lại</button>}{step<3&&<button className="primary-button" onClick={()=>setStep((step+1) as Step)} disabled={!selected.length||selected.length>MAX_RATINGS||(step===2&&missing.length>0)}>Tiếp tục</button>}{step===3&&<button className="primary-button" onClick={()=>void submit()} disabled={loading||selected.length>MAX_RATINGS||missing.length>0}>{loading?'Đang lưu...':mode==='edit'?'Lưu thay đổi':'Xác nhận và lưu'}</button>}<button className="tertiary-button" onClick={reset} disabled={loading}>Xóa dữ liệu nhập</button>{onCancel&&<button className="tertiary-button" onClick={onCancel} disabled={loading}>Hủy</button>}</div>
    <ConfirmationDialog open={Boolean(copyCandidate)} title="Thay đội hình đang nhập?" description="Đội hình gần nhất sẽ thay danh sách đang chọn và xóa các chỉ số đang nhập. Rating và chỉ số trận cũ không được sao chép." confirmLabel="Thay đội hình" onCancel={()=>setCopyCandidate(null)} onConfirm={()=>copyCandidate&&applyLineup(copyCandidate)}/>
  </div>;
}
