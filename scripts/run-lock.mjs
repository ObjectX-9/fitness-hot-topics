import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const data=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../data');
const [command,runId]=process.argv.slice(2);
if(!runId||!/^[a-zA-Z0-9_-]+$/.test(runId))throw new Error('用法：pnpm collect:lock acquire|release <runId>');
await fs.mkdir(data,{recursive:true});const file=path.join(data,'collector.lock');
if(command==='acquire'){
  try{await fs.writeFile(file,JSON.stringify({runId,acquiredAt:new Date().toISOString()}),{flag:'wx',mode:0o600});console.log('已取得采集锁');}
  catch(e){if(e.code==='EEXIST')throw new Error('已有采集锁。禁止并发；确认原任务结束后由用户决定恢复或释放。');throw e;}
}else if(command==='release'){
  const lock=JSON.parse(await fs.readFile(file,'utf8'));if(lock.runId!==runId)throw new Error('锁属于其他批次，禁止释放');
  await fs.unlink(file);console.log('采集锁已释放');
}else throw new Error('仅支持 acquire / release');
