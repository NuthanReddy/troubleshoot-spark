export const groups = {
  launch: {name:'Startup or capacity', hint:'Check grants, registration and the submit process.', question:'Which startup milestone is missing?', branches:[
    ['capacity','Resources or slots','The queue, executor target, and idle-removal policy.', ['01','05','06']],
    ['registration','Driver or executor registration','Separate a running YARN container from a usable Spark slot.', ['02','03','04']],
    ['submission','Submission is slow or exits early','Look before the first action reaches the driver.', ['21','22']]
  ]},
  execution: {name:'Exception or lost process', hint:'Identify the first process or task that failed.', question:'What stopped or reported the first error?', branches:[
    ['python','Python import, closure or task','Inspect the earliest Python or serialization exception.', ['12','23','24','25']],
    ['executor','Executor or task attempt','Compare Spark attempt IDs with YARN container diagnostics.', ['13','14','15','16']],
    ['memory','Memory, disk or stack exhaustion','Identify the process and the resource whose limit was reached.', []],
    ['driver','A driver-side exchange or sample','Inspect the build side, range sampling job and cumulative result limit.', []],
    ['serialization','Serialization or task launch','Distinguish a single row, one buffer, and a whole RPC launch payload.', []],
    ['shuffle','Shuffle lookup, integrity or transport','Follow metadata, serving host and block bytes separately.', []],
    ['analysis','Query rejected or exception wrapped','Start at the structured condition or the earliest nested cause.', []],
    ['application','Job or entire application attempt','Check the cancellation group and YARN attempt ID.', ['19','20']]
  ]},
  performance: {name:'Slow or unexpected stage', hint:'Compare task counts, bytes, and the final plan.', question:'What distinguishes the slow stage?', branches:[
    ['sql','Physical SQL plan changed','Find Python evaluation, broadcast, skew, pruning or coalescing.', ['08','09','10','34','35']],
    ['work','Too little parallelism or extra jobs','Count partitions and distinguish operator semantics from resource limits.', ['27','28','29','30']],
    ['read','Slow scan, projection or benchmark','Compare actual columns read and work performed, not just source syntax.', []],
    ['shape','Skew, partition width or a slow host','Follow the task index and executor ID across attempts.', []],
    ['retention','Cache, checkpoint, spill or broadcast','Identify which data survives and where it is stored.', ['07','31','32','33']]
  ]},
  data: {name:'Data movement or output', hint:'Separate missing bytes, read errors and failed publication.', question:'Where does the data path diverge?', branches:[
    ['transfer','Shuffle or result transfer','Find the serving address, result size or large partition.', ['11','17','26']],
    ['files','Input file or schema','Check whether the file is absent or cannot be decoded.', ['36','37']],
    ['write','File count, contents or commit','Compare successful task output with published files.', ['18','38','39','40']]
  ]}
};

const ns='http://www.w3.org/2000/svg';
export function svg(tag,attrs={},value) {
  const n=document.createElementNS(ns,tag);
  for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);
  if(value!=null)n.textContent=value;
  return n;
}
function rows(text,max){
  const lines=[''];
  for(const w of text.split(' ')){
    const i=lines.length-1;
    if(lines[i]&&lines[i].length+w.length+1>max)lines.push(w);
    else lines[i]+=(lines[i]?' ':'')+w;
  }
  return lines;
}
function multiline(parent,title,x,y,max,klass,lineHeight,center=false){
  const words=rows(title,max);
  const n=svg('text',{x,y:y-(words.length-1)*lineHeight/2,class:klass,'text-anchor':center?'middle':'start'});
  words.forEach((line,i)=>n.append(svg('tspan',{x,dy:i?lineHeight:0},line)));
  parent.append(n);
}

// The vertical layout keeps the branch wires and touch targets visible on a narrow screen.
export function drawFork(host,question,choices,{small=false}={}){
  const narrow=host.clientWidth<610, width=narrow?360:840;
  const row=narrow?103:86,rx=narrow?140:131;
  const lineWidth=narrow?21:20,questionLines=rows(question,lineWidth);
  const ry=Math.max(narrow?46:70,questionLines.length*18+12);
  const top=narrow?2*ry+30:10,height=Math.max(top+choices.length*row+10,narrow?0:2*ry+22);
  const rootX=150,rootY=narrow?ry+6:height/2;
  const branchX=narrow?52:358, branchW=narrow?295:456, branchH=row-12;
  const chart=svg('svg',{viewBox:`0 0 ${width} ${height}`,class:'fork-svg',role:'group','aria-label':question});
  chart.append(svg('title',{},question));
  const trunk=narrow?25:311;
  for(const [i,c] of choices.entries()){
    const cy=top+row*i+row/2, start=narrow?`M${rootX},${rootY+ry} V${top-10} H${trunk}`:`M${rootX+rx},${rootY} H${trunk}`;
    chart.append(svg('path',{d:`${start} V${cy} H${branchX-5}`,class:'fork-wire'}));
    chart.append(svg('path',{d:`M${branchX-12} ${cy-4} l8 4 -8 4`,class:'fork-arrow'}));
    const g=svg(c.href?'a':'g',c.href?{href:c.href,'aria-label':`${c.badge}: ${c.name}`,class:'fork-choice'}:{});
    g.append(svg('rect',{x:branchX,y:cy-branchH/2,width:branchW,height:branchH,rx:7,class:'fork-box'}));
    g.append(svg('text',{x:branchX+14,y:cy-branchH/2+18,class:'fork-badge'},c.badge));
    multiline(g,c.name,branchX+14,cy+14,narrow?30:48,'fork-name',17);
    if(c.href)g.append(svg('text',{x:branchX+branchW-22,y:cy+7,class:'fork-out'},'›'));
    chart.append(g);
  }
  chart.append(svg('path',{d:`M${rootX-rx},${rootY} l${rx},${-ry} ${rx},${ry} ${-rx},${ry} Z`,class:'fork-diamond'}));
  multiline(chart,question,rootX,rootY+4,lineWidth,'fork-question',17,true);
  host.classList.toggle('small-fork',small);
  host.replaceChildren(chart);
}
export function inspectRoute(hash,records){
  const bits=hash.split('/'),g=groups[bits[1]],b=g?.branches.find(x=>x[0]===bits[2]);
  const under=path=>records.filter(d=>d.branch===path||d.branch.startsWith(path+'/'));
  if(b)return {question:'Which observation fits?', trail:[['Diagnostic map','#map'],[g.name,`#map/${bits[1]}`]],
    description:b[2],name:b[1],choices:under(`${bits[1]}/${b[0]}`).map(d=>({badge:d.kind.toUpperCase(),name:d.title,href:`#errors/${d.id}`}))};
  if(g)return {question:g.question,trail:[['Diagnostic map','#map']],description:g.hint,name:g.name,
    choices:g.branches.map(([key,name])=>({badge:`${under(bits[1]+'/'+key).length} INVESTIGATIONS`,name,href:`#map/${bits[1]}/${key}`}))};
  return {question:'What happened first?',name:'Find the first broken handoff',trail:[],
    description:'Follow the symptom through the flowchart. Choose a branch to narrow it down to an observable case.',
    choices:Object.entries(groups).map(([key,g])=>({badge:`${under(key).length} INVESTIGATIONS`,name:g.name,href:`#map/${key}`}))};
}
export function pathToCase(id){
  for(const [key,g] of Object.entries(groups))for(const b of g.branches)if(b[3].includes(id))return `#map/${key}/${b[0]}`;
  throw Error(`Case ${id} missing from diagnostic map`);
}
