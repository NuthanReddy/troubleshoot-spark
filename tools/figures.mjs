import fs from 'node:fs';
import path from 'node:path';
const figures={
  'shuffle-recovery':['A reducer loses its shuffle input','Missing bytes do not travel through the driver.',[
    ['01  FETCH','Reduce executor','Requests map block','from the original host.','#8bb7ff'],
    ['02  FAILURE','Driver scheduler','FetchFailed invalidates','the old map location.','#ffaf91'],
    ['03  REBUILD','Map executor','Recomputes the lost','producer partition.','#ffda87'],
    ['04  RETRY','Reduce executor','Fetches the new block','and finishes its task.','#87ded0']]],
  'am-restart':['YARN restarts the attempt, not the stack','Application ID stays the same. Attempt ID changes.',[
    ['01  RUN','Attempt 1','Python driver and AM','are running the job.','#8bb7ff'],
    ['02  FAILURE','AM container','The driver JVM is lost;','task retries cannot help.','#ffaf91'],
    ['03  ALLOCATE','ResourceManager','Checks retry policy;','grants another attempt.','#ffda87'],
    ['04  RESTART','Attempt 2','A fresh Python process','enters the script again.','#87ded0']]],
  'parquet-mismatch':['A readable file fails the requested schema','An executor retry sees the same bytes and the same mismatch.',[
    ['01  PLAN','Spark driver','Requests integer values','for the amount column.','#8bb7ff'],
    ['02  INSPECT','Parquet reader','Finds string storage','in one batch of files.','#ffda87'],
    ['03  FAILURE','Scan task','Reports path, column','and incompatible types.','#ffaf91'],
    ['04  REPAIR','Batch writer','Reads native schema;','validates and rewrites.','#87ded0']]]
};
export function writeFigures(dir){
  fs.mkdirSync(dir,{recursive:true});
  for(const [slug,[title,desc,frames]] of Object.entries(figures)){
    const body=frames.map(([status,actor,a,b,color],i)=>`<g transform="translate(${22+i*212} 92)">
      <rect width="194" height="125" rx="9" fill="#152238" stroke="#455570"/>
      <rect class="beat" style="animation-delay:${i*2}s" x="1" y="1" width="192" height="123" rx="8" fill="none" stroke="${color}" stroke-width="3"/>
      <circle cx="17" cy="22" r="4" fill="${color}"/><text x="29" y="26" class="small" fill="${color}">${status}</text>
      <text x="13" y="58" class="actor">${actor}</text><text x="13" y="85" class="copy">${a}</text><text x="13" y="105" class="copy">${b}</text></g>`).join('');
    fs.writeFileSync(path.join(dir,slug+'.svg'),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 874 239" role="img" aria-labelledby="title desc">
      <title id="title">${title}</title><desc id="desc">${desc} ${frames.map(f=>f.slice(0,4).join(' ')).join(' ')}</desc>
      <style>text{font-family:system-ui,sans-serif}.actor{font-size:17px;font-weight:650;fill:#f1f5fd}.copy{font-size:14px;fill:#c0cde1}.small{font-size:12px;letter-spacing:1px;font-weight:700}.beat{opacity:.1;animation:step 8s linear infinite}@keyframes step{0%,23%{opacity:1}25%,100%{opacity:.08}}@media(prefers-reduced-motion:reduce){.beat{animation:none;opacity:.65}}</style>
      <rect width="874" height="239" rx="13" fill="#0c1525"/><text x="22" y="37" fill="#eff6ff" font-size="23" font-weight="700">${title}</text>
      <text x="22" y="66" fill="#bac7da" font-size="15">${desc}</text><path d="M30 151H838" stroke="#7995b8" stroke-width="3"/>${body}</svg>\n`);
  }
}
