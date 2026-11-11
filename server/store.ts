import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { defaultConfig, runSchema, configSchema, type Run, type Config, type CollectionRequest } from '../shared/schema';
export const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
export const dataDir = path.join(root, 'data');
export async function setup() { await fs.mkdir(path.join(dataDir, 'runs'), { recursive: true }); await fs.mkdir(path.join(dataDir, 'assets'), { recursive: true }); }
export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback; throw error; }
}
export async function writeJson(file: string, data: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  try { await fs.writeFile(temp, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 }); await fs.rename(temp, file); }
  finally { await fs.rm(temp, { force: true }); }
}
export async function getConfig(): Promise<Config> { return configSchema.parse(await readJson(path.join(dataDir, 'config.json'), defaultConfig)); }
export async function getRuns() {
  await setup();
  const files = (await fs.readdir(path.join(dataDir, 'runs'))).filter(f => f.endsWith('.json'));
  const runs: Run[] = [];
  for (const f of files) { const parsed = runSchema.safeParse(await readJson(path.join(dataDir, 'runs', f), null)); if (parsed.success) runs.push(parsed.data); }
  return runs.sort((a, b) => b.date.localeCompare(a.date) || b.startedAt.localeCompare(a.startedAt));
}
export function rankItems(run: Run) {
  // Select by observed TOTAL likes only. Board heat and seven-day increments are not interchangeable.
  const byKey = new Map<string, Run['items'][number]>();
  for (const item of run.items) {
    const key = `${item.platform}:${item.platformId}`;
    const previous = byKey.get(key);
    if (!previous || item.capturedAt > previous.capturedAt) byKey.set(key, item);
  }
  run.items = [...byKey.values()];
  run.selectedIds = (['douyin', 'xiaohongshu'] as const).flatMap(platform => run.items
    .filter(i => {
      const published = i.publishedAt ? Date.parse(i.publishedAt.length === 10 ? `${i.publishedAt}T00:00:00+08:00` : i.publishedAt) : NaN;
      const end = Date.parse(`${run.date}T23:59:59.999+08:00`);
      const start = Date.parse(`${run.date}T00:00:00+08:00`) - ((run.track === 'app_research' ? run.config.appResearch.windowDays : run.config.windowDays) - 1) * 86400000;
      const inWindow = run.mode === 'historical_import' || (Number.isFinite(published) && published >= start && published <= Math.min(end, Date.parse(i.capturedAt)));
      return (run.track === 'app_research' ? i.researchTrack === 'app_research' : i.researchTrack === 'daily') && i.platform === platform && inWindow && (run.track === 'app_research' || (i.metrics.likes.basis === 'total' && i.metrics.likes.value !== null)) && (run.config.includePromotion || i.contentType !== '商业推广');
    })
    .sort((a, b) => ((b.metrics.likes.value ?? -1) - (a.metrics.likes.value ?? -1)) || a.id.localeCompare(b.id))
    .slice(0, run.track === 'app_research' ? run.items.length : run.config.topPerPlatform).map(i => i.id));
  if (run.track === 'app_research') {
    const inScope = new Set(run.selectedIds.filter(id => id.startsWith('xiaohongshu:')));
    // Balance product groups; do not let only highly liked release/promotional posts dominate research.
    run.selectedIds = (['mainstream','indie'] as const).flatMap(group => run.items
      .filter(i => inScope.has(i.id) && i.appResearch?.productGroup === group)
      .sort((a,b) => (b.metrics.likes.value ?? -1) - (a.metrics.likes.value ?? -1) || a.id.localeCompare(b.id))
      .slice(0, run.config.appResearch.postsPerGroup).map(i => i.id));
  }
  return run;
}
export async function saveRun(input: unknown) {
  const run = rankItems(runSchema.parse(input));
  const ids = new Set<string>();
  const existingBatches = run.items.some(i=>i.researchTrack==='app_research') ? await getRuns() : [];
  for (const item of run.items.filter(i=>i.researchTrack==='app_research')) {
    const existing=existingBatches.find(batch=>batch.id!==run.id&&batch.items.some(other=>other.id===item.id));
    if(existing) throw new Error(`帖子 ${item.id} 已存在于批次 ${existing.id}，请在原批次续读评论，不得重复导入`);
  }
  for (const item of run.items) {
    if (ids.has(item.id)) throw new Error(`重复内容 ID: ${item.id}`);
    ids.add(item.id);
    if (item.id !== `${item.platform}:${item.platformId}`) throw new Error(`内容 ID 必须为 platform:platformId: ${item.id}`);
    item.comments = [...new Map(item.comments.map(c => [c.id, c])).values()];
    item.commentSampling.captured = item.comments.length;
    for (const frame of item.frames) {
      const resolved = path.resolve(dataDir, frame.path);
      if (!resolved.startsWith(path.join(dataDir, 'assets') + path.sep)) throw new Error('截帧路径越界');
      await fs.access(resolved);
    }
  }
  await writeJson(path.join(dataDir, 'runs', `${run.id}.json`), run);
  if (run.track === 'app_research') {
    const inScope = new Set(run.selectedIds.filter(id => id.startsWith('xiaohongshu:')));
    // Balance product groups; do not let only highly liked release/promotional posts dominate research.
    run.selectedIds = (['mainstream','indie'] as const).flatMap(group => run.items
      .filter(i => inScope.has(i.id) && i.appResearch?.productGroup === group)
      .sort((a,b) => (b.metrics.likes.value ?? -1) - (a.metrics.likes.value ?? -1) || a.id.localeCompare(b.id))
      .slice(0, run.config.appResearch.postsPerGroup).map(i => i.id));
  }
  return run;
}
export function collectionPrompt(date: string, track: 'daily' | 'app_research' = 'daily') {
  if (track === 'app_research') return `使用 $fitness-hot-topics 执行 ${date} 的 App 调研：读取 data/config.json 的 appResearch，仅通过 ego-browser 采集小红书国内主流健身App与独立开发者产品帖子。主流产品是观察清单，不冒充市场排名；分开采集用户吐槽、求推荐、对比和开发者发布，关注真实评论中的功能诉求、付费反馈、留存、手表同步、AI与数据导出问题。创建 track=app_research 的独立批次，按配置两组各取目标数量；全局按平台帖子ID去重，已有帖子在原批次续读评论，不重复计数；逐条读完当前可访问评论与楼中楼，记录页面末尾或断点、读取状态，不以固定条数冒充完整。保存截图、分类依据和评论证据。遵守现有低频日预算和采集锁，不能为新增调研增加请求上限；出现验证或限流立即停止，缺量记 partial。保存本地并更新待执行请求，不推送采集数据。`;

  return `使用 $fitness-hot-topics，在当前仓库读取 data/config.json（不存在则使用默认配置），执行 ${date} 的每日采集：仅使用 ego-browser，从抖音和小红书近配置天数的关键词搜索结果中建立候选池，各平台按可见累计点赞排序去重取前50；保留筛选口径和缺口。逐条查看内容、保存本地截帧、采集热评及最新评论、分析内容类型、传播假设与评论需求，导入本地 data/runs，更新日结。读取并处理 data/requests 中待执行请求；遇到登录或验证则暂停该平台并保留进度。不要把候选池称作全站榜，不得虚构不足的样本。`;
}
export async function requests(): Promise<CollectionRequest[]> {
  const dir = path.join(dataDir, 'requests'); await fs.mkdir(dir, { recursive: true });
  const files = (await fs.readdir(dir)).filter(f => f.endsWith('.json'));
  const list = await Promise.all(files.map(f => readJson<CollectionRequest | null>(path.join(dir, f), null)));
  return list.filter((r): r is CollectionRequest => r !== null).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}
