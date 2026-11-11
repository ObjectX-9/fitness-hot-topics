import { z } from 'zod';
export const platforms = ['douyin', 'xiaohongshu'] as const;
export const topics = ['健身', '运动健康', '体态分析', '减脂减肥', '增肌'] as const;
export const contentTypes = ['动作教学', '跟练课程', '知识科普', '身材展示', '减脂记录', '体态纠正', '测评推荐', '运动娱乐', '励志故事', '商业推广', '求助讨论', '未分类'] as const;
const nullableNumber = z.number().nonnegative().nullable();
export const metricSchema = z.object({ value: nullableNumber, display: z.string(), basis: z.enum(['total', 'increment', 'unknown']).default('total'), window: z.string().nullable().default(null) });
export const frameSchema = z.object({ id: z.string(), path: z.string().regex(/^assets\/[a-zA-Z0-9_./-]+$/), kind: z.enum(['video_frame', 'note_image', 'page_capture']), timestamp: nullableNumber, caption: z.string(), observed: z.string().default('') });
export const commentSchema = z.object({ id: z.string(), text: z.string(), likes: nullableNumber.default(null), isAuthor: z.boolean().default(false), isPromotion: z.boolean().default(false), parentId: z.string().nullable().default(null), publishedText: z.string().default(''), capturedAt: z.string().datetime({ offset: true }), tags: z.array(z.string()).default([]) });
export const hypothesisSchema = z.object({ title: z.string(), explanation: z.string(), evidenceIds: z.array(z.string()), confidence: z.enum(['high', 'medium', 'low']), alternative: z.string().default('') });
export const needSchema = z.object({ id: z.string(), title: z.string(), description: z.string(), commentIds: z.array(z.string()), priority: z.enum(['P0', 'P1', 'P2']), opportunity: z.string() });
export const itemSchema = z.object({
  id: z.string().min(1), platform: z.enum(platforms), platformId: z.string().regex(/^[a-zA-Z0-9_-]+$/), title: z.string().min(1), author: z.string(),
  url: z.string().url().refine(v => { const u = new URL(v); return u.protocol === 'https:' && ['www.douyin.com','douyin.com','www.xiaohongshu.com','xiaohongshu.com'].includes(u.hostname); }, '来源必须是平台 HTTPS 页面'),
  publishedAt: z.string().nullable(), publishedText: z.string().default(''), capturedAt: z.string().datetime({ offset: true }),
  topics: z.array(z.enum(topics)), contentType: z.enum(contentTypes), format: z.enum(['video', 'image_note', 'text_note', 'unknown']),
  duration: nullableNumber, audience: z.array(z.string()).default([]), summary: z.string().default(''),
  metrics: z.object({ likes: metricSchema, saves: metricSchema, comments: metricSchema, shares: metricSchema, views: metricSchema }),
  discovery: z.object({ keywords: z.array(z.string()), sourceUrl: z.string().url(), sort: z.string(), timeWindow: z.string(), rank: z.number().int().positive().nullable(), scope: z.string() }),
  frames: z.array(frameSchema).default([]), comments: z.array(commentSchema).default([]),
  commentSampling: z.object({ strategy: z.string(), displayedTotal: nullableNumber, captured: z.number().int().nonnegative(), expandedReplies: z.boolean(), limitations: z.array(z.string()) }),
  analysis: z.object({ status: z.enum(['pending', 'partial', 'complete']), hook: z.string(), structure: z.array(z.object({ label: z.string(), description: z.string(), frameIds: z.array(z.string()) })), hypotheses: z.array(hypothesisSchema), needs: z.array(needSchema), limitations: z.array(z.string()), healthClaims: z.array(z.string()).default([]) }),
});
export const configSchema = z.object({
  timezone: z.literal('Asia/Shanghai').default('Asia/Shanghai'), windowDays: z.number().int().min(1).max(90).default(7),
  topPerPlatform: z.literal(50).default(50), candidatePerKeyword: z.number().int().min(20).max(300).default(60),
  commentsPerItem: z.number().int().min(10).max(500).default(50), recentCommentsPerItem: z.number().int().min(0).max(100).default(20),
  frameCount: z.number().int().min(3).max(12).default(5), keywords: z.array(z.string().min(1)).min(1).max(40),
  includePromotion: z.boolean().default(true),
});
export const defaultConfig = configSchema.parse({ keywords: ['健身', '运动健康', '体态分析', '减脂', '减肥', '增肌', '力量训练', '圆肩驼背'] });
export const runSchema = z.object({
  schemaVersion: z.literal(1), id: z.string().regex(/^[a-zA-Z0-9_-]+$/), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startedAt: z.string().datetime({ offset: true }), finishedAt: z.string().datetime({ offset: true }).nullable(),
  status: z.enum(['collecting', 'analyzing', 'complete', 'partial', 'blocked']), mode: z.enum(['daily', 'historical_import']),
  config: configSchema, items: z.array(itemSchema), selectedIds: z.array(z.string()),
  coverage: z.array(z.object({ platform: z.enum(platforms), keyword: z.string(), sourceUrl: z.string(), sort: z.string(), timeWindow: z.string(), scanned: z.number().int().nonnegative(), stopReason: z.string() })),
  report: z.object({ summary: z.string(), findings: z.array(z.string()), opportunities: z.array(z.string()), limitations: z.array(z.string()) }),
});
export const annotationSchema = z.object({ favorite: z.boolean().default(false), note: z.string().max(20000).default('') });
export type ContentItem = z.infer<typeof itemSchema>;
export type Run = z.infer<typeof runSchema>;
export type Config = z.infer<typeof configSchema>;
export type Annotation = z.infer<typeof annotationSchema>;
export type Platform = typeof platforms[number];
export type Bootstrap = { runs: Omit<Run, 'items'>[]; run: Run | null; config: Config; annotations: Record<string, Annotation>; requests: CollectionRequest[] };
export type CollectionRequest = { id: string; createdAt: string; status: 'pending' | 'running' | 'done' | 'blocked'; prompt: string; date: string; runId?: string };
