import {drawFork,inspectRoute,pathToCase} from './triage.js';
import {createReplay} from './replay.js';
import {initInvestigations} from './investigate.js';

const $=id=>document.getElementById(id);
const node=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n};
const anchor=(text,href)=>{const a=node('a',text);a.href=href;return a};
const plain=html=>{const t=node('template');t.innerHTML=html;return t.content.textContent.trim()};
const replay=createReplay($('topology'),{
  prev:$('prev'),play:$('play'),next:$('next'),jump:$('jump'),objects:$('objects'),speed:$('speed'),meter:$('meter'),kind:$('kind'),
  phase:$('phase'),direction:$('direction'),state:$('state'),explain:$('explain'),scrub:$('scrub'),counter:$('counter')
});
let cases=[],knowledge,investigations,current=null,mapRoute=null,tab='clue',pane='trace';
function catalog(){
  const q=$('search').value.trim().toLowerCase(),g=$('group').value;
  const rows=cases.filter(c=>(!g||c.section===g)&&(!q||c.search.includes(q)));
  $('available').textContent=`${rows.length} of ${cases.length} cases`;$('list').replaceChildren();
  for(const c of rows){
    const a=anchor('',`#case-${c.id}`);a.setAttribute('aria-current',String(c===current));
    a.append(node('span',c.id),node('b',c.title));$('list').append(a);
  }
  if(!rows.length){
    const p=node('p','No matches. Try a component such as “executor”.'),b=node('button','Clear filters');
    b.onclick=()=>{$('search').value='';$('group').value='';catalog();$('search').focus()};$('list').append(p,b);
  }
}
function noteView(key){
  tab=key;
  document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===key)));
  $('note-title').textContent=({clue:'What to look for',repro:'Try it safely',fix:'Resolution and verification'})[key];
  $('note').innerHTML=current[key];
}
function redraw(){
  if(mapRoute)drawFork($('fork'),mapRoute.question,mapRoute.choices);
  else if(current&&pane==='decision'){
    const d=current.decision;
    drawFork($('decision-chart'),d.question,[{badge:'YES',name:d.yes},{badge:'NO',name:d.no}],{small:true});
  }
}
function showPane(key){
  pane=key;if(key!=='trace')replay.pause();
  for(const name of ['trace','decision','full'])$(`${name}-pane`).hidden=key!==name;
  document.querySelectorAll('[data-pane]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pane===key)));
  redraw();
}
function render(){
  const hash=location.hash.slice(1)||'map';
  const c=cases.find(x=>'case-'+x.id===hash);
  const candidate=hash.startsWith('errors/')?hash.slice(7):'';
  const diagnosis=candidate&&knowledge.records.find(d=>d.id===candidate);
  const which=c?'case':diagnosis?'investigation':hash==='errors'||candidate?'lookup':hash==='sources'?'coverage':'map';
  replay.pause(); current=c??null;mapRoute=which==='map'?inspectRoute(hash,knowledge.records):null;
  for(const id of ['case','map','lookup','investigation','coverage'])$(id).hidden=id!==which;
  $('way-map').setAttribute('aria-current',String(which==='map'||which==='case'));
  $('way-errors').setAttribute('aria-current',String(which==='lookup'||which==='investigation'));
  if(which==='coverage'){
    document.title='Source coverage · Troubleshoot Spark';investigations.sources();
  }else if(which==='lookup'){
    document.title='Error lookup · Troubleshoot Spark';investigations.refresh();
  }else if(which==='investigation'){
    document.title=`${diagnosis.title} · Investigation`;investigations.show(diagnosis.id);
  }else if(which==='map'){
    document.title=`${mapRoute.name} · Troubleshoot Spark`;
    $('map-title').textContent=mapRoute.name;$('map-intro').textContent=mapRoute.description;
    $('crumbs').replaceChildren(...mapRoute.trail.flatMap(([name,url])=>[anchor(name,url),node('span','/')]),node('span',mapRoute.trail.length?'Choose a branch':'PySpark on YARN'));
    redraw();
  }else{
    document.title=`${c.title} · Troubleshoot Spark`;$('case-no').textContent='Case '+c.id;
    $('case-path').href=pathToCase(c.id);$('case-path').textContent=c.section;
    $('start-investigation').href=`#errors/case-${c.id}`;
    $('title').textContent=c.title;$('trigger').innerHTML=c.trigger;
    $('branch-evidence').innerHTML=c.clue;$('branch-fix').innerHTML=c.fix;
    $('full-pane').innerHTML=`<h2>Complete case ${c.id}</h2>${c.full}`;
    $('component-links').replaceChildren(...c.nodes.map(n=>{
      const li=node('li');li.append(anchor(n.name,`components/${n.reference}.html`),node('small',n.host));return li;
    }));
    $('sources').replaceChildren(...c.links.map(l=>{const li=node('li');li.append(anchor(l.label,l.url));return li}));
    for(const [id,offset] of [['previous-case',-1],['next-case',1]]){
      const dest=cases[Number(c.id)-1+offset];$(id).hidden=!dest;if(dest)$(id).href='#case-'+dest.id;
    }
    $('guide-link').href=`scenarios.html#${c.id}-${c.title.toLowerCase().replace(/[^a-z0-9 -]/g,'').replace(/\s+/g,'-')}`;
    showPane('trace');replay.load(c);noteView(tab);
  }
  if(matchMedia('(max-width:720px)').matches)setCatalog(false);
  catalog();
}
function setCatalog(open){
  $('catalog-body').classList.toggle('open',open);
  $('toggle-catalog').setAttribute('aria-expanded',String(open));
  $('toggle-catalog').textContent=open?'Hide list':'Browse 40 cases';
}
async function start(){
  [cases,knowledge]=await Promise.all(['cases.json','knowledge.json'].map(async name=>{
    const res=await fetch(`./${name}?edition=diagnostics-2`);if(!res.ok)throw Error(`${name}: HTTP ${res.status}`);return res.json();
  }));
  investigations=initInvestigations(knowledge,cases);
  for(const c of cases)c.search=[c.id,c.title,c.section,plain(c.full),...c.nodes.map(n=>n.name),
    ...c.events.map(e=>[e.label,e.state,e.detail].join(' '))].join(' ').toLowerCase();
  for(const name of new Set(cases.map(c=>c.section))){const o=node('option',name);o.value=name;$('group').append(o)}
  $('search').oninput=catalog;$('group').onchange=catalog;
  $('toggle-catalog').onclick=()=>setCatalog($('toggle-catalog').getAttribute('aria-expanded')!=='true');
  $('skip').onclick=e=>{e.preventDefault();$('workspace').focus()};
  document.querySelectorAll('[data-pane]').forEach(b=>b.onclick=()=>showPane(b.dataset.pane));
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>noteView(b.dataset.tab));
  window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);$('workspace').focus({preventScroll:true})});
  let prevWidth=0;
  new ResizeObserver(entries=>{
    const width=entries[0].contentRect.width;
    if(prevWidth!==width){prevWidth=width;redraw()}
  }).observe($('workspace'));
  $('load').hidden=true;render();
}
start().catch(e=>{$('load').hidden=false;$('load').textContent=`Could not open the explorer (${e.message}). Reload or use the Field guide above.`});
