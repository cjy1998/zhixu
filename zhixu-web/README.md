# zhixu-web · 知序 Pathly 前端

基于 `../prototype/` 高保真原型实现的 React 前端。视觉与交互以原型 `app.js` / `styles.css` 为验收参照，接口以 `../docs/api-contract.md` 为单一事实源。

## 技术栈

React 19 · TypeScript · Vite 7 · react-router-dom（HashRouter）· CSS Modules（原型样式迁移）

## 启动

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 类型检查 + 产物构建
```

## 数据层

- 默认 `VITE_USE_MOCK=true`：走 `src/mock/` 的本地实现（localStorage 持久化，语义与契约一致，含 SSE 进度模拟），可完整体验 15 屏交互。
- 后端就绪后：复制 `.env.example` 为 `.env`，设 `VITE_USE_MOCK=false`、`VITE_API_BASE=http://localhost:8080/api` 即切换真实接口；`api/` 层已按契约实现统一信封解包与 POST SSE（fetch + ReadableStream 解析）。
- 演示入口：登录页「免登录，体验示例工作台」（`lin.zhixia@example.com`，任意密码）；注册新账号从空工作台开始。

## 目录

```
src/
  api/        契约层：types(client.ts 信封 / sse.ts SSE 封装 / index.ts mock↔real 开关)
  mock/       契约端点的本地实现（db.ts 种子数据 / graders.ts 出题与判分 / server.ts）
  domain/     树构建、状态会聚(app.js:92 语义)、Asia/Shanghai 日期
  app/        AuthContext / ToastContext / TopicsContext
  layout/     侧栏 + 顶栏 + 主区壳（AppShell）
  pages/      auth / dashboard / create / roadmap / node / stats
  components/ Modal（焦点陷阱）/ Heatmap / Badge / ReviewModal / Icon(45+) / 插画
  styles/     global.css(设计令牌) + ui.module.css(共享原语)
```

## 与契约的对齐说明（待后端联调时确认）

- `POST /api/topics/{id}/nodes`（新增节点）：契约 §5.3 未定义，但原型 19 屏需要；mock 已实现，后端补齐端点即可切换。
- `PATCH /api/nodes/{id}` 响应按 `{...NodeDTO, revisionChanged, parentAffected}` 解析（契约表述为「附加」字段）。
- NodeDTO 展示扩展字段：`completedAt`（完成日期展示）；`GET /api/stats/overview` 扩展 `todayChecked`。
- quiz 状态门槛：契约规定 `idle → 409`，但「开始学习」无对应端点；mock 在发起检验时将 `idle` 升为 `active`（语义对齐原型）。建议契约评审时定稿。
- 学习要点/复盘文案：`/ai/roadmap`、`/ai/quiz`、`/ai/review` 的 result 结构以 `docs/schema/*.schema.json` 为准；节点详情页「学习要点」由 objective 客户端派生（契约无对应端点）。
