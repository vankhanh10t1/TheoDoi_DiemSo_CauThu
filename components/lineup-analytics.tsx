'use client';
import { useEffect, useState } from 'react';
import type { LineupAnalytics as Data } from '../lib/analytics/lineup';

const EMPTY_FILTERS={season:'',competition:'',matchType:'',dateFrom:'',dateTo:''};

export function LineupAnalytics(){
  const [positionWindow,setPositionWindow]=useState<5|10|20>(10),[filters,setFilters]=useState(EMPTY_FILTERS);
  const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{const query=new URLSearchParams({window:String(positionWindow)});Object.entries(filters).forEach(([key,value])=>{if(value)query.set(key,value)});
    setLoading(true);setError('');fetch(`/api/analytics/lineup?${query}`).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error);setData(body)}).catch(e=>setError(e.message)).finally(()=>setLoading(false));
  },[positionWindow,filters]);
  const change=(key:keyof typeof filters,value:string)=>setFilters(current=>({...current,[key]:value}));
  return <section className="screen-panel">
    <div className="screen-header"><div><p className="panel-kicker">Lineup intelligence</p><h2>Hiệu quả đội hình</h2></div></div>
    <div className="panel match-history-filters">
      <label>Mùa giải<input value={filters.season} maxLength={80} onChange={e=>change('season',e.target.value)} placeholder="2026-S1"/></label>
      <label>Giải đấu<input value={filters.competition} maxLength={80} onChange={e=>change('competition',e.target.value)} placeholder="FVPL"/></label>
      <label>Loại trận<select value={filters.matchType} onChange={e=>change('matchType',e.target.value)}><option value="">Tất cả</option><option value="FRIENDLY">Giao hữu</option><option value="LEAGUE">Giải đấu</option><option value="CUP">Cúp</option><option value="RANKED">Xếp hạng</option><option value="TRAINING">Tập luyện</option></select></label>
      <label>Từ ngày<input type="date" value={filters.dateFrom} onChange={e=>change('dateFrom',e.target.value)}/></label><label>Đến ngày<input type="date" value={filters.dateTo} onChange={e=>change('dateTo',e.target.value)}/></label>
      <button className="secondary-button" onClick={()=>setFilters(EMPTY_FILTERS)}>Đặt lại</button>
    </div>
    {loading?<div className="panel tracking-state">Đang tải phân tích...</div>:error?<div className="panel inline-message error">{error}</div>:<>
      <article className="panel"><div className="screen-header"><h3>Theo vị trí</h3><label>Cửa sổ chung <select value={positionWindow} onChange={e=>setPositionWindow(Number(e.target.value) as 5|10|20)}><option>5</option><option>10</option><option>20</option></select> trận</label></div>
        {data?.positions.length?<div className="analysis-table-wrap"><table className="analysis-table"><thead><tr><th>Vị trí</th><th>Lượt</th><th>Phút</th><th>Rating TB</th><th>Bàn/KT</th><th>T-H-B</th></tr></thead><tbody>{data.positions.map(row=><tr key={row.position}><td><strong>{row.position}</strong>{row.insufficientData&&<small>Dữ liệu còn ít, chỉ nên tham khảo.</small>}</td><td>{row.appearances}</td><td>{row.minutes}</td><td>{row.averageRating.toFixed(2)}</td><td>{row.goals}/{row.assists}</td><td>{row.wins}-{row.draws}-{row.losses}</td></tr>)}</tbody></table></div>:<p className="tracking-state">Chưa có dữ liệu vị trí trong tập đã lọc.</p>}
      </article>
      <article className="panel"><h3>Theo sơ đồ - các trận gần nhất của từng sơ đồ</h3><p className="panel-subtitle">Hiệu quả được tính riêng trên tối đa {data?.formationMatchLimit??10} trận gần nhất có dùng từng sơ đồ, không phụ thuộc cửa sổ chung.</p>
        {data?.formations.length?<div className="analysis-table-wrap"><table className="analysis-table"><thead><tr><th>Sơ đồ</th><th>Trận dùng</th><th>T-H-B</th><th>Tỷ lệ thắng</th><th>Rating TB</th><th>Bàn/KT</th><th>Hiệu số</th></tr></thead><tbody>{data.formations.map(row=><tr key={row.formation}><td><strong>{row.formation}</strong>{row.insufficientData&&<small>Dữ liệu còn ít, chỉ nên tham khảo.</small>}</td><td>{row.matches}</td><td>{row.wins}-{row.draws}-{row.losses}</td><td>{row.winRate.toFixed(1)}%</td><td>{row.averageRating?row.averageRating.toFixed(2):'—'}</td><td>{row.goals}/{row.assists}</td><td>{row.goalDifference>0?'+':''}{row.goalDifference}</td></tr>)}</tbody></table></div>:<p className="tracking-state">Chưa có dữ liệu sơ đồ trong tập đã lọc.</p>}
      </article></>}
  </section>;
}
