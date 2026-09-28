# 知序 Pathly · 后端自学搭建手册

> **定位**：这是你自己动手搭建的仓库。本手册是路标与验收器——每一步都要亲手实现、跑通自测才算完成。
> 教练（AI）不替你写业务代码：你的代码你写，卡住时按各里程碑的「求助点」来提问、贴报错、贴 diff。

---

## 0. 本手册使用规则

1. **顺序推进**：P0 → M0 → M1 → M2 → M3 → M4 → M5。上一个里程碑自测清单未全绿，禁止开工下一个。
2. **自测即验收**：自测清单里的命令都要真实跑，预期结果逐条打勾；不许凭感觉认为“应该可以”。
3. **以原型为参照**：原型目录 `../zhixu-prototype/`；做哪个功能就先看对应截图（`screenshots/`）与 `gallery.html`，再读 `app.js` 里对应屏的实现，理解语义后设计接口。
4. **契约先行**：接口细节以 `docs/api-contract.md` 为唯一事实源；AI 输出结构以 `docs/schema/*.json` 为唯一事实源。你的代码是实现契约，不是发明契约——发现契约不合理，先找我改契约，再改代码。
5. **打卡**：每次里程碑推进时在 `docs/learning-log.md` 写一行（日期/阶段/状态/问题），这是你的学习证据。
6. **提交习惯**：每通过一组自测就 commit 一次，message 写清“M1-§3 节点排序通过自测”这类可追溯信息。

---

## 1. 技术栈锁定（施工期间不许换轮子）

| 层 | 选型 | 版本 |
|---|---|---|
| 主服务 | Java LTS + Spring Boot | Java 21 · Boot 3.5.x |
| ORM | MyBatis-Plus（spring-boot3 starter） | 3.5.x |
| 构建 | Maven（mvnw 包装器随脚手架生成） | 3.9+ |
| 数据库 | MySQL | 8.x |
| 建表迁移 | Flyway（Boot 自带集成） | 随 Boot |
| 认证 | Spring Security + JWT（jjwt） | 最新稳定 |
| AI 服务运行时 | Node.js | 22 LTS |
| AI Web 框架 | Hono + `@hono/node-server` | 4.x |
| AI SDK | Vercel AI SDK（`ai` 包，generateObject / streamObject） | v6 |
| 模型 | DeepSeek（`@ai-sdk/deepseek`）为默认；GLM/Qwen 走 OpenAI 兼容 baseURL 切换 | 2026 现价 |
| 部署 | Docker Compose + Caddy（自动 HTTPS） | VPS |

**为什么这些选择成立**（要说得出理由，被问就是学习点）：
- 双服务动机=学习两个生态 + AI 关注点隔离；Spring 侧不装任何 AI SDK。
- 国产模型四家都有 OpenAI 兼容端点，所以 AI 服务内用一套 OpenAI-compatible 抽象即可，供应商由环境变量决定。
- 结构化输出优先用原生 json 区（DeepSeek 的 `response_format`），不稳定时回退 tool-call 模式——这是 M2 的一个明确学习点。

---

## 2. 仓库目标结构

```
zhixu/
├─ docs/
│  ├─ PLAN.md            ← 本手册
│  ├─ api-contract.md    ← HTTP/SSE 接口契约（唯一事实源）
│  ├─ learning-log.md    ← 学习打卡
│  └─ schema/            ← JSON Schema 契约源（M0 交付四份）
│     ├─ roadmap.schema.json
│     ├─ quiz.schema.json
│     ├─ grade.schema.json
│     └─ review.schema.json
├─ zhixu-api/            ← Spring Boot（M0 脚手架生成）
├─ zhixu-ai/             ← Hono + TS（M0 初始化）
├─ docker-compose.yml    ← M0 建立（dev）
├─ docker-compose.prod.yml / caddy/Caddyfile   ← M5 建立
└─ e2e-test.mjs          ← M5 产出（Playwright 风格的接口级端到端）
```

---

## 3. 学习地图

| 阶段 | 内容 | 建议投入 | 通过后你会具备的能力 |
|---|---|---|---|
| P0 | 环境 + 仓库 | 0.5 天 | 工具链全部自证可用 |
| M0 | 双端脚手架 + 契约 | 1–2 天 | 双服务开发与联调基础；契约思维 |
| M1 | Spring 业务骨干 | 4–7 天 | 独立产出带认证、树结构、软删撤销的业务 API |
| M2 | AI 链路 | 3–4 天 | LLM 结构化输出 + SSE 全链路（Hono→Spring→浏览器协议级理解） |
| M3 | 检验闭环 | 3–4 天 | 事务边界、状态机、幂等设计 |
| M4 | 统计 + 复盘 | 2–3 天 | 聚合 SQL、索引验证（EXPLAIN） |
| M5 | 上线 VPS | 2–3 天 | 生产 compose、HTTPS、限流、成本可观测 |

---

## 4. P0 · 环境准备（0.5 天）

### 学习目标
工具链每一样都被你亲手验证过可用——后面 3 周不再为环境分心。

### 动手任务
1. 安装：JDK 21（Temurin/Zulu 皆可）、Maven 3.9+、Node 22 LTS（推荐用 nvm 管理）、Docker Desktop、MySQL 8 客户端（`brew install mysql-client` 即可，服务器本体后面由 compose 提供）。
2. IDE：IntelliJ IDEA（Java）+ VS Code（TS）。
3. `git config` 全局配置好；在 GitHub 建空仓库 `zhixu`，clone 到 `~/Desktop/Daily/code/github/zhixu/`（文档骨架已在此），push 首个 commit。

### 自测清单
```bash
java -version            # 21.x
mvn -version             # 3.9.x + Java 21
node -v                  # v22.x
npm -v
docker run --rm hello-world   # 输出 hello from Docker
mysql --version          # Ver 8.x（mysql-client）
git ls-remote git@github.com:<你>/zhixu.git HEAD   # 能连上远端
```
- [ ] 六条全部符合预期

### 常见坑
- `brew` 装的默认 java 不是 21 → 用 `/usr/libexec/java_home -v 21` 校准 `JAVA_HOME`。
- 国内网络：npm 换 registry 镜像、Docker 拉镜像配置镜像加速。
- Docker Desktop 与其他 VM（Qoder/虚拟机）冲突：先启动 Docker 再干活。

### 求助点
报错直接整段贴给我（命令+输出），环境问题我直接给修复命令。

---

## 5. M0 · 双端脚手架 + 契约（1–2 天）

### 学习目标
- 能画出（并讲清）一条请求的完整链路：浏览器 → Spring(localhost:8080) → Hono(localhost:4601，生产为内网) → DeepSeek API。
- 理解“契约先行”：schema 文件就是 TS/Java 两侧共同的对齐物。

### 知识点（按序学）
| # | 知识点 | 学到什么程度 |
|---|---|---|
| 1 | Spring Initializr 依赖语义 | 说得出 starter 里每个依赖是干嘛的（web/validation/lombok/mysql/flyway/actuator） |
| 2 | `application.yml` | profile 分层：dev 用本地文件，密钥全部环境变量 |
| 3 | Hono 最小服务 + `@hono/node-server` | 路由、中间件概念、tsx 热重载 |
| 4 | docker compose 基础 | 服务/网络/healthcheck；`depends_on` ≠ 就绪；服务名 DNS 互联在 M5 生产编排落地 |
| 5 | JSON Schema | 会读会校验（用 ajv 手动校验一次 sample） |

### 动手任务
1. **zhixu-api**：Spring Initializr 生成（Web/Validation/Lombok/MySQL Driver/Flyway/Actuator；**M0 暂不加 Security**，M1 引入以免混淆）。加依赖 `mybatis-plus-spring-boot3-starter`。写 `HealthController`：`GET /api/health` → `{"code":0,"message":"ok","data":{"app":"zhixu-api","time":<iso>}}`。
2. **zhixu-ai**：`npm init` + `hono`、`@hono/node-server`、`tsx`、`zod`。写 `src/index.ts`：`GET /ai/health` → 同风格 JSON。`npm run dev` 用 tsx 启动，端口 4601。
3. **契约过手**：通读 `docs/api-contract.md` 与 `docs/schema/` 四份契约（已就绪，你是评审者——发现不合理先找我改契约再动代码）；为每份 schema 手写一个合法样例 `docs/schema/fixtures/*.sample.json`。
4. **docker-compose.yml**（dev）：只跑 `mysql`（root 密码、库名 `zhixu`、healthcheck `mysqladmin ping`，3306 可选发布给本机客户端）；api/ai 本机原生跑（容器化统一在 M5 做）。
5. README 更新启动命令。

### 自测清单
```bash
(cd zhixu-api && ./mvnw spring-boot:run &) ; curl -s localhost:8080/api/health   # code:0 JSON
(cd zhixu-ai && npm run dev &) ; curl -s localhost:4601/ai/health                # code:0 JSON
docker compose up -d && docker compose ps                                       # mysql healthy
docker compose exec mysql mysqladmin ping -uzhixu -p<密码>                       # mysqld is alive
npx --yes ajv-cli@5 -s docs/schema/roadmap.schema.json \
  -d docs/schema/fixtures/roadmap.sample.json --spec=draft2020                  # valid
# 同法校验另外三份 fixture；再故意改坏一处（如删字段）→ 读懂 ajv 报错定位
```
- [ ] 五条全过；`git push`

### 常见坑
- MySQL 容器没就绪应用就连库（M1 接库时会遇到）：healthcheck + `condition: service_healthy`；本机跑 api 前记得先 `docker compose up -d`。
- Hono 端口被占用/防火墙：dev 期 4601 只绑本机。
- Spring Boot 版本兼容：Boot 3.5 需要 Java 17+（你用 21，注意 Maven 编译插件 release=21）。
- ajv-cli 默认 draft-07：校验 2020-12 schema 必须带 `--spec=draft2020`。

### 求助点
- compose 编排/healthcheck 写法；Initializr 依赖取舍；ajv 报 schema 错误解读。
- 里程碑收尾：把两个 health 响应和 compose 文件贴给我做 review。

---

## 6. M1 · Spring 业务骨干（4–7 天，最重的一块）

### 学习目标
不看教程独立完成：注册登录(JWT) → 建主题(整树) → 树管理(改/排/软删/撤销) → revision 语义。原型 08/19/20 屏的语义全部可用 API 复现。

### 知识点（按序学，每个先跑通一个 demo 再用于本任务）
| # | 知识点 | 建议练习 |
|---|---|---|
| 1 | Flyway 命名与执行规则（V 版本化 / U 回滚 / R 重复） | 先写 V1 一张 user 表观察 `flyway_schema_history` |
| 2 | MyBatis-Plus：BaseMapper / IService / 分页插件 / @TableLogic / @TableField(fill) / LambdaQueryWrapper | 每个特性一个临时 controller 方法验证后删掉 |
| 3 | Spring Security：SecurityFilterChain / 无状态配置 / OncePerRequestFilter(自写 JWT filter) / PasswordEncoder(bcrypt) | 画一遍过滤器链顺序再动手 |
| 4 | DTO + `@Valid` 校验 + 统一响应 `R<T>` + `@RestControllerAdvice` 全局异常 | 错误也要返回契约的 code 结构 |
| 5 | 事务 `@Transactional`：先建立感知（M3 深挖） | 读文档“传播行为”前两节即可 |
| 6 | 自关联树建模（三级）：parent_id + stage_index + order_no + level | 白板上画 08 屏的三级树再建表 |

### 动手任务（对照 api-contract.md 相应端点）
1. `V1__init.sql`：先**自己设计** 10 张表（user / topic / node / assessment / assessment_answer / check_in / note / resource / ai_log / review），字段与索引按“附录 B 需求卡”设计；设计完找教练要参考 DDL 对照，差异以 V2 迁移补齐（体会迁移而不是改历史）。
2. 认证：注册（email 唯一、密码强度校验、bcrypt）、登录（签发 JWT：uid+exp）、JWT 过滤器、`GET /api/me`。
3. 主题：`POST /api/topics`（入参=roadmap schema 结果 → 校验（可用 networknt json-schema 或先手写校验器）→ 事务内建 topic+nodes，parentRef/ref 转真实外键与 level）、`GET /api/topics`（侧栏）、`GET /api/topics/{id}`（含整树）。
4. 节点管理：`PATCH /api/nodes/{id}`（objective 变更 → revision+1）；`POST /api/topics/{id}/nodes/reorder`（组内批量排序，协议见契约 §5.3）；`DELETE /api/nodes/{id}`（逻辑删、子树级联不可见）；`POST /api/topics/{id}/undo`（撤销最近一次删除，恢复 deleted_at）。
5. `GET /api/me/assessments`（cursor 分页——先返回空实现，M3 填数据；分页框架本期写好）。
6. 笔记与资源（契约 §5.5）：`GET/PUT /api/nodes/{id}/note`（upsert，原型“自动保存”语义）、`POST/GET /api/nodes/{id}/resources`、`DELETE /api/resources/{rid}`——简单 CRUD，练手热身。
7. 统一异常：`MethodArgumentNotValidException` → 400 + VALIDATION_FAILED；`BusinessException(code)` 体系。

### 自测清单（全部 curl，维护一个 `scripts/m1-smoke.sh` 存下来）
```bash
# 1) 认证
curl -s -X POST localhost:8080/api/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"林知夏","email":"a@x.com","password":"Str0ng!pass1"}'       # code:0, data.user.id
curl -s -X POST localhost:8080/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"a@x.com","password":"错的"}'                              # 401 BAD_CREDENTIALS
TOKEN=...   # 用正确密码登录拿 token
curl -s localhost:8080/api/me -H "Authorization: Bearer $TOKEN"          # user
curl -s localhost:8080/api/topics                                        # 401 无 token
# 2) 建主题：入参用 M0 的 fixture
curl -s -X POST localhost:8080/api/topics -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d @docs/schema/fixtures/roadmap.sample.json
#    → 整树返回；断言 node.level / parentId / ref→id 转换正确
# 3) revision：改某 node.objective → revision=2 且 revisionChanged=true
curl -s -X PATCH localhost:8080/api/nodes/<id> -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"objective":"新目标"}'
# 4) 重排：交换同级两个 node 顺序 → GET 树顺序变化
# 5) 软删+撤销：DELETE 后树中不可见 → undo 恢复，status/order 不变
# 6) 删父节点：子树级联不可见；undo 父节点全恢复
# 7) db 侧核对（与接口口径一致）
docker compose exec mysql mysql -uzhixu -p<密码> zhixu \
  -e "SELECT id,revision,status,deleted_at FROM node WHERE topic_id=<id>;"
```
- [ ] 每条断言真实通过；`m1-smoke.sh` 提交

### 常见坑
- @TableLogic 字段参与所有 MP 自动 SQL：别用 `deleted_at IS NULL` 手写了重复条件。
- JWT 过滤器放行顺序：`/api/auth/**`、`/api/health` 白名单要显式，别 lazy 到运行时报 500。
- 树校验遗漏环与重复 ref（建主题时 parentRef 前向引用 + 格式校验兜底）。
- 逻辑删与唯一索引冲突（同一 topic 下重名恢复会撞 unique）→ M1 允许唯一性弱约束，M5 复盘再收紧。

### 求助点
- 表设计稿（字段草稿/查询场景清单）发我 → 我给 shape 反馈；参考 DDL 由我出。
- MP/Lambda 组合查询别扭、过滤器链不通 → 贴代码与请求日志。
- 收尾 review：接口全部 curl 记录 + `V*__init.sql`。

---

## 7. M2 · AI 链路（3–4 天）——第一个 SSE 双跳

### 学习目标
- 独立跑通：`streamObject`(Hono) → SSE → `WebClient.bodyToFlux(ServerSentEvent)` → `SseEmitter` → curl 可见事件流。
- DeepSeek 结构化输出的两种模式（json_format / tool-call 回退）与取舍能口头讲清。

### 知识点
| # | 知识点 | 要点 |
|---|---|---|
| 1 | AI SDK `generateObject` / `streamObject` + Zod schema | schema 就用 docs/schema 同构翻译（Zod 为源，`zod-to-json-schema` 校对一致性） |
| 2 | DeepSeek `response_format` 与 function calling 兼容性 | 主路径用 json 模式；偶发非法 JSON → 重试 1 次 → 仍失败回退 tool-call 模式 |
| 3 | Hono `streamSSE` | event/id/data 结构、心跳 `: ping`、客户端断开的 cancelled 处理 |
| 4 | SSE 协议本体 | 读 MDN SSE一文，懂 id/event/data/retry 字段语义 |
| 5 | Spring WebClient（reactor 未深学没关系） | `bodyToFlux(ServerSentEvent<String>)` 消费 SSE；`onErrorResume`、超时 |
| 6 | `SseEmitter` 转发与取消传播 | emitter 注册 onError/onCompletion；客户端断开 → dispose upstream |
| 7 | 代价可观测 | Hono 在 result 后发 `usage` 事件（model/tokens/durationMs）；Spring 消费后写 ai_log |

### 动手任务
1. **事件协议**（契约 §2）：`progress`(0..n) → `result`(恰好 1 次) → `usage`(0..1) → 结束；出错 `error` 1 次后收尾。
2. **Hono `/ai/roadmap`**（SSE）：两阶段——①小 `generateObject` 产出 `{背景理解、周预算分配}` → progress 事件 30%；②大 `streamObject` 全量路线 → 进度心跳 → 完整对象作 `result` 事件（对象级一次发送，非碎片拼装）→ `usage` 事件收尾。
3. **Hono `/ai/quiz`**（SSE）：单次 `streamObject` 出 3 题（结构=quiz.schema），心跳进度。
4. **Spring 转发**：`POST /api/ai/roadmap`（SSE，鉴权，契约 §5.2）→ WebClient 连 Hono → SseEmitter 逐事件透传；**不持久化路线**——创建主题仍走 `POST /api/topics`（前端拿 result 确认后提交，正是原型 07 屏“预览→确认”语义）；收到 `usage` 事件写 ai_log。
5. **api 侧配置**：模型三个 env（`MODEL_BASEURL/MODEL_NAME/MODEL_APIKEY`）只在 zhixu-ai 一侧生效；Spring 不接触 key。
6. 重试策略：AI 服务对一次生成失败重试 1 次（指数退避 2s），两次失败 → error 事件（契约错误码 AI_UNAVAILABLE）。

### 自测清单
```bash
# A) 直接打 Hono
curl -N -s -X POST localhost:4601/ai/roadmap -H 'Content-Type: application/json' \
  -d '{"title":"Java 后端学习路线","level":"有一点基础","goal":"...","hoursPerWeek":8}'
#   → 顺序见 progress → ... → result → usage；把 result.data 用 ajv 过 roadmap.schema.json 通过
# B) 经 Spring 双跳（带 TOKEN）
curl -N -s -X POST localhost:8080/api/ai/roadmap -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Java 后端学习路线","level":"有一点基础","goal":"...","hoursPerWeek":8}'
#   → 事件逐块到达（非一次性），id 递增，有 : ping 心跳
# B2) 拿 B 的 result 载荷 POST /api/topics（复用 M1）→ 建主题成功
# C) 错误路径：给 zhixu-ai 设错 APIKEY 重启 → SSE error 事件 + ai_log 一行 status=error（重试在 Hono 内部，Spring 只见最终失败）
# D) 取消传播: curl -N 中途 Ctrl+C → 看 zhixu-ai 日志出现 upstream cancelled（或 DeepSeek 请求被打断的记录）
# E) ai_log 有一行 kind=roadmap, tokens>0（数据来自 usage 事件）
```
- [ ] A–E 全过

### 常见坑
- dev 本机 curl 直连无缓冲问题；M5 上 Caddy 反代后 SSE 必须配 `flush_interval -1`，否则事件被攒着一起吐。
- Reactor 记好：这是消费流不是并行框架，先会 `doOnNext/doOnError/doFinally` 三件套。
- DeepSeek 偶发非 JSON/截断 → 重试策略吃掉，别让它冒给前端。
- JSON 中文转义：统一 UTF-8，Hono 侧 `c.header('Content-Type','text/event-stream; charset=utf-8')`。

### 求助点
- Zod schema 与 JSON Schema 不一致 → 给我两边文件我帮你对齐；
- WebClient/SseEmitter 取消和背压报错 → 贴堆栈；
- 收尾 review：两个 curl 的完整输出（A、B）+ ai_log 行。

---

## 8. M3 · 检验闭环（3–4 天）——业务心脏

### 学习目标
把“检验式打卡”这个产品灵魂做成 API：生成题（绑 revision）、逐题作答（选择题本地判 / 概念与编码题 AI 判）、判定与状态机、打卡派生、重考与提交幂等。原型 09–13 屏语义复现。

### 知识点
| # | 知识点 | 要点 |
|---|---|---|
| 1 | 事务传播与边界 | submit 的多表写入是一个事务；判分调用(foreign AI) 必须在事务外 |
| 2 | 状态机收敛 | leaf 直接生效；父节点=子节点会聚（done 全→done；含 failed→failed；含 pending→pending；有进行中→active；其余 idle）——statusOf 逻辑见原型 app.js:92，照抄语义 |
| 3 | revision 语义 | 提交时校验 assessment.revision == node.revision，否则 409 QUIZ_EXPIRED |
| 4 | 幂等 | submit 用状态 CAS（in_progress→finished 一次成功），重复 → 409 DUPLICATE_SUBMIT |
| 5 | 判分混合 | choice 本地；concept/code → Hono `/ai/grade`（非流式 JSON，见 grade.schema） |

### 动手任务
1. `POST /api/nodes/{id}/quiz`：调 Hono 出题（SSE 生成,题目持久化进 assessment.questions JSON, **剔除答案字段后下发**），assessment 标 `in_progress`。
2. `POST /api/assessments/{id}/answer`：choice → 本地判（回 answerIndex/explanation）；concept/code → 调 `/ai/grade`，存 feedback 各层字段＋graded_by=model。答案行进 `assessment_answer`。
3. `POST /api/assessments/{id}/submit`（单事务）：汇总 3 题，`passedCount>=2` → node `done` + `check_in`（node+date 唯一）；否则 `failed` 不写打卡；返回契约结构含 streak。
4. 重考：failed 节点重新发起 quiz（生成新 assessment，旧记录保留）；`GET /api/me/assessments` 填充数据。
5. ai_log 增加 kind=quiz / grade 记录与 token 汇总。

### 自测清单
```bash
# 全流程两分支（题目从 quiz 的 SSE result 事件里取）
# A) 通过分支: 生成 quiz → choice 答对 → concept 答出覆盖 keyPoints 的答案 → submit
#    → node=done, check_in 当日 +1, response.streak>=1
# B) 失败分支: choice 对但两主观题不过 → submit → node=failed, check_in 无, canRetake=true
# C) 主观题判分返回含 missingPoints/suggestions（对照 grade.schema 用 ajv 校验存库 JSON）
# D) revision: PATCH 该 node.objective → revision=2 → 再提交旧 assessment → 409 QUIZ_EXPIRED
# E) 幂等: 同一 assessment 并发/重复 submit 两次 → 第二次 409 DUPLICATE_SUBMIT
# F) 父节点会聚: 子列表出现 failed → 完成树接口该父节点 status=failed
```
- [ ] A–F 全过

### 常见坑
- AI 判分放事务里导致长事务：**判分在事务外，结果落库在事务内**。
- 循环引用 JSON 序列化树结构（用 DTO 展平）。
- 时区： check_in 用 `Asia/Shanghai` 日期边界，不要 UTC 混算。
- LLM 判分级联失败：grade 超时按“判分失败可重试”返回 502 而不是记 passed=false。

### 求助点
- 事务注解“失效”类问题（自调用/传播行为）贴代码即答；状态机会聚 SQL 写不动 → 我给三种实现建议。

---

## 9. M4 · 统计 + 复盘（2–3 天）

### 学习目标
全部统计一个**SQL 聚合查询**（DTO 出参即可），会用 `EXPLAIN` 证明走索引；复盘是第二个复用 SSE 协议的 AI 端点。

### 动手任务
1. `GET /api/stats/overview`：正在学主题数/历史通过/本周 N/4/今日完成数——一条或两条 SQL。
2. `GET /api/stats/heatmap?from&to`：`check_in` 按 user+date 聚合，缺失日补 0（SQL 日历表 vs 应用层补齐，二选一并能说出取舍理由——这是个学习点）。
3. `GET /api/topics/{id}/progress`：按 stage 聚合 leaf 完成度。
4. `POST /api/topics/{id}/stages/{stageIndex}/review`（SSE，转发 Hono `/ai/review`；stage 未全完成 → 409 `STAGE_NOT_COMPLETE`；result 按 schema 校验后入 review 表）。

### 自测清单
```sql
EXPLAIN SELECT check_date, COUNT(*) FROM check_in WHERE user_id=? AND check_date BETWEEN ? AND ? GROUP BY check_date;
-- type=range, key=user_date 复合索引命中
```
```bash
# streak 边界用造数验证：昨天+今天 → streak=2；删今天 → streak=1；全无 → 0
# review: 阶段未完成 → 409；完成后调用 → 事件流 + review.schema 校验通过
```
- [ ] 全过

### 常见坑
- 在 Java 内存里过滤大结果集（应由 SQL 完成，禁止 `findAll` 后 stream）。
- 日期边界 off-by-one（BETWEEN 含边界）。

### 求助点
SQL 写不动贴表结构我给方向（不是答案）；EXPLAIN 输出要解读直接来。

---

## 10. M5 · 上线 VPS（2–3 天）

### 学习目标
一台干净 VPS 上 HTTPS 全链路连通，出问题具备初步维度（日志/成本/限流）。

### 动手任务
1. **Dockerfile ×2**：api 用 Maven 多阶段构建（builder → temurin jre）；ai 用 node:22-alpine + `npm ci --omit=dev`。
2. `docker-compose.prod.yml`：mysql / zhixu-api / zhixu-ai / caddy 四服务；仅 caddy 暴露 80/443；mysql 卷持久化；重启策略 `unless-stopped`；统一 `TZ=Asia/Shanghai`。
3. `caddy/Caddyfile`：域名反代 api（`reverse_proxy zhixu-api:8080`）；SSE 路径 `flush_interval -1`；基本安全头。
4. 限流：AI 端点按用户简单令牌桶（内存实现即可：比如每日 roadmap≤10、quiz≤50），超限 429 RATE_LIMITED。
5. `env` 管理：`.env`（gitignore）+ `.env.example`；密钥不进库。
6. `e2e-test.mjs`（Node + fetch，Playwright 风格断言，模仿原型 interaction-test 的写法）：注册→登录→建路线→查树→改 objective→出题→答题×3→submit→统计→复盘共 10 步断言。dev 与 prod 都跑。
7. 部署脚本：`deploy.sh`（rsync + compose build + up -d + 冒烟 curl）。

### 自测清单
```bash
# VPS 上:
curl -s https://<域名>/api/health                                 # 200
node e2e-test.mjs --base https://<域名>                           # 10 步全绿
docker compose -f docker-compose.prod.yml restart                 # 重启后数据仍在（mysql 卷）
docker run --rm --network <prod网络名> curlimages/curl -s http://zhixu-ai:4601/ai/health
#    ↑ 服务名 DNS 互联验证（M0 知识点在此落地）；zhixu-ai 不对公网暴露
docker compose -f docker-compose.prod.yml exec mysql mysql -uzhixu -p<密码> zhixu \
  -e "SELECT kind, SUM(prompt_tokens), SUM(completion_tokens), COUNT(*) FROM ai_log GROUP BY kind;"
# 换供应商: 只改 .env 三个变量 → e2e 仍绿（供应商抽象达标）
```
- [ ] 六项全过

### 常见坑
- Caddy 证书需域名 A 记录已生效；SSE 被中心代理缓冲 → flush_interval。
- 容器时区 ≠ 上海：统一 `TZ=Asia/Shanghai`，check_in 与统计对齐。
- 磁盘被 mysql binlog 吃满：binlog_expire 配短一点或关闭 binlog（学习型部署）。

### 求助点
compose/caddy 全部可贴；首次部署我陪你 step-by-step。

---

## 附录 A · 响应与错误码（摘自契约，详情见 api-contract.md）

统一信封 `{"code":0,"message":"ok","data":...}`；业务码：`AUTH_REQUIRED / BAD_CREDENTIALS / VALIDATION_FAILED / EMAIL_TAKEN(409) / NOT_FOUND / REVISION_CONFLICT(409) / QUIZ_EXPIRED(409) / DUPLICATE_SUBMIT(409) / STAGE_NOT_COMPLETE(409) / RATE_LIMITED(429) / AI_UNAVAILABLE(502) / INTERNAL(500)`。

## 附录 B · 表设计需求卡（自己设计，画完找教练要参考 DDL）

每张表请按以下**查询场景**决定字段与索引：
- user：登录（email 唯一）；`/me` 直查。
- topic：侧栏列表（user 全量，数个到百级，不需分页但排序固定）。
- node：树读取（topic 范围一次全出）；重排（按 parent+stage 批量 update）；状态会聚（parent_id 组内）。
- assessment：用户历史（user+时间倒序分页）；按 node+revision 校验有效性。
- assessment_answer：判分分布统计（未来：某知识点错题率）。
- check_in：热力图（user+date 范围聚合）；同 node 同日仅一次。
- note：节点详情页一对一读写。
- resource：节点收藏列表（node 范围，量小）。
- ai_log：成本按 kind/日汇总；排查按 user+时间。
- review：阶段复盘存档（topic+stage 读取最新一条；历史保留）。
交付物：字段清单+索引清单+每个索引对应的查询场景一句话（共 10 张表）。

## 附录 C · 资源清单（以官方为准，勿搜旧教程）
- Spring Boot / Security 官方 reference（Security 的“Servlet Architecture、Filter Chain”章必读）
- MyBatis-Plus 官方 quickstart 与“逻辑删除/分页插件/自动填充”三节
- Flyway 官方“Naming/Migrations”两节
- MyBatis-Plus + Spring Boot 3 注意 starter 名（spring-boot3 后缀）
- Hono 官方 docs（Streaming、`@hono/node-server`）
- AI SDK 官方 docs：`generateObject` / `streamObject` / Structured Output / Output 差异
- DeepSeek API 文档（`response_format` 与 function calling 兼容性）
- MDN「Server-Sent Events」
- jjwt 文档（认证方案按锁定栈执行：JWT）

## 附录 D · e2e 十步（M5 敲定后固化在 e2e-test.mjs 断言中）
1 register 2 login 3 roadmap 生成(SSE 含 progress+result) 4 topics 树形状断言 5 objective 修改→revision 6 quiz 生成(3 题、无答案泄漏) 7 逐题 answer 反馈 8 submit 通过→check_in 9 stats overview & heatmap 10 review 流(阶段完成后)。
