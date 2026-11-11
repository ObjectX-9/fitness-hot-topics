import fs from 'node:fs/promises';
import path from 'node:path';
import { dataDir, setup, getConfig, getRuns, saveRun, writeJson, requests } from '../server/store';
import { runSchema, type Run } from '../shared/schema';
const [command, arg, trackArg] = process.argv.slice(2);
await setup();
if(command === 'init') {
  const date = arg ?? new Date().toLocaleDateString('en-CA', {timeZone:'Asia/Shanghai'});
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('日期格式应为 YYYY-MM-DD');
  const track=trackArg ?? 'daily';
  if(track!=='daily'&&track!=='app_research') throw new Error('采集类型仅支持 daily / app_research');
  const id=`${date}-${track}-${Date.now()}`;
  const run: Run = {schemaVersion:1,id,date,startedAt:new Date().toISOString(),finishedAt:null,status:'collecting',track,mode:'daily',config:await getConfig(),items:[],selectedIds:[],coverage:[],report:{summary:'',findings:[],opportunities:[],limitations:[]}};
  await saveRun(run);
  console.log(JSON.stringify({id,file:path.join(dataDir,'runs',`${id}.json`)},null,2));
} else if(command === 'import') {
  if(!arg) throw new Error('用法：pnpm collect:import /absolute/path/to/run.json');
  const run=await saveRun(JSON.parse(await fs.readFile(path.resolve(arg),'utf8')));
  console.log(JSON.stringify({id:run.id,candidates:run.items.length,selected:run.selectedIds.length}));
} else if(command === 'finalize') {
  if(!arg) throw new Error('用法：pnpm collect:finalize <runId>');
  const run=(await getRuns()).find(r=>r.id===arg); if(!run) throw new Error('未找到批次');
  const result=await saveRun(runSchema.parse({...run,finishedAt:new Date().toISOString(),status:run.status==='blocked'?'blocked':'analyzing'}));
  const incomplete=result.items.filter(i=>result.selectedIds.includes(i.id)).some(i=>i.analysis.status!=='complete'||i.frames.length===0||(result.track==='app_research'&&i.commentSampling.readStatus!=='all_visible')||i.commentSampling.captured<Math.min(i.commentSampling.displayedTotal??Infinity,result.config.commentsPerItem));
  const selected=result.items.filter(i=>result.selectedIds.includes(i.id));
  const belowTarget=result.track==='app_research' ? ['mainstream','indie'].some(group=>selected.filter(i=>i.appResearch?.productGroup===group).length<result.config.appResearch.postsPerGroup) : ['douyin','xiaohongshu'].some(p=>selected.filter(i=>i.platform===p).length<50);
  const coverageIncomplete=result.coverage.length===0||result.coverage.some(c=>/登录|验证|失败|未完成/.test(c.stopReason));
  result.status=result.status==='blocked'?'blocked':incomplete||coverageIncomplete||belowTarget?'partial':'complete';
  const saved=await saveRun(result);
  for(const req of await requests()) if(req.date===saved.date&&(req.track??'daily')===saved.track&&(req.status==='pending'||req.status==='running')) await writeJson(path.join(dataDir,'requests',`${req.id}.json`),{...req,status:saved.status==='blocked'?'blocked':'done',runId:saved.id});
  console.log(JSON.stringify({id:saved.id,status:saved.status,selected:saved.selectedIds.length}));
} else {
  throw new Error('命令：init [YYYY-MM-DD] | import <JSON文件> | finalize <runId>');
}
