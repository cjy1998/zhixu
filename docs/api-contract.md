# 知序 Pathly · API 契约 v0.1.1

> 本文件是前后端（Spring 主服务 / Hono AI 服务 / 将来任何客户端）的**单一事实源**。
> 修改必须遵守：先改此文件 → 与教练对齐 → 再改代码。
> AI 输出结构以 `docs/schema/*.schema.json` 为准，本文件不重复定义，只写引用。

---

## 1. 通用约定

| 项 | 约定 |
|---|---|
| Base | `https://<host>/api`（dev: `http://localhost:8080/api`） |
| 内容类型 | `application/json; charset=utf-8`（除 SSE） |
| 认证 | `Authorization: Bearer <JWT>`；公开接口仅 `/api/auth/**`、`/api/health` |
| 统一信封 | `{"code":0,"message":"ok","data":...}`；`code:0` 表示成功，其余为业务码 |
| HTTP 状态码 | 200 成功；400 校验；401 未认证/凭证错误；403 越权；404 不存在；409 业务冲突；429 限流；502 AI 上游失败；500 其它 |
| ID | 全部数字 ID（BIGINT），JSON 里为 number；自增控制在 2^53 内（JS number 安全上限），越界风险高就改输出字符串 |
| 时间 | 统一 ISO-8601 字符串，UTC 存储、`2026-09-23T15:04:05Z` 输出；**用户日边界（打卡/streak/热力图）按 `Asia/Shanghai` 计算** |
| 分页 | Cursor 型：`?limit=20&cursor=<opaque>`；响应 `data:{"items":[...],"nextCursor":"..."}`，`nextCursor=null` 表示没有更多 |
| 树结构 | 节点一律**扁平数组**传输（含 `id/parentId/stageIndex/level/orderNo`），由客户端组树——避免深层嵌套与引用循环 |
| 删除 | 业务删=逻辑删（`deletedAt`）；响应见 §5.4 |

## 2. SSE 事件协议（roadmap / quiz / review 共用）

SSE 端点一律 **POST**（body 携带参数），流式响应：

```
POST /api/ai/roadmap
Accept: text/event-stream
```

响应流：

```
HTTP/1.1 200
Content-Type: text/event-stream; charset=utf-8

: ping                       ← 每 15s 心跳注释，防代理超时断链

id:1
event:progress
data:{"step":"analyze","message":"解析背景与目标…","percent":20}

id:2
event:progress
data:{"step":"compose","message":"构建阶段与节点…","percent":60}

id:3
event:result
data:{…}                     ← 完整结果对象，结构与对应 schema 一致

id:4
event:usage
data:{"model":"deepseek-chat","promptTokens":1832,"completionTokens":905,"durationMs":8123}

（结束、关闭流）
```

**规则**
1. 事件序：`progress` 0..n 次 → `result` 恰好 1 次 → `usage` 0..1 次 → 正常结束；任何失败只发 1 次 `error` 后结束：
   ```
   event:error
   data:{"code":"AI_UNAVAILABLE","message":"生成超时，请重试"}
   ```
2. `result.data` 必须能通过对应 schema 校验（ajv/契约测试可查）。
3. `id` 单调递增；同一次请求内所有事件 id 连续。
4. 客户端断开 → 服务端立即取消 upstream（不得继续扣模型 token）。
5. 事件类型定义：
   - `progress`: `{"step": <string>, "message": <string>, "percent": 0..100}`
   - `result`: 完整结果对象（对应 schema）
   - `usage`: `{"model": <string>, "promptTokens": <int>, "completionTokens": <int>, "durationMs": <int>}` —— 0..1 次，在 `result` 之后；供 zhixu-api 落 ai_log，客户端可忽略
   - `error`: `{"code": <§4 业务码>, "message": <string>}`

## 3. AI 服务内部接口（zhixu-api → zhixu-ai，内网，不对外）

| Hono 路由 | 形态 | 输入（zhixu-ai 自定 TS 类型） | 输出 |
|---|---|---|---|
| `GET /ai/health` | JSON | — | 信封 |
| `POST /ai/roadmap` | SSE | `{title, level:"零基础"|"入门"|"有一点基础"|"进阶", goal, hoursPerWeek}` | result = **roadmap.schema.json** |
| `POST /ai/quiz` | SSE | `{nodeTitle, objective, revision}` | result = **quiz.schema.json**（含答案，Spring 负责摘除答案后下发） |
| `POST /ai/grade` | JSON（非流式） | `{kind:"concept"|"code", prompt, referenceAnswer, keyPoints|checks, language, learnerAnswer}` | result = **grade.schema.json**；响应附 `usage` 元数据（model/tokens/durationMs） |
| `POST /ai/review` | SSE | `{stageTitle, stageGoal, passedNodes:[{title,objective,completedAt}], weakNodes:[...]}` | result = **review.schema.json** |

模型供应商由 zhixu-ai 三个环境变量决定：`MODEL_BASEURL / MODEL_NAME / MODEL_APIKEY`。默认 DeepSeek。
SSE 生成类接口（roadmap/quiz/review）在 `result` 后发 `usage` 事件；quiz 的三题类型互异（choice/concept/code 各一）由 zhixu-ai 生成后自检，不符合即视为失败走重试。

## 4. 业务码表

| code | HTTP | 场景 |
|---|---|---|
| `AUTH_REQUIRED` | 401 | 缺/坏 token |
| `BAD_CREDENTIALS` | 401 | 登录失败 |
| `EMAIL_TAKEN` | 409 | 注册邮箱已存在 |
| `VALIDATION_FAILED` | 400 | DTO/schema 校验失败（message 里含字段细节） |
| `NOT_FOUND` | 404 | 资源不存在或越权访问（统一 404 不暴露存在性） |
| `REVISION_CONFLICT` | 409 | 目标已更新导致过期 |
| `QUIZ_EXPIRED` | 409 | assessment.revision != node.revision |
| `DUPLICATE_SUBMIT` | 409 | 已提交过 |
| `STAGE_NOT_COMPLETE` | 409 | 复盘要求阶段叶子全部 done |
| `RATE_LIMITED` | 429 | AI 额度用尽（返回 message 含恢复时间） |
| `AI_UNAVAILABLE` | 502 | 模型超时/格式失败重试后仍失败 |
| `INTERNAL` | 500 | 兜底（不泄漏堆栈） |

---

## 5. 端点明细

### 5.1 认证（公开）

#### `POST /api/auth/register`
```jsonc
// req
{ "name": "林知夏", "email": "a@x.com", "password": "Str0ng!pass1" }
// res data
{ "user": { "id": 1, "name": "林知夏", "email": "a@x.com" } }
```
规则：email 唯一（重复→409 `EMAIL_TAKEN`）；密码 ≥8 位且含字母+数字。

#### `POST /api/auth/login`
```jsonc
// req { "email":"...", "password":"..." }
// res data
{ "token": "<jwt>", "expiresIn": 604800, "user": { "id": 1, "name": "林知夏", "email": "a@x.com" } }
```

#### `GET /api/me`（需认证）
→ `data: {"id":1,"name":"林知夏","email":"a@x.com","createdAt":"..."}`

### 5.2 主题与路线

#### `GET /api/topics`（需认证）
→ `data.items[]`：
```jsonc
{ "id":1, "title":"Java 后端学习路线", "subtitle":"...", "icon":"coffee", "color":"purple",
  "estimatedWeeks":8, "weeklyHours":8, "leafTotal":9, "leafDone":4, "percent":44,
  "nextNodeTitle":"面向对象：封装与继承", "lastActiveAt":"...", "createdAt":"..." }
```

#### `POST /api/ai/roadmap`（需认证，SSE）— 路线生成
```jsonc
// req
{ "title": "Java 后端学习路线", "level": "零基础|入门|有一点基础|进阶", "goal": "...", "hoursPerWeek": 8 }
// 流：progress(解析背景… → 构建阶段与节点… → 设计检验方式…) → result = roadmap.schema.json 完整对象 → usage
```
- **本端点不持久化**：创建主题由前端拿 result 后调 `POST /api/topics`（原型 07 屏“预览→确认”语义）。

#### `POST /api/topics`（需认证）— 由 AI 预览确认后创建
请求体 = **roadmap.schema.json 的完整对象**（前端拿到 SSE result 后原样回传）。
校验失败 → 400。成功 → `data:{"topic":{"id":1,...},"nodes":[NodeDTO...]}`，树内部 `ref/parentRef` 已转为真实 `id/parentId`。

#### `GET /api/topics/{id}`（需认证）
→ `data:{"topic":{...,"summary":"...","stageTitles":[...],"stageWeeks":[...]},"nodes":[NodeDTO]}`

NodeDTO（权威字段）：
```jsonc
{ "id":11, "topicId":1, "parentId":null, "stageIndex":0, "level":1, "orderNo":0,
  "title":"搭建 Java 开发环境", "objective":"...", "durationMinutes":35,
  "status":"done",           // idle|active|pending|done|failed（含父节点会聚后的值）
  "revision":1, "hasPassedRecord":true, "createdAt":"...", "updatedAt":"..." }
```

#### `POST /api/topics/{id}/undo`（需认证）
撤销该主题最近一次节点删除。→ `data:{"restored":[id...]}`；无可撤销 → 404。
范围说明：只撤销**最近一次**删除操作（栈顶），不做多级历史。

### 5.3 节点管理

#### `PATCH /api/nodes/{id}`（需认证）
```jsonc
// req（均可选，至少一个）
{ "title":"...", "objective":"...", "durationMinutes":45 }
// res data = NodeDTO
// 语义：objective 与原值不同 → revision=revision+1，旧 assessments 判"过期"（hasPassedRecord=false 侧写）
//      title/duration 变更不影响 revision
// 响应附加：data.revisionChanged: true|false, data.parentAffected: [id...]  // 父节点 status 变了就回传
```

#### `POST /api/topics/{id}/nodes/reorder`（需认证）
```jsonc
// req：一个 parent+stage 组内的完整顺序（客户端整组提交）
{ "groupId": {"parentId":11, "stageIndex":1},
  "order": [12, 13, 14] }    // 该组内新顺序（nodeId）
// res data:{ "updated":3 }
```

#### `DELETE /api/nodes/{id}`（需认证）
→ `data:{"deleted":{"nodeId":12,"subtreeCount":2}}`（子树逻辑删；父节点 status 不再参与会聚）
`undoneToken` 简化：撤销无需 token，主题内最近一次删除可被 `/undo` 撤销（重复 undo 幂等返回最近一次已恢复集）。

### 5.4 检验闭环

#### `POST /api/nodes/{id}/quiz`（需认证，SSE）
- progress 心跳若干 → `result`：
```jsonc
{ "assessment": {
    "id": 500, "nodeId": 11, "topicId": 1, "revision": 2, "status": "in_progress",
    "questions": [
      { "type":"choice", "prompt":"...", "options":["A","B","C","D"] },
      { "type":"concept","prompt":"...","minLength":10 },
      { "type":"code",  "prompt":"...", "language":"java", "starterCode":"..."|null }
    ]
} }
```
- **答案永不下发**：`answerIndex/referenceAnswer/keyPoints/checks` 仅存服务端。
- 已有未完成的 assessment（`in_progress`）→ 仍走 SSE 返回（仅 `result` 事件、无生成过程、不产生模型调用），复用同一 assessment。
- 节点状态门槛：`idle` → 409（先开始学习）；`done` → 409（已通过；改 objective 提升 revision 后才需再检验）；`active / pending / failed` 可发起（failed 即重考）。

#### `POST /api/assessments/{id}/answer`（需认证）
```jsonc
// req
{ "questionIndex": 0, "answer": 2 }        // choice: 选项下标
{ "questionIndex": 1, "answer": "封装是……因为……" }   // concept/code: 文本
// res data（同步返回）
{ "questionIndex":0, "type":"choice", "correct":true,
  "answerIndex":2, "explanation":"..." }      // choice 本地判
{ "questionIndex":1, "type":"concept", "passed":true, "score":85, "gradedBy":"model",
  ... }   // 其余字段同 grade.schema.json：feedback/missingPoints/wrongPoints/suggestions/strengths
```
- 同一 question 重复作答 → 409 `DUPLICATE_SUBMIT`；一次一锤定音，重考走新 assessment。
- 概念/编码判分由 Hono `/ai/grade` 完成（Spring 同步等待，超时 60s → 502 AI_UNAVAILABLE）。

#### `POST /api/assessments/{id}/submit`（需认证）
```jsonc
// res data
{ "assessmentId":500, "passed":true, "passedCount":3, "total":3,
  "nodeStatus":"done",
  "checkIn":{"id":77,"checkDate":"2026-09-23"} | null,
  "streak": 4, "canRetake": false,
  "nextNode":{"id":12,"title":"集合框架：List 与 Set"} | null }
```
- 判定：choice 正确 + concept.passed + code.passed 的计数 ≥ 2 → 通过。
- 通过：node→done（revision 匹配），插入 check_in（node+date 唯一，重复幂等）。
- 未通过：node→failed；**不写** check_in；未答题目按错误计；`canRetake:true`（failed 状态可重新发起 quiz）。

#### `GET /api/me/assessments?limit&cursor`（需认证）
→ items：
```jsonc
{ "id":500, "nodeId":11, "nodeTitle":"面向对象：封装与继承", "topicId":1,
  "revision":2, "status":"finished", "passed":true, "passedCount":2,
  "finishedAt":"...", "isStale":false }   // isStale= node.revision 已大于本 assessment 的 revision
```

#### `GET /api/assessments/{id}`（需认证）——回看
→ 完整题目+每题作答+判分结果（含 explanation/missingPoints/suggestions 与 choice 的 answerIndex）。

### 5.5 笔记与资源

- `GET /api/nodes/{id}/note` → `data:{"content":"...","updatedAt":"..."}`（无 → `data:null`）
- `PUT /api/nodes/{id}/note`（req `{"content":"..."}`，≤20000 字）→ upsert（原型"自动保存"语义）
- `POST /api/nodes/{id}/resources`（req `{"type":"link|video|book|paper|document","title":"...","url":"..."}`）→ resource DTO
- `GET  /api/nodes/{id}/resources` → items
- `DELETE /api/resources/{rid}` → 200 空信封

### 5.6 统计（需认证）

#### `GET /api/stats/overview`
```jsonc
{ "topicsCount":3, "passedTotal":27,
  "weeklyTarget":{"passed":2,"goal":4, "percent":50},   // 目标=每周 4 节点，可配置常量
  "todayPassed":2, "streak":6, "longestStreak":21 }
```

#### `GET /api/stats/heatmap?from=2026-03-30&to=2026-09-23`
→ `data:{"days":[{"date":"2026-09-01","count":3},...]}`（范围内缺日补 0；未来日期不返回）

#### `GET /api/topics/{id}/progress`
→ `data:{"stages":[{"index":0,"title":"Java 语言基础","weekRange":"第 1–2 周","leafTotal":3,"leafDone":3,"percent":100,"allDone":true}, ...]}`

### 5.7 阶段复盘（需认证，SSE）

`POST /api/topics/{id}/stages/{stageIndex}/review`
- 前置：该 stage 全部叶子 done，否则 409 `STAGE_NOT_COMPLETE`。
- 流：progress(汇总阶段数据…) → result = **review.schema.json** 对象 → usage；result 经 schema 校验后写入 review 表（topic+stage 保留历史，读取最新一条）。

---

## 6. 客户端接入提示（给未来前端）
- SSE 用 `fetch` + ReadableStream 解析（EventSource 仅支持 GET，而本契约全是 POST）。
- 建议：封装统一 `api()` 信封解包与 401 重登；SSE 侧把 progress 事件映射到原型 06 屏的三个子任务进度 UI。

## 7. 变更记录
- v0.1 初版（契约文档与 4 份 schema 同步产出；凡与代码冲突，以本文件为准先改一致）。
- v0.1.1 修订：补 `POST /api/ai/roadmap` 端点定义；SSE 协议增加 `usage` 事件；错误码新增 `EMAIL_TAKEN`；submit 响应增加 `canRetake`；统一 `/api/me/assessments`、`/api/nodes/{id}/resources` 路径；quiz 状态门槛与复用规则明确化。
