const $=id=>document.getElementById(id);
function element(tag,text,cls){
  const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;
}
function link(label,url){const a=element('a',label);a.href=url;return a;}
function choice(label,handler){const b=element('button',label);b.type='button';b.onclick=handler;return b;}
const norm=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const ordinary=new Set(['the','at','for','of','and','a','to','in','org','apache','spark','error','exception','failed','is','com','java','lang']);

export function rank(records,query,kind='all'){
  const q=norm(query.slice(0,12000));
  const tokens=new Set(q.split(' ').filter(w=>w.length>2&&!ordinary.has(w)));
  function score(d){
    if(!q)return 1;
    let best=0;
    for(const s of [d.title,...d.aliases]){
      const a=norm(s);if(!a)continue;
      if(q===a)best=Math.max(best,140+a.length/100);
      else if((` ${q} `).includes(` ${a} `))best=Math.max(best,(d.id==='handoff'?36:90)+Math.min(a.length,60)/3);
      else if(a.includes(q))best=Math.max(best,64+Math.min(q.length,40)/4);
      else{
        const words=a.split(' ').filter(w=>w.length>2&&!ordinary.has(w));
        const hit=words.filter(t=>tokens.has(t)).length;
        if(hit>=2&&hit>=words.length*.65)best=Math.max(best,40+hit);
      }
    }
    return best;
  }
  return records.filter(d=>kind==='all'||d.kind===kind).map(d=>[score(d),d]).filter(([s])=>s)
    .sort(([a,x],[b,y])=>b-a || x.title.localeCompare(y.title)).map(([,d])=>d);
}

export function investigateStep(record,index,answer){
  if(!record.checks[index])throw Error('Unknown diagnostic check');
  if(answer==='yes')return {index,status:'supported'};
  if(answer==='unknown')return {index,status:'evidence'};
  if(answer==='no')return index+1<record.checks.length?{index:index+1,status:'ask'}:{index,status:'unresolved'};
  throw Error('Unknown observation');
}
const upstreamUrl=slug=>`https://holdenk.github.io/spark-flowchart/details/${slug}/`;
export function initInvestigations(knowledge,cases){
  const {records,coverage,rev}=knowledge, byId=new Map(records.map(d=>[d.id,d]));
  let current=null,progress=null,answers=[];
  function linked(id){const d=byId.get(id);return link(d.title,`#errors/${d.id}`);}
  function refresh(){
    const list=rank(records,$('log-query').value,$('error-kind').value);
    $('match-count').textContent=`${list.length} matching ${list.length===1?'investigation':'investigations'}`;
    $('error-pick').replaceChildren(element('option','Select an error or symptom…'));
    $('error-pick').options[0].value='';
    for(const d of list){const opt=element('option',d.title);opt.value=d.id;$('error-pick').append(opt);}
    $('match-list').replaceChildren(...list.map(d=>{
      const li=element('li'),a=linked(d.id);
      a.append(element('small',`${d.kind==='error'?'Exception / failure':'Symptom'} · ${d.aliases[0]||d.title}`));
      li.append(a);return li;
    }));
    if(!list.length){const li=element('li','No match. Try the innermost exception class, or ');li.append(link('start an unclassified-error investigation','#errors/handoff'),'.');$('match-list').append(li)}
  }
  function refs(){
    const root=$('diagnostic-refs');root.replaceChildren();
    for(const url of current.primary){
      const tail=url.split('/').filter(Boolean).at(-1);
      const host=new URL(url).hostname;
      const label=host==='github.com'?tail:`${host==='spark.apache.org'?'Apache Spark':host} · ${tail.replace('.html','').replaceAll('-',' ')}`;
      const li=element('li');li.append(link(label,url));root.append(li);
    }
    for(const s of current.upstream){const li=element('li');li.append(link('Advanced Topics · '+s,upstreamUrl(s)));root.append(li);}
  }
  function alternatives(parent){
    parent.append(element('h3','Other explanations to check'));
    const list=element('ul');for(const id of current.related){const li=element('li');li.append(linked(id));list.append(li)}parent.append(list);
  }
  function setStatus(answer){
    answers.push({...progress,answer});
    progress=investigateStep(current,progress.index,answer);
    renderProbe(true);
  }
  function renderProbe(focus=false){
    const p=$('probe'),d=current,{index,status}=progress,check=d.checks[index];
    p.replaceChildren();p.append(element('small',`Observation ${index+1} of ${d.checks.length}`,'meta'));
    if(status==='unresolved'){
      p.append(element('h2','The available evidence does not establish this cause.'),
        element('p','Preserve the first exception, process or container ID, stage and task attempt, input snapshot and deployed versions. Compare one failing and one successful attempt before changing a limit.'));
      alternatives(p);
    }else if(status==='supported'){
      p.append(element('h2','Resolution for this finding'),element('p',check.question,'observation'),
        element('h3','Change'),element('p',check.action),element('h3','Verify on the original workload'),element('p',check.verify));
      if(d.checks.length>index+1)p.append(choice('Examine the next hypothesis',()=>setStatus('no')));
      alternatives(p);
    }else{
      p.append(element('h2',check.question),element('h3',status==='evidence'?'Gather this evidence first':'Where to look'),element('p',check.inspect));
      if(status==='evidence')p.append(element('p','Not checked is not the same as no. Leave settings unchanged until an observation supports a branch.','observation'));
      const buttons=element('div',undefined,'answer-row');
      buttons.append(choice('Yes, observed',()=>setStatus('yes')),choice('No, not observed',()=>setStatus('no')));
      if(status!=='evidence')buttons.append(choice('Not checked yet',()=>setStatus('unknown')));
      p.append(buttons);
    }
    if(answers.length)p.append(choice('← Previous observation',()=>{const last=answers.pop();progress={index:last.index,status:last.status};renderProbe(true)}));
    if(focus){p.tabIndex=-1;p.focus({preventScroll:true});}
  }
  function show(id){
    current=byId.get(id);if(!current)return false;
    const d=current;progress={index:0,status:'ask'};answers=[];
    $('investigate-name').textContent=d.title;$('investigate-scope').textContent=d.scope;
    $('safe-comparison').textContent=d.reproduce;
    $('via-map').href='#map/'+d.branch;$('signatures').replaceChildren(...d.aliases.map(s=>element('code',s)));
    $('investigate-kind').textContent=d.kind==='error'?'Error / exception':'Performance or runtime symptom';
    $('case-links').replaceChildren(...d.cases.map(id=>{
      const c=cases.find(c=>c.id===id);return link(`Replay ${id}: ${c.title}`,`#case-${id}`);
    }));
    $('all-probes').replaceChildren(...d.checks.map((c,i)=>{
      const s=element('section');s.append(element('h3',`${i+1}. ${c.question}`),
        element('p','Inspect: '+c.inspect),element('p','If observed: '+c.action),element('p','Verify: '+c.verify));return s;
    }));
    $('all-probes').parentElement.open=false;renderProbe();refs();
    return true;
  }
  function sources(){
    const box=$('coverage-items');box.replaceChildren();
    for(const p of coverage){
      const item=element('li'),title=element('h3');
      title.append(link(`${p.section}/${p.slug}`,`https://github.com/holdenk/spark-flowchart/blob/${rev}/docs/${p.section}/${p.slug}.md`));
      item.append(title,element('small',p.type));
      if(p.nodes){
        const details=element('details');details.append(element('summary',`Inspect ${p.nodes.length} branch mappings`));
        for(const n of p.nodes){const line=element('p',n.node+' → ');n.targets.forEach((id,i)=>{if(i)line.append(' · ');line.append(linked(id))});details.append(line)}item.append(details);
      }else{const line=element('p');p.targets.forEach((id,i)=>{if(i)line.append(' · ');line.append(linked(id))});item.append(line);}
      box.append(item);
    }
  }
  $('log-query').oninput=refresh;$('error-kind').onchange=refresh;
  $('error-pick').onchange=()=>{if($('error-pick').value)location.hash='errors/'+$('error-pick').value};
  $('clear-log').onclick=()=>{$('log-query').value='';$('error-kind').value='all';refresh();$('log-query').focus()};
  for(const button of document.querySelectorAll('[data-query]'))button.onclick=()=>{
    $('log-query').value=button.dataset.query;$('error-kind').value='all';refresh();$('log-query').focus();
  };
  refresh();
  return {show,refresh,sources};
}
