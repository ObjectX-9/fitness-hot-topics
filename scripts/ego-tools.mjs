// Import these helpers inside `ego-browser nodejs`, after reading the installed ego-browser skill.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
export function parseCount(display) {
  if (display == null) return null;
  const text=String(display).trim().replaceAll(',','');
  const match=text.match(/^(\d+(?:\.\d+)?)\s*(万|亿|[kKmM])?$/);
  if (!match) return null;
  const multiplier=({万:10000,亿:100000000,k:1000,K:1000,m:1000000,M:1000000})[match[2]]??1;
  return Math.round(Number(match[1])*multiplier);
}
export function extractCandidates() {
  const platform=location.hostname.endsWith('xiaohongshu.com')?'xiaohongshu':'douyin';
  const selector=platform==='xiaohongshu'?'a[href*="/search_result/"],a[href*="/explore/"]':'a[href*="/video/"]';
  const found=new Map();
  for(const a of document.querySelectorAll(selector)) {
    const match=a.href.match(platform==='xiaohongshu'?/\/(?:search_result|explore)\/([a-zA-Z0-9]+)/:/\/video\/(\d+)/);
    if(!match)continue;
    const card=a.closest('section.note-item') ?? a.closest('[data-e2e*="search-result"]') ?? a.parentElement;
    const row={platform,platformId:match[1],url:a.href,title:a.innerText.trim(),rawCardText:card?.innerText??'',discoveredAt:new Date().toISOString()};
    const old=found.get(row.platformId); if(!old||row.title.length>old.title.length)found.set(row.platformId,row);
  }
  return [...found.values()];
}
export function extractVisibleComments(platform) {
  const selector=platform==='xiaohongshu'?'.note-detail-mask .comment-item':'[data-e2e="comment-item"]';
  return [...document.querySelectorAll(selector)].map((node,index)=>{
    const raw=node.innerText.trim();
    const text=node.querySelector(platform==='xiaohongshu'?'.content':'[data-e2e="comment-content"]')?.innerText.trim();
    return {platformId:node.id||node.getAttribute('data-id')||null,text:text||raw,rawText:raw,isAuthor:!!node.querySelector('.author-tag')||/(?:^|\n)作者(?:\n|$)/.test(raw),capturedAt:new Date().toISOString(),domOrder:index};
  }).filter(row=>row.text);
}
export async function readPageEvidence(page, platform) {
  const text=await page.evaluate(()=>document.querySelector('.note-detail-mask')?.innerText??document.body.innerText);
  const comments=await page.evaluate(extractVisibleComments,platform);
  return {url:await page.url(),capturedAt:new Date().toISOString(),text,comments};
}
export async function captureVideoFrames(page,directory,requestedTimes) {
  await fs.mkdir(directory,{recursive:true});
  const frames=[];
  for(const seconds of requestedTimes) {
    const state=await page.evaluate(seconds=>{
      const video=[...document.querySelectorAll('video')].find(v=>v.getBoundingClientRect().width>100&&v.readyState>=2);
      if(!video||!Number.isFinite(video.duration)||video.duration<=0)return null;
      video.pause();video.currentTime=Math.min(Math.max(seconds,0),Math.max(0,video.duration-.15));
      return {time:video.currentTime};
    },seconds);
    if(!state)break;
    await page.waitForFunction(time=>[...document.querySelectorAll('video')].some(v=>v.readyState>=2&&!v.seeking&&Math.abs(v.currentTime-time)<.2),state.time,{timeout:12000});
    const rect=await page.evaluate(()=>{
      const v=[...document.querySelectorAll('video')].find(v=>v.getBoundingClientRect().width>100&&v.readyState>=2);
      if(!v)return null;const r=v.getBoundingClientRect();
      const x=Math.max(0,r.x), y=Math.max(0,r.y), width=Math.min(innerWidth,r.right)-x,height=Math.min(innerHeight,r.bottom)-y;
      return width>0&&height>0?{x,y,width,height}:null;
    });
    if(!rect)break;
    const filename=`frame-${state.time.toFixed(2).replace('.','-')}.png`;
    await page.screenshot({path:path.join(directory,filename),clip:rect});
    frames.push({filename,timestamp:state.time});
  }
  return frames;
}
export function commentId(platform,platformId,row) {
  return row.platformId||`${platform}-${platformId}-${crypto.createHash('sha256').update(row.text).digest('hex').slice(0,16)}`;
}
