/* Word Stress Catalog: world bibliography browser.
   Loads data/index.json (one row per language), data/authors.json (author names per language, for search, loaded in the background)
   and data/lang/<glottocode>.json on demand when a language is opened. */
(function(){
'use strict';
const DATA='data/';
const GL=gc=>'https://glottolog.org/resource/languoid/id/'+gc;
const KIND_LABEL={'fixed':'Fixed stress','fixed-strict':'Fixed stress','fixed-dominant':'Fixed stress','fixed-unreviewed':'Fixed stress','phrase-lumped':'Fixed stress (word and phrase not distinguished)','weight':'Weight-sensitive','weight-hedged':'Weight-sensitive (tentative)','weight-unreviewed':'Weight-sensitive','lexical':'Lexical (unpredictable)','morphological':'Set by morphology','variable':'Variable','tonal':'Tone or pitch accent','no-word-stress':'No word stress','phrasal':'Phrase-level only','segmental':'Depends on segments','conflict':'Sources conflict (unresolved)','undetermined':'Not determinable','excluded':'Other (see entry)','other':'Other','—':'Not in the catalog'};
/* classification keys that share a label are shown as one facet option */
const KIND_ALIAS={'fixed-strict':'fixed','fixed-dominant':'fixed','fixed-unreviewed':'fixed','weight-unreviewed':'weight'};
const KIND_ORDER=Object.keys(KIND_LABEL);
const CAT_LABEL={'in':'In the catalog','out':'Not in the catalog'};
/* source assessment of a catalog entry (how well the classification is supported by the works cited); entries without one carry a confidence level only */
const AUDIT_LABEL={'well-sourced':'Well sourced','adequate':'Adequate','thin':'Thin','at-risk':'Weak','no-stress-source-exists':'No source on stress exists','later':'not assessed; see confidence level','—':'Not in the catalog'};
const AUDIT_ORDER=['well-sourced','adequate','thin','at-risk','no-stress-source-exists','later','—'];
/* confidence: e.confidence = 4..0 or null (not yet rated), e.confidence_why = the one-sentence reason; catalog entries only */
const CF_WORD={4:'very confident',3:'fairly confident',2:'moderately confident',1:'disputed',0:'not confident'};
const CF_NONE='not yet rated';
const CF_ORDER=['4','3','2','1','0','x'];
const CF_LABEL={'4':CF_WORD[4],'3':CF_WORD[3],'2':CF_WORD[2],'1':CF_WORD[1],'0':CF_WORD[0],'x':CF_NONE,'—':'—'};
const CF_MEANING={'4':'several independent first-hand descriptions agree','3':'one first-hand description, or minor disagreement with a clear resolution','2':'descriptions disagree; one analysis is better supported','1':'specialists disagree in print','0':'no first-hand statement has been confirmed; the classification is provisional','x':'not yet rated'};
const cfCls=k=>'cf-'+k;
function cfBadge(e){ const k=e.confk; if(k==='—') return ''; return `<span class="tag ${cfCls(k)}" title="${esc(CF_MEANING[k]||'')}">${esc(CF_LABEL[k])}</span>`; }
/* access classes, per work: 'digital' = full text online (digital_gated=true when it is behind a login, a paywall or a search-only view); counts: digital = every online copy, digital_gated = the restricted ones among them */
const ACCESS={digital:{label:'Open access',cls:'a-digital',long:'full text freely available online'},digital_gated:{label:'Restricted access',cls:'a-digital a-gated',long:'full text online behind a login or paywall, or viewable only in limited (search-only) form'},scan_deliver:{label:'Print, library copy',cls:'a-scan',long:'no digital copy known; a research library holds a print copy, obtainable by scan request or interlibrary loan'},print_only:{label:'Print, no copy located',cls:'a-print',long:'known in print from a catalog record or citation; no holding found in the libraries checked'},unknown:{label:'Not located',cls:'a-unknown',long:'no copy of any kind located yet'}};
const ACCESS_KEYS=['digital','digital_gated','scan_deliver','print_only','unknown'];
const accCounts=o=>({digital:(o.digital||0)-(o.digital_gated||0),digital_gated:o.digital_gated||0,scan_deliver:o.scan_deliver||0,print_only:o.print_only||0,unknown:o.unknown||0});   // open-access copies, then the restricted ones
const BEST_LABEL={digital:'At least one open-access work',digital_gated:'Online, restricted access only',scan_deliver:'Print only, library copy located',print_only:'Print only, no library copy located',unknown:'No copy located',none:'No works listed'};
const BEST_ORDER=['digital','digital_gated','scan_deliver','print_only','unknown','none'];
const NEW_LABEL={verified:'Found and verified in the source',found:'Found, verification pending',none:'None'};
const NEW_ORDER=['verified','found','none'];
/* V95 TONE: tone statement found among the works listed (verified = quotation checked at the cited page) */
const TONE_LABEL={verified:'Found and verified in the source',found:'Found, verification pending',listed:'Works on tone listed, none quoted',none:'None'};
const TONE_ORDER=['verified','found','listed','none'];
const TONE_BADGE={states:'states tone',notes:'mentions tone',silent:'nothing on tone'};
const WORLD_ORDER=['statement found in an open source','statement found in a copy already on file','statement found in a copy we already had','statement reported second-hand only','a description exists but is not accessible','accessible description is silent on stress','no descriptive source known','not yet read','—'];
/* status keys that share a label are shown as one facet option */
const WORLD_ALIAS={'statement found in a copy already on file':'statement found in an open source','statement found in a copy we already had':'statement found in an open source'};
const WORLD_LABEL={'statement found in an open source':'stress statement found in an accessible source','statement found in a copy already on file':'stress statement found in an accessible source','statement found in a copy we already had':'stress statement found in an accessible source','statement reported second-hand only':'stress statement known only second-hand','a description exists but is not accessible':'description exists; no copy accessible to us','accessible description is silent on stress':'accessible descriptions say nothing about stress','no descriptive source known':'no description of the language known','not yet read':'sources not yet examined','—':'in the catalog'};
const SWEEP_ORDER=['new statement read','swept, no new statement','searched; no new statement','not swept','not yet searched','—'];
const SWEEP_LABEL={'new statement read':'statement found','swept, no new statement':'examined, nothing new','searched; no new statement':'examined, nothing new','not swept':'not yet examined','not yet searched':'not yet examined','—':'no works on stress listed'};
/* verification status of a statement whose quotation has not (yet) been verified in the source */
const CHECK_LABEL={'confirmed by a second reader':'quotation verified in source','confirmed by a second reader, with minor differences':'quotation verified in source (minor differences in wording)','reported by the second reader, not yet confirmed':'verification pending','second reading pending':'verification pending','not checked by the second reader':'not yet verified','second reader did not find the passage at the locator':'quotation not found at the cited page','not checked: no copy of the source was kept':'no copy available to verify the quotation'};
/* how a statement relates to the catalog entry (catalog languages) or to the other descriptions found (other languages); 'new' = the first statement found for the language. Works that say nothing about stress never appear as statements. */
const RELATION_LABEL={agrees:'agrees with the entry',refines:'adds detail to the entry',contradicts:'conflicts with the entry',new:'first statement for this language'};
const RELATION_LABEL_OUT={agrees:'agrees with another description',refines:'adds detail to another description',contradicts:'conflicts with another description',new:'first statement for this language'};
const BEARS_LABEL={confirms:'agrees with the entry',refines:'adds detail to the entry',contradicts:'conflicts with the entry'};
const RELATION_CLS={agrees:'b-confirms',refines:'b-refines',contradicts:'b-contradicts',new:'ok'};
const COLL=new Intl.Collator('en',{sensitivity:'base',numeric:true});
const ORIGIN_LABEL={glottolog:'from Glottolog',reader:'added by the compilers',scan:'added by the compilers',database:'cited in the catalog entry'};
/* editorial note attached to a source assessment; keys in both the short and the sentence form found in the data; an empty label is not displayed */
const ACTION_LABEL={'no change':'','recode':'classification under review','classification to be revised':'classification under review','identity or merge check':'possible duplicate of another entry (under review)','check whether this is the same language as another entry':'possible duplicate of another entry (under review)','cite a better source for the same coding':'a better source is available for this classification','a better source should be cited for the same classification':'a better source is available for this classification','re-read with a listed source':'to be re-checked against a listed work','re-read against a listed source':'to be re-checked against a listed work','annotate the record':'','add a note to the record':''};
const SCAN_LABEL={'source named unreachable':'a source is known but no copy could be obtained','a source was named but could not be reached':'a source is known but no copy could be obtained','source reachable stress':'an accessible source states the stress pattern','a reachable source states the stress pattern':'an accessible source states the stress pattern','no source found':'no source found'};
const QCHECK_LABEL={'confirmed in the held file':'verified at the cited page','confirmed in the copy we hold':'verified at the cited page','not found in the held file':'not found at the cited page','not found in the copy we hold':'not found at the cited page','no file held':'no copy available to verify the quotation','no copy held to check':'no copy available to verify the quotation','partly confirmed':'partly verified at the cited page','the record has no quotation':'the entry carries no quotation'};
/* per-work access note: display form (drops internal holdings remarks, keeps what a user can act on) */
function detail(t){ return String(t||'').replace(/a copy the project holds \([^)]*\);?\s*/g,'').replace(/open copy downloaded when we checked the sources/g,'open copy online').replace(/(^|;\s*)access check:\s*/g,'$1').replace(/ when a reader tried/g,'').replace(/read online, no copy( kept)?/g,'available online').replace(/ in (?:one|two|three|\d+) readings? \([^)]*\)/g,'').replace(/^\s*;\s*/,'').replace(/;\s*;/g,';').trim(); }
const GROUPS=[
 ['states','Cited in the catalog entry',['states stress (quoted in catalog)','states stress (domain / secondary stress passage)'],true],
 ['bears','States the stress pattern',['read: confirms the catalog coding','read: refines the catalog coding','read: contradicts the catalog coding','states stress (new statement, read)'],true],
 ['notes','Mentions stress, no rule stated',['read: notes on stress','read (morphology study)'],true],
 ['silent','Examined: nothing on stress',['read: silent on stress'],true],
 ['tone','Describes the tone system',['read: states tone'],true],   /* V95 TONE */
 ['tonenotes','Mentions tone, no system stated',['read: notes on tone'],false],
 ['tonesilent','Examined for tone: nothing on tone',['read: silent on tone'],false],
 ['tonewanted','Not yet examined: likely to describe tone',['likely states tone; not yet obtained'],false],
 ['consulted','Other works consulted for the entry',['consulted for the record'],true],
 ['wanted','Not yet examined: likely to describe stress',['wanted: likely states stress, not held','likely states stress; not yet obtained'],true],
 ['wantednotes','Not yet examined: likely to mention stress or tone',['likely notes on stress or tone; not yet obtained','likely notes on stress; not yet obtained'],false],
 ['gldesc','Not yet examined: descriptive works',['Glottolog description, unread','named by the earlier scan, not opened','named in our earlier survey, not yet opened'],false],
 ['glphon','Not yet examined: phonological studies',['Glottolog phonology work, unread'],false],
 ['inacc','No copy accessible to us',['not read: not accessible'],false],
 ['abstract','Known from citation or abstract only',['not read: abstract or record only'],false],
 ['other','Other works listed',[],false]];
const TAG_SHORT={'states stress (quoted in catalog)':'cited in the entry','states stress (domain / secondary stress passage)':'cited for domain or secondary stress','states stress (new statement, read)':'','read (morphology study)':'morphological study','read: notes on stress':''};
const $=id=>document.getElementById(id);
function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function linkify(s){ return esc(s).replace(/(https?:\/\/[^\s<)\]]+[^\s<)\].,;])/g,'<a class="ext" href="$1" target="_blank" rel="noopener">$1</a>').replace(/\bdoi:(10\.[^\s<)\],;]+)/g,'<a class="ext" href="https://doi.org/$1" target="_blank" rel="noopener">doi:$1</a>').replace(/\bhdl:([0-9.]+\/[^\s<)\],;]+)/g,'<a class="ext" href="https://hdl.handle.net/$1" target="_blank" rel="noopener">hdl:$1</a>'); }
const fmt=n=>Number(n||0).toLocaleString('en-US');
const plural=(n,w)=>fmt(n)+' '+w+(n===1?'':'s');

let D=[], byGC=new Map(), AUTHORS=null, BUILT='';
const state={q:'',terms:[],cat:new Set(),conf:new Set(),best:new Set(),newst:new Set(),tone:new Set(),audit:new Set(),world:new Set(),sweep:new Set(),kind:new Set(),area:new Set(),fam:'',sort:'name',dir:1,page:0,sel:''};
const PAGE=100;
let current=[];

function prep(e){
  e.cat=e.in_catalog?'in':'out';
  e.digital_gated=e.digital_gated||0; e.digital_open=(e.digital||0)-e.digital_gated;
  e.best=e.n_sources?(e.digital_open>0?'digital':e.digital_gated>0?'digital_gated':e.scan_deliver?'scan_deliver':e.print_only?'print_only':'unknown'):'none';
  e.newst=e.new_statement_verified?'verified':(e.has_new_statement?'found':'none');
  e.tonest=e.tone_statement_verified?'verified':(e.n_states_tone?'found':(e.n_tone_works?'listed':'none'));   /* V95 TONE */
  e.auditk=e.in_catalog?(e.audit_status||'later'):'—';
  e.confk=e.in_catalog?(e.confidence==null?'x':String(e.confidence)):'—';
  e.cfsort=e.in_catalog?(e.confidence==null?-1:Number(e.confidence)):-2;
  e.worldk=e.in_catalog?'—':(WORLD_ALIAS[e.world_status]||e.world_status||'—');
  e.sweepk=e.sweep_status||'—';
  e.kindk=e.in_catalog?(KIND_ALIAS[e.catalog_kind]||e.catalog_kind||'other'):'—';
  e.areak=e.macroarea||'—';
  e.catlabel=e.in_catalog?(KIND_LABEL[e.catalog_kind]||e.catalog_kind):'—';
  e.status=e.in_catalog?(AUDIT_LABEL[e.audit_status]||'not assessed'):(WORLD_LABEL[e.world_status]||e.world_status||'');
  e.n_read=(e.n_read_silent||0)+(e.n_read_other||0);
  e.hay=(e.name+' '+e.glottocode+' '+e.family+' '+e.macroarea).toLowerCase();
}
function reset(){ state.q=''; state.terms=[]; ['cat','conf','best','newst','tone','audit','world','sweep','kind','area'].forEach(k=>state[k]=new Set()); state.fam=''; $('q').value=''; }
function match(e){
  if(state.terms.length){ const h=e.hay+(AUTHORS&&AUTHORS[e.glottocode]?' '+AUTHORS[e.glottocode]:''); for(const t of state.terms) if(!h.includes(t)) return false; }
  if(state.cat.size&&!state.cat.has(e.cat)) return false;
  if(state.conf.size&&!state.conf.has(e.confk)) return false;
  if(state.best.size&&!state.best.has(e.best)) return false;
  if(state.newst.size&&!state.newst.has(e.newst)) return false;
  if(state.tone.size&&!state.tone.has(e.tonest)) return false;   /* V95 TONE */
  if(state.audit.size&&!state.audit.has(e.auditk)) return false;
  if(state.world.size&&!state.world.has(e.worldk)) return false;
  if(state.sweep.size&&!state.sweep.has(e.sweepk)) return false;
  if(state.kind.size&&!state.kind.has(e.kindk)) return false;
  if(state.area.size&&!state.area.has(e.areak)) return false;
  if(state.fam&&e.family!==state.fam) return false;
  return true;
}
function filtered(){ const out=D.filter(match); const k=state.sort, d=state.dir; const q=state.terms.length&&k==='name'?state.q.toLowerCase():''; const nm=e=>q?(e.name.toLowerCase()===q?0:e.name.toLowerCase().includes(q)?1:2):0; /* with a search on, languages whose name matches come before author-only matches */ out.sort((a,b)=>{ const r=nm(a)-nm(b); if(r) return r; const x=a[k]??'', y=b[k]??''; const c=(typeof x==='number'&&typeof y==='number')?(x-y):COLL.compare(String(x),String(y)); return c*d || COLL.compare(a.name,b.name); }); return out; }
const COLS=[['name','Language'],['family','Family'],['catlabel','Catalog entry'],['status','Status'],['n_sources','Works'],['n_states_stress','Stress information'],['digital','Access']];
function renderHead(){ const tr=$('thead'); tr.innerHTML=''; COLS.forEach(([k,l])=>{ const th=document.createElement('th'); th.textContent=l+(state.sort===k?(state.dir>0?' ▲':' ▼'):''); if(state.sort===k) th.className='sorted'; th.onclick=()=>{ if(state.sort===k) state.dir*=-1; else { state.sort=k; state.dir=(k==='n_sources'||k==='n_states_stress'||k==='digital')?-1:1; } state.page=0; render(); }; tr.appendChild(th); }); }
function knowPills(e){ const p=(n,l,c,t)=>n?`<span class="tag ${c}" title="${esc(t)}"><b>${fmt(n)}</b> ${l}</span>`:''; return '<div class="pills">'+p(e.n_states_stress,'state stress','p-states','works that state the stress pattern: the entry\'s cited source, other works found to agree with, add detail to or conflict with it, and first statements for languages not yet in the catalog')+p(e.n_states_tone,'state tone','p-tone','works that state the language\'s tone system, or the absence of tone, in a passage quoted with its page')+p(e.n_read,'examined, no rule','p-read','works examined that state no stress rule (nothing on stress, or a mention only), and other works consulted for the entry')+p(e.n_wanted,'likely relevant','p-wanted','works likely, from their title and type, to describe stress, of which no copy has yet been examined')+p(e.n_unread,'not yet examined','p-unread','works not yet examined, known only from a citation or abstract, or not accessible to us')+'</div>'; }
function accessPills(e){ const c=accCounts(e); const p=k=>c[k]?`<span class="tag ${ACCESS[k].cls}" title="${esc(ACCESS[k].long)}"><b>${fmt(c[k])}</b> ${ACCESS[k].label}</span>`:''; return '<div class="pills">'+ACCESS_KEYS.map(p).join('')+'</div>'; }
function render(){
  current=filtered(); renderHead(); const tb=$('tbody'); tb.innerHTML=''; if(state.page*PAGE>=current.length) state.page=0; const slice=current.slice(state.page*PAGE,state.page*PAGE+PAGE);
  slice.forEach(e=>{ const tr=document.createElement('tr'); if(e.glottocode===state.sel) tr.className='sel';
    tr.innerHTML=`<td class="lang"><span class="nm">${esc(e.name)}</span><a class="gc" href="${GL(e.glottocode)}" target="_blank" rel="noopener" title="Open this language in Glottolog" onclick="event.stopPropagation()">${esc(e.glottocode)}</a></td><td class="fam">${esc(e.family)}${e.macroarea?`<div class="muted">${esc(e.macroarea)}</div>`:''}</td><td>${e.in_catalog?`<span class="tag k-${esc(e.catalog_kind)}">${esc(e.catlabel)}</span>`:'<span class="muted">not in the catalog</span>'}</td><td class="desc">${esc(e.status)}</td><td class="num">${fmt(e.n_sources)}</td><td>${knowPills(e)}</td><td>${e.n_sources?accessPills(e):'<span class="muted">—</span>'}</td>`;
    tr.onclick=()=>openDrawer(e.glottocode); tb.appendChild(tr); });
  $('empty').hidden=current.length>0; $('count').textContent=fmt(current.length); const works=current.reduce((s,e)=>s+(e.n_sources||0),0); $('countlabel').textContent=`languages · ${plural(works,'work')}`;
  const pg=$('pager'); pg.innerHTML=''; if(current.length>PAGE){ const n=Math.ceil(current.length/PAGE); const prev=document.createElement('button'); prev.textContent='Previous'; prev.disabled=state.page===0; prev.onclick=()=>{state.page--;render();}; const next=document.createElement('button'); next.textContent='Next'; next.disabled=state.page>=n-1; next.onclick=()=>{state.page++;render();}; const lab=document.createElement('span'); lab.textContent=`Page ${state.page+1} of ${n}`; pg.append(prev,lab,next); }
  renderChips(); renderRail();
}
function renderChips(){ const c=$('chips'); c.innerHTML=''; const add=(label,fn)=>{ const s=document.createElement('span'); s.className='chip'; s.innerHTML=esc(label)+' <button aria-label="Remove">×</button>'; s.querySelector('button').onclick=()=>{ fn(); state.page=0; render(); }; c.appendChild(s); };
  if(state.q) add('“'+state.q+'”',()=>{ state.q=''; state.terms=[]; $('q').value=''; });
  state.cat.forEach(k=>add(CAT_LABEL[k],()=>state.cat.delete(k))); state.conf.forEach(k=>add('confidence: '+(CF_LABEL[k]||k),()=>state.conf.delete(k))); state.best.forEach(k=>add('access: '+BEST_LABEL[k],()=>state.best.delete(k))); state.newst.forEach(k=>add('stress statement: '+NEW_LABEL[k],()=>state.newst.delete(k))); state.audit.forEach(k=>add('source assessment: '+(AUDIT_LABEL[k]||k),()=>state.audit.delete(k))); state.world.forEach(k=>add('sources: '+(WORLD_LABEL[k]||k),()=>state.world.delete(k))); state.sweep.forEach(k=>add('works on stress: '+(SWEEP_LABEL[k]||k),()=>state.sweep.delete(k))); state.kind.forEach(k=>add(KIND_LABEL[k]||k,()=>state.kind.delete(k))); state.area.forEach(k=>add(k,()=>state.area.delete(k))); if(state.fam) add(state.fam,()=>state.fam='');
  $('crit').textContent=c.children.length?'':'no filters — showing every language'; }
function renderRail(){ const rail=$('rail'); const keep=rail.scrollTop; rail.innerHTML='';
  /* hide: a key left out of the list (its languages are still counted in the other facets); tagcls: k -> a class that renders the label as a colored tag; always: keys listed even at a count of 0 */
  const mk=(title,key,setName,order,labels,hide,tagcls,always)=>{ const box=document.createElement('div'); box.className='facet'; box.innerHTML=`<h3>${esc(title)}</h3>`; const saved=state[setName]; state[setName]=new Set(); const within=D.filter(match); state[setName]=saved; const counts=new Map(); (always||[]).forEach(k=>counts.set(k,0)); within.forEach(e=>{ const v=e[key]; if(hide!==undefined&&v===hide) return; counts.set(v,(counts.get(v)||0)+1); }); let keys=[...counts.keys()]; if(order) keys.sort((a,b)=>(order.indexOf(a)<0?99:order.indexOf(a))-(order.indexOf(b)<0?99:order.indexOf(b))); else keys.sort((a,b)=>counts.get(b)-counts.get(a)); const LIM=8; keys.forEach((k,i)=>{ const lab=document.createElement('label'); lab.className='opt'; if(i>=LIM&&!state[setName].has(k)) lab.hidden=true; const text=esc(labels?(labels[k]||k):k); lab.innerHTML=`<input type="checkbox" ${state[setName].has(k)?'checked':''}> <span>${tagcls?`<span class="tag ${esc(tagcls(k))}">${text}</span>`:text}</span><span class="c">${fmt(counts.get(k))}</span>`; lab.querySelector('input').onchange=ev=>{ if(ev.target.checked) state[setName].add(k); else state[setName].delete(k); state.page=0; render(); }; box.appendChild(lab); }); if(keys.length>LIM){ const m=document.createElement('button'); m.className='more'; m.textContent=`Show all ${keys.length}`; m.onclick=()=>{ box.querySelectorAll('.opt').forEach(x=>x.hidden=false); m.remove(); }; box.appendChild(m); } rail.appendChild(box); };
  mk('Catalog entry','cat','cat',['in','out'],CAT_LABEL);
  mk('Confidence','confk','conf',CF_ORDER,CF_LABEL,'—',cfCls,CF_ORDER);   /* all six levels listed, highest first, even at 0; languages not in the catalog are left out of its counts */
  mk('Best available access','best','best',BEST_ORDER,BEST_LABEL);
  mk('Stress statement found in the bibliography','newst','newst',NEW_ORDER,NEW_LABEL);
  mk('Tone statement found in the bibliography','tonest','tone',TONE_ORDER,TONE_LABEL);   /* V95 TONE */
  mk('Languages not in the catalog: what the sources offer','worldk','world',WORLD_ORDER,WORLD_LABEL);
  mk('Works on stress or prosody (by title)','sweepk','sweep',SWEEP_ORDER,SWEEP_LABEL);
  mk('Catalog classification','kindk','kind',KIND_ORDER,KIND_LABEL);
  mk('Area','areak','area');
  const fb=document.createElement('div'); fb.className='facet'; fb.innerHTML='<h3>Family</h3>'; const sel=document.createElement('select'); const f0=state.fam; state.fam=''; const within=D.filter(match); state.fam=f0; const fams=new Map(); within.forEach(e=>fams.set(e.family||'—',(fams.get(e.family||'—')||0)+1)); const fk=[...fams.keys()].sort((a,b)=>fams.get(b)-fams.get(a)); sel.innerHTML='<option value="">All families</option>'+fk.map(k=>`<option value="${esc(k)}" ${state.fam===k?'selected':''}>${esc(k)} (${fmt(fams.get(k))})</option>`).join(''); sel.onchange=()=>{ state.fam=sel.value; state.page=0; render(); }; fb.appendChild(sel); rail.appendChild(fb);
  rail.scrollTop=keep; }

/* ---- drawer ---- */
const cache=new Map();
function metaHTML(e){ return `<h2>${esc(e.name)}</h2><div class="meta"><a class="ext" href="${GL(e.glottocode)}" target="_blank" rel="noopener" title="Glottolog: classification, location, full bibliography">Glottolog ${esc(e.glottocode)}</a><span>${esc(e.family||'—')}</span><span>${esc(e.macroarea||'—')}</span><span>${e.in_catalog?'in the catalog':'not in the catalog'}</span></div>`+(e.in_catalog?`<div class="cf">${cfBadge(e)}${e.confidence_why?`<span class="why">${esc(e.confidence_why)}</span>`:''}</div>`:''); }
function accessLine(o){ const c=accCounts(o); return `<div class="pills">${ACCESS_KEYS.map(k=>c[k]?`<span class="tag ${ACCESS[k].cls}" title="${esc(ACCESS[k].long)}"><b>${fmt(c[k])}</b> ${ACCESS[k].label}</span>`:'').join('')}</div>`; }
function stmtHTML(s,inCat){ const ok=!!s.verified; const rel=s.relation&&RELATION_CLS[s.relation]?`<span class="tag ${RELATION_CLS[s.relation]}">${esc((inCat?RELATION_LABEL:RELATION_LABEL_OUT)[s.relation])}</span>`:''; const head=[ok?'<span class="tag ok">Quotation verified in source</span>':`<span class="tag ${/pending/.test(s.check||'')?'muted':'warn'}">${esc(CHECK_LABEL[s.check]||'verification pending')}</span>`, rel, s.source_kind?esc(s.source_kind):'', s.year?esc(s.year):''].filter(Boolean).join(' · ');
  let h=`<div class="stmt"><div class="head">${head}</div>`; if(s.quote) h+=`<blockquote class="q">${esc(s.quote)}</blockquote>`; if(s.translation) h+=`<div class="tr"><em>Translation</em>${esc(s.translation)}</div>`;
  h+=`<div class="cite">${linkify(s.citation)}${s.locator?' — '+esc(s.locator):''}</div>`;
  if(s.reading) h+=`<div class="reading">Analysis: ${esc(s.reading)}</div>`;
  const more=[]; if(s.rule_in_words) more.push('<div><b>Rule.</b> '+esc(s.rule_in_words)+'</div>'); if(s.secondary_stress) more.push('<div><b>Secondary stress.</b> '+esc(s.secondary_stress)+'</div>'); if(s.exceptions) more.push('<div><b>Exceptions.</b> '+esc(s.exceptions)+'</div>'); if(s.domain_note) more.push('<div><b>Domain.</b> '+esc(s.domain_note)+'</div>'); if(s.confidence) more.push('<div><b>Certainty of the coding.</b> '+esc(s.confidence)+'</div>'); if(s.identity_note) more.push('<div><b>Which variety.</b> '+esc(s.identity_note)+'</div>'); if(s.relation_note) more.push('<div><b>'+(inCat?'Relation to the catalog entry.':'Relation to other descriptions.')+'</b> '+esc(s.relation_note)+'</div>'); if(s.supersedes_catalog_source) more.push('<div><b>Relation to the entry\'s cited source.</b> '+(s.supersedes_catalog_source===true?'This work is a fuller primary source than the one cited in the entry.':esc(s.supersedes_catalog_source))+'</div>');
  if(more.length) h+=`<details class="more"><summary>Details</summary>${more.join('')}</details>`;
  return h+'</div>'; }
function srcHTML(s){ const A=(s.access_class==='digital'&&s.digital_gated)?ACCESS.digital_gated:(ACCESS[s.access_class]||ACCESS.unknown); const links=[]; if(s.open_url) links.push(`<a class="ext" href="${esc(s.open_url)}" target="_blank" rel="noopener">open copy</a>`); if(s.hollis_url) links.push(`<a class="ext" href="${esc(s.hollis_url)}" target="_blank" rel="noopener">library record</a>`); if(s.doi) links.push(`<a class="ext" href="https://doi.org/${esc(s.doi)}" target="_blank" rel="noopener">DOI</a>`);
  const badges=[]; const short=TAG_SHORT[s.tag]; if(short) badges.push(`<span class="tag muted">${esc(short)}</span>`); if(s.bears&&BEARS_LABEL[s.bears]) badges.push(`<span class="tag b-${esc(s.bears)}">${esc(BEARS_LABEL[s.bears])}</span>`);
  const tn=s.tone||null; if(tn&&TONE_BADGE[tn.status]){ badges.push(`<span class="tag t-${esc(tn.status)}">${TONE_BADGE[tn.status]}</span>`); if(tn.status==='states') badges.push(tn.verified?'<span class="tag ok">tone quotation verified in source</span>':`<span class="tag muted">${esc(CHECK_LABEL[tn.check]||tn.check||'verification pending')}</span>`); }   /* V95 TONE */
  const bits=[s.source_kind?esc(s.source_kind):'', s.year?esc(s.year):'', s.language_of_publication?'in '+esc(s.language_of_publication):'', ORIGIN_LABEL[s.origin]||''].filter(Boolean);
  let h=`<li class="src"><div class="cit">${linkify(s.citation)}</div>`;
  const det=detail(s.access_detail); h+=`<div class="acc"><span class="tag ${A.cls}" title="${esc(A.long)}">${A.label}</span>${det?`<span>${esc(det)}</span>`:''}${s.harvard_location&&!(s.access_detail||'').includes(s.harvard_location)?`<span>· ${esc(s.harvard_location)}</span>`:''}${links.length?'<span>· '+links.join(' · ')+'</span>':''}</div>`;
  if(badges.length||bits.length) h+=`<div class="cite">${badges.concat(bits).join(' · ')}</div>`;
  if(s.quote) h+=`<blockquote class="q">${esc(s.quote)}</blockquote>${s.locator?`<div class="cite">${esc(s.locator)}</div>`:''}`;
  if(s.note) h+=`<div class="noteline">${linkify(s.note)}</div>`;
  if(tn){ if(tn.quote&&tn.quote!==s.quote) h+=`<blockquote class="q">${esc(tn.quote)}</blockquote>${tn.translation?`<div class="tr"><em>Translation</em>${esc(tn.translation)}</div>`:''}${tn.locator?`<div class="cite">${esc(tn.locator)}</div>`:''}`; else if(tn.quote&&tn.translation&&!s.note) h+=`<div class="tr"><em>Translation</em>${esc(tn.translation)}</div>`; const tb=[tn.n_tones?'Tones: '+esc(tn.n_tones):'', tn.summary?esc(tn.summary):'', (tn.says&&tn.says!==s.note&&!tn.summary)?esc(tn.says):''].filter(Boolean); if(tb.length) h+=`<div class="noteline tonenote"><b>On tone.</b> ${tb.join(' · ')}</div>`; }   /* V95 TONE */
  return h+'</li>'; }
function bibHTML(L){ const srcs=L.sources||[]; if(!srcs.length) return `<h3 class="sec">Bibliography</h3><p class="muted">No works listed for this language.</p>`;
  const byTag=new Map(); srcs.forEach(s=>{ const g=GROUPS.find(x=>x[2].includes(s.tag))||GROUPS[GROUPS.length-1]; if(!byTag.has(g[0])) byTag.set(g[0],[]); byTag.get(g[0]).push(s); });
  let h=`<h3 class="sec">Bibliography <span class="c">${plural(srcs.length,'work')}</span></h3>`;
  GROUPS.forEach(([id,title,,open])=>{ const arr=byTag.get(id); if(!arr) return; h+=`<details class="grp" ${open||arr.length<=6?'open':''}><summary>${esc(title)}<span class="c">${arr.length}</span></summary><ol class="refs">${arr.map(srcHTML).join('')}</ol></details>`; });
  return h; }
function fullHTML(e,L){ const kv=[]; const push=(k,v)=>{ if(v!==undefined&&v!==null&&String(v).trim()!=='') kv.push(`<dt>${k}</dt><dd>${v}</dd>`); };
  if(e.in_catalog){ push('Classification',`<span class="tag k-${esc(e.catalog_kind)}">${esc(e.catlabel)}</span>`);
    const a=L.audit||{}; if(a.status||e.audit_status){ const stv=a.status||e.audit_status; let h=`<b>${esc(AUDIT_LABEL[stv]||'')}</b>`; const act=ACTION_LABEL[a.action||e.audit_action]; if(act) h+=' — '+esc(act); const qc=QCHECK_LABEL[a.quote_check]; if(qc) h+=`<div class="cite">quotation: ${esc(qc)}</div>`; if(a.deciding_source_kind||a.deciding_source_year) h+=`<div class="cite">primary source: ${esc([a.deciding_source_kind,a.deciding_source_year].filter(Boolean).join(', '))}</div>`; push('Source assessment',h); } }
  else { const bits=[]; if(e.world_status) bits.push(esc(WORLD_LABEL[e.world_status]||e.world_status)); const sc=L.earlier_scan||{}; const svk=sc.verdict||e.scan_verdict||''; const sv=SCAN_LABEL[svk]||''; if(sc.source_named) bits.push(`<div class="cite">${sv&&svk!=='no source found'?esc(sv)+': ':''}${linkify(sc.source_named)}</div>`); else if(sv&&!e.world_status) bits.push(esc(sv)); if(sc.note) bits.push(`<div class="cite">${linkify(sc.note)}</div>`); if(bits.length) push('Source situation',bits.join('')); }
  if(e.sweep_status) push('Works on stress (by title)',esc(SWEEP_LABEL[e.sweep_status]||e.sweep_status));
  const c=L.counts||e; push('Works listed',`<div>${plural(c.n_sources,'work')}${c.n_glottolog_entries?` · ${plural(c.n_glottolog_entries,'work')} of all kinds listed in Glottolog`:''}</div>${c.n_sources?accessLine(c):''}${c.n_sources?`<div class="cite">${fmt(c.n_states_stress)} state the stress pattern · ${fmt((c.n_read_silent||0)+(c.n_read_other||0))} examined, no stress rule · ${fmt(c.n_wanted)} likely relevant, not yet examined · ${fmt(c.n_unread)} others not yet examined${c.n_tone_works?` · ${fmt(c.n_states_tone)} of ${fmt(c.n_tone_works)} works on tone state the tone system`:''}</div>`:''}`);   /* V95 TONE */
  let st=''; if(e.in_catalog&&L.catalog_quote) st+=`<div class="stmt"><div class="head"><span class="tag ok">Cited in the catalog entry</span></div><blockquote class="q">${esc(L.catalog_quote)}</blockquote><div class="cite">${linkify(L.catalog_citation||'')}${L.catalog_locator?' — '+esc(L.catalog_locator):''}</div></div>`;
  const ns=(L.new_statements||[]).slice().sort((a,b)=>(b.verified?1:0)-(a.verified?1:0)); ns.forEach(s=>st+=stmtHTML(s,e.in_catalog));
  const stHead=`<h3 class="sec">Stress statements${ns.length?` <span class="c">${ns.filter(s=>s.verified).length} of ${ns.length} verified in the source</span>`:''}</h3>`;
  const tsl=(L.tone_statements||[]); let th=''; if(tsl.length){ th=`<h3 class="sec">Tone statements <span class="c">${tsl.filter(s=>s.verified).length} of ${tsl.length} verified in the source</span></h3>`+tsl.map(toneStmtHTML).join(''); }   /* V95 TONE */
  return metaHTML(e)+`<dl class="kv">${kv.join('')}</dl>`+stHead+(st||'<p class="muted">No first-hand statement about stress has been found for this language.</p>')+th+bibHTML(L); }
function toneStmtHTML(s){ const head=[s.verified?'<span class="tag ok">Quotation verified in source</span>':`<span class="tag muted">${esc(CHECK_LABEL[s.check]||s.check||'verification pending')}</span>`, s.source_kind?esc(s.source_kind):'', s.year?esc(s.year):''].filter(Boolean).join(' · ');
  let h=`<div class="stmt"><div class="head">${head}</div>`; if(s.quote) h+=`<blockquote class="q">${esc(s.quote)}</blockquote>`; if(s.translation) h+=`<div class="tr"><em>Translation</em>${esc(s.translation)}</div>`;
  h+=`<div class="cite">${linkify(s.citation)}${s.locator?' — '+esc(s.locator):''}</div>`; const more=[]; if(s.n_tones) more.push('<div><b>Tones.</b> '+esc(s.n_tones)+'</div>'); if(s.summary) more.push('<div><b>System.</b> '+esc(s.summary)+'</div>'); if(more.length) h+=`<details class="more"><summary>Details</summary>${more.join('')}</details>`; return h+'</div>'; }   /* V95 TONE */
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
function toCSV(rows){ const base=location.href.split('#')[0]; const cols=[['language',e=>e.name],['glottocode',e=>e.glottocode],['glottolog_url',e=>GL(e.glottocode)],['family',e=>e.family],['macroarea',e=>e.macroarea],['in_catalog',e=>e.in_catalog?'yes':'no'],['catalog_classification',e=>e.in_catalog?(KIND_LABEL[e.catalog_kind]||e.catalog_kind):''],['source_assessment',e=>e.in_catalog?(AUDIT_LABEL[e.audit_status]||''):''],['source_assessment_note',e=>ACTION_LABEL[e.audit_action]||''],['confidence',e=>e.in_catalog?CF_LABEL[e.confk]:''],['confidence_why',e=>e.in_catalog?(e.confidence_why||''):''],['source_situation',e=>WORLD_LABEL[e.world_status]||e.world_status||''],['works_on_stress_by_title',e=>SWEEP_LABEL[e.sweep_status]||e.sweep_status||''],['source_identified',e=>SCAN_LABEL[e.scan_verdict]||e.scan_verdict||''],['works_listed',e=>e.n_sources],['states_stress',e=>e.n_states_stress],['examined_nothing_on_stress',e=>e.n_read_silent],['examined_other',e=>e.n_read_other],['likely_relevant_not_examined',e=>e.n_wanted],['not_yet_examined',e=>e.n_unread],['open_access',e=>e.digital_open],['restricted_access',e=>e.digital_gated],['print_library_copy',e=>e.scan_deliver],['print_no_copy_located',e=>e.print_only],['not_located',e=>e.unknown],['best_access',e=>BEST_LABEL[e.best]],['glottolog_entries',e=>e.n_glottolog_entries],['stress_statement_found',e=>e.has_new_statement?'yes':'no'],['stress_statement_verified',e=>e.new_statement_verified?'yes':'no'],['tone_works',e=>e.n_tone_works||0],['states_tone',e=>e.n_states_tone||0],['tone_statement_verified',e=>e.tone_statement_verified?'yes':'no'],['quotation',e=>e.best_quote],['bibliography_url',e=>base+'#'+e.glottocode]]; const q=v=>{ const s=String(v??''); return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }; return cols.map(c=>c[0]).join(',')+'\n'+rows.map(e=>cols.map(c=>q(c[1](e))).join(',')).join('\n'); }
$('savecsv').onclick=()=>{ const blob=new Blob([toCSV(current)],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`word-stress-bibliography-${current.length}.csv`; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500); };

/* ---- load ---- */
function legend(){ const inC=D.filter(e=>e.in_catalog).length, outC=D.length-inC, works=D.reduce((s,e)=>s+(e.n_sources||0),0);
  $('legend').innerHTML=`<b>About this page.</b> One row per language: the ${fmt(inC)} languages with an entry in the catalog and ${fmt(outC)} not yet in it, each with every work that describes, or could describe, its word stress or its tone — ${plural(works,'work')} in all. Click a language for the stress statements found in its sources and the full list of works, grouped by what each says about stress or tone. <b>Examined</b> means the work has been checked for what it says about stress; <b>verified</b> means the quoted passage has been confirmed at the cited page of the source. <b>Likely relevant</b> works are those likely, from their title and type, to describe stress, of which no copy has yet been examined. <b>Confidence</b> rates the classification of each catalog entry: very confident (several independent first-hand descriptions agree), fairly confident (one first-hand description, or minor disagreement with a clear resolution), moderately confident (descriptions disagree; one analysis is better supported), disputed (specialists disagree in print), not confident (no first-hand statement has been confirmed; the classification is provisional), or not yet rated. Access, per work: <b>Open access</b> — full text freely available online. <b>Restricted access</b> — full text online behind a login, a paywall or a limited (search-only) view; a volume that HathiTrust offers for full-text search only counts here. <b>Print, library copy</b> — no digital copy is known; a research library holds a print copy, which can usually be obtained as a scan or by interlibrary loan through your own library. <b>Print, no copy located</b> — the work is known in print from a catalog record or citation, but no holding was found in the libraries checked. <b>Not located</b> — no copy of any kind has been located yet. Search matches language names, Glottocodes, families and the authors of the works listed.`;
  $('edition').textContent=`${fmt(D.length)} languages · ${plural(works,'work')}${BUILT?' · updated '+BUILT.slice(0,10):''}`;
  $('provnote').textContent=`Works come from Glottolog 5.1's bibliography for each language, from the sources cited in the catalog, and from works found during compilation; access was checked against a research library catalog, HathiTrust, the Internet Archive and open-access indexes, and a print copy can usually be had through your own library by scan request or interlibrary loan. Works are matched across those lists by first author, year and title, so a citation copied differently may appear twice. Works whose access has not been checked are listed as 'not located' unless Glottolog records an open link.${BUILT?' Data updated '+BUILT.replace('T',' ').replace('Z',' UTC')+'.':''} Corrections: open an issue at github.com/accstack/catalog.`; }
async function load(){ try{ const r=await fetch(DATA+'index.json'); if(!r.ok) throw new Error(r.status); D=await r.json(); }catch(err){ $('crit').textContent='The bibliography index could not be loaded.'; return; }
  D.forEach(prep); byGC=new Map(D.map(e=>[e.glottocode,e]));
  try{ const r=await fetch(DATA+'summary.json'); if(r.ok){ const s=await r.json(); BUILT=s.built||''; } }catch(err){}
  legend(); reset(); render();
  const m=location.hash.match(/^#([a-z0-9]{4}\d{4})$/); if(m&&byGC.has(m[1])) openDrawer(m[1]);
  fetch(DATA+'authors.json').then(r=>r.ok?r.json():null).then(a=>{ if(a){ AUTHORS=a; if(state.terms.length) render(); } }).catch(()=>{}); }
load();
})();
