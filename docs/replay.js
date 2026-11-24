import {svg} from './triage.js';

const colors={
  control:'#97bef9',data:'#dfb2ff',decision:'#f6d888',
  blocked:'#ff947d',failure:'#ff947d',recovery:'#87dfc3'
};
export const kinds={control:'Control',data:'Data',decision:'Decision',blocked:'Blocked',failure:'Failure',recovery:'Recovery'};
const make=(tag,a,v)=>svg(tag,a,v);
const path=(d,attrs)=>make('path',{d,...attrs});
// Isometric process and storage glyphs. The small unit on a wire depicts a message, not elapsed Spark time.
function glyph(kind){
  const g=make('g',{class:'machine'});
  if(kind==='disk'){
    g.append(path('M-24 -12 v24 c0 13 48 13 48 0 v-24Z',{fill:'#233f55'}),make('ellipse',{cx:0,cy:-12,rx:24,ry:9,fill:'#36576c'}));
    for(const y of [0,9])g.append(path(`M-24 ${y} c0 13 48 13 48 0`,{fill:'none'}));
  }else if(kind==='plan'){
    for(const y of [9,1,-7])g.append(path(`M-27 ${y} l20 -13 32 6 -21 15z`,{fill:y===-7?'#3c526a':'#223347'}));
    g.append(path('M-8 -12 l16 3 m-20 2 11 2',{fill:'none'}));
  }else if(kind==='python'){
    g.append(make('rect',{x:-25,y:-18,width:50,height:35,rx:4,fill:'#27394f'}),path('M-25 -9h50 M-15 -3l6 5-6 5m12 0h9 M-12 22h24',{fill:'none'}));
  }else{
    const rack=kind==='worker'?2:kind==='service'?3:1;
    for(let i=rack-1;i>=0;i--){
      const y=i*7-(rack-1)*4;
      g.append(path(`M-24 ${y-9}l19 -10 29 9 -19 11z`,{fill:'#48637d'}),
        path(`M-24 ${y-9}l29 10v10l-29 -10z`,{fill:'#283f56'}),
        path(`M5 ${y+1}l19 -11v10L5 ${y+11}z`,{fill:'#1c3046'}));
      g.append(path(`M-19 ${y-3}l4 1`,{stroke:'#99e1c8','stroke-width':2.5}));
    }
    if(kind==='scheduler')g.append(path('M-7 -13l5 -3 8 2-5 3z',{fill:'#b2d9e2'}));
  }
  return g;
}
const bend=(x,y)=>`${Math.round(x)} ${Math.round(y)}`;
function route(a,b){
  if(a===b)return `M${bend(a.x-23,a.y-9)} C${bend(a.x-70,a.y-66)} ${bend(a.x+68,a.y-66)} ${bend(a.x+24,a.y-11)}`;
  const dx=b.x-a.x,dy=b.y-a.y;
  if(dy===0){
    const s=Math.sign(dx), lift=Math.abs(dx)>260?55:20;
    return `M${bend(a.x+s*30,a.y-5)} Q${bend((a.x+b.x)/2,a.y-lift)} ${bend(b.x-s*30,b.y-5)}`;
  }
  const s=dx===0?(a.x>250?-1:1):Math.sign(dx), e=dx===0?s:-s;
  return `M${bend(a.x+s*27,a.y)} C${bend(a.x+s*82,a.y)} ${bend(b.x+e*82,b.y)} ${bend(b.x+e*27,b.y)}`;
}
function positions(nodes,compact){
  const cols=compact?2:nodes.length<5?2:3, w=compact?390:660, rowH=compact?136:145;
  const rows=Math.ceil(nodes.length/cols), height=rows*rowH+27, layout=new Map();
  nodes.forEach((n,i)=>{
    const row=Math.floor(i/cols), count=Math.min(cols,nodes.length-row*cols);
    layout.set(n.key,{x:w*(i%cols+0.5)/count,y:rowH*row+62});
  });
  return {w,height,layout};
}
const cube='M0 -7l8 4-8 4-8-4z M-8 -3v8l8 4 8-4v-8 M0 1v8';
const specimenColors={known:'#a6caff',pending:'#7890a4',missing:'#ff947d',building:'#f6d888',ready:'#87dfc3'};
export function specimenState(specimen,eventNumber){
  let s=specimen.initial;
  for(const [n,state] of Object.entries(specimen.changes))if(+n<=eventNumber)s=state;
  return s;
}
const dotMark=(k,payload)=>{
  const g=make('g');
  if(payload==='block')g.append(path(cube,{stroke:'#e7fff5',fill:'#308d79','stroke-width':2}));
  else if(k==='blocked'||k==='failure')g.append(make('circle',{r:8.5,fill:colors[k]}),path('M-3 -3l6 6m0-6-6 6',{stroke:'#351e19','stroke-width':2.3}));
  else if(k==='data')g.append(make('rect',{x:-8,y:-6,width:16,height:12,rx:2,fill:colors[k]}),path('M-5 -2h10m-10 4h7',{stroke:'#3a214c','stroke-width':1.5}));
  else if(k==='decision')g.append(path('M0 -8l8 8-8 8-8-8Z',{fill:colors[k]}));
  else g.append(make('circle',{r:7,fill:colors[k]}),make('circle',{r:2,fill:'#182b38'}));
  return g;
};

export function createReplay(host,ui){
  let c, index=0, pos=0, playing=false, raf=0, last=null, speed=1;
  let layout, picture, historyLayer, edgeLayer, nodeLayer, flight, arc, pulse, edges=[], nodeViews;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const duration=3300;
  function stop(){playing=false;cancelAnimationFrame(raf);raf=0;last=null;}
  function controls(){
    const final=index===c.events.length-1&&pos>=1;
    ui.play.textContent=playing?'Ⅱ Pause':final?'↺ Replay':pos>0&&pos<1?'▶ Resume':'▶ Play trace';
    ui.play.setAttribute('aria-label',playing?'Pause trace':final?'Replay trace from the beginning':'Play trace');
    ui.counter.textContent=`Event ${index+1} of ${c.events.length}`;
    ui.prev.disabled=index===0;ui.next.disabled=index===c.events.length-1;
    [...ui.scrub.children].forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
  }
  function skeleton(){
    const {w,height,layout:l}=positions(c.nodes,host.clientWidth<500);
    layout=l;picture=make('svg',{viewBox:`0 0 ${w} ${height}`,role:'img','aria-label':`Component map: ${c.nodes.map(n=>n.name).join(', ')}`});
    picture.append(make('title',{},'Execution topology for '+c.title));
    historyLayer=make('g',{class:'ghost-links'});edgeLayer=make('g');nodeLayer=make('g');
    picture.append(historyLayer,edgeLayer,nodeLayer);
    const distinct=new Set();edges=[];
    c.events.forEach(e=>{
      const key=[e.from,e.to].sort().join(':');
      if(distinct.has(key)||e.from===e.to)return;
      distinct.add(key);
      const wire=path(route(l.get(e.from),l.get(e.to)),{fill:'none','stroke-width':1.6,stroke:'#405675','stroke-dasharray':'3 5'});
      historyLayer.append(wire);edges.push(wire);
    });
    nodeViews=new Map();
    for(const n of c.nodes){
      const at=l.get(n.key),g=make('g',{transform:`translate(${at.x} ${at.y})`,class:'actor-node','data-node':n.key});
      g.append(make('title',{},`${n.name} · ${n.host}`));
      const base=make('ellipse',{cx:0,cy:12,rx:37,ry:13,class:'platform'}),halo=make('ellipse',{cx:0,cy:11,rx:39,ry:15,class:'signal-halo'});
      g.append(base,halo,glyph(n.icon),make('text',{y:44,'text-anchor':'middle',class:'actor-name'},n.name),
        make('text',{y:60,'text-anchor':'middle',class:'actor-host'},n.host));
      const status=make('text',{y:77,'text-anchor':'middle',class:'actor-state'});g.append(status);
      const flag=make('g',{transform:'translate(26 -21)',class:'state-flag'});
      flag.append(make('circle',{r:8}),make('text',{y:3.5,'text-anchor':'middle'}));g.append(flag);
      const object=c.specimens?.find(s=>s.node===n.key);
      let sample;
      if(object){
        sample=make('g',{transform:'translate(-37 -23)',class:'specimen'});
        sample.append(make('title',{},object.name),make('circle',{r:12,fill:'#0d1c2a'}),path(
          object.type==='block'?cube:object.type==='attempt'?'M-7 -7H7V6H-7z M-4 1h8 M-4 4h3':'M-6 -8h8l4 4V8H-6Z M1 -8v5h5 M-3 1h6 M-3 4h5',
          {fill:'none','stroke-width':1.8}),path('M-9 9l18-18',{class:'strike','stroke-width':2.6}));
        g.append(sample);
      }
      nodeViews.set(n.key,{g,flag,halo,status,name:n.name,object,sample});nodeLayer.append(g);
    }
    host.replaceChildren(picture);
  }
  function paintState(arrived){
    const now=c.events[index], states=new Map();
    for(const e of c.events.slice(0,index+(arrived?1:0)))states.set(e.kind==='blocked'?e.from:e.to,e);
    const visited=new Set(c.events.slice(0,index+1).flatMap(e=>[e.from,e.to]));
    for(const [key,{g,flag,halo,status,name,object,sample}] of nodeViews){
      const state=states.get(key),active=key===now.from||key===now.to;
      g.classList.toggle('participating',active);
      g.classList.toggle('not-yet-seen',!visited.has(key));
      halo.style.stroke=active?colors[now.kind]:'transparent';
      flag.style.visibility=state?'visible':'hidden';
      status.textContent=state?.state??'';
      status.setAttribute('fill',state?colors[state.kind]:'none');
      g.querySelector('title').textContent=state?`${name}: ${state.state}`:name;
      if(state){
        flag.querySelector('circle').setAttribute('fill',colors[state.kind]);
        flag.querySelector('text').textContent=state.kind==='blocked'||state.kind==='failure'?'×':state.kind==='decision'?'?':'✓';
      }
      if(sample){
        const s=specimenState(object,index+(arrived?1:0));
        sample.setAttribute('data-state',s);sample.style.stroke=specimenColors[s];
        sample.querySelector('title').textContent=`${object.name}: ${s}`;
      }
    }
    ui.state.textContent=arrived?now.state:!playing&&pos===0?'Ready to replay':'In progress';
    ui.objects.replaceChildren(...(c.specimens??[]).map(s=>{
      const part=document.createElement('span'),state=specimenState(s,index+(arrived?1:0));
      part.dataset.state=state;part.style.color=specimenColors[state];part.textContent=`${s.name}: ${state}`;return part;
    }));
    ui.objects.hidden=!c.specimens;
  }
  let settled;
  function frame(){
    // With reduced motion the causal path, direction, outcome and message are still visible.
    const e=c.events[index], t=Math.min(pos/.79,1), shown=reduced.matches?1:t;
    const limit=e.kind==='blocked' ? 0.64 : 1;
    const at=arc.getPointAtLength(arc.getTotalLength()*shown*limit);
    flight.setAttribute('transform',`translate(${at.x} ${at.y})`);
    pulse.style.strokeDasharray=`${Math.max(.001,shown*limit)} 1`;
    if(settled!==(t===1)){settled=t===1;paintState(settled);}
    ui.meter.style.transform=`scaleX(${pos})`;
  }
  function eventView(){
    const e=c.events[index], from=c.nodes.find(n=>n.key===e.from),to=c.nodes.find(n=>n.key===e.to);
    ui.phase.textContent=e.label;ui.explain.textContent=e.detail;
    ui.direction.textContent=from===to?`${from.name} · internal operation`:`${from.name} → ${to.name}`;
    ui.kind.textContent=kinds[e.kind];ui.kind.style.color=colors[e.kind];
    const d=route(layout.get(e.from),layout.get(e.to)),color=colors[e.kind];
    arc=path(d,{fill:'none',stroke:color,'stroke-width':2,'stroke-opacity':.35,'stroke-dasharray':e.kind==='blocked'?'4 5':''});
    pulse=path(d,{fill:'none',stroke:color,'stroke-width':3,'stroke-linecap':'round',pathLength:1});
    flight=dotMark(e.kind,e.payload);flight.classList.add('payload');
    edgeLayer.replaceChildren(arc,pulse);
    const len=arc.getTotalLength(),end=arc.getPointAtLength(len),before=arc.getPointAtLength(Math.max(len-2,0));
    const angle=Math.atan2(end.y-before.y,end.x-before.x)*180/Math.PI;
    edgeLayer.append(path('M-9 -4 L0 0 -9 4',{transform:`translate(${end.x} ${end.y}) rotate(${angle})`,stroke:color,fill:'none','stroke-width':2}));
    edgeLayer.append(flight);
    settled=undefined;frame();controls();
  }
  function tick(ts){
    if(!playing)return;
    if(last!==null)pos=Math.min(1,pos+(ts-last)*speed/duration);
    last=ts;
    if(pos>=1 && index<c.events.length-1){index++;pos=0;eventView();}
    else if(pos>=1){stop();controls();}
    frame();
    if(playing)raf=requestAnimationFrame(tick);
  }
  function choose(i){
    if(!c||i<0||i>=c.events.length)return;
    stop();index=i;pos=1;eventView();
  }
  function play(){
    if(playing){stop();controls();return;}
    if(pos>=1){if(index===c.events.length-1)index=0;pos=0;}
    playing=true;last=null;eventView();raf=requestAnimationFrame(tick);
  }
  function pause(){if(playing){stop();controls();}}
  ui.play.onclick=play;ui.prev.onclick=()=>choose(index-1);ui.next.onclick=()=>choose(index+1);
  ui.jump.onclick=()=>choose(c.events.findIndex(e=>e.kind==='blocked'||e.kind==='failure'));
  ui.speed.onchange=()=>{speed=Number(ui.speed.value)};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
  let small;
  new ResizeObserver(()=>{if(!c||!host.clientWidth)return;const next=host.clientWidth<500;
    if(next!==small){small=next;skeleton();eventView();}}).observe(host);
  reduced.addEventListener('change',()=>{if(c)frame()});
  return {pause,choose,load(caseData){
    stop();c=caseData;index=0;pos=0;
    ui.jump.hidden=!c.events.some(e=>e.kind==='blocked'||e.kind==='failure');
    ui.scrub.replaceChildren(...c.events.map((e,i)=>{
      const b=document.createElement('button');b.type='button';b.textContent=String(i+1);
      b.title=e.label;b.setAttribute('aria-label',`Event ${i+1}: ${e.label}`);b.onclick=()=>choose(i);return b;
    }));
    small=host.clientWidth<500;skeleton();eventView();
  }};
}
