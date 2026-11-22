import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPutJson } from '../../api/client';
import styles from './LaskaPlanTargets.module.css';

type Metric = 'grn'|'kg'|'pcs'|'tt'|'tt_from_x'|'tt_from_kg'|'tt_from_pcs'|'tt_from_sku'|'total_sku';
type Plan = {id:string;label:string;metric:Metric;threshold:number;brand:string;displayOrder:number;agentPlans:Record<string,number>};
type Agent = {name:string;department:string};
const endpoint='/api/laska/plan-targets';
const metrics:Record<Metric,string>={grn:'Сума, грн',kg:'Вага, кг',pcs:'Кількість, шт',tt:'Активні ТТ',tt_from_x:'ТТ від суми, грн',tt_from_kg:'ТТ від ваги, кг',tt_from_pcs:'ТТ від кількості, шт',tt_from_sku:'ТТ від SKU',total_sku:'SKU'};
export default function LaskaPlanTargets({onBack,canEdit}:{onBack:()=>void;canEdit:boolean}){
 const client=useQueryClient();
 const plans=useQuery({queryKey:['laska-plan-targets'],queryFn:({signal})=>apiGet<{rows:Plan[]}>(endpoint,{authenticated:true,signal}),staleTime:60000});
 const agents=useQuery({queryKey:['laska-plan-agents'],queryFn:({signal})=>apiGet<{rows:Agent[]}>(endpoint+'/agents',{authenticated:true,signal}),enabled:canEdit,staleTime:300000});
 const [draft,setDraft]=useState<Plan[]>([]);
 const [dirty,setDirty]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 useEffect(()=>{if(!dirty && plans.data) setDraft(plans.data.rows);},[plans.data,dirty]);
 const groups=useMemo(()=>Object.entries((agents.data?.rows??[]).reduce<Record<string,string[]>>((acc,a)=>{(acc[a.department||'Без відділу']??=[]).push(a.name);return acc;},{})),[agents.data]);
 function update(id:string,patch:Partial<Plan>){setDirty(true);setDraft(rows=>rows.map(row=>row.id===id?{...row,...patch}:row));}
 function add(){setDirty(true);setDraft(rows=>[...rows,{id:crypto.randomUUID(),label:'Новий показник',metric:'tt_from_x',threshold:5000,brand:'',displayOrder:rows.length+1,agentPlans:{}}]);}
 async function save(){setBusy(true);setMessage('');try{await apiPutJson(endpoint,draft.map((row,index)=>({...row,displayOrder:index+1})),{authenticated:true,tenant:'laska'});setDirty(false);await client.invalidateQueries({queryKey:['laska-plan-targets']});setMessage('Плани збережено в Neon LASKA.');}catch(e){setMessage(e instanceof Error?e.message:'Помилка збереження');}finally{setBusy(false);}}
 return <section className={styles.page}>
 <header className={styles.header}><button type="button" onClick={onBack}>← Назад</button><h1>Планові показники · LASKA</h1></header>
 <p className={styles.note}>Плани LASKA зберігаються окремо від OLGATORG. Тут задаються планові цілі. Автоматичне порівняння з фактичними продажами ще не реалізовано.</p>
 {plans.isLoading&&<p>Завантаження…</p>}{plans.isError&&<p role="alert">Не вдалося отримати плани. <button onClick={()=>void plans.refetch()}>Повторити</button></p>}
 {canEdit&&<div className={styles.actions}><button type="button" onClick={add}>+ Додати показник</button><button type="button" disabled={!dirty||busy} onClick={()=>void save()}>{busy?'Зберігаємо…':'Зберегти всі'}</button></div>}
 {message&&<p role="status">{message}</p>}
 {draft.map(row=><article key={row.id} className={styles.card}>
  <div className={styles.fields}><label>Назва<input value={row.label} disabled={!canEdit} maxLength={160} onChange={e=>update(row.id,{label:e.target.value})}/></label>
  <label>Показник<select disabled={!canEdit} value={row.metric} onChange={e=>update(row.id,{metric:e.target.value as Metric})}>{Object.entries(metrics).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
  <label>Поріг<input type="number" min="0" disabled={!canEdit} value={row.threshold} onChange={e=>update(row.id,{threshold:Math.max(0,Number(e.target.value)||0)})}/></label>
  <label>ТМ / бренд<input value={row.brand} disabled={!canEdit} placeholder="Усі ТМ" onChange={e=>update(row.id,{brand:e.target.value})}/></label></div>
  {canEdit?groups.map(([department,names])=><div key={department}><h3>{department}</h3><div className={styles.agents}>{names.map(name=><label key={name}>{name}<input type="number" min="0" value={row.agentPlans[name]??0} onChange={e=>update(row.id,{agentPlans:{...row.agentPlans,[name]:Math.max(0,Number(e.target.value)||0)}})}/></label>)}</div></div>)
  :<div className={styles.agents}>{Object.entries(row.agentPlans).map(([name,value])=><p key={name}>{name}: <strong>{value}</strong></p>)}</div>}
  {canEdit&&<button type="button" className={styles.danger} onClick={()=>{setDirty(true);setDraft(rows=>rows.filter(p=>p.id!==row.id));}}>Видалити показник</button>}
 </article>)}
 {!plans.isLoading&&!draft.length&&<p>Планових показників ще немає.</p>}
 </section>;
}
