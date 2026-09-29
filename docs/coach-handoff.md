# 教练会话交接单（coach-handoff）

> **用途**：AI 教练的会话记忆是临时的。每次会话结束（或状态变化）时更新本文件，下一位教练（哪怕是全新会话）读它就能无缝续上。
> **规则**：改完勾掉一行，就在上面标日期。让新教练「读 AGENTS.md + 本文件」即可开局。

---

## 当前里程碑：M0（已验收，2026-09-29）

**结论：基本完成，1 必修未确认 + 2 项用户豁免/欠账 + 4 建议项。**

### ✅ 已通过（实测）
- [x] Spring `/api/health` → `{"code":0,...}` 实测通过（服务常驻 8080）
- [x] Hono `/ai/health` → `{"code":0,...}` 实测通过（服务常驻 4601）
- [x] ajv 校验 4 份 fixture（roadmap/quiz/grade/review）全部 valid
- [x] git 仓库已推 `github.com/cjy1998/zhixu`（P0）

### 🔴 必修（M1 前必须处理）
- [ ] **Result.java code 颠倒**：`success()`=code 1、`error()`=code 0，与契约（0=成功）相反。
      文件：`zhixu-api/src/main/java/com/cj/zhixu/pojo/common/Result.java`
      背景：HealthController 用构造器直传 0 所以没暴露；M1 一旦用静态方法就全错。
      参考对齐：`zhixu-ai/src/utils/result.ts`（那边是对的：success=0）。

### 🟡 用户决定 / 豁免
- [x] **不补 docker-compose**（2026-09-29 用户拍板）：开发库直接用云端 MySQL `39.105.220.230:3306/zhixu`（用户确认是测试库）。
      ⚠️ 衍生纪律：Flyway 迁移**只增不改**；动云端表结构前先 `mysqldump` 备份。
- [ ] README 启动命令未写（M0 任务 5，欠账）
- [ ] `.idea/` 9 个 IDE 文件已提交进 git，建议移除 + 加 .gitignore

### 🟢 建议项（不阻塞 M1）
- [ ] `modelProvider.ts` baseURL 硬编码阿里云百炼 → M2 前改 `MODEL_BASEURL/MODEL_NAME/MODEL_APIKEY` 三 env（契约 §3）
- [ ] `src/constants/Messgae.ts` 文件名拼写错误 → `Message.ts`
- [ ] Spring health 的 time 无时区（契约要求 UTC ISO），M1 统一序列化时处理
- [ ] `application.yaml` 中 IP 硬编码；CLI 跑 api 需带 `DB_USERNAME/DB_PASSWORD`（IDE 里已有配置）

### 计划偏差（知情即用）
- Spring Boot 4.1.1（计划锁 3.5.x）、AI SDK v7（计划 v6）、模型用 Qwen 而非 DeepSeek、包管理用 pnpm——均可用，查资料以官方文档为准。

---

## 下一个里程碑：M1 · Spring 业务骨干

参照 `docs/PLAN.md` 第 6 节。开工顺序建议：
1. **先交表设计稿**（10 张表：user/topic/node/assessment/assessment_answer/check_in/note/resource/ai_log/review，
   按 PLAN 附录 B 需求卡设计字段+索引）→ 发教练 review → 再要参考 DDL 对照。
2. 认证（JWT）→ 主题/节点树 → 节点管理（revision/重排/软删+撤销）→ 笔记资源 CRUD → 统一异常。
3. 自测脚本 `scripts/m1-smoke.sh` 逐步维护。

## 约定速查（新教练必读）

- 用户写码，教练只评：给方案、读报错、review；不直接写业务代码（用户点名要求除外）。
- 契约/文档是唯一事实源，矛盾先改文档。
- 验收=跑自测清单，实测才算数。
- 用户风格：中文、大白话、讲透报错（如 ajv oneOf 陪跑报错怎么定位）。
- 原型参照：`../zhixu-prototype/`（screenshots 逐屏对照）。

## 最近会话摘要（2026-09-29）

1. 产出并修复全部文档（PLAN/api-contract/schema×4），修复 14 处一致性问题（v0.1.1）。
2. 手把手教了 ajv 用法 + oneOf 报错定位；用户 fixture 修好，4 份全过。
3. M0 验收完成，上述清单是验收产物。
4. 用户决定：云端 MySQL 测试库；需要持久上下文（本文件 + AGENTS.md 诞生原因）。