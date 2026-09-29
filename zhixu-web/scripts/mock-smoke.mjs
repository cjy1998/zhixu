import { createServer } from 'vite';

const passed = [];
const failed = [];
function check(name, condition, detail = '') {
  if (condition) passed.push(name);
  else failed.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

const { mockServer } = await vite.ssrLoadModule('/src/mock/server.ts');
const { setToken } = await vite.ssrLoadModule('/src/api/client.ts');

try {
  const login = await mockServer.login({ email: 'lin.zhixia@example.com', password: 'Pathly2026' });
  setToken(login.token);
  check('login returns demo user', login.user.name === '林知夏');

  const { items } = await mockServer.listTopics();
  check('listTopics has 3 seeded topics', items.length === 3, `got ${items.length}`);
  const java = items.find((t) => t.title.includes('Java'));
  check('java summary has percent/leaves', java.leafTotal === 12 && java.leafDone === 4 && java.percent === 33);

  const detail = await mockServer.getTopic(java.id);
  check('getTopic returns 12 nodes', detail.nodes.length === 12);
  const j1 = detail.nodes.find((n) => n.title.includes('开发环境'));
  const j5 = detail.nodes.find((n) => n.title.includes('封装与继承'));
  const j7 = detail.nodes.find((n) => n.title.includes('异常处理'));
  check('seed statuses done/active/failed', j1.status === 'done' && j5.status === 'active' && j7.status === 'failed');

  const progressEvents = [];
  const quizStart = await mockServer.startQuiz(j5.id, {
    onProgress: (event) => progressEvents.push(event),
  });
  const questions = quizStart.assessment.questions;
  check('quiz emits progress then result', progressEvents.length >= 2 && questions.length === 3);
  check(
    'quiz answers never leak to client',
    !JSON.stringify(questions).includes('answerIndex') && !JSON.stringify(questions).includes('referenceAnswer'),
  );
  check(
    'quiz has choice/concept/code',
    questions[0].type === 'choice' && questions[1].type === 'concept' && questions[2].type === 'code',
  );
  check('choice question has 4 options', questions[0].options.length === 4);

  const a0 = await mockServer.answer(quizStart.assessment.id, { questionIndex: 0, answer: 1 });
  check('choice graded locally', a0.type === 'choice' && a0.correct === true && 'explanation' in a0);
  let duplicateBlocked = false;
  try {
    await mockServer.answer(quizStart.assessment.id, { questionIndex: 0, answer: 1 });
  } catch (error) {
    duplicateBlocked = error.code === 'DUPLICATE_SUBMIT';
  }
  check('duplicate answer rejected with 409 DUPLICATE_SUBMIT', duplicateBlocked);

  const a1 = await mockServer.answer(quizStart.assessment.id, {
    questionIndex: 1,
    answer: '封装用 private 隐藏内部状态并提供受控访问保护对象；继承表达 is-a 关系并复用共同行为，比如 Dog 继承 Animal。',
  });
  check('concept graded with feedback', a1.type === 'concept' && typeof a1.passed === 'boolean' && a1.feedback.length > 10);
  const a2 = await mockServer.answer(quizStart.assessment.id, {
    questionIndex: 2,
    answer: 'class Dog extends Animal {\n    @Override\n    public String speak() { return "汪汪"; }\n}',
  });
  check('code graded with score', a2.type === 'code' && a2.score >= 0 && a2.score <= 100);

  const submit = await mockServer.submit(quizStart.assessment.id);
  check('submit passes with 3/3', submit.passed === true && submit.passedCount === 3 && submit.nodeStatus === 'done');
  check('submit writes check-in and streak', submit.checkIn !== null && submit.streak >= 1);
  let secondSubmitBlocked = false;
  try {
    await mockServer.submit(quizStart.assessment.id);
  } catch (error) {
    secondSubmitBlocked = error.code === 'DUPLICATE_SUBMIT';
  }
  check('second submit rejected', secondSubmitBlocked);

  const patched = await mockServer.patchNode(j5.id, { objective: '能够独立解释封装与继承的完整机制，并完成银行账户练习。' });
  check('objective change bumps revision', patched.revisionChanged === true && patched.revision === 2 && patched.status === 'idle');
  const repatched = await mockServer.patchNode(j5.id, { title: '面向对象：封装与继承（深入）' });
  check('title-only change keeps revision', repatched.revisionChanged === false && repatched.revision === 2);

  const deleted = await mockServer.deleteNode(j9Id(detail));
  check('delete returns subtree count', deleted.deleted.subtreeCount === 1);
  const afterDelete = await mockServer.getTopic(java.id);
  check('deleted node invisible in tree', afterDelete.nodes.length === 11);
  const undone = await mockServer.undoDelete(java.id);
  check('undo restores node', undone.restored.length === 1);
  const afterUndo = await mockServer.getTopic(java.id);
  check('tree back to 12 nodes', afterUndo.nodes.length === 12);

  const reordered = await mockServer.reorderNodes(java.id, {
    groupId: { parentId: null, stageIndex: 0 },
    order: [j1.id, detail.nodes.find((n) => n.title.includes('流程控制')).id, detail.nodes.find((n) => n.title.includes('变量')).id],
  });
  check('reorder updates 3 nodes', reordered.updated === 3);
  const afterReorder = await mockServer.getTopic(java.id);
  const stage0 = afterReorder.nodes.filter((n) => n.stageIndex === 0).sort((a, b) => a.orderNo - b.orderNo);
  check('reorder order persisted', stage0[0].id === j1.id && stage0[2].title.includes('变量'));

  const overview = await mockServer.statsOverview();
  check('overview counts pass', overview.passedTotal >= 12 && overview.streak >= 4 && overview.topicsCount === 3);

  const heatFromValue = heatFrom();
  const heat = await mockServer.statsHeatmap({ from: heatFromValue, to: todayISO() });
  check('heatmap fills missing days with 0', heat.days.some((d) => d.count === 0));
  check('heatmap includes today', heat.days.some((d) => d.date === todayISO()));

  const progress = await mockServer.topicProgress(java.id);
  check('topicProgress has 4 stages', progress.stages.length === 4 && progress.stages[0].allDone === true);

  const genEvents = [];
  const roadmap = await mockServer.generateRoadmap(
    { title: 'Python 数据分析入门', level: '零基础', goal: '能够用 pandas 完成一份完整的数据清洗与可视化报告。', hoursPerWeek: 10 },
    { onProgress: (event) => genEvents.push(event) },
  );
  check('roadmap SSE emits progress', genEvents.length >= 2 && genEvents[0].percent === 30);
  check('roadmap shape matches schema contract', roadmap.stages.length >= 2 && roadmap.stages.every((stage) => stage.nodes.length > 0 && stage.goal.length >= 10));
  check('roadmap refs unique and forward-safe', (() => {
    const seen = new Set();
    for (const stage of roadmap.stages) {
      for (const node of stage.nodes) {
        if (seen.has(node.ref)) return false;
        seen.add(node.ref);
      }
    }
    return true;
  })());

  const created = await mockServer.createTopic(roadmap);
  const createdDetail = await mockServer.getTopic(created.topic.id);
  check('createTopic persists tree', createdDetail.nodes.length === roadmap.stages.reduce((sum, stage) => sum + stage.nodes.length, 0));
  check('created topic appears in list', (await mockServer.listTopics()).items.length === 4);

  let registerFail = false;
  try {
    await mockServer.register({ name: '测试', email: 'lin.zhixia@example.com', password: 'Abcdefg123' });
  } catch (error) {
    registerFail = error.code === 'EMAIL_TAKEN';
  }
  check('duplicate email rejected', registerFail === true);

  const newUser = await mockServer.register({ name: '新同学', email: 'new@x.com', password: 'Abcdefg123' });
  check('register creates user', newUser.user.id > 0);
} finally {
  await vite.close();
}

console.log(`\n通过 ${passed.length} 项`);
if (failed.length) {
  console.log(`失败 ${failed.length} 项:`);
  failed.forEach((item) => console.log(`  ✗ ${item}`));
  process.exit(1);
} else {
  console.log('mock 契约冒烟全部通过');
}

function j9Id(detail) {
  return detail.nodes.find((n) => n.title.includes('I/O 与文件操作')).id;
}

function todayISO() {
  return new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
}

function heatFrom() {
  const monday = new Date(Date.parse(`${todayISO()}T00:00:00Z`));
  const weekday = monday.getUTCDay();
  monday.setUTCDate(monday.getUTCDate() + (weekday === 0 ? -6 : 1 - weekday) - 21 * 7);
  return monday.toISOString().slice(0, 10);
}

function heatTo() {
  return todayISO();
}
