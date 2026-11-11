# 项目约定

- 技术栈 React + TypeScript + Vite + Less + pnpm；shadcn/ui 原语在 src/components/ui，业务样式在 src/styles.less。
- 每日数据采集与分析使用 `.agents/skills/fitness-hot-topics/SKILL.md`，仅使用 ego-browser。账号风险边界优先于数量目标，遇验证或限流停止，禁止并发或绕过。
- Codex 执行采集，WebUI 负责读取、筛选、研究笔记和创建请求；不要在 HTTP 请求里启动 shell 或 Agent。
- data/ 所有实际数据仅本地保存，不提交采集内容、评论、截图、登录信息；保留跨日快照，不覆盖历史计数。
- 共享数据契约在 shared/schema.ts；本地文件服务在 server/，仅监听本机。
- 用户明确要求修改代码时，直接做最小修改；不要主动运行测试、构建、Lint、类型检查、启动服务或浏览器验证。交付说明注明未执行验证。
