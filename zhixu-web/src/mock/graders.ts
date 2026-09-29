import type { MockNode, QuizQuestionFull } from './db';

export function quizFor(node: MockNode): QuizQuestionFull[] {
  if (node.quizTemplate === 'java-oop')
    return [
      {
        type: 'choice',
        prompt: '下面哪一种做法，更符合「封装」的设计思想？',
        options: [
          '把所有字段设为 public，方便外部直接修改',
          '将字段设为 private，通过方法提供受控访问',
          '让所有类都继承同一个父类，实现代码复用',
          '把相关字段全部搬到子类中，按需暴露',
        ],
        answerIndex: 1,
        explanation:
          '封装通过隐藏内部状态，并由公开方法控制访问，保护对象的不变量。继承主要解决 is-a 关系下的行为复用。',
      },
      {
        type: 'concept',
        prompt: '封装和继承，分别解决什么问题？请用自己的话解释，并举一个简单例子。',
        minLength: 10,
        referenceAnswer:
          '封装隐藏实现、保护状态；继承表达 is-a 关系并复用共同能力。二者相关，但不能相互替代。',
        keyPoints: ['封装', 'private', '隐藏', '继承', 'is-a', '复用'],
      },
      {
        type: 'code',
        prompt:
          'Animal 已定义 public String speak()。请实现 Dog，使其继承 Animal 并重写 speak()，返回“汪汪”。',
        language: 'java',
        starterCode: 'class Dog {\n    // 在这里补全继承关系与重写方法\n\n}',
        referenceAnswer:
          'class Dog extends Animal {\n    @Override\n    public String speak() { return "汪汪"; }\n}',
        checks: ['extends Animal', '@Override', 'speak()', '汪汪'],
      },
    ];
  if (node.quizTemplate === 'java-collections')
    return [
      {
        type: 'choice',
        prompt: '需要保存不重复的用户 ID，应优先选择哪一种集合？',
        options: ['ArrayList', 'HashSet', '允许重复的 List', 'LinkedList'],
        answerIndex: 1,
        explanation: 'HashSet 表达集合的唯一性语义，利用 equals 和 hashCode 判断重复元素。',
      },
      {
        type: 'concept',
        prompt: '为什么放入 HashSet 的对象要正确实现 equals 和 hashCode？请从重复判断和哈希查找两个角度解释。',
        minLength: 10,
        referenceAnswer:
          'equals 定义逻辑相等，hashCode 用于定位哈希桶；相等对象必须有相同哈希值，否则可能破坏去重。',
        keyPoints: ['equals', 'hashCode', '相等', '哈希'],
      },
      {
        type: 'code',
        prompt: '用 HashSet 保存 "Java"，重复添加两次后输出 size()，证明重复添加不会增加数量。',
        language: 'java',
        starterCode: '// 已导入 java.util.*\n',
        referenceAnswer: 'Set<String> ids = new HashSet<>();\nids.add("Java");\nids.add("Java");\nSystem.out.println(ids.size()); // 1',
        checks: ['HashSet', 'add', 'size'],
      },
    ];
  return [
    {
      type: 'choice',
      prompt: `学习「${node.title}」时，哪种方式更能验证真正掌握？`,
      options: [
        '只收藏资料，等以后再看',
        '独立完成练习，并解释选择背后的原因',
        '照抄答案后直接标记完成',
        '把要点背下来，不做练习',
      ],
      answerIndex: 1,
      explanation:
        '能够独立完成练习、解释原因并检查结果，比单纯阅读或收藏更能体现掌握。',
    },
    {
      type: 'concept',
      prompt: `请用自己的话解释：${node.title}的核心概念，以及它解决了什么问题。`,
      minLength: 10,
      referenceAnswer: node.objective,
      keyPoints: [node.title.slice(0, 4), '概念', '例子'],
    },
    {
      type: 'code',
      prompt:
        '如果要在一个真实场景中应用这部分知识，你会怎么做？请描述一个具体场景、操作步骤以及验证结果的方式（可用伪代码或步骤描述）。',
      language: 'pseudo',
      starterCode: null,
      referenceAnswer: '场景 + 步骤 + 验证方式三者齐全，才算把知识落到应用。',
      checks: ['场景', '步骤', '验证'],
    },
  ];
}

export interface GradeOutcome {
  passed: boolean;
  score: number;
  feedback: string;
  missingPoints: string[];
  suggestions: string[];
  strengths: string[];
}

function coreToken(point: string): string {
  const cleaned = point.replace(/[（(].*?[)）]/g, '').replace(/\s+/g, '');
  const match = /[0-9A-Za-z\u4e00-\u9fff]{2,}/.exec(cleaned);
  return (match?.[0] ?? point).toLowerCase();
}

export function gradeAnswer(
  answer: string,
  points: string[],
  kind: 'concept' | 'code',
): GradeOutcome {
  const text = answer.trim();
  const normalized = text.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];
  for (const point of points) {
    const token = coreToken(point);
    if (normalized.includes(token) || normalized.includes(point.toLowerCase())) matched.push(point);
    else missing.push(point);
  }
  const ratio = points.length ? matched.length / points.length : 0;
  const lengthBonus = Math.min(30, Math.round(text.length / 5));
  const score = Math.min(100, Math.round(ratio * 70 + lengthBonus));
  const passed = matched.length >= Math.max(1, Math.ceil(points.length * 0.6));
  const suggestions = passed
    ? [
        `把「${matched[0] ?? points[0]}」放进一个真实练习里再验证一次，理解会更扎实。`,
        '在笔记里用自己的话写下这个概念，隔天回看一次。',
      ]
    : [
        `先补上「${missing[0] ?? points[0]}」：回到学习要点，用自己的话重写一遍。`,
        kind === 'code'
          ? '对照检验要点逐条检查代码，缺哪条补哪条，再提交一次。'
          : '先用自己的话解释，再举一个具体例子，覆盖全部关键点。',
      ];
  const feedback = passed
    ? `你的答案抓住了${matched.length}/${points.length} 个关键点，解释清楚、方向正确。${missing.length ? `还可以补充：「${missing[0]}」。` : '关键点覆盖完整，继续保持。'}`
    : `你的答案覆盖了${matched.length}/${points.length} 个关键点，已经有基础，但还有缺口：${missing.map((m) => `「${m}」`).join('、')}。先补上这些，再回来试一次。`;
  return {
    passed,
    score,
    feedback,
    missingPoints: missing,
    suggestions,
    strengths: matched,
  };
}

export interface RoadmapTemplate {
  stageTitles: string[];
  stageWeeks: string[];
  stageGoals: string[];
  nodes: { title: string; minutes: number }[];
  weeks: number;
  icon: string;
  color: string;
}

export function roadmapTemplateFor(title: string): RoadmapTemplate {
  if (/设计|UI|UX|Figma/i.test(title))
    return {
      stageTitles: ['理解用户与问题', '搭建产品骨架', '视觉与组件设计', '验证与作品集'],
      stageWeeks: ['第 1 周', '第 2–3 周', '第 4–5 周', '第 6 周'],
      stageGoals: [
        '学会访谈与问题定义，把需求与解决方案分开',
        '用旅程与信息架构组织产品结构',
        '掌握视觉层级与可复用组件',
        '完成并检验一份完整的设计案例',
      ],
      nodes: [
        '认识用户体验与设计流程',
        '用户访谈与问题定义',
        '用户旅程与信息架构',
        '低保真线框图',
        '视觉层级与设计规范',
        'Figma 组件与自动布局',
        '交互原型与可用性测试',
        '完成一份产品设计案例',
      ].map((t) => ({ title: t, minutes: 45 })),
      weeks: 6,
      icon: 'pen',
      color: 'gold',
    };
  if (/英语|英文|口语|English/i.test(title))
    return {
      stageTitles: ['找回表达的基础', '听懂并流畅回应', '真实职场沟通', '自信表达与展示'],
      stageWeeks: ['第 1 周', '第 2 周', '第 3–4 周', '第 5 周'],
      stageGoals: [
        '恢复发音与基本句型的肌肉记忆',
        '听懂慢速对话并自然接话',
        '完成邮件、会议等职场表达',
        '完成一次五分钟的主题分享',
      ],
      nodes: [
        '英语音标与连读基础',
        '日常自我介绍',
        '描述工作与日程',
        '听懂慢速英语对话',
        '日常问答与表达',
        '表达观点与给出理由',
        '职场邮件写作',
        '跟读与复述训练',
        '模拟英文面试',
        '五分钟英语主题分享',
      ].map((t) => ({ title: t, minutes: 30 })),
      weeks: 5,
      icon: 'language',
      color: 'blue',
    };
  if (/java|后端|编程|Spring|服务端/i.test(title))
    return {
      stageTitles: ['Java 语言基础', '面向对象与集合', 'Java 进阶能力', 'Spring Boot 实战'],
      stageWeeks: ['第 1–2 周', '第 3–4 周', '第 5–6 周', '第 7–8 周'],
      stageGoals: [
        '掌握语法、流程控制与方法组织',
        '理解封装、继承与集合的正确用法',
        '处理异常、泛型与 I/O 等进阶主题',
        '独立完成一个可部署的 RESTful 服务',
      ],
      nodes: [
        '搭建 Java 开发环境',
        '变量、类型与运算符',
        '流程控制与方法',
        '类与对象：构造方法',
        '面向对象：封装与继承',
        '集合框架：List 与 Set',
        '异常处理与调试',
        '泛型与反射基础',
        'I/O 与文件操作',
        'Spring Boot 项目起步',
        'RESTful API 与数据库',
        '完成并部署个人项目',
      ].map((t) => ({ title: t, minutes: 60 })),
      weeks: 8,
      icon: 'coffee',
      color: 'purple',
    };
  return {
    stageTitles: ['建立基础认知', '掌握核心方法', '专项练习与应用', '成果输出与复盘'],
    stageWeeks: ['第 1–2 周', '第 3–4 周', '第 5–6 周', '第 7–8 周'],
    stageGoals: [
      '认识核心概念与学习边界',
      '掌握常用方法与适用场景',
      '在真实练习中应用并纠错',
      '整理知识结构并产出成果',
    ],
    nodes: [
      '认识核心概念与学习边界',
      '梳理基础术语与关系',
      '用自己的话解释关键概念',
      '拆解一个典型案例',
      '练习常用方法',
      '比较不同方法的适用场景',
      '完成一次独立练习',
      '分析练习中的错误',
      '针对薄弱点专项训练',
      '制作个人学习成果',
      '检验成果并收集反馈',
      '整理知识结构与后续计划',
    ].map((t) => ({ title: t, minutes: 45 })),
    weeks: 8,
    icon: 'book',
    color: 'purple',
  };
}
