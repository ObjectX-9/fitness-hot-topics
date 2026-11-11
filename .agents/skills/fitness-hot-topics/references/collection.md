# 采集约定

## 窗口和排名

日期时区 Asia/Shanghai。每日运行可观察近7天新发内容，因此同一视频可连续多天入榜；每天各保留一次指标快照。不是“当天新增点赞排名”。单次运行候选池内各平台分别按累计点赞排序，不跨平台合成名次。未知点赞、未知发布日期仍可存候选，但不进入每日排序。零点赞须明确页面显示0，空白不等于0。

此处为普通内容流程，App 调研采用 app-research.md 的全局去重和评论续读规则。

默认每平台每词最多60个候选、入选50条详情、每详情50热评+20最新评论、5关键帧。数量受页面可访问性和本地风险预算约束。预算不足不得追抓，partial 即有效产物。

## 浏览器提取

先 snapshot 定位当前页面。页面结构变化时根据真实DOM调整，禁止盲目复用失效 ref。

可在 `ego-browser nodejs` 中用绝对路径导入仓库 helper：

```js
const { extractCandidates, readPageEvidence, captureVideoFrames } = await import('/absolute/repo/scripts/ego-tools.mjs');
const { reserveDetail } = await import('/absolute/repo/scripts/risk-budget.mjs');
const task = await taskSpace(savedSpaceId);
const page = task.page('p1');
const candidates = await page.evaluate(extractCandidates);
// candidates.rawCardText 是页面原文，不是结构化计数。阅读页面标签后明确字段。
const budget = await reserveDetail('/absolute/repo/data', 'xiaohongshu');
if (!budget.allowed) { console.log(budget); } // 不要继续导航
```

helper 仅提取实际DOM，不保证平台结构永不变化。抖音评论默认选择器找不到时按 snapshot/DOM 寻找真实容器，返回空不代表没有评论。XHS 卡片注意封面和标题可能有两条同URL锚点；按平台ID去重。

图文翻页使用正常UI点击；截图命名 ASCII，所有 frame.path 相对 data，如 `assets/<runId>/xiaohongshu/<id>/image-01.png`。不要用远端图链充当本地已保存截帧。

计数示例：`2.7万` => value=27000、display='2.7万'（页面四舍五入近似值）；不可将显示精度当作精确计数。metric.basis 只能 total/increment/unknown，增量写 window；不可见为 value=null、display='—'。

## 落盘契约

以 shared/schema.ts 为唯一可执行契约：
- Run: schemaVersion=1, track=daily/app_research, id/date/startedAt/finishedAt/status/mode/config/items/selectedIds/coverage/report。
- Item.id=`douyin:<数字ID>` 或 `xiaohongshu:<笔记ID>`；同一 run 唯一。
- metrics 中 likes/saves/comments/shares/views 均有 value/display/basis/window。播放量不可见也保留 null。
- publishedAt 可用带时区 ISO 或 YYYY-MM-DD；publishedText 保留实际页面原文，相对日期需结合 capturedAt 转换。仅确认发布日期在窗口内的内容进入 daily Top50。
- discovery 保留 keywords/sourceUrl/sort/timeWindow/rank/scope；rank 是来源榜原始位置，非二次排序位置。
- frames：id/path/kind/timestamp/caption/observed，timestamp 对图文为 null。
- comments：id/text/likes/isAuthor/isPromotion/parentId/publishedText/capturedAt/tags，不存无关个人信息。
- commentSampling：strategy/displayedTotal/captured/expandedReplies/limitations/readStatus/resumeCursor/stopReason，显示总评论量不等于采到的条数。
- analysis：status/hook/structure/hypotheses/needs/limitations/healthClaims。证据ID可用 frame.id、comment.id、title/body/metrics。

初始 run 可用 collect:init 生成；在其 items 中追加数据后 collect:import。finalize 仅排序、检查完成度，不自动生成文字分析。采满50不等于整体 complete，仍需画面与评论分析。

原始证据保存在 data/raw/<runId>，规范化批次在 data/runs。WebUI 通过本地 Vite middleware 读取文件；pnpm dev/preview 都支持，直接静态部署 dist 不提供文件API。为避免数据竞争，只允许一个 Codex 采集者；UI 本地写入串行化，文件采用临时文件+rename。
