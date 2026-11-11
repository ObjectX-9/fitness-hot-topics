# 动察 · 健身热点研究库

用 Codex + ego-browser 收集抖音、小红书的健身、运动健康、体态分析、减脂减肥与增肌内容。WebUI 提供内容筛选、视频关键帧/图文查看、传播假设、评论与需求证据、研究笔记、采集批次和本地设置。

## 使用

```bash
pnpm install
pnpm dev
```

打开 http://127.0.0.1:5178 。React + TypeScript + Vite + Less + pnpm；shadcn/ui 使用 Base UI 原语，业务布局使用 Less，组件基础样式使用 Tailwind CSS。数据服务是 Vite 本地中间件，开发与 preview 均支持，不能仅把 dist 当静态站点部署后直接读本机数据。

在 Codex 中打开本仓库并执行：

> 使用 $fitness-hot-topics 执行今天的采集与分析，遵循账号风险上限，将数据写入本地研究库。

Skill 位于 [.agents/skills/fitness-hot-topics/SKILL.md](.agents/skills/fitness-hot-topics/SKILL.md)。需要本机可用的 ego-browser 和本人正常登录；验证或限流时停止并保留进度。每日调度使用 Codex 自动化调用同一 Skill，不在 GitHub Actions 中运行浏览器。

“新建采集”保存本地待执行请求并提供 Codex 指令，不会在网页内自动启动采集。运行完成后点击刷新查看。导入按钮接受完整 Run JSON；截帧文件需先存放在 data/assets 对应位置。单条内容支持收藏、笔记、原帖跳转和 JSON 导出。

## 数据与排名

```text
data/
  config.json                本机关键词与采样设置
  runs/<runId>.json          每日快照、分析和证据引用
  assets/<runId>/...         本地视频截帧与图文截图
  raw/<runId>/...            原始页面与评论证据
  requests/<id>.json         Codex 待处理请求
  annotations.json          收藏及研究笔记
  risk-state.json           当日访问预算和平台阻塞状态
  collector.lock            单采集者锁
```

所有实际数据被 Git 忽略，推送代码不会上传本机评论和截图。跨设备使用须自行转移 data 目录。全量规范见 shared/schema.ts。数据命令：

```bash
pnpm collect:init 2026-11-11
pnpm collect:lock acquire <runId>
pnpm collect:import /absolute/path/run.json
pnpm collect:finalize <runId>
pnpm collect:lock release <runId>
```

默认近7天发布的关键词搜索候选池，按可见累计点赞分别取抖音50、小红书50，不是全站榜，也不是当日增量榜。窗口重叠时同一内容会有多日快照。候选不足、日期/指标未知、评论未加载或无法播放时标为 partial；不补造数据。历史导入不参与“今日全量采集完成”的表述。

账号风险优先：串行操作、每详情至少间隔30秒、每10页至少休息3分钟、每日最多100详情且各平台50。所有搜索和评论加载还须低频操作；这些数值不是平台认可的安全阈值，不能保证不被限流或封号。首次验证码、访问频繁或账号异常即停止，不换代理/指纹/账号，不破解签名、不绕过访问限制、不自动重试。

传播分析明确区分观察、假设和缺失证据。评论需求引用原话，排除已标记推广、邀请码及作者回复；无法获取曝光/完播/投流数据时不推断算法因果，不把热门健康说法当作医学事实。
