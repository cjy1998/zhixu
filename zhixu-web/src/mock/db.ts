import type { NodeStatus, QuizQuestion } from '../api/types';
import { shiftISO, todayISO } from '../domain/dates';

export interface MockNode {
  id: number;
  topicId: number;
  parentId: number | null;
  stageIndex: number;
  level: number;
  orderNo: number;
  title: string;
  objective: string;
  durationMinutes: number;
  rawStatus: NodeStatus;
  revision: number;
  completedAt: string | null;
  quizTemplate?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface MockTopic {
  id: number;
  userId: number;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  estimatedWeeks: number;
  weeklyHours: number;
  summary: string;
  level?: string;
  stageTitles: string[];
  stageWeeks: string[];
  createdAt: string;
  lastActiveAt: string;
}

export interface MockUser {
  id: number;
  name: string;
  email: string;
  password: string | null;
  createdAt: string;
}

export interface MockCheckIn {
  id: number;
  userId: number;
  topicId: number;
  nodeId: number;
  checkDate: string;
}

export interface QuizQuestionFull {
  type: 'choice' | 'concept' | 'code';
  prompt: string;
  options?: string[];
  answerIndex?: number;
  explanation?: string;
  minLength?: number;
  referenceAnswer?: string;
  keyPoints?: string[];
  language?: string;
  starterCode?: string | null;
  checks?: string[];
}

export interface MockAssessment {
  id: number;
  userId: number;
  topicId: number;
  nodeId: number;
  nodeTitle: string;
  objective: string;
  revision: number;
  status: 'in_progress' | 'finished';
  passed: boolean | null;
  passedCount: number | null;
  questions: QuizQuestionFull[];
  answers: Record<number, { answer: number | string; passed: boolean }>;
  finishedAt: string | null;
  createdAt: string;
}

export interface MockNote {
  userId: number;
  nodeId: number;
  content: string;
  updatedAt: string;
}

export interface MockResource {
  id: number;
  userId: number;
  nodeId: number;
  type: string;
  title: string;
  url: string;
  createdAt: string;
}

export interface MockReview {
  id: number;
  userId: number;
  topicId: number;
  stageIndex: number;
  stageTitle: string;
  summaryText: string;
  abilityRating: number;
  mastered: { point: string; evidence: string }[];
  needsAttention: { point: string; reason: string }[];
  nextStep: { action: string; reason: string }[];
  createdAt: string;
}

export interface MockDeletedBatch {
  id: number;
  userId: number;
  topicId: number;
  nodeIds: number[];
  subtreeCount: number;
  rootTitle: string;
  deletedAt: string;
}

export interface MockDB {
  version: number;
  seq: number;
  users: MockUser[];
  topics: MockTopic[];
  nodes: MockNode[];
  checkIns: MockCheckIn[];
  assessments: MockAssessment[];
  notes: MockNote[];
  resources: MockResource[];
  reviews: MockReview[];
  deleted: MockDeletedBatch[];
}

const DB_KEY = 'zhixu-web-mock-v1';

export function nextId(db: MockDB): number {
  return ++db.seq;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function load(): MockDB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MockDB;
      if (parsed.version === 1) return parsed;
    }
  } catch {
    localStorage.removeItem(DB_KEY);
  }
  const db = seed();
  save(db);
  return db;
}

export function save(db: MockDB) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function resetDemo() {
  localStorage.removeItem(DB_KEY);
}

function objectiveFor(title: string): string {
  return `能够独立解释「${title}」的核心概念，并完成一个实际练习。`;
}

function seed(): MockDB {
  const db: MockDB = {
    version: 1,
    seq: 0,
    users: [],
    topics: [],
    nodes: [],
    checkIns: [],
    assessments: [],
    notes: [],
    resources: [],
    reviews: [],
    deleted: [],
  };
  const today = todayISO();
  const user: MockUser = {
    id: nextId(db),
    name: '林知夏',
    email: 'lin.zhixia@example.com',
    password: null,
    createdAt: nowISO(),
  };
  db.users.push(user);
  const userId = user.id;

  interface Spec {
    title: string;
    status: NodeStatus;
    minutes: number;
    completedDaysAgo?: number;
    quizTemplate?: string;
  }
  const javaSpecs: Spec[] = [
    { title: '搭建 Java 开发环境', status: 'done', minutes: 35, completedDaysAgo: 18 },
    { title: '变量、类型与运算符', status: 'done', minutes: 45, completedDaysAgo: 12 },
    { title: '流程控制与方法', status: 'done', minutes: 60, completedDaysAgo: 7 },
    { title: '类与对象：构造方法', status: 'done', minutes: 45, completedDaysAgo: 5 },
    { title: '面向对象：封装与继承', status: 'active', minutes: 60, quizTemplate: 'java-oop' },
    { title: '集合框架：List 与 Set', status: 'pending', minutes: 60, quizTemplate: 'java-collections' },
    { title: '异常处理与调试', status: 'failed', minutes: 45 },
    { title: '泛型与反射基础', status: 'idle', minutes: 60 },
    { title: 'I/O 与文件操作', status: 'idle', minutes: 60 },
    { title: 'Spring Boot 项目起步', status: 'idle', minutes: 90 },
    { title: 'RESTful API 与数据库', status: 'idle', minutes: 90 },
    { title: '完成并部署个人项目', status: 'idle', minutes: 120 },
  ];
  const designSpecs: Spec[] = [
    { title: '认识用户体验与设计流程', status: 'done', minutes: 45, completedDaysAgo: 16 },
    { title: '用户访谈与问题定义', status: 'done', minutes: 45, completedDaysAgo: 6 },
    { title: '用户旅程与信息架构', status: 'active', minutes: 45 },
    { title: '低保真线框图', status: 'idle', minutes: 45 },
    { title: '视觉层级与设计规范', status: 'idle', minutes: 45 },
    { title: 'Figma 组件与自动布局', status: 'idle', minutes: 45 },
    { title: '交互原型与可用性测试', status: 'idle', minutes: 45 },
    { title: '完成一份产品设计案例', status: 'idle', minutes: 45 },
  ];
  const englishSpecs: Spec[] = [
    { title: '英语音标与连读基础', status: 'done', minutes: 30, completedDaysAgo: 9 },
    { title: '日常自我介绍', status: 'done', minutes: 30, completedDaysAgo: 4 },
    { title: '描述工作与日程', status: 'done', minutes: 30, completedDaysAgo: 3 },
    { title: '听懂慢速英语对话', status: 'done', minutes: 30, completedDaysAgo: 2 },
    { title: '日常问答与表达', status: 'done', minutes: 30, completedDaysAgo: 1 },
    { title: '表达观点与给出理由', status: 'active', minutes: 30 },
    { title: '职场邮件写作', status: 'idle', minutes: 30 },
    { title: '跟读与复述训练', status: 'idle', minutes: 30 },
    { title: '模拟英文面试', status: 'idle', minutes: 30 },
    { title: '五分钟英语主题分享', status: 'idle', minutes: 30 },
  ];

  const addTopic = (
    spec: {
      title: string;
      subtitle: string;
      icon: string;
      color: string;
      weeks: number;
      hours: number;
      level: string;
      summary: string;
      stageTitles: string[];
      stageWeeks: string[];
      nodes: Spec[];
      stageOf: (index: number) => number;
    },
  ) => {
    const topic: MockTopic = {
      id: nextId(db),
      userId,
      title: spec.title,
      subtitle: spec.subtitle,
      icon: spec.icon,
      color: spec.color,
      estimatedWeeks: spec.weeks,
      weeklyHours: spec.hours,
      summary: spec.summary,
      level: spec.level,
      stageTitles: spec.stageTitles,
      stageWeeks: spec.stageWeeks,
      createdAt: nowISO(),
      lastActiveAt: nowISO(),
    };
    db.topics.push(topic);
    const orderCounters = new Map<string, number>();
    spec.nodes.forEach((nodeSpec, index) => {
      const stageIndex = spec.stageOf(index);
      const key = `null:${stageIndex}`;
      const orderNo = orderCounters.get(key) ?? 0;
      orderCounters.set(key, orderNo + 1);
      const completedAt = nodeSpec.completedDaysAgo
        ? shiftISO(today, -nodeSpec.completedDaysAgo)
        : null;
      const node: MockNode = {
        id: nextId(db),
        topicId: topic.id,
        parentId: null,
        stageIndex,
        level: 1,
        orderNo,
        title: nodeSpec.title,
        objective: objectiveFor(nodeSpec.title),
        durationMinutes: nodeSpec.minutes,
        rawStatus: nodeSpec.status,
        revision: 1,
        completedAt,
        quizTemplate: nodeSpec.quizTemplate,
        createdAt: topic.createdAt,
        updatedAt: topic.createdAt,
        deletedAt: null,
      };
      db.nodes.push(node);
      if (completedAt) {
        db.checkIns.push({
          id: nextId(db),
          userId,
          topicId: topic.id,
          nodeId: node.id,
          checkDate: completedAt,
        });
        db.assessments.push({
          id: nextId(db),
          userId,
          topicId: topic.id,
          nodeId: node.id,
          nodeTitle: node.title,
          objective: node.objective,
          revision: 1,
          status: 'finished',
          passed: true,
          passedCount: 3,
          questions: [],
          answers: {},
          finishedAt: new Date(`${completedAt}T10:00:00Z`).toISOString(),
          createdAt: new Date(`${completedAt}T09:00:00Z`).toISOString(),
        });
      }
    });
    return topic;
  };

  const javaTopic = addTopic({
    title: 'Java 后端学习路线',
    subtitle: '从基础语法到独立构建后端应用',
    icon: 'coffee',
    color: 'purple',
    weeks: 8,
    hours: 8,
    level: '有一点基础',
    summary:
      '从 Java 语法出发，经面向对象与集合、进阶特性，最终落地 Spring Boot 实战：每个节点都有可检验的目标，边学边验证，避免「看过就忘」。',
    stageTitles: ['Java 语言基础', '面向对象与集合', 'Java 进阶能力', 'Spring Boot 实战'],
    stageWeeks: ['第 1–2 周', '第 3–4 周', '第 5–6 周', '第 7–8 周'],
    nodes: javaSpecs,
    stageOf: (index) => Math.floor(index / 3),
  });
  addTopic({
    title: 'UI/UX 设计入门',
    subtitle: '以用户为中心，做有据可依的设计',
    icon: 'pen',
    color: 'gold',
    weeks: 6,
    hours: 8,
    level: '零基础',
    summary:
      '从理解用户与问题出发，搭建信息架构与线框，再进入视觉与组件设计，最后通过可用性测试完成一份作品集案例。',
    stageTitles: ['理解用户与问题', '搭建产品骨架', '视觉与组件设计', '验证与作品集'],
    stageWeeks: ['第 1 周', '第 2–3 周', '第 4–5 周', '第 6 周'],
    nodes: designSpecs,
    stageOf: (index) => Math.floor(index / 2),
  });
  addTopic({
    title: '英语口语提升计划',
    subtitle: '从不敢开口，到清晰表达自己的想法',
    icon: 'language',
    color: 'blue',
    weeks: 5,
    hours: 8,
    level: '入门',
    summary:
      '先找回发音与表达的基础，再练习听懂并回应日常对话，最后进入真实职场沟通与主题表达，层层递进。',
    stageTitles: ['找回表达的基础', '听懂并流畅回应', '真实职场沟通', '自信表达与展示'],
    stageWeeks: ['第 1 周', '第 2 周', '第 3–4 周', '第 5 周'],
    nodes: englishSpecs,
    stageOf: (index) => Math.min(3, Math.floor(index / 3)),
  });

  const j5 = db.nodes.find((n) => n.topicId === javaTopic.id && n.quizTemplate === 'java-oop');
  if (j5) {
    db.notes.push({
      userId,
      nodeId: j5.id,
      content:
        '## 用自己的话理解\n封装像给对象设定边界，不是所有字段都应该有 setter。\n继承表示“是一种”的关系，比如 Dog 是一种 Animal。\n\n## 还想弄清楚\n重写方法时，访问权限能不能比父类更严格？',
      updatedAt: nowISO(),
    });
    db.resources.push(
      {
        id: nextId(db),
        userId,
        nodeId: j5.id,
        type: 'document',
        title: 'Java 官方教程：继承',
        url: 'https://docs.oracle.com/javase/tutorial/java/IandI/subclasses.html',
        createdAt: nowISO(),
      },
      {
        id: nextId(db),
        userId,
        nodeId: j5.id,
        type: 'book',
        title: 'Java 语言基础学习指南',
        url: 'https://dev.java/learn/',
        createdAt: nowISO(),
      },
      {
        id: nextId(db),
        userId,
        nodeId: j5.id,
        type: 'link',
        title: 'Spring 官方示例仓库',
        url: 'https://github.com/spring-guides',
        createdAt: nowISO(),
      },
    );
  }
  return db;
}

export function userFromToken(token: string | null): MockUser | null {
  if (!token) return null;
  const match = /^mock-token-(\d+)$/.exec(token);
  if (!match) return null;
  const db = load();
  return db.users.find((u) => u.id === Number(match[1])) ?? null;
}

export type { QuizQuestion };
