// Local pacing/accounting, not anti-detection. Invoke inside ego-browser nodejs before a detail navigation.
import fs from 'node:fs/promises';
import path from 'node:path';
const policies={dailyDetailLimit:100,minDetailIntervalMs:30000,batchSize:10,batchRestMs:180000};
export async function reserveDetail(dataDirectory,platform) {
  if(!['douyin','xiaohongshu'].includes(platform))throw new Error('未知平台');
  const date=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'});
  await fs.mkdir(dataDirectory,{recursive:true});const file=path.join(dataDirectory,'risk-state.json');
  let state;try{state=JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;state={date,count:0,platformCounts:{douyin:0,xiaohongshu:0},lastAt:0,blocked:{}};}
  // Challenge flags persist across dates until the user explicitly resolves them.
  if(state.blocked?.[platform])return {allowed:false,reason:state.blocked[platform],requiresUser:true};
  if(state.date!==date)state={...state,date,count:0,platformCounts:{douyin:0,xiaohongshu:0},lastAt:0};
  if(state.count>=policies.dailyDetailLimit||state.platformCounts[platform]>=50)return {allowed:false,reason:'已达本机当日详情页采集上限，保留进度，不追加批次'};
  const rest=state.count>0&&state.count%policies.batchSize===0?policies.batchRestMs:policies.minDetailIntervalMs;
  const waitMs=Math.max(0,(state.lastAt??0)+rest-Date.now());
  if(waitMs>0)return {allowed:false,reason:'等待采集间隔',retryAfterMs:waitMs};
  state.count++;state.platformCounts[platform]++;state.lastAt=Date.now();
  const temp=`${file}.${process.pid}.tmp`;await fs.writeFile(temp,JSON.stringify(state,null,2),{mode:0o600});await fs.rename(temp,file);
  return {allowed:true,count:state.count,platformCount:state.platformCounts[platform]};
}
export async function blockPlatform(dataDirectory,platform,reason) {
  const file=path.join(dataDirectory,'risk-state.json');
  const state=JSON.parse(await fs.readFile(file,'utf8'));
  state.blocked={...state.blocked,[platform]:reason};
  const temp=`${file}.${process.pid}.tmp`;await fs.writeFile(temp,JSON.stringify(state,null,2),{mode:0o600});await fs.rename(temp,file);
}
