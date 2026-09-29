import { ApiError, getToken } from '../api/client';
import type {
  AnswerResult,
  QuizQuestion,
  ResourceDTO,
  AssessmentHistoryItem,
  AssessmentView,
  CreateTopicResult,
  HeatmapDay,
  NodeDTO,
  NodeStatus,
  ReviewResult,
  Roadmap,
  StageProgress,
  StatsOverview,
  SubmitResult,
  TopicDetail,
  TopicSummary,
  User,
} from '../api/types';
import { aggregateStatus, nextLeafAfter, stageLeaves } from '../domain/tree';
import { mondayOfCurrentWeekISO, shiftISO, todayISO } from '../domain/dates';
import type { SseHandlers } from '../api/sse';
import {
  load,
  nextId,
  nowISO,
  save,
  userFromToken,
  type MockDB,
  type MockNode,
  type MockTopic,
  type MockUser,
  type QuizQuestionFull,
} from './db';
import { gradeAnswer, quizFor, roadmapTemplateFor } from './graders';

function requireUser(): { user: MockUser; db: MockDB } {
  const user = userFromToken(getToken());
  if (!user) throw new ApiError('AUTH_REQUIRED', '请先登录', 401);
  return { user, db: load() };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

function visibleNodes(db: MockDB, topicId: number): MockNode[] {
  return db.nodes.filter((n) => n.topicId === topicId && n.deletedAt === null);
}

function rawDto(n: MockNode): NodeDTO {
  return { ...n, status: n.rawStatus, hasPassedRecord: false };
}

function rawDtos(nodes: MockNode[]): NodeDTO[] {
  return nodes.map(rawDto);
}

function toNodeDTO(db: MockDB, nodes: MockNode[], node: MockNode): NodeDTO {
  const hasPassedRecord = db.assessments.some(
    (a) => a.nodeId === node.id && a.passed === true && a.revision === node.revision,
  );
  return {
    id: node.id,
    topicId: node.topicId,
    parentId: node.parentId,
    stageIndex: node.stageIndex,
    level: node.level,
    orderNo: node.orderNo,
    title: node.title,
    objective: node.objective,
    durationMinutes: node.durationMinutes,
    status: aggregateStatus(rawDtos(nodes), rawDto(node)),
    revision: node.revision,
    hasPassedRecord,
    completedAt: node.completedAt,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  };
}

function topicLeavesAll(nodes: MockNode[]): MockNode[] {
  return nodes.filter((n) => !nodes.some((c) => c.parentId === n.id));
}

function sortedLeaves(nodes: MockNode[]): MockNode[] {
  return topicLeavesAll(nodes).sort(
    (a, b) => a.stageIndex - b.stageIndex || (a.parentId ?? 0) - (b.parentId ?? 0) || a.orderNo - b.orderNo,
  );
}

function leafDone(nodes: MockNode[], node: MockNode): boolean {
  return aggregateStatus(rawDtos(nodes), rawDto(node)) === 'done';
}

function topicSummary(db: MockDB, topic: MockTopic): TopicSummary {
  const nodes = visibleNodes(db, topic.id);
  const leaves = sortedLeaves(nodes);
  const done = leaves.filter((n) => leafDone(nodes, n)).length;
  const next =
    leaves.find((n) => aggregateStatus(rawDtos(nodes), rawDto(n)) === 'active') ||
    leaves.find((n) => !leafDone(nodes, n)) ||
    leaves[0];
  return {
    id: topic.id,
    title: topic.title,
    subtitle: topic.subtitle,
    icon: topic.icon,
    color: topic.color,
    estimatedWeeks: topic.estimatedWeeks,
    weeklyHours: topic.weeklyHours,
    leafTotal: leaves.length,
    leafDone: done,
    percent: leaves.length ? Math.round((done / leaves.length) * 100) : 0,
    nextNodeTitle: next?.title ?? null,
    lastActiveAt: topic.lastActiveAt,
    createdAt: topic.createdAt,
  };
}

function touchTopic(db: MockDB, topicId: number) {
  const topic = db.topics.find((t) => t.id === topicId);
  if (topic) {
    topic.lastActiveAt = nowISO();
    db.topics.sort((a, b) => (a.lastActiveAt < b.lastActiveAt ? 1 : -1));
  }
}

function streakFrom(dates: string[]): { streak: number; longest: number } {
  const unique = [...new Set(dates)].sort();
  if (unique.length === 0) return { streak: 0, longest: 0 };
  let longest = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i += 1) {
    if (Date.parse(`${unique[i]}T00:00:00Z`) - Date.parse(`${unique[i - 1]}T00:00:00Z`) === 86400000) {
      run += 1;
      longest = Math.max(longest, run);
    } else run = 1;
  }
  const today = todayISO();
  let cursor = unique.includes(today) ? today : shiftISO(today, -1);
  let streak = 0;
  while (unique.includes(cursor)) {
    streak += 1;
    cursor = shiftISO(cursor, -1);
  }
  return { streak, longest: Math.max(longest, streak) };
}

function ensureOwnedTopic(db: MockDB, user: MockUser, topicId: number): MockTopic {
  const topic = db.topics.find((t) => t.id === topicId && t.userId === user.id);
  if (!topic) throw new ApiError('NOT_FOUND', '主题不存在', 404);
  return topic;
}

function ensureOwnedNode(db: MockDB, user: MockUser, nodeId: number): MockNode {
  const node = db.nodes.find(
    (n) => n.id === nodeId && n.deletedAt === null && db.topics.some((t) => t.id === n.topicId && t.userId === user.id),
  );
  if (!node) throw new ApiError('NOT_FOUND', '节点不存在', 404);
  return node;
}

function stripQuestion(q: QuizQuestionFull): QuizQuestion {
  if (q.type === 'choice')
    return { type: 'choice', prompt: q.prompt, options: q.options ?? [] };
  if (q.type === 'concept')
    return { type: 'concept', prompt: q.prompt, minLength: q.minLength ?? 10 };
  return { type: 'code', prompt: q.prompt, language: q.language ?? 'pseudo', starterCode: q.starterCode ?? null };
}

export const mockServer = {
  async register(input: { name: string; email: string; password: string }): Promise<{ user: User }> {
    const db = load();
    if (!input.name?.trim()) throw new ApiError('VALIDATION_FAILED', '请填写称呼', 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email ?? ''))
      throw new ApiError('VALIDATION_FAILED', '邮箱格式不正确', 400);
    if (!/[A-Za-z]/.test(input.password ?? '') || !/[0-9]/.test(input.password ?? '') || (input.password ?? '').length < 8)
      throw new ApiError('VALIDATION_FAILED', '密码至少 8 位，且同时包含字母和数字', 400);
    if (db.users.some((u) => u.email === input.email))
      throw new ApiError('EMAIL_TAKEN', '该邮箱已被注册', 409);
    const user: MockUser = {
      id: nextId(db),
      name: input.name.trim(),
      email: input.email,
      password: input.password,
      createdAt: nowISO(),
    };
    db.users.push(user);
    save(db);
    return { user: { id: user.id, name: user.name, email: user.email } };
  },

  async login(input: { email: string; password: string }): Promise<{ token: string; expiresIn: number; user: User }> {
    const db = load();
    const user = db.users.find((u) => u.email === input.email);
    if (!user || (user.password !== null && user.password !== input.password))
      throw new ApiError('BAD_CREDENTIALS', '邮箱或密码不正确', 401);
    return {
      token: `mock-token-${user.id}`,
      expiresIn: 604800,
      user: { id: user.id, name: user.name, email: user.email },
    };
  },

  async me(): Promise<User> {
    const { user } = requireUser();
    return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
  },

  async listTopics(): Promise<{ items: TopicSummary[] }> {
    const { user, db } = requireUser();
    const topics = db.topics.filter((t) => t.userId === user.id);
    topics.sort((a, b) => (a.lastActiveAt < b.lastActiveAt ? 1 : -1));
    return { items: topics.map((t) => topicSummary(db, t)) };
  },

  async getTopic(topicId: number): Promise<TopicDetail> {
    const { user, db } = requireUser();
    const topic = ensureOwnedTopic(db, user, topicId);
    const nodes = visibleNodes(db, topicId);
    return {
      topic: {
        ...topicSummary(db, topic),
        summary: topic.summary,
        stageTitles: topic.stageTitles,
        stageWeeks: topic.stageWeeks,
        ...(topic.level ? { level: topic.level } : {}),
      },
      nodes: nodes.map((n) => toNodeDTO(db, nodes, n)),
    };
  },

  async createTopic(roadmap: Roadmap): Promise<CreateTopicResult> {
    const { user, db } = requireUser();
    if (!roadmap?.title || roadmap.title.trim().length < 2 || roadmap.title.trim().length > 40)
      throw new ApiError('VALIDATION_FAILED', '路线标题需要 2–40 个字', 400);
    if (!roadmap.subtitle || roadmap.subtitle.length < 2)
      throw new ApiError('VALIDATION_FAILED', '路线副标题缺失', 400);
    if (!roadmap.summary || roadmap.summary.length < 20)
      throw new ApiError('VALIDATION_FAILED', '路线总述缺失', 400);
    if (!Array.isArray(roadmap.stages) || roadmap.stages.length < 2)
      throw new ApiError('VALIDATION_FAILED', '路线至少需要 2 个阶段', 400);
    const topic: MockTopic = {
      id: nextId(db),
      userId: user.id,
      title: roadmap.title.trim(),
      subtitle: roadmap.subtitle,
      icon: roadmap.icon ?? 'book',
      color: roadmap.color ?? 'purple',
      estimatedWeeks: Math.min(52, Math.max(1, Math.round(roadmap.estimatedWeeks || 8))),
      weeklyHours: Math.min(80, Math.max(1, Math.round(roadmap.weeklyHours || 8))),
      summary: roadmap.summary,
      stageTitles: roadmap.stages.map((s) => s.title),
      stageWeeks: roadmap.stages.map((s) => s.weekRange ?? ''),
      createdAt: nowISO(),
      lastActiveAt: nowISO(),
    };
    db.topics.push(topic);
    const refToId = new Map<string, number>();
    const orderCounters = new Map<string, number>();
    const nodes: MockNode[] = [];
    roadmap.stages.forEach((stage, stageIndex) => {
      if (!stage.nodes?.length) return;
      stage.nodes.forEach((spec) => {
        const id = nextId(db);
        refToId.set(spec.ref, id);
        const parentId = spec.parentRef ? refToId.get(spec.parentRef) ?? null : null;
        if (spec.parentRef && parentId === null)
          throw new ApiError('VALIDATION_FAILED', `parentRef ${spec.parentRef} 引用无效`, 400);
        const parent = parentId ? nodes.find((n) => n.id === parentId) : null;
        const level = parent ? parent.level + 1 : 1;
        if (level > 3) throw new ApiError('VALIDATION_FAILED', '节点层级不能超过三级', 400);
        const key = `${parentId ?? 'null'}:${stageIndex}`;
        const orderNo = orderCounters.get(key) ?? 0;
        orderCounters.set(key, orderNo + 1);
        const node: MockNode = {
          id,
          topicId: topic.id,
          parentId,
          stageIndex,
          level,
          orderNo,
          title: spec.title,
          objective: spec.objective,
          durationMinutes: Math.min(240, Math.max(10, Math.round(spec.durationMinutes || 45))),
          rawStatus: 'idle',
          revision: 1,
          completedAt: null,
          createdAt: topic.createdAt,
          updatedAt: topic.createdAt,
          deletedAt: null,
        };
        nodes.push(node);
        db.nodes.push(node);
      });
    });
    save(db);
    return { topic: { id: topic.id, title: topic.title }, nodes: nodes.map((n) => toNodeDTO(db, nodes, n)) };
  },

  async generateRoadmap(
    input: { title: string; level: string; goal: string; hoursPerWeek: number },
    handlers: SseHandlers,
    signal?: AbortSignal,
  ): Promise<Roadmap> {
    requireUser();
    const title = (input.title ?? '').trim();
    if (title.length < 2) throw new ApiError('VALIDATION_FAILED', '请填写学习主题', 400);
    if ((input.goal ?? '').trim().length < 10)
      throw new ApiError('VALIDATION_FAILED', '请用至少 10 个字描述学习目标', 400);
    const hours = Math.min(20, Math.max(2, Math.round(input.hoursPerWeek || 8)));
    const template = roadmapTemplateFor(title);
    const subtitle = input.goal.trim().slice(0, 80);
    const roadmap: Roadmap = {
      title: title.slice(0, 40),
      subtitle,
      icon: template.icon,
      color: template.color,
      estimatedWeeks: Math.max(3, Math.round((template.weeks * 8) / hours)),
      weeklyHours: hours,
      summary: `结合你「${input.level}」的起点与每周 ${hours} 小时的投入，按 ${template.stageTitles.length} 个阶段递进：${template.stageTitles.join(' → ')}。每个节点都有可检验的学习目标，边学边验证，避免看过就忘。`,
      stages: [],
    };
    const total = template.nodes.length;
    const stageCount = template.stageTitles.length;
    const per = Math.ceil(total / stageCount);
    let refIndex = 0;
    template.stageTitles.forEach((stageTitle, stageIndex) => {
      const slice = template.nodes.slice(stageIndex * per, (stageIndex + 1) * per);
      roadmap.stages.push({
        title: stageTitle,
        weekRange: template.stageWeeks[stageIndex] ?? '',
        goal: template.stageGoals[stageIndex] ?? objectiveFor(stageTitle),
        nodes: slice.map((node) => {
          refIndex += 1;
          return {
            ref: `n${refIndex}`,
            parentRef: null,
            title: node.title,
            objective: objectiveFor(node.title),
            durationMinutes: node.minutes,
          };
        }),
      });
    });
    await sleep(1400, signal);
    handlers.onProgress?.({ step: 'analyze', message: '正在理解你的学习背景与目标…', percent: 30 });
    await sleep(1600, signal);
    handlers.onProgress?.({ step: 'compose', message: '正在构建学习阶段与里程碑节点…', percent: 64 });
    await sleep(1600, signal);
    handlers.onResult?.(roadmap);
    handlers.onUsage?.({
      model: 'deepseek-chat',
      promptTokens: 1832,
      completionTokens: 905,
      durationMs: 4600,
    });
    return roadmap;
  },

  async addNode(
    topicId: number,
    body: { parentId: number | null; stageIndex: number; title: string; objective: string; durationMinutes: number },
  ): Promise<NodeDTO> {
    const { user, db } = requireUser();
    ensureOwnedTopic(db, user, topicId);
    if (!body.title?.trim() || body.title.trim().length < 2)
      throw new ApiError('VALIDATION_FAILED', '节点名称至少 2 个字', 400);
    if (!body.objective?.trim() || body.objective.trim().length < 10)
      throw new ApiError('VALIDATION_FAILED', '学习目标至少 10 个字', 400);
    const minutes = Math.round(body.durationMinutes);
    if (minutes < 5 || minutes > 600 || minutes % 5 !== 0)
      throw new ApiError('VALIDATION_FAILED', '预计时长需为 5–600 分钟内、按 5 分钟递增', 400);
    const nodes = visibleNodes(db, topicId);
    const parent = body.parentId ? nodes.find((n) => n.id === body.parentId) : null;
    if (body.parentId && !parent) throw new ApiError('NOT_FOUND', '父节点不存在', 404);
    const level = parent ? parent.level + 1 : 1;
    if (level > 3) throw new ApiError('VALIDATION_FAILED', '已达三级上限，不能继续添加子节点', 400);
    if (parent && !nodes.some((n) => n.parentId === parent.id)) {
      parent.revision += 1;
      parent.rawStatus = 'idle';
      parent.completedAt = null;
    }
    const peers = nodes.filter((n) => n.parentId === body.parentId && n.stageIndex === body.stageIndex);
    const node: MockNode = {
      id: nextId(db),
      topicId,
      parentId: body.parentId,
      stageIndex: body.stageIndex,
      level,
      orderNo: peers.length,
      title: body.title.trim(),
      objective: body.objective.trim(),
      durationMinutes: minutes,
      rawStatus: 'idle',
      revision: 1,
      completedAt: null,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      deletedAt: null,
    };
    db.nodes.push(node);
    touchTopic(db, topicId);
    save(db);
    const after = visibleNodes(db, topicId);
    return toNodeDTO(db, after, node);
  },

  async patchNode(
    nodeId: number,
    patch: { title?: string; objective?: string; durationMinutes?: number },
  ): Promise<NodeDTO & { revisionChanged: boolean; parentAffected: number[] }> {
    const { user, db } = requireUser();
    const node = ensureOwnedNode(db, user, nodeId);
    if (!patch.title && !patch.objective && patch.durationMinutes === undefined)
      throw new ApiError('VALIDATION_FAILED', '至少修改一项内容', 400);
    const nodesBefore = visibleNodes(db, node.topicId);
    const beforeStatuses = nodesBefore.map((n) => [n.id, aggregateStatus(rawDtos(nodesBefore), rawDto(n))] as const);
    let revisionChanged = false;
    if (patch.objective !== undefined && patch.objective !== node.objective) {
      if (patch.objective.trim().length < 10)
        throw new ApiError('VALIDATION_FAILED', '学习目标至少 10 个字', 400);
      revisionChanged = true;
      const affected = [
        node,
        ...visibleNodes(db, node.topicId).filter((n) => {
          let parent = n.parentId ? db.nodes.find((p) => p.id === n.parentId) : null;
          while (parent) {
            if (parent.id === node.id) return true;
            parent = parent.parentId ? db.nodes.find((p) => p.id === parent!.parentId) : null;
          }
          return false;
        }),
      ];
      for (const target of affected) {
        target.revision += 1;
        target.rawStatus = 'idle';
        target.completedAt = null;
        target.updatedAt = nowISO();
      }
    }
    if (patch.title !== undefined && patch.title.trim()) {
      node.title = patch.title.trim().slice(0, 80);
      node.updatedAt = nowISO();
    }
    if (patch.durationMinutes !== undefined) {
      const minutes = Math.round(patch.durationMinutes);
      if (minutes < 5 || minutes > 600 || minutes % 5 !== 0)
        throw new ApiError('VALIDATION_FAILED', '预计时长需为 5–600 分钟内、按 5 分钟递增', 400);
      node.durationMinutes = minutes;
      node.updatedAt = nowISO();
    }
    const nodesAfter = visibleNodes(db, node.topicId);
    const parentAffected: number[] = [];
    for (const [id, before] of beforeStatuses) {
      if (id === node.id) continue;
      const afterNode = nodesAfter.find((n) => n.id === id);
      if (!afterNode) continue;
      const after = aggregateStatus(rawDtos(nodesAfter), rawDto(afterNode));
      if (before !== after) parentAffected.push(id);
    }
    touchTopic(db, node.topicId);
    save(db);
    return {
      ...toNodeDTO(db, nodesAfter, node),
      revisionChanged,
      parentAffected,
    };
  },

  async reorderNodes(
    topicId: number,
    body: { groupId: { parentId: number | null; stageIndex: number }; order: number[] },
  ): Promise<{ updated: number }> {
    const { user, db } = requireUser();
    ensureOwnedTopic(db, user, topicId);
    const { parentId, stageIndex } = body.groupId;
    const group = visibleNodes(db, topicId).filter(
      (n) => n.parentId === parentId && n.stageIndex === stageIndex,
    );
    const incoming = body.order ?? [];
    if (incoming.length !== group.length || !incoming.every((id) => group.some((n) => n.id === id)))
      throw new ApiError('VALIDATION_FAILED', '排序范围与该组节点不一致', 400);
    incoming.forEach((id, index) => {
      const node = db.nodes.find((n) => n.id === id);
      if (node) {
        node.orderNo = index;
        node.updatedAt = nowISO();
      }
    });
    save(db);
    return { updated: incoming.length };
  },

  async deleteNode(nodeId: number): Promise<{ deleted: { nodeId: number; subtreeCount: number } }> {
    const { user, db } = requireUser();
    const node = ensureOwnedNode(db, user, nodeId);
    const nodes = visibleNodes(db, node.topicId);
    const removed = [
      node,
      ...nodes.filter((n) => {
        let parent = n.parentId ? nodes.find((p) => p.id === n.parentId) : null;
        while (parent) {
          if (parent.id === node.id) return true;
          parent = parent.parentId ? nodes.find((p) => p.id === parent!.parentId) : null;
        }
        return false;
      }),
    ];
    const stamp = nowISO();
    for (const target of removed) target.deletedAt = stamp;
    db.deleted.push({
      id: nextId(db),
      userId: user.id,
      topicId: node.topicId,
      nodeIds: removed.map((n) => n.id),
      subtreeCount: removed.length,
      rootTitle: node.title,
      deletedAt: stamp,
    });
    touchTopic(db, node.topicId);
    save(db);
    return { deleted: { nodeId: node.id, subtreeCount: removed.length } };
  },

  async undoDelete(topicId: number): Promise<{ restored: number[] }> {
    const { user, db } = requireUser();
    ensureOwnedTopic(db, user, topicId);
    const batch = [...db.deleted].reverse().find((b) => b.topicId === topicId && b.userId === user.id);
    if (!batch) throw new ApiError('NOT_FOUND', '没有可撤销的删除', 404);
    const restored: number[] = [];
    for (const id of batch.nodeIds) {
      const node = db.nodes.find((n) => n.id === id);
      if (node && node.deletedAt !== null) {
        node.deletedAt = null;
        node.updatedAt = nowISO();
        restored.push(id);
      }
    }
    db.deleted = db.deleted.filter((b) => b.id !== batch.id);
    touchTopic(db, topicId);
    save(db);
    return { restored };
  },

  async startQuiz(
    nodeId: number,
    handlers: SseHandlers,
    signal?: AbortSignal,
  ): Promise<{ assessment: AssessmentView }> {
    const { user, db } = requireUser();
    const node = ensureOwnedNode(db, user, nodeId);
    const nodes = visibleNodes(db, node.topicId);
    if (nodes.some((n) => n.parentId === node.id))
      throw new ApiError('VALIDATION_FAILED', '父节点仅汇总进度，请进入叶子节点发起检验', 409);
    if (node.rawStatus === 'done')
      throw new ApiError('VALIDATION_FAILED', '该节点已通过检验；修改学习目标后才能再次检验', 409);
    const existing = db.assessments.find(
      (a) => a.nodeId === node.id && a.revision === node.revision && a.status === 'in_progress',
    );
    if (existing) {
      const view = {
        id: existing.id,
        nodeId: existing.nodeId,
        topicId: existing.topicId,
        revision: existing.revision,
        status: existing.status,
        questions: existing.questions.map(stripQuestion),
      };
      handlers.onResult?.({ assessment: view });
      return { assessment: view };
    }
    if (node.rawStatus === 'idle') {
      node.rawStatus = 'active';
      node.updatedAt = nowISO();
    }
    const questions = quizFor(node);
    const assessment = {
      id: nextId(db),
      userId: user.id,
      topicId: node.topicId,
      nodeId: node.id,
      nodeTitle: node.title,
      objective: node.objective,
      revision: node.revision,
      status: 'in_progress' as const,
      passed: null,
      passedCount: null,
      questions,
      answers: {},
      finishedAt: null,
      createdAt: nowISO(),
    };
    db.assessments.push(assessment);
    touchTopic(db, node.topicId);
    save(db);
    await sleep(900, signal);
    handlers.onProgress?.({ step: 'prepare', message: '正在围绕节点组织检验要点…', percent: 30 });
    await sleep(900, signal);
    handlers.onProgress?.({ step: 'compose', message: '正在设计 3 道检验小题…', percent: 70 });
    await sleep(700, signal);
    const view = {
      id: assessment.id,
      nodeId: assessment.nodeId,
      topicId: assessment.topicId,
      revision: assessment.revision,
      status: assessment.status,
      questions: questions.map(stripQuestion),
    };
    handlers.onResult?.({ assessment: view });
    handlers.onUsage?.({
      model: 'deepseek-chat',
      promptTokens: 512,
      completionTokens: 388,
      durationMs: 2500,
    });
    return { assessment: view };
  },

  async answer(assessmentId: number, body: { questionIndex: number; answer: number | string }): Promise<AnswerResult> {
    const { user, db } = requireUser();
    const assessment = db.assessments.find((a) => a.id === assessmentId && a.userId === user.id);
    if (!assessment) throw new ApiError('NOT_FOUND', '检验记录不存在', 404);
    if (assessment.status !== 'in_progress') throw new ApiError('DUPLICATE_SUBMIT', '该检验已提交，不能重复作答', 409);
    const { questionIndex, answer } = body;
    const question = assessment.questions[questionIndex];
    if (!question) throw new ApiError('VALIDATION_FAILED', '题目不存在', 400);
    if (assessment.answers[questionIndex] !== undefined)
      throw new ApiError('DUPLICATE_SUBMIT', '这道题已经作答，一次一锤定音', 409);
    let result: AnswerResult;
    if (question.type === 'choice') {
      if (typeof answer !== 'number' || answer < 0 || answer > 3)
        throw new ApiError('VALIDATION_FAILED', '请选择一个选项', 400);
      const correct = answer === question.answerIndex;
      assessment.answers[questionIndex] = { answer, passed: correct };
      result = {
        questionIndex,
        type: 'choice',
        correct,
        answerIndex: question.answerIndex ?? 0,
        explanation: question.explanation ?? '',
      };
    } else {
      const text = typeof answer === 'string' ? answer : '';
      if (!text.trim()) throw new ApiError('VALIDATION_FAILED', '请先写下你的答案', 400);
      if (question.type === 'concept' && text.trim().length < (question.minLength ?? 10))
        throw new ApiError('VALIDATION_FAILED', '答案太短，多说两句', 400);
      const outcome = gradeAnswer(text, question.keyPoints ?? question.checks ?? [], question.type);
      assessment.answers[questionIndex] = { answer: text, passed: outcome.passed };
      result = {
        questionIndex,
        type: question.type,
        passed: outcome.passed,
        score: outcome.score,
        gradedBy: 'deepseek-chat',
        feedback: outcome.feedback,
        missingPoints: outcome.missingPoints,
        wrongPoints: [],
        suggestions: outcome.suggestions,
        strengths: outcome.strengths,
      };
    }
    save(db);
    return result;
  },

  async submit(assessmentId: number): Promise<SubmitResult> {
    const { user, db } = requireUser();
    const assessment = db.assessments.find((a) => a.id === assessmentId && a.userId === user.id);
    if (!assessment) throw new ApiError('NOT_FOUND', '检验记录不存在', 404);
    if (assessment.status !== 'in_progress') throw new ApiError('DUPLICATE_SUBMIT', '该检验已提交', 409);
    const node = db.nodes.find((n) => n.id === assessment.nodeId);
    if (!node) throw new ApiError('NOT_FOUND', '节点不存在', 404);
    if (node.revision !== assessment.revision)
      throw new ApiError('QUIZ_EXPIRED', '学习目标已修改，本次检验已过期，请重新发起', 409);
    const total = assessment.questions.length;
    const passedCount = assessment.questions.filter((_, index) => assessment.answers[index]?.passed).length;
    const passed = passedCount >= 2;
    assessment.status = 'finished';
    assessment.passed = passed;
    assessment.passedCount = passedCount;
    assessment.finishedAt = nowISO();
    const today = todayISO();
    if (passed) {
      node.rawStatus = 'done';
      node.completedAt = today;
    } else {
      node.rawStatus = 'failed';
    }
    node.updatedAt = nowISO();
    let checkIn: { id: number; checkDate: string } | null = null;
    if (passed && !db.checkIns.some((c) => c.userId === user.id && c.nodeId === node.id)) {
      const record = { id: nextId(db), userId: user.id, topicId: node.topicId, nodeId: node.id, checkDate: today };
      db.checkIns.push(record);
      checkIn = { id: record.id, checkDate: record.checkDate };
    }
    touchTopic(db, node.topicId);
    const nodes = visibleNodes(db, node.topicId);
    const topicRecord = db.topics.find((t) => t.id === node.topicId);
    const next = nextLeafAfter(
      {
        topic: { stageTitles: topicRecord?.stageTitles ?? [] } as TopicDetail['topic'],
        nodes: nodes.map((n) => toNodeDTO(db, nodes, n)),
      },
      node.id,
    );
    const { streak } = streakFrom(db.checkIns.filter((c) => c.userId === user.id).map((c) => c.checkDate));
    save(db);
    return {
      assessmentId: assessment.id,
      passed,
      passedCount,
      total,
      nodeStatus: node.rawStatus as NodeStatus,
      checkIn,
      streak,
      canRetake: !passed,
      nextNode: next ? { id: next.id, title: next.title } : null,
    };
  },

  async listAssessments(params: { limit?: number; cursor?: number } = {}): Promise<{
    items: AssessmentHistoryItem[];
    nextCursor: number | null;
  }> {
    const { user, db } = requireUser();
    const limit = params.limit ?? 50;
    const offset = params.cursor ?? 0;
    const all = db.assessments
      .filter((a) => a.userId === user.id && a.status === 'finished')
      .sort((a, b) => ((a.finishedAt ?? '') < (b.finishedAt ?? '') ? 1 : -1));
    const slice = all.slice(offset, offset + limit);
    const items = slice.map((a) => {
      const node = db.nodes.find((n) => n.id === a.nodeId);
      return {
        id: a.id,
        nodeId: a.nodeId,
        nodeTitle: a.nodeTitle,
        topicId: a.topicId,
        revision: a.revision,
        status: a.status,
        passed: a.passed === true,
        passedCount: a.passedCount ?? 0,
        objective: a.objective,
        finishedAt: a.finishedAt ?? a.createdAt,
        isStale: node ? node.revision > a.revision : false,
      };
    });
    return { items, nextCursor: offset + slice.length < all.length ? offset + slice.length : null };
  },

  async getNote(nodeId: number): Promise<{ content: string; updatedAt: string } | null> {
    const { user, db } = requireUser();
    ensureOwnedNode(db, user, nodeId);
    const note = db.notes.find((n) => n.userId === user.id && n.nodeId === nodeId);
    return note ? { content: note.content, updatedAt: note.updatedAt } : null;
  },

  async putNote(nodeId: number, body: { content: string }): Promise<{ updatedAt: string }> {
    const { user, db } = requireUser();
    const node = ensureOwnedNode(db, user, nodeId);
    if (typeof body.content !== 'string' || body.content.length > 20000)
      throw new ApiError('VALIDATION_FAILED', '笔记内容需在 20000 字以内', 400);
    const existing = db.notes.find((n) => n.userId === user.id && n.nodeId === nodeId);
    const stamp = nowISO();
    if (existing) {
      existing.content = body.content;
      existing.updatedAt = stamp;
    } else {
      db.notes.push({ userId: user.id, nodeId, content: body.content, updatedAt: stamp });
    }
    node.updatedAt = stamp;
    save(db);
    return { updatedAt: stamp };
  },

  async listResources(nodeId: number): Promise<{ items: ResourceDTO[] }> {
    const { user, db } = requireUser();
    ensureOwnedNode(db, user, nodeId);
    const items = db.resources
      .filter((r) => r.userId === user.id && r.nodeId === nodeId)
      .map(({ id, nodeId: node, type, title, url, createdAt }) => ({ id, nodeId: node, type, title, url, createdAt }));
    return { items };
  },

  async addResource(
    nodeId: number,
    body: { type: string; title: string; url: string },
  ): Promise<ResourceDTO> {
    const { user, db } = requireUser();
    ensureOwnedNode(db, user, nodeId);
    if (!body.title?.trim()) throw new ApiError('VALIDATION_FAILED', '请为资源填写一个名称', 400);
    let parsed: URL;
    try {
      parsed = new URL(body.url ?? '');
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch {
      throw new ApiError('VALIDATION_FAILED', '请输入有效的 http:// 或 https:// 链接', 400);
    }
    const record = {
      id: nextId(db),
      userId: user.id,
      nodeId,
      type: body.type ?? 'link',
      title: body.title.trim().slice(0, 100),
      url: parsed.href,
      createdAt: nowISO(),
    };
    db.resources.push(record);
    save(db);
    const { id, type, title, url, createdAt } = record;
    return { id, nodeId, type, title, url, createdAt };
  },

  async deleteResource(resourceId: number): Promise<null> {
    const { user, db } = requireUser();
    const index = db.resources.findIndex((r) => r.id === resourceId && r.userId === user.id);
    if (index === -1) throw new ApiError('NOT_FOUND', '资源不存在', 404);
    db.resources.splice(index, 1);
    save(db);
    return null;
  },

  async statsOverview(): Promise<StatsOverview & { todayChecked: boolean }> {
    const { user, db } = requireUser();
    const checkIns = db.checkIns.filter((c) => c.userId === user.id);
    const today = todayISO();
    const monday = mondayOfCurrentWeekISO();
    const passedNodes = new Set(checkIns.map((c) => c.nodeId));
    const weekPassed = new Set(
      checkIns.filter((c) => c.checkDate >= monday && c.checkDate <= today).map((c) => c.nodeId),
    );
    const todayPassed = new Set(checkIns.filter((c) => c.checkDate === today).map((c) => c.nodeId));
    const { streak, longest } = streakFrom(checkIns.map((c) => c.checkDate));
    return {
      topicsCount: db.topics.filter((t) => t.userId === user.id).length,
      passedTotal: passedNodes.size,
      weeklyTarget: {
        passed: weekPassed.size,
        goal: 4,
        percent: Math.min(100, Math.round((weekPassed.size / 4) * 100)),
      },
      todayPassed: todayPassed.size,
      streak,
      longestStreak: longest,
      todayChecked: checkIns.some((c) => c.checkDate === today),
    };
  },

  async statsHeatmap(params: { from: string; to: string }): Promise<{ days: HeatmapDay[] }> {
    const { user, db } = requireUser();
    const counts = new Map<string, Set<number>>();
    for (const checkIn of db.checkIns.filter((c) => c.userId === user.id)) {
      if (!counts.has(checkIn.checkDate)) counts.set(checkIn.checkDate, new Set());
      counts.get(checkIn.checkDate)!.add(checkIn.nodeId);
    }
    const today = todayISO();
    const days: HeatmapDay[] = [];
    let cursor = params.from;
    while (cursor <= params.to && cursor <= today) {
      days.push({ date: cursor, count: counts.get(cursor)?.size ?? 0 });
      cursor = shiftISO(cursor, 1);
    }
    return { days };
  },

  async topicProgress(topicId: number): Promise<{ stages: StageProgress[] }> {
    const { user, db } = requireUser();
    const topic = ensureOwnedTopic(db, user, topicId);
    const nodes = visibleNodes(db, topicId);
    const dtoNodes = rawDtos(nodes);
    const stages = topic.stageTitles.map((title, index) => {
      const leaves = stageLeaves(dtoNodes, index);
      const done = leaves.filter(
        (n) => aggregateStatus(dtoNodes, n) === 'done',
      ).length;
      return {
        index,
        title,
        weekRange: topic.stageWeeks[index] ?? '',
        leafTotal: leaves.length,
        leafDone: done,
        percent: leaves.length ? Math.round((done / leaves.length) * 100) : 0,
        allDone: leaves.length > 0 && done === leaves.length,
      };
    });
    return { stages };
  },

  async stageReview(
    topicId: number,
    stageIndex: number,
    handlers: SseHandlers,
    signal?: AbortSignal,
  ): Promise<ReviewResult> {
    const { user, db } = requireUser();
    const topic = ensureOwnedTopic(db, user, topicId);
    const nodes = visibleNodes(db, topicId);
    const dtoNodes = rawDtos(nodes);
    const leaves = stageLeaves(dtoNodes, stageIndex);
    if (!(leaves.length > 0 && leaves.every((n) => aggregateStatus(dtoNodes, n) === 'done')))
      throw new ApiError('STAGE_NOT_COMPLETE', '该阶段还有未通过检验的节点，完成后再来复盘', 409);
    const stageTitle = topic.stageTitles[stageIndex] ?? `阶段 ${stageIndex + 1}`;
    const result: ReviewResult = {
      stageTitle,
      summary: {
        text:
          stageIndex === 0
            ? `你已经完成「${stageTitle}」的全部 ${leaves.length} 个节点，并通过每一次知识检验。从理解概念到独立练习，学习开始变成能运用的能力。`
            : `你已经完成「${stageTitle}」的全部 ${leaves.length} 个节点。把这一阶段的方法沉淀下来，下一阶段会更顺。`,
        abilityRating: 4,
      },
      mastered: leaves.slice(0, 6).map((n) => ({
        point: n.title,
        evidence: '理解核心概念，并通过节点检验。',
      })),
      needsAttention: [
        {
          point: '边界条件与易混概念',
          reason: '练习中最容易出错的位置，建议对照笔记再核对一遍。',
        },
        {
          point: '独立复述关键概念',
          reason: '能做对题不等于能讲清楚；试着不看资料复述一次。',
        },
      ],
      nextStep: [
        {
          action: `进入「${topic.stageTitles[stageIndex + 1] ?? '下一阶段'}」，用一个小场景贯穿练习`,
          reason: '新知识在真实场景里用一遍，才算真正接住。',
        },
        {
          action: '回看本阶段笔记，整理成三句话总结',
          reason: '压缩过的知识更容易长期记住，也方便日后复习。',
        },
      ],
    };
    const record = {
      id: nextId(db),
      userId: user.id,
      topicId,
      stageIndex,
      stageTitle,
      summaryText: result.summary.text,
      abilityRating: result.summary.abilityRating,
      mastered: result.mastered,
      needsAttention: result.needsAttention,
      nextStep: result.nextStep,
      createdAt: nowISO(),
    };
    db.reviews.push(record);
    save(db);
    await sleep(700, signal);
    handlers.onProgress?.({ step: 'collect', message: '正在汇总阶段学习数据…', percent: 40 });
    await sleep(900, signal);
    handlers.onProgress?.({ step: 'compose', message: '正在生成阶段复盘…', percent: 85 });
    await sleep(500, signal);
    handlers.onResult?.(result);
    handlers.onUsage?.({
      model: 'deepseek-chat',
      promptTokens: 1104,
      completionTokens: 486,
      durationMs: 2100,
    });
    return result;
  },
};

function objectiveFor(title: string): string {
  return `能够独立解释「${title}」的核心概念，并完成一个实际练习。`;
}
