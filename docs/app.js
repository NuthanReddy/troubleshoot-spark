const $ = id => document.getElementById(id);
// Short labels for the three source-traced steps. The full explanation always remains available.
const labels = [
 ['Check capacity','Add overhead','Reject request'],['Start Python','Await context','Time out'],['Grant container','Call driver','Registration stalls'],['Lose connection','Classify exit','Clean containers'],
 ['Observe backlog','Raise target','Register capacity'],['Track idleness','Check eligibility','Remove executor'],['Request partition','Look up block','Read or rebuild'],['Plan predicate','Evaluate batch','Attach results'],
 ['Select build side','Broadcast relation','Probe locally'],['Measure skew','Split reads','Schedule pairs'],['Fetch fails','Invalidate output','Rebuild and retry'],['Report exception','Count failures','Abort task set'],
 ['Flag straggler','Launch sibling','Accept winner'],['Check last seen','Expire executor','Reschedule work'],['Reclaim container','Classify loss','Retry task'],['Enforce limit','Classify memory kill','Replace executor'],
 ['Serialize results','Count bytes','Abort collection'],['Commit tasks','Commit job','Abort on error'],['Match job group','Cancel stages','Keep context'],['Attempt lost','Allocate new AM','Re-enter script'],
 ['Package JARs','Stage archive','Reuse distribution'],['Submit app','Read one report','Continue on YARN'],['Import fails','Register archive','Set worker path'],['Start worker','Compare versions','Reject command'],
 ['Serialize closure','Reject context','Capture value'],['Request partition','Serve records','Stop or continue'],['Scan first split','Expand search','Return sample'],['Require all rows','Single task','Consider keyed ranks'],
 ['Pack values','Merge partials','Reduce by key'],['Narrow dependency','One busy task','Compare shuffle'],['Mark checkpoint','Write partitions','Cut lineage'],['Request memory','Spill locally','Report metrics'],
 ['Evict copies','Destroy handle','Reject reuse'],['Read map stats','Group partitions','Launch readers'],['Analyze filters','Prune index','Scan fewer files'],['Request INT','Reject conversion','Isolate batch'],
 ['Open split','Classify exception','Skip or fail'],['Check path','Apply save mode','Skip insertion'],['Plan overwrite','Stage touched paths','Replace dates'],['Set file limit','Roll writer','Commit files']
];
const shapes=[
 '<path d="M4 10 20 4l16 6-16 7zM4 10v17l16 9 16-9V10M20 17v19"/><path d="m10 19 5 3"/>',
 '<rect x="5" y="7" width="30" height="10" rx="2"/><rect x="5" y="23" width="30" height="10" rx="2"/><path d="M10 12h1m4 0h5m-10 16h1m4 0h5"/>',
 '<path d="M6 20h9m9-10h9m-9 20h9M15 20c5 0 4-10 9-10m-9 10c5 0 4 10 9 10"/><circle cx="5" cy="20" r="2"/><circle cx="35" cy="10" r="2"/><circle cx="35" cy="30" r="2"/>'
];
let data=[],current,step=0,timer=0,tab='clue';
const plain=s=>{const t=document.createElement('template');t.innerHTML=s;return t.content.textContent};
const el=(name,text)=>{const x=document.createElement(name);if(text!==undefined)x.textContent=text;return x};
function stop(){clearInterval(timer);timer=0;$('play').textContent='▶ Play trace';}
function showStep(i){
  step=i;[...$('nodes').children].forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));
  $('explain').innerHTML=current.steps[i];$('phase').textContent=labels[Number(current.id)-1][i];
  $('counter').textContent=`Step ${i+1} / 3`;$('prev').disabled=i===0;$('next').disabled=i===2;
}
function notes(key){
  tab=key;document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===key)));
  $('noteTitle').textContent=({clue:'What to look for',repro:'Try it safely',fix:'Resolution and verification'})[key];
  $('note').innerHTML=current[key];
}
function catalog(){
  const q=$('search').value.trim().toLowerCase(),g=$('group').value;
  const rows=data.filter(c=>(!g||c.section===g)&&(!q||c.haystack.includes(q)));
  $('available').textContent=`${rows.length} of ${data.length} cases`;$('list').replaceChildren();
  for(const c of rows){const a=el('a');a.href=`#case-${c.id}`;a.setAttribute('aria-current',String(current?.id===c.id));a.append(el('span',c.id),el('b',c.title));$('list').append(a);}
  if(!rows.length){const p=el('p','No cases match. Try a component such as “executor”, or clear the filters.');p.className='empty';const b=el('button','Clear filters');b.onclick=()=>{$('search').value='';$('group').value='';catalog();$('search').focus()};$('list').append(p,b);}
}
function openCase(){
  stop();const wanted=location.hash.match(/^#case-(\d{2})$/)?.[1]??'11';
  current=data.find(c=>c.id===wanted)??data[10];const i=Number(current.id)-1;
  document.title=`${current.title} · Troubleshoot Spark`;$('caseNo').textContent=`Case ${current.id}`;$('section').textContent=current.section;
  $('title').textContent=current.title;$('trigger').innerHTML=current.trigger;$('nodes').replaceChildren();
  const figure=({'11':['shuffle-recovery','Failed fetch, invalidated output, map rebuild, then successful retry.'],'20':['am-restart','Lost AM container, a new YARN attempt, then script re-entry.'],'36':['parquet-mismatch','Requested and stored types disagree; read natively and normalize the batch.']})[current.id];
  $('recovery').hidden=!figure;$('recovery').open=false;
  if(figure){$('figure').src=`pyspark-yarn-media/${figure[0]}.svg`;$('figure').alt=figure[1]}else{$('figure').removeAttribute('src')}
  labels[i].forEach((name,j)=>{const b=el('button');b.className='nodestep';b.setAttribute('aria-label',`Step ${j+1}: ${name}`);
    const icon=el('span');icon.className='chip';icon.innerHTML=`<svg viewBox="0 0 40 40" aria-hidden="true">${shapes[j]}</svg>`;b.append(icon,el('span',name));
    b.onclick=()=>{stop();showStep(j)};$('nodes').append(b);});
  $('actors').replaceChildren(...current.route.map(x=>el('li',x)));
  $('steps').replaceChildren(...current.steps.map(s=>{const l=el('li');l.innerHTML=s;return l}));
  $('sources').replaceChildren(...current.links.map(link=>{const l=el('li'),a=el('a',link.label);a.href=link.url;l.append(a);return l}));
  $('previousCase').disabled=!i;$('nextCase').disabled=i===data.length-1;showStep(0);notes(tab);catalog();
}
async function start(){
  const response=await fetch('./cases.json');if(!response.ok)throw Error(`HTTP ${response.status}`);data=await response.json();
  if(data.length!==labels.length)throw Error('Catalog and trace labels differ');
  for(const c of data)c.haystack=[c.id,c.title,c.section,...c.route,...[c.trigger,c.clue,c.repro,c.fix,...c.steps].map(plain)].join(' ').toLowerCase();
  for(const name of new Set(data.map(c=>c.section))){const o=el('option',name);o.value=name;$('group').append(o)}
  $('total').textContent=data.length;$('search').oninput=catalog;$('group').onchange=catalog;
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>notes(b.dataset.tab));
  $('prev').onclick=()=>{stop();showStep(step-1)};$('next').onclick=()=>{stop();showStep(step+1)};
  $('play').onclick=()=>{if(timer){stop();return}if(step===2)showStep(0);$('play').textContent='Ⅱ Pause trace';timer=setInterval(()=>{showStep(step+1);if(step===2)stop()},2800)};
  $('previousCase').onclick=()=>{location.hash=`case-${data[Number(current.id)-2].id}`};$('nextCase').onclick=()=>{location.hash=`case-${data[Number(current.id)].id}`};
  window.addEventListener('hashchange',openCase);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
  openCase();$('load').hidden=true;$('content').hidden=false;
}
start().catch(err=>{$('load').textContent=`Could not load the scenario catalog (${err.message}). Reload this page, or open All scenarios above.`;});
