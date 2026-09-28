# zhixu — 知序 Pathly 后端学习仓库

AI 学习路线产品「知序 Pathly」的自建后端：Spring Boot 主服务 + Hono AI 旁路服务。

> 高保真原型在同级目录 `../zhixu-prototype/`，所有页面视觉与交互以 `screenshots/` 与 `gallery.html` 为验收参照。

## 从哪开始

**打开 [`docs/PLAN.md`](docs/PLAN.md)，从 P0 开始，自测全绿才进下一里程碑。**

## 目录

```
docs/
  PLAN.md            ← 自学搭建手册（路线图 + 每步自测）
  api-contract.md    ← 全部 HTTP/SSE 接口契约（前后端单一事实源）
  learning-log.md    ← 你的打卡记录
  schema/            ← 4 份 JSON Schema（AI 输出契约）
zhixu-api/           ← Spring Boot 主服务（M0 创建）
zhixu-ai/            ← Hono AI 服务（M0 创建）
```

## 技术栈速览

Java 21 · Spring Boot 3.5 · MyBatis-Plus · Maven · Flyway · JWT ｜ Node 22 · Hono · Vercel AI SDK v6 · DeepSeek（env 可切 GLM/Qwen）｜ MySQL 8 · Docker Compose · Caddy
