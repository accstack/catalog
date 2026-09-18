/* Word Stress Catalog: world bibliography browser.
   Loads data/index.json (one row per language), data/authors.json (author names per language, for search, loaded in the background)
   and data/lang/<glottocode>.json on demand when a language is opened. */
(function(){
'use strict';
const DATA='data/';
const GL=gc=>'https://glottolog.org/resource/languoid/id/'+gc;
const KIND_LABEL={'fixed-strict':'Fixed stress · strict set','fixed-dominant':'Fixed stress · dominant set only','fixed-unreviewed':'Fixed stress (not yet checked against the source)','phrase-lumped':'Fixed stress, word vs phrase not separated','weight':'Weight-sensitive','weight-hedged':'Weight-sensitive (source is tentative)','weight-unreviewed':'Weight-sensitive (not yet checked against the source)','lexical':'Lexical (unpredictable)','morphological':'Set by morphology','variable':'Variable','tonal':'Tone or pitch accent','no-word-stress':'No word stress','phrasal':'Phrase-level only','segmental':'Depends on segments','conflict':'Descriptions disagree','undetermined':'Not determinable from sources','excluded':'Other (see record)','other':'Other','—':'Outside the catalog'};
const KIND_ORDER=Object.keys(KIND_LABEL);
const CAT_LABEL={'in':'Stress recorded','out':'Stress not yet recorded'};
const AUDIT_LABEL={'well-sourced':'Well sourced','adequate':'Adequate','thin':'Thin','at-risk':'At risk','no-stress-source-exists':'No stress source exists','—':'No stress record yet'};
const AUDIT_ORDER=['well-sourced','adequate','thin','at-risk','no-stress-source-exists','—'];
const ACCESS={digital:{label:'Digital',cls:'a-digital',long:'an open copy, a copy the project holds, or a copy behind a university library login'},scan_deliver:{label:'Scan & Deliver',cls:'a-scan',long:'a research library holds a print copy; articles and chapters can usually be obtained as scans through your own library, whole books by interlibrary loan'},print_only:{label:'Print only',cls:'a-print',long:'located (a print copy, or a publisher record behind a paywall), but no open copy and not held by the libraries we checked'},unknown:{label:'Unknown',cls:'a-unknown',long:'not located, or not yet checked'}};
const ACCESS_KEYS=['digital','scan_deliver','print_only','unknown'];
const BEST_LABEL={digital:'At least one digital copy',scan_deliver:'Library print copy, nothing digital',print_only:'Located, print only',unknown:'Nothing located or checked',none:'No works listed'};
const BEST_ORDER=['digital','scan_deliver','print_only','unknown','none'];
const NEW_LABEL={verified:'Found and verified by a second reader',found:'Found, not yet confirmed by a second reader',none:'None'};
const NEW_ORDER=['verified','found','none'];
const WORLD_ORDER=['statement found in an open source','statement found in a copy already on file','statement found in a copy we already had','statement reported second-hand only','a description exists but is not accessible','accessible description is silent on stress','no descriptive source known','not yet read','—'];
const WORLD_LABEL={'—':'Stress already recorded (not read again)','statement found in a copy already on file':'statement found in a copy we already had'};
const SWEEP_ORDER=['new statement read','swept, no new statement','searched; no new statement','not swept','not yet searched','—'];
const SWEEP_LABEL={'swept, no new statement':'read, no new statement','searched; no new statement':'read, no new statement','not swept':'not yet read','not yet searched':'not yet read','—':'No stress-titled works listed'};
const FOUND_BY={'world pass':'found when we read this language\'s sources','our reading':'found when we read this language\'s sources','stress-title sweep':'found among works with stress in the title','works with stress in the title':'found among works with stress in the title','read-everything pass':'found when we read every open source listed for this language'};
/* how a statement relates to what was already on record: the catalog's classification for catalog languages, the earlier statement otherwise; 'new' = the first statement on record. Works silent on stress never appear as statements. */
const RELATION_LABEL={agrees:'agrees with the catalog',refines:'refines the catalog',contradicts:'contradicts the catalog',new:'first statement on record'};
const RELATION_LABEL_OUT={agrees:'agrees with the earlier statement',refines:'refines the earlier statement',contradicts:'contradicts the earlier statement',new:'first statement on record'};
const RELATION_CLS={agrees:'b-confirms',refines:'b-refines',contradicts:'b-contradicts',new:'ok'};
const COLL=new Intl.Collator('en',{sensitivity:'base',numeric:true});
const ORIGIN_LABEL={glottolog:'listed by Glottolog',reader:'found by a reader',scan:'named in an earlier search',database:'from the catalog record'};
const ACTION_LABEL={'no change':'no change','recode':'classification to be revised','identity or merge check':'check whether this is the same language as another entry','cite a better source for the same coding':'a better source should be cited for the same classification','re-read with a listed source':'re-read against a listed source','annotate the record':'add a note to the record'};
const SCAN_LABEL={'source named unreachable':'a source was named but could not be reached','source reachable stress':'a reachable source states the stress pattern','no source found':'no source found'};
const QCHECK_LABEL={'confirmed in the held file':'confirmed in the copy we hold','no file held':'no copy held to check','not found in the held file':'not found in the copy we hold'};
const GROUPS=[
 ['states','States the stress pattern',['states stress (quoted in catalog)','states stress (domain / secondary stress passage)','states stress (new statement, read)'],true],
 ['bears','Read: bears on the catalog\'s classification',['read: confirms the catalog coding','read: refines the catalog coding','read: contradicts the catalog coding'],true],
 ['notes','Read: notes on stress',['read: notes on stress','read (morphology study)'],true],
 ['silent','Read: silent on stress',['read: silent on stress'],true],
 ['consulted','Consulted for the record',['consulted for the record'],true],
 ['wanted','To obtain: likely states the stress pattern',['wanted: likely states stress, not held','likely states stress; not yet obtained'],true],
 ['abstract','Not read: abstract or record only',['not read: abstract or record only'],false],
 ['inacc','Not read: not accessible',['not read: not accessible'],false],
 ['gldesc','Glottolog descriptions, not yet read',['Glottolog description, unread'],false],
 ['glphon','Glottolog phonology works, not yet read',['Glottolog phonology work, unread'],false],
 ['scan','Named in an earlier search, not opened',['named by the earlier scan, not opened','named in our earlier survey, not yet opened'],false],
 ['other','Other',[],false]];
const TAG_SHORT={'states stress (quoted in catalog)':'quoted in the catalog','states stress (domain / secondary stress passage)':'domain or secondary-stress passage','states stress (new statement, read)':'new statement, read','read (morphology study)':'morphology study','read: notes on stress':''};
const $=id=>document.getElementById(id);
function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function linkify(s){ return esc(s).replace(/(https?:\/\/[^\s<)\]]+[^\s<)\].,;])/g,'<a class="ext" href="$1" target="_blank" rel="noopener">$1</a>').replace(/\bdoi:(10\.[^\s<)\],;]+)/g,'<a class="ext" href="https://doi.org/$1" target="_blank" rel="noopener">doi:$1</a>').replace(/\bhdl:([0-9.]+\/[^\s<)\],;]+)/g,'<a class="ext" href="https://hdl.handle.net/$1" target="_blank" rel="noopener">hdl:$1</a>'); }
const fmt=n=>Number(n||0).toLocaleString('en-US');
const plural=(n,w)=>fmt(n)+' '+w+(n===1?'':'s');

let D=[], byGC=new Map(), AUTHORS=null, BUILT='';
const state={q:'',terms:[],cat:new Set(),best:new Set(),newst:new Set(),audit:new Set(),world:new Set(),sweep:new Set(),kind:new Set(),area:new Set(),fam:'',sort:'name',dir:1,page:0,sel:''};
const PAGE=100;
let current=[];

function prep(e){
  e.cat=e.in_catalog?'in':'out';
  e.best=e.n_sources?(e.digital?'digital':e.scan_deliver?'scan_deliver':e.print_only?'print_only':'unknown'):'none';
  e.newst=e.new_statement_verified?'verified':(e.has_new_statement?'found':'none');
  e.auditk=e.in_catalog?(e.audit_status||'—'):'—';
  e.worldk=e.in_catalog?'—':(e.world_status||'—');
  e.sweepk=e.sweep_status||'—';
  e.kindk=e.in_catalog?(e.catalog_kind||'other'):'—';
  e.areak=e.macroarea||'—';
  e.catlabel=e.in_catalog?(KIND_LABEL[e.catalog_kind]||e.catalog_kind):'—';
  e.status=e.in_catalog?(AUDIT_LABEL[e.audit_status]||e.audit_status||''):(e.world_status||'');
  e.n_read=(e.n_read_silent||0)+(e.n_read_other||0);
  e.hay=(e.name+' '+e.glottocode+' '+e.family+' '+e.macroarea).toLowerCase();
}
function reset(){ state.q=''; state.terms=[]; ['cat','best','newst','audit','world','sweep','kind','area'].forEach(k=>state[k]=new Set()); state.fam=''; $('q').value=''; }
function match(e){
  if(state.terms.length){ const h=e.hay+(AUTHORS&&AUTHORS[e.glottocode]?' '+AUTHORS[e.glottocode]:''); for(const t of state.terms) if(!h.includes(t)) return false; }
  if(state.cat.size&&!state.cat.has(e.cat)) return false;
  if(state.best.size&&!state.best.has(e.best)) return false;
  if(state.newst.size&&!state.newst.has(e.newst)) return false;
  if(state.audit.size&&!state.audit.has(e.auditk)) return false;
  if(state.world.size&&!state.world.has(e.worldk)) return false;
  if(state.sweep.size&&!state.sweep.has(e.sweepk)) return false;
  if(state.kind.size&&!state.kind.has(e.kindk)) return false;
  if(state.area.size&&!state.area.has(e.areak)) return false;
  if(state.fam&&e.family!==state.fam) return false;
  return true;
}
function filtered(){ const out=D.filter(match); const k=state.sort, d=state.dir; const q=state.terms.length&&k==='name'?state.q.toLowerCase():''; const nm=e=>q?(e.name.toLowerCase()===q?0:e.name.toLowerCase().includes(q)?1:2):0; /* with a search on, languages whose name matches come before author-only matches */ out.sort((a,b)=>{ const r=nm(a)-nm(b); if(r) return r; const x=a[k]??'', y=b[k]??''; const c=(typeof x==='number'&&typeof y==='number')?(x-y):COLL.compare(String(x),String(y)); return c*d || COLL.compare(a.name,b.name); }); return out; }
const COLS=[['name','Language'],['family','Family'],['catlabel','Stress record'],['status','Status'],['n_sources','Works'],['n_states_stress','What we know'],['digital','Access']];
function renderHead(){ const tr=$('thead'); tr.innerHTML=''; COLS.forEach(([k,l])=>{ const th=document.createElement('th'); th.textContent=l+(state.sort===k?(state.dir>0?' ▲':' ▼'):''); if(state.sort===k) th.className='sorted'; th.onclick=()=>{ if(state.sort===k) state.dir*=-1; else { state.sort=k; state.dir=(k==='n_sources'||k==='n_states_stress'||k==='digital')?-1:1; } state.page=0; render(); }; tr.appendChild(th); }); }
function knowPills(e){ const p=(n,l,c,t)=>n?`<span class="tag ${c}" title="${esc(t)}"><b>${fmt(n)}</b> ${l}</span>`:''; return '<div class="pills">'+p(e.n_states_stress,'state stress','p-states','works that state the stress pattern: quoted in the catalog, or read and found to confirm, refine or contradict it, or a new statement read')+p(e.n_read,'read, no statement','p-read','works read that are silent on stress or carry only a note, plus works consulted for the record')+p(e.n_wanted,'to obtain','p-wanted','works a reader judged likely to state the stress pattern that the project has not yet seen')+p(e.n_unread,'not yet read','p-unread','Glottolog descriptions and phonology works not yet read, works seen only as a record or abstract, works not accessible, works named in an earlier search')+'</div>'; }
function accessPills(e){ const p=k=>e[k]?`<span class="tag ${ACCESS[k].cls}" title="${esc(ACCESS[k].long)}"><b>${fmt(e[k])}</b> ${ACCESS[k].label}</span>`:''; return '<div class="pills">'+ACCESS_KEYS.map(p).join('')+'</div>'; }
function render(){
  current=filtered(); renderHead(); const tb=$('tbody'); tb.innerHTML=''; if(state.page*PAGE>=current.length) state.page=0; const slice=current.slice(state.page*PAGE,state.page*PAGE+PAGE);
  slice.forEach(e=>{ const tr=document.createElement('tr'); if(e.glottocode===state.sel) tr.className='sel';
    tr.innerHTML=`<td class="lang"><span class="nm">${esc(e.name)}</span><a class="gc" href="${GL(e.glottocode)}" target="_blank" rel="noopener" title="Open this language in Glottolog" onclick="event.stopPropagation()">${esc(e.glottocode)}</a></td><td class="fam">${esc(e.family)}${e.macroarea?`<div class="muted">${esc(e.macroarea)}</div>`:''}</td><td>${e.in_catalog?`<span class="tag k-${esc(e.catalog_kind)}">${esc(e.catlabel)}</span>`:'<span class="muted">not yet recorded</span>'}</td><td class="desc">${esc(e.status)}${e.in_catalog&&e.audit_action&&e.audit_action!=='no change'?`<div class="muted">${esc(ACTION_LABEL[e.audit_action]||e.audit_action)}</div>`:''}</td><td class="num">${fmt(e.n_sources)}</td><td>${knowPills(e)}</td><td>${e.n_sources?accessPills(e):'<span class="muted">—</span>'}</td>`;
    tr.onclick=()=>openDrawer(e.glottocode); tb.appendChild(tr); });
  $('empty').hidden=current.length>0; $('count').textContent=fmt(current.length); const works=current.reduce((s,e)=>s+(e.n_sources||0),0); $('countlabel').textContent=`languages · ${plural(works,'work')}`;
  const pg=$('pager'); pg.innerHTML=''; if(current.length>PAGE){ const n=Math.ceil(current.length/PAGE); const prev=document.createElement('button'); prev.textContent='Previous'; prev.disabled=state.page===0; prev.onclick=()=>{state.page--;render();}; const next=document.createElement('button'); next.textContent='Next'; next.disabled=state.page>=n-1; next.onclick=()=>{state.page++;render();}; const lab=document.createElement('span'); lab.textContent=`Page ${state.page+1} of ${n}`; pg.append(prev,lab,next); }
  renderChips(); renderRail();
}
function renderChips(){ const c=$('chips'); c.innerHTML=''; const add=(label,fn)=>{ const s=document.createElement('span'); s.className='chip'; s.innerHTML=esc(label)+' <button aria-label="Remove">×</button>'; s.querySelector('button').onclick=()=>{ fn(); state.page=0; render(); }; c.appendChild(s); };
  if(state.q) add('“'+state.q+'”',()=>{ state.q=''; state.terms=[]; $('q').value=''; });
  state.cat.forEach(k=>add(CAT_LABEL[k],()=>state.cat.delete(k))); state.best.forEach(k=>add('access: '+BEST_LABEL[k],()=>state.best.delete(k))); state.newst.forEach(k=>add('new statement: '+NEW_LABEL[k],()=>state.newst.delete(k))); state.audit.forEach(k=>add('sourcing: '+(AUDIT_LABEL[k]||k),()=>state.audit.delete(k))); state.world.forEach(k=>add('what the readers found: '+(WORLD_LABEL[k]||k),()=>state.world.delete(k))); state.sweep.forEach(k=>add('stress-titled works: '+(SWEEP_LABEL[k]||k),()=>state.sweep.delete(k))); state.kind.forEach(k=>add(KIND_LABEL[k]||k,()=>state.kind.delete(k))); state.area.forEach(k=>add(k,()=>state.area.delete(k))); if(state.fam) add(state.fam,()=>state.fam='');
  $('crit').textContent=c.children.length?'':'no filters — showing every language'; }
function renderRail(){ const rail=$('rail'); const keep=rail.scrollTop; rail.innerHTML='';
  const mk=(title,key,setName,order,labels)=>{ const box=document.createElement('div'); box.className='facet'; box.innerHTML=`<h3>${title}</h3>`; const saved=state[setName]; state[setName]=new Set(); const within=D.filter(match); state[setName]=saved; const counts=new Map(); within.forEach(e=>{ const v=e[key]; counts.set(v,(counts.get(v)||0)+1); }); let keys=[...counts.keys()]; if(order) keys.sort((a,b)=>(order.indexOf(a)<0?99:order.indexOf(a))-(order.indexOf(b)<0?99:order.indexOf(b))); else keys.sort((a,b)=>counts.get(b)-counts.get(a)); const LIM=8; keys.forEach((k,i)=>{ const lab=document.createElement('label'); lab.className='opt'; if(i>=LIM&&!state[setName].has(k)) lab.hidden=true; lab.innerHTML=`<input type="checkbox" ${state[setName].has(k)?'checked':''}> <span>${esc(labels?(labels[k]||k):k)}</span><span class="c">${fmt(counts.get(k))}</span>`; lab.querySelector('input').onchange=ev=>{ if(ev.target.checked) state[setName].add(k); else state[setName].delete(k); state.page=0; render(); }; box.appendChild(lab); }); if(keys.length>LIM){ const m=document.createElement('button'); m.className='more'; m.textContent=`Show all ${keys.length}`; m.onclick=()=>{ box.querySelectorAll('.opt').forEach(x=>x.hidden=false); m.remove(); }; box.appendChild(m); } rail.appendChild(box); };
  mk('Stress record','cat','cat',['in','out'],CAT_LABEL);
  mk('Access to the works listed','best','best',BEST_ORDER,BEST_LABEL);
  mk('New stress statement from our reading','newst','newst',NEW_ORDER,NEW_LABEL);
  mk('How well the record is sourced','auditk','audit',AUDIT_ORDER,AUDIT_LABEL);
  mk('What the readers found (languages without a stress record)','worldk','world',WORLD_ORDER,WORLD_LABEL);
  mk('Works with stress in the title','sweepk','sweep',SWEEP_ORDER,SWEEP_LABEL);
  mk('Catalog classification','kindk','kind',KIND_ORDER,KIND_LABEL);
  mk('Area','areak','area');
  const fb=document.createElement('div'); fb.className='facet'; fb.innerHTML='<h3>Family</h3>'; const sel=document.createElement('select'); const f0=state.fam; state.fam=''; const within=D.filter(match); state.fam=f0; const fams=new Map(); within.forEach(e=>fams.set(e.family||'—',(fams.get(e.family||'—')||0)+1)); const fk=[...fams.keys()].sort((a,b)=>fams.get(b)-fams.get(a)); sel.innerHTML='<option value="">All families</option>'+fk.map(k=>`<option value="${esc(k)}" ${state.fam===k?'selected':''}>${esc(k)} (${fmt(fams.get(k))})</option>`).join(''); sel.onchange=()=>{ state.fam=sel.value; state.page=0; render(); }; fb.appendChild(sel); rail.appendChild(fb);
  rail.scrollTop=keep; }

/* ---- drawer ---- */
const cache=new Map();
function metaHTML(e){ return `<h2>${esc(e.name)}</h2><div class="meta"><a class="ext" href="${GL(e.glottocode)}" target="_blank" rel="noopener" title="Glottolog: classification, location, full bibliography">Glottolog ${esc(e.glottocode)}</a><span>${esc(e.family||'—')}</span><span>${esc(e.macroarea||'—')}</span><span>${e.in_catalog?'in the catalog':'not yet recorded'}</span></div>`; }
function accessLine(c){ return `<div class="pills">${ACCESS_KEYS.map(k=>c[k]?`<span class="tag ${ACCESS[k].cls}" title="${esc(ACCESS[k].long)}"><b>${fmt(c[k])}</b> ${ACCESS[k].label}</span>`:'').join('')}</div>`; }
function stmtHTML(s,inCat){ const ok=!!s.verified; const rel=s.relation&&RELATION_CLS[s.relation]?`<span class="tag ${RELATION_CLS[s.relation]}">${esc((inCat?RELATION_LABEL:RELATION_LABEL_OUT)[s.relation])}</span>`:''; const head=[ok?'<span class="tag ok">Verified by a second reader</span>':`<span class="tag ${/pending/.test(s.check||'')?'muted':'warn'}">${esc(s.check||'second reading pending')}</span>`, rel, s.found_by?esc(FOUND_BY[s.found_by]||('found when we read '+s.found_by)):'' , s.source_kind?esc(s.source_kind):'', s.year?esc(s.year):''].filter(Boolean).join(' · ');
  let h=`<div class="stmt"><div class="head">${head}</div>`; if(s.quote) h+=`<blockquote class="q">${esc(s.quote)}</blockquote>`; if(s.translation) h+=`<div class="tr"><em>Translation</em>${esc(s.translation)}</div>`;
  h+=`<div class="cite">${linkify(s.citation)}${s.locator?' — '+esc(s.locator):''}</div>`;
  if(s.reading) h+=`<div class="reading">Reading: ${esc(s.reading)}</div>`;
  const more=[]; if(s.rule_in_words) more.push('<div><b>Rule in words.</b> '+esc(s.rule_in_words)+'</div>'); if(s.secondary_stress) more.push('<div><b>Secondary stress.</b> '+esc(s.secondary_stress)+'</div>'); if(s.exceptions) more.push('<div><b>Exceptions.</b> '+esc(s.exceptions)+'</div>'); if(s.domain_note) more.push('<div><b>Domain.</b> '+esc(s.domain_note)+'</div>'); if(s.confidence) more.push('<div><b>Reader\'s confidence.</b> '+esc(s.confidence)+'</div>'); if(s.first_reading) more.push('<div><b>First reading, corrected by the second reader.</b> '+esc(s.first_reading)+'</div>'); if(s.identity_note) more.push('<div><b>Which variety.</b> '+esc(s.identity_note)+'</div>'); if(s.relation_note) more.push('<div><b>Compared with the record.</b> '+esc(s.relation_note)+'</div>'); if(s.second_reader_evidence) more.push('<div><b>Second reader.</b> '+esc(s.second_reader_evidence)+'</div>'); if(s.supersedes_catalog_source) more.push('<div><b>Bearing on the catalog.</b> '+esc(s.supersedes_catalog_source)+'</div>');
  if(more.length) h+=`<details class="more"><summary>More on this statement</summary>${more.join('')}</details>`;
  return h+'</div>'; }
function srcHTML(s){ const A=ACCESS[s.access_class]||ACCESS.unknown; const links=[]; if(s.open_url) links.push(`<a class="ext" href="${esc(s.open_url)}" target="_blank" rel="noopener">open copy</a>`); if(s.hollis_url) links.push(`<a class="ext" href="${esc(s.hollis_url)}" target="_blank" rel="noopener">library record</a>`); if(s.doi) links.push(`<a class="ext" href="https://doi.org/${esc(s.doi)}" target="_blank" rel="noopener">DOI</a>`);
  const badges=[]; const short=TAG_SHORT[s.tag]; if(short) badges.push(`<span class="tag muted">${esc(short)}</span>`); if(s.bears&&s.bears!=='new'&&s.bears!=='silent') badges.push(`<span class="tag b-${esc(s.bears)}">${esc(s.bears)} the catalog's classification</span>`); if(s.held) badges.push('copy held by the project');
  const bits=[s.source_kind?esc(s.source_kind):'', s.year?esc(s.year):'', s.language_of_publication?'in '+esc(s.language_of_publication):'', ORIGIN_LABEL[s.origin]||''].filter(Boolean);
  let h=`<li class="src"><div class="cit">${linkify(s.citation)}</div>`;
  h+=`<div class="acc"><span class="tag ${A.cls}" title="${esc(A.long)}">${A.label}</span>${s.access_detail?`<span>${esc(s.access_detail)}</span>`:''}${s.harvard_location&&!(s.access_detail||'').includes(s.harvard_location)?`<span>· ${esc(s.harvard_location)}</span>`:''}${links.length?'<span>· '+links.join(' · ')+'</span>':''}</div>`;
  if(badges.length||bits.length) h+=`<div class="cite">${badges.concat(bits).join(' · ')}</div>`;
  if(s.quote) h+=`<blockquote class="q">${esc(s.quote)}</blockquote>${s.locator?`<div class="cite">${esc(s.locator)}</div>`:''}`;
  if(s.note) h+=`<div class="noteline">${linkify(s.note)}</div>`;
  return h+'</li>'; }
function bibHTML(L){ const srcs=L.sources||[]; if(!srcs.length) return `<h3 class="sec">Bibliography</h3><p class="muted">No works listed for this language.</p>`;
  const byTag=new Map(); srcs.forEach(s=>{ const g=GROUPS.find(x=>x[2].includes(s.tag))||GROUPS[GROUPS.length-1]; if(!byTag.has(g[0])) byTag.set(g[0],[]); byTag.get(g[0]).push(s); });
  let h=`<h3 class="sec">Bibliography <span class="c">${plural(srcs.length,'work')}</span></h3>`;
  GROUPS.forEach(([id,title,,open])=>{ const arr=byTag.get(id); if(!arr) return; h+=`<details class="grp" ${open||arr.length<=6?'open':''}><summary>${esc(title)}<span class="c">${arr.length}</span></summary><ol class="refs">${arr.map(srcHTML).join('')}</ol></details>`; });
  return h; }
function fullHTML(e,L){ const kv=[]; const push=(k,v)=>{ if(v!==undefined&&v!==null&&String(v).trim()!=='') kv.push(`<dt>${k}</dt><dd>${v}</dd>`); };
  if(e.in_catalog){ push('Classification',`<span class="tag k-${esc(e.catalog_kind)}">${esc(e.catlabel)}</span>`);
    const a=L.audit||{}; if(a.status||e.audit_status){ let h=`<b>${esc(AUDIT_LABEL[a.status||e.audit_status]||a.status||e.audit_status)}</b>`; const act=a.action||e.audit_action; if(act) h+=' — '+esc(ACTION_LABEL[act]||act); if(a.second_reader&&a.second_reader!=='not run'&&a.second_reader!=='no second reader') h+=`<div class="cite">second reader: ${esc(a.second_reader)}${a.quote_check?' · quotation check: '+esc(QCHECK_LABEL[a.quote_check]||a.quote_check):''}</div>`; else if(a.quote_check) h+=`<div class="cite">quotation check: ${esc(QCHECK_LABEL[a.quote_check]||a.quote_check)}</div>`; if(a.deciding_source_kind||a.deciding_source_year) h+=`<div class="cite">deciding source: ${esc([a.deciding_source_kind,a.deciding_source_year].filter(Boolean).join(', '))}</div>`; if(a.recode_to) h+=`<div class="cite"><b>Suggested reclassification:</b> ${esc(a.recode_to)}</div>`; if(a.reasoning) h+=`<details class="more"><summary>Reader's reasoning</summary>${esc(a.reasoning)}</details>`; if(a.second_reader_evidence) h+=`<details class="more"><summary>Second reader's evidence</summary>${esc(a.second_reader_evidence)}</details>`; push('Sourcing of the record',h); } }
  else { if(e.world_status) push('What the readers found',esc(WORLD_LABEL[e.world_status]||e.world_status)); const sc=L.earlier_scan||{}; if(sc.verdict||e.scan_verdict){ const sv=sc.verdict||e.scan_verdict; let h=esc(SCAN_LABEL[sv]||sv); if(sc.source_named) h+=`<div class="cite">source named: ${linkify(sc.source_named)}</div>`; if(sc.note) h+=`<div class="cite">${linkify(sc.note)}</div>`; push('Earlier search',h); } }
  if(e.sweep_status){ let h=esc(SWEEP_LABEL[e.sweep_status]||e.sweep_status); if(L.sweep_summary) h+=`<details class="more"><summary>Reader's summary</summary>${esc(L.sweep_summary)}</details>`; push('Stress-titled works',h); }
  const c=L.counts||e; push('Works listed',`<div>${plural(c.n_sources,'work')}${c.n_glottolog_entries?` · Glottolog lists ${plural(c.n_glottolog_entries,'entry').replace('entrys','entries')} of any kind`:''}</div>${c.n_sources?accessLine(c):''}${c.n_sources?`<div class="cite">${fmt(c.n_states_stress)} state the stress pattern · ${fmt((c.n_read_silent||0)+(c.n_read_other||0))} read without a deciding statement · ${fmt(c.n_wanted)} not yet obtained · ${fmt(c.n_unread)} not yet read</div>`:''}`);
  let st=''; if(e.in_catalog&&L.catalog_quote) st+=`<div class="stmt"><div class="head"><span class="tag ok">Quoted in the catalog</span></div><blockquote class="q">${esc(L.catalog_quote)}</blockquote><div class="cite">${linkify(L.catalog_citation||'')}${L.catalog_locator?' — '+esc(L.catalog_locator):''}</div></div>`;
  const ns=(L.new_statements||[]).slice().sort((a,b)=>(b.verified?1:0)-(a.verified?1:0)); ns.forEach(s=>st+=stmtHTML(s,e.in_catalog));
  const stHead=`<h3 class="sec">Stress statements${ns.length?` <span class="c">${ns.filter(s=>s.verified).length} of ${ns.length} new statement${ns.length===1?'':'s'} verified</span>`:''}</h3>`;
  return metaHTML(e)+`<dl class="kv">${kv.join('')}</dl>`+stHead+(st||'<p class="muted">No first-hand stress statement on record for this language.</p>')+bibHTML(L); }
async function openDrawer(gc){ const e=byGC.get(gc); if(!e) return; state.sel=gc; if(location.hash!=='#'+gc) history.replaceState(null,'','#'+gc); document.querySelectorAll('tbody tr').forEach(tr=>tr.classList.remove('sel'));
  const d=$('drawer'), b=$('dbody'); b.innerHTML=metaHTML(e)+(e.best_quote?`<blockquote class="q">${esc(e.best_quote)}</blockquote>`:'')+'<div class="loading">Loading the bibliography…</div>'; d.classList.add('open'); d.setAttribute('aria-hidden','false'); d.scrollTop=0;
  let L=cache.get(gc); if(!L){ try{ const r=await fetch(DATA+'lang/'+gc+'.json'); L=r.ok?await r.json():null; }catch(err){ L=null; } if(L) cache.set(gc,L); }
  if(state.sel!==gc) return;
  b.innerHTML=L?fullHTML(e,L):metaHTML(e)+'<p class="muted">The bibliography file for this language could not be loaded.</p>'; d.scrollTop=0; }
function closeDrawer(){ const d=$('drawer'); d.classList.remove('open'); d.setAttribute('aria-hidden','true'); state.sel=''; if(location.hash) history.replaceState(null,'',location.pathname+location.search); document.querySelectorAll('tbody tr.sel').forEach(tr=>tr.classList.remove('sel')); }
$('dclose').onclick=closeDrawer;
document.addEventListener('keydown',ev=>{ if(ev.key==='Escape'&&$('drawer').classList.contains('open')) closeDrawer(); });
window.addEventListener('hashchange',()=>{ const m=location.hash.match(/^#([a-z0-9]{4}\d{4})$/); if(m&&byGC.has(m[1])&&state.sel!==m[1]) openDrawer(m[1]); });

/* ---- search, filters, CSV ---- */
$('q').oninput=ev=>{ state.q=ev.target.value.trim(); state.terms=state.q.toLowerCase().split(/\s+/).filter(Boolean); state.page=0; render(); };
$('clear').onclick=()=>{ reset(); state.page=0; render(); };
$('filtersbtn').onclick=()=>{ const r=$('rail'); const on=r.classList.toggle('open'); $('filtersbtn').setAttribute('aria-expanded',on?'true':'false'); };
function toCSV(rows){ const base=location.href.split('#')[0]; const cols=[['language',e=>e.name],['glottocode',e=>e.glottocode],['glottolog_url',e=>GL(e.glottocode)],['family',e=>e.family],['macroarea',e=>e.macroarea],['in_catalog',e=>e.in_catalog?'yes':'no'],['catalog_classification',e=>e.in_catalog?(KIND_LABEL[e.catalog_kind]||e.catalog_kind):''],['sourcing',e=>e.in_catalog?(AUDIT_LABEL[e.audit_status]||e.audit_status||''):''],['sourcing_action',e=>ACTION_LABEL[e.audit_action]||e.audit_action||''],['reader_outcome',e=>WORLD_LABEL[e.world_status]||e.world_status||''],['stress_titled_works',e=>SWEEP_LABEL[e.sweep_status]||e.sweep_status||''],['earlier_search',e=>SCAN_LABEL[e.scan_verdict]||e.scan_verdict||''],['works_listed',e=>e.n_sources],['states_stress',e=>e.n_states_stress],['read_silent',e=>e.n_read_silent],['read_other',e=>e.n_read_other],['to_obtain',e=>e.n_wanted],['not_yet_read',e=>e.n_unread],['digital',e=>e.digital],['library_print',e=>e.scan_deliver],['print_only',e=>e.print_only],['unknown',e=>e.unknown],['best_access',e=>BEST_LABEL[e.best]],['glottolog_entries',e=>e.n_glottolog_entries],['new_statement',e=>e.has_new_statement?'yes':'no'],['new_statement_verified',e=>e.new_statement_verified?'yes':'no'],['deciding_quotation',e=>e.best_quote],['bibliography_url',e=>base+'#'+e.glottocode]]; const q=v=>{ const s=String(v??''); return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }; return cols.map(c=>c[0]).join(',')+'\n'+rows.map(e=>cols.map(c=>q(c[1](e))).join(',')).join('\n'); }
$('savecsv').onclick=()=>{ const blob=new Blob([toCSV(current)],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`word-stress-bibliography-${current.length}.csv`; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500); };

/* ---- load ---- */
function legend(){ const inC=D.filter(e=>e.in_catalog).length, outC=D.length-inC, works=D.reduce((s,e)=>s+(e.n_sources||0),0), verified=D.filter(e=>e.new_statement_verified).length;
  $('legend').innerHTML=`<b>How to read this.</b> One row per language: the ${fmt(inC)} languages whose stress pattern is recorded in the catalog and ${fmt(outC)} whose stress is not yet recorded (their bibliography is here; the readers are working through their bibliographies), with every work that describes, or could describe, the language's word stress — ${plural(works,'work')} in all. Click a language for the stress statements found in its sources and the full list of works, grouped by what we know about each. <b>Read</b> means a reader opened the text and reported what it says about stress; <b>verified</b> means a second reader found the quoted passage at the stated page (${fmt(verified)} languages have a verified new statement so far). <b>To obtain</b> works are ones a reader judged likely to state the stress pattern that the project has not yet seen. How a copy can be had, per work: <b>Digital</b> — an open copy, a copy the project holds, or a copy behind a university library login; <b>Scan &amp; Deliver</b> — a research library holds a print copy (articles and chapters can usually be obtained as scans through your own library; whole books by interlibrary loan); <b>Print only</b> — located (a print copy, or a publisher record behind a paywall), but no open copy and not held by the libraries we checked; <b>Unknown</b> — not located, or not yet checked. Search matches language names, glottocodes, families and the authors of the works listed.`;
  $('edition').textContent=`Bibliography · ${fmt(D.length)} languages · ${plural(works,'work')}${BUILT?' · updated '+BUILT.slice(0,10):''}`;
  $('provnote').textContent=`Works come from Glottolog 5.1's bibliography for each language, from the catalog's own records and from the readers' reports; access was checked against a research library catalogue, HathiTrust, the Internet Archive and open-access indexes; the classes describe copies, not one institution, and a print copy can be had through your own library by scan request or interlibrary loan. Works are matched across those lists by first author, year and title, so a citation copied differently may appear twice. Access classes for works whose access has not yet been checked are 'unknown' unless Glottolog records an open link.${BUILT?' Data updated '+BUILT.replace('T',' ').replace('Z',' UTC')+'.':''} Corrections: open an issue at github.com/mattschwartzscience/word-stress-catalog.`; }
async function load(){ try{ const r=await fetch(DATA+'index.json'); if(!r.ok) throw new Error(r.status); D=await r.json(); }catch(err){ $('crit').textContent='The bibliography index could not be loaded.'; return; }
  D.forEach(prep); byGC=new Map(D.map(e=>[e.glottocode,e]));
  try{ const r=await fetch(DATA+'summary.json'); if(r.ok){ const s=await r.json(); BUILT=s.built||''; } }catch(err){}
  legend(); reset(); render();
  const m=location.hash.match(/^#([a-z0-9]{4}\d{4})$/); if(m&&byGC.has(m[1])) openDrawer(m[1]);
  fetch(DATA+'authors.json').then(r=>r.ok?r.json():null).then(a=>{ if(a){ AUTHORS=a; if(state.terms.length) render(); } }).catch(()=>{}); }
load();
})();
