import type { Plugin } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import { annotationSchema, configSchema, type Annotation } from '../shared/schema';
import { dataDir, setup, getConfig, getRuns, readJson, writeJson, saveRun, requests, collectionPrompt } from './store';
const mime: Record<string,string> = { '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp' };
async function body(req: IncomingMessage) {
  let size = 0; const chunks: Buffer[] = [];
  for await (const chunk of req) { size += chunk.length; if (size > 30 * 1024 * 1024) throw new Error('数据超过30MB，请使用本地导入命令'); chunks.push(Buffer.from(chunk)); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function json(res: ServerResponse, data: unknown, status = 200) { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(data)); }
// Serialize writes so concurrent annotation/config updates cannot overwrite one another.
let mutation = Promise.resolve();
function serial<T>(fn: () => Promise<T>) { const next = mutation.then(fn); mutation = next.then(() => undefined, () => undefined); return next; }
export function localDataPlugin(): Plugin {
  const middleware = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith('/api/') && !req.url?.startsWith('/local-assets/')) return next();
    res.setHeader('Cache-Control', 'no-store');
    try {
      const host = req.headers.host ?? '';
      if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host)) return json(res, { error: '仅允许本地访问' }, 403);
      const url = new URL(req.url, `http://${host}`);
      if (req.method !== 'GET' && req.headers.origin && req.headers.origin !== url.origin) return json(res, { error: '跨域写入已拒绝' }, 403);
      await setup();
      if (url.pathname.startsWith('/local-assets/') && req.method === 'GET') {
        const relative = decodeURIComponent(url.pathname.slice('/local-assets/'.length));
        const base = await fs.realpath(path.join(dataDir, 'assets'));
        const resolved = await fs.realpath(path.resolve(base, relative));
        if (!resolved.startsWith(base + path.sep) || !mime[path.extname(resolved).toLowerCase()]) return json(res, {error:'无效素材路径'},403);
        res.setHeader('Content-Type', mime[path.extname(resolved).toLowerCase()]); res.end(await fs.readFile(resolved)); return;
      }
      if (url.pathname === '/api/bootstrap' && req.method === 'GET') {
        const runs = await getRuns(); const run = runs.find(r => r.id === url.searchParams.get('run')) ?? runs[0] ?? null;
        return json(res, { runs: runs.map(({ items: _items, ...rest }) => rest), run, config: await getConfig(), annotations: await readJson(path.join(dataDir, 'annotations.json'), {}), requests: await requests() });
      }
      if (url.pathname === '/api/config' && req.method === 'POST') {
        const config = configSchema.parse(await body(req)); await serial(() => writeJson(path.join(dataDir, 'config.json'), config)); return json(res, config);
      }
      if (url.pathname === '/api/annotations' && req.method === 'POST') {
        const input = z.object({ id: z.string().min(1), annotation: annotationSchema }).parse(await body(req));
        await serial(async () => { const all = await readJson<Record<string,Annotation>>(path.join(dataDir,'annotations.json'),{}); all[input.id] = input.annotation; await writeJson(path.join(dataDir,'annotations.json'),all); });
        return json(res, input.annotation);
      }
      if (url.pathname === '/api/import' && req.method === 'POST') { const input = await body(req); return json(res, await serial(() => saveRun(input))); }
      if (url.pathname === '/api/requests' && req.method === 'POST') {
        const { date } = z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).parse(await body(req));
        const request = { id: randomUUID(), date, createdAt: new Date().toISOString(), status: 'pending' as const, prompt: collectionPrompt(date) };
        await serial(() => writeJson(path.join(dataDir,'requests',`${request.id}.json`),request)); return json(res,request);
      }
      return json(res, { error:'接口不存在' }, 404);
    } catch (error) { return json(res, {error: error instanceof Error ? error.message : '读取失败'}, (error as NodeJS.ErrnoException).code === 'ENOENT' ? 404 : 400); }
  };
  return { name:'fitness-local-data', configureServer(server) { server.middlewares.use(middleware); }, configurePreviewServer(server) { server.middlewares.use(middleware); } };
}
