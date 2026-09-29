import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const ROOT = '/Users/cjy/Desktop/Daily/code/github/zhixu-prototype';
const BASE = 'http://127.0.0.1:4170/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const report = { passes: [], failures: [], observations: [], consoleErrors: {}, pageErrors: [], networkErrors: [] };
const digest = async name => createHash('sha256').update(await readFile(`${ROOT}/${name}`)).digest('hex');
const before = { app: await digest('app.js'), css: await digest('styles.css') };
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const contexts = [];
let phase = 'server navigation';
async function newPage() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
  contexts.push(context);
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = message.text();
    report.consoleErrors[text] ??= { count: 0, firstPhase: phase, location: message.location() };
    report.consoleErrors[text].count++;
  });
  page.on('pageerror', error => report.pageErrors.push({ phase, message: error.message }));
  page.on('requestfailed', request => report.networkErrors.push({ phase, url: request.url(), error: request.failure()?.errorText }));
  page.on('response', response => {
    if (response.status() >= 400) report.networkErrors.push({ phase, url: response.url(), status: response.status() });
  });
  return page;
}
async function step(name, action) {
  phase = name;
  try {
    const details = await action();
    report.passes.push({ name, ...(details === undefined ? {} : { details }) });
    console.log(`PASS ${name}`);
    return true;
  } catch (error) {
    report.failures.push({ name, error: error.message, stack: error.stack });
    console.log(`FAIL ${name}: ${error.message}`);
    return false;
  }
}
async function visible(page, selector) { await page.locator(selector).waitFor({ state: 'visible' }); }
async function textHas(page, selector, text) {
  await page.waitForFunction(({ selector, text }) => document.querySelector(selector)?.textContent.includes(text), { selector, text });
}
async function route(page, hash) {
  await page.waitForURL(url => url.hash === `#${hash}`, { timeout: 12000 });
}
async function goto(page, hash) {
  await page.goto(`${BASE}#${hash}`);
  await route(page, hash);
}
async function storage(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('zhixu-prototype-v1') || '{}'));
}
async function nativeInvalid(page, selector, submit, expectedFlag) {
  await submit.click();
  const result = await page.locator(selector).evaluate((el, flag) => ({ valid: el.validity.valid, expected: el.validity[flag], message: el.validationMessage }), expectedFlag);
  assert.equal(result.valid, false);
  assert.equal(result.expected, true);
  return result.message;
}

// Every mutation below goes through the UI; storage is read only for assertions.
const customObjective = '能够独立设计学习数据的校验步骤，解释边界条件，并用具体输入验证输出结果。';
const applicationAnswer = '我会选择每周学习记录作为真实场景，先明确目标和输入条件，再独立编写具体操作步骤，分别验证正常情况、边界情况和错误输入，最后比较实际输出与预期结果并记录改进方法。';
const card = (page, id) => page.locator(`.tree-card[data-card-id="${id}"]`);
const savedNode = (saved, id, topicId = 'java') => saved.routes[topicId].find(n => n.id === id);
const rawProgress = (saved, id, topicId = 'java') => saved.statuses[id] || savedNode(saved, id, topicId).status;
function firstPasses(saved) {
  const seen = new Set();
  return saved.assessments.filter(r => r.passed && !seen.has(r.nodeId) && seen.add(r.nodeId));
}
async function regression(name, action) {
  await step(name, async () => {
    const page = await newPage();
    try {
      await goto(page, 'roadmap');
      await visible(page, '.route-stage[data-stage="0"]');
      return await action(page);
    } catch (error) {
      const screenshot = `/tmp/zhixu-regression-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0,90)}.png`;
      try {
        await page.screenshot({ path: screenshot, fullPage: true });
        report.observations.push({ name, url: page.url(), screenshot });
      } catch (captureError) {
        report.observations.push({ name, screenshotError: captureError.message });
      }
      throw error;
    } finally {
      await page.context().close();
      contexts.splice(contexts.indexOf(page.context()), 1);
    }
  });
}
async function openEditor(page, id) {
  await page.locator(`[data-node-actions="${id}"]`).click();
  await page.locator(`[data-edit-node="${id}"]`).click();
  await visible(page, '#edit-node-title');
}
async function fillNodeEditor(page, values) {
  if (values.title !== undefined) await page.locator('#edit-node-title').fill(values.title);
  if (values.objective !== undefined) await page.locator('#edit-node-objective').fill(values.objective);
  if (values.minutes !== undefined) await page.locator('#edit-node-minutes').fill(String(values.minutes));
}
async function submitEditor(page, name, acknowledge = false) {
  if (acknowledge) await page.locator('#ack-node-impact').check();
  await page.getByRole('button', { name, exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
}
async function editNode(page, id, values, acknowledge = false) {
  await openEditor(page, id);
  await fillNodeEditor(page, values);
  await submitEditor(page, '保存修改', acknowledge);
}
async function addNode(page, title, { parentId = null, stage = 2, acknowledge = false } = {}) {
  if (parentId) {
    await page.locator(`[data-node-actions="${parentId}"]`).click();
    await page.locator(`[data-add-child="${parentId}"]`).click();
  } else {
    await page.locator(`.route-stage[data-stage="${stage}"] [data-add-stage="${stage}"]`).click();
  }
  await fillNodeEditor(page, { title, objective: customObjective, minutes: 35 });
  await submitEditor(page, '添加节点', acknowledge);
  const saved = await storage(page);
  const added = saved.routes[saved.activeTopic].find(n => n.title === title);
  assert(added, `Added node ${title} must persist`);
  await visible(page, `[data-card-id="${added.id}"]`);
  return added.id;
}
async function openDelete(page, id) {
  await page.locator(`[data-node-actions="${id}"]`).click();
  await page.locator(`[data-delete-node="${id}"]`).click();
  await visible(page, `[data-confirm-delete="${id}"]`);
}
async function deleteNodeUI(page, id) {
  await openDelete(page, id);
  await page.locator(`[data-confirm-delete="${id}"]`).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(await card(page, id).count(), 0);
}
async function genericQuiz(page, id, objective) {
  await goto(page, `node/${id}`);
  if (objective) await textHas(page, '.learning-card', objective);
  await page.locator('[data-action="start-quiz"]').click();
  await route(page, 'quiz');
  assert.equal(await page.locator('[data-action="submit-answer"]').isEnabled(), false);
  await page.getByRole('radio').nth(1).click();
  await page.getByRole('button', { name: '提交答案', exact: true }).click();
  await textHas(page, '.answer-feedback', '回答正确');
  await page.getByRole('button', { name: '下一题', exact: true }).click();
  if (objective) await textHas(page, '.question-note', objective);
  for (let index = 1; index <= 2; index++) {
    await page.locator('#quiz-answer').fill(applicationAnswer);
    await page.getByRole('button', { name: '提交答案', exact: true }).click();
    await textHas(page, '.answer-feedback', '回答正确');
    await page.getByRole('button', { name: index === 2 ? '查看检验结果' : '下一题', exact: true }).click();
  }
  await route(page, 'success');
  await textHas(page, '.result-score', '3 / 3');
  const saved = await storage(page);
  const attempt = saved.assessments.at(-1);
  assert.equal(attempt.nodeId, id);
  assert.equal(attempt.revision, savedNode(saved, id).revision);
  assert.equal(attempt.passed, true);
  assert.equal(attempt.date, '2026-09-23');
  await page.getByRole('button', { name: '回到学习路线', exact: true }).click();
  await route(page, 'roadmap');
  return saved;
}
async function activitySnapshot(page) {
  await goto(page, 'stats');
  await visible(page, '.heatmap');
  return {
    total: await page.locator('.stats-stat').nth(1).locator('strong').innerText(),
    streak: await page.locator('.stats-stat.featured strong').innerText(),
    days: await page.locator('[data-heat]').evaluateAll(cells => cells.map(el => [el.dataset.heat, el.title]))
  };
}
async function peerOrder(page, parentId = null, stage = 2) {
  return page.locator(`.route-stage[data-stage="${stage}"] ${parentId ? `#children-${parentId}` : '.stage-cards'} > .node-branch`).evaluateAll(els => els.map(el => el.dataset.nodeId));
}
async function dragNode(page, id, targetId, after = false, allowed = true) {
  const handle = page.locator(`[data-drag-node="${id}"]`);
  const target = card(page, targetId);
  // Use Chrome's native mouse/HTML drag sequence, never dispatch synthetic drag events.
  await handle.scrollIntoViewIfNeeded();
  const sourceBox = await handle.boundingBox();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 12, sourceBox.y + sourceBox.height / 2 + 8, { steps: 5 });
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  const x = box.x + box.width * 0.55;
  const y = box.y + box.height * (after ? 0.75 : 0.25);
  try {
    await page.mouse.move(x, y, { steps: 12 });
    await page.mouse.move(x + 1, y, { steps: 2 });
    const marker = await target.getAttribute('class');
    if (allowed) assert(marker.includes(after ? 'drop-after' : 'drop-before'), `Native drag must show insertion marker: ${marker}`);
    else assert(!/drop-(before|after)/.test(marker), 'Cross-group drag must not show insertion marker');
  } finally {
    await page.mouse.up();
  }
}
async function assertNoOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    outside: [...document.querySelectorAll('.tree-card, .node-controls button, .node-drag, .node-toggle, .modal, .node-editor input, .node-editor textarea')]
      .filter(el => el.getClientRects().length)
      .map(el => ({ selector: el.dataset.cardId || el.id || el.className, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right }))
      .filter(rect => rect.left < -1 || rect.right > innerWidth + 1)
  }));
  assert(dimensions.document <= dimensions.viewport + 1 && dimensions.body <= dimensions.viewport + 1, `${label}: horizontal overflow ${JSON.stringify(dimensions)}`);
  assert.deepEqual(dimensions.outside, [], `${label}: controls outside viewport`);
  return dimensions;
}

try {
  const page = await newPage();
  await step('Server page navigation at 1440x1080', async () => {
    const response = await page.goto(BASE, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    await visible(page, '.dashboard-hero');
    assert.deepEqual(page.viewportSize(), { width: 1440, height: 1080 });
    return { status: response.status(), title: await page.title() };
  });

  await step('Login: required, malformed email, short password, password toggle and valid login', async () => {
    await page.getByRole('button', { name: '返回登录页', exact: true }).click();
    await route(page, 'login');
    const submit = page.getByRole('button', { name: '登录，继续学习' });
    await page.locator('#auth-email').fill('');
    await nativeInvalid(page, '#auth-email', submit, 'valueMissing');
    assert.equal(new URL(page.url()).hash, '#login');
    await page.locator('#auth-email').fill('not-an-email');
    await nativeInvalid(page, '#auth-email', submit, 'typeMismatch');
    await page.locator('#auth-email').fill('tester@example.test');
    await page.locator('#auth-password').fill('');
    await nativeInvalid(page, '#auth-password', submit, 'valueMissing');
    await page.locator('#auth-password').fill('abc123');
    await nativeInvalid(page, '#auth-password', submit, 'tooShort');
    await page.locator('#auth-password').fill('Prototype2026');
    await page.getByRole('button', { name: '显示密码', exact: true }).click();
    assert.equal(await page.locator('#auth-password').getAttribute('type'), 'text');
    await page.getByRole('button', { name: '隐藏密码', exact: true }).click();
    assert.equal(await page.locator('#auth-password').getAttribute('type'), 'password');
    await submit.click();
    await route(page, 'dashboard');
    await visible(page, '.dashboard-hero');
    const saved = JSON.stringify(await storage(page));
    assert(!saved.includes('tester@example.test'));
    assert(!saved.includes('Prototype2026'));
  });

  await step('Demo entry bypasses invalid login fields', async () => {
    await page.getByRole('button', { name: '返回登录页', exact: true }).click();
    await route(page, 'login');
    await page.locator('#auth-email').fill('');
    await page.locator('#auth-password').fill('');
    await page.getByRole('button', { name: '免登录，体验示例工作台' }).click();
    await route(page, 'dashboard');
    await visible(page, '.dashboard-hero');
  });

  const authPage = await newPage();
  await step('Register validation: name, email, password length/composition and terms', async () => {
    await goto(authPage, 'login');
    await authPage.getByRole('link', { name: '注册', exact: true }).click();
    await route(authPage, 'register');
    const submit = authPage.getByRole('button', { name: '创建我的账号' });
    await nativeInvalid(authPage, '#auth-name', submit, 'valueMissing');
    await authPage.locator('#auth-name').fill('交互测试同学');
    await nativeInvalid(authPage, '#auth-email', submit, 'valueMissing');
    await authPage.locator('#auth-email').fill('invalid-email');
    await nativeInvalid(authPage, '#auth-email', submit, 'typeMismatch');
    await authPage.locator('#auth-email').fill('register@example.test');
    await nativeInvalid(authPage, '#auth-password', submit, 'valueMissing');
    await authPage.locator('#auth-password').fill('abc123');
    await nativeInvalid(authPage, '#auth-password', submit, 'tooShort');
    await authPage.locator('#auth-password').fill('abcdefgh');
    await nativeInvalid(authPage, 'input[type="checkbox"]', submit, 'valueMissing');
    await authPage.getByRole('checkbox').check();
    await submit.click();
    await textHas(authPage, '#auth-error', '密码需要同时包含字母和数字');
    await authPage.locator('#auth-password').fill('12345678');
    await submit.click();
    await textHas(authPage, '#auth-error', '密码需要同时包含字母和数字');
    assert.equal(new URL(authPage.url()).hash, '#register');
    await authPage.getByRole('button', { name: '演示服务与隐私说明', exact: true }).click();
    await visible(authPage, '[role="dialog"]');
    await textHas(authPage, '[role="dialog"]', '本地预设数据与简单规则模拟');
    await authPage.keyboard.press('Escape');
    assert.equal(await authPage.getByRole('dialog').count(), 0);
    await authPage.locator('#auth-password').fill('Register2026');
    await submit.click();
    await route(authPage, 'empty');
    await visible(authPage, '.empty-state');
    assert((await authPage.locator('h1').innerText()).includes('交互测试同学'));
    const saved = await storage(authPage);
    assert.equal(saved.name, '交互测试同学');
    assert(!JSON.stringify(saved).includes('register@example.test'));
    assert(!JSON.stringify(saved).includes('Register2026'));
  });

  await step('Empty state: zero counts, no seeded activity, first-theme and preset controls', async () => {
    await goto(authPage, 'empty');
    await visible(authPage, '.empty-state');
    assert.equal(await authPage.locator('.nav-count').innerText(), '0');
    assert.equal(await authPage.locator('.topic-card,.heatmap,.summary-row').count(), 0);
    await authPage.getByRole('button', { name: '创建第一个学习主题', exact: true }).click();
    await route(authPage, 'create');
    await visible(authPage, '#create-form');
    await goto(authPage, 'empty');
    await authPage.getByRole('button', { name: 'UI/UX 设计', exact: true }).click();
    await route(authPage, 'create');
    assert.equal(await authPage.locator('#topic-title').inputValue(), 'UI/UX 设计入门');
  });

  const title = '交互测试：数据分析路线';
  const goal = '独立使用电子表格分析每周学习数据，完成一份清晰可复用的学习成果报告。';
  let customId;
  await step('Wizard validation and create → generating → generated preserve inputs', async () => {
    await goto(page, 'create');
    const submit = page.getByRole('button', { name: '生成我的学习路线' });
    await page.locator('#topic-title').fill('');
    await nativeInvalid(page, '#topic-title', submit, 'valueMissing');
    await page.locator('#topic-title').fill('   ');
    await submit.click();
    await textHas(page, '#create-error', '请填写主题');
    await page.locator('#topic-title').fill(title);
    await page.locator('#learning-goal').fill('');
    await nativeInvalid(page, '#learning-goal', submit, 'valueMissing');
    await page.locator('#learning-goal').fill('过短目标');
    await submit.click();
    assert.equal(new URL(page.url()).hash, '#create');
    await page.locator('#learning-goal').fill(goal);
    await page.getByRole('radio', { name: '零基础 从第一步开始' }).click();
    await page.locator('#hours').focus();
    await page.locator('#hours').press('Home');
    for (let i = 0; i < 9; i++) await page.locator('#hours').press('ArrowRight');
    assert.equal(await page.locator('#hours').inputValue(), '11');
    await submit.click();
    await route(page, 'generating');
    await textHas(page, '.generating', title);
    await route(page, 'generated');
    await textHas(page, '.generated', title);
    await textHas(page, '.generated', '每周 11 小时');
    await page.getByRole('button', { name: '调整背景', exact: true }).click();
    await route(page, 'create');
    assert.equal(await page.locator('#topic-title').inputValue(), title);
    assert.equal(await page.locator('#learning-goal').inputValue(), goal);
    assert.equal(await page.locator('#hours').inputValue(), '11');
    assert.equal(await page.getByRole('radio', { name: '零基础 从第一步开始' }).getAttribute('aria-checked'), 'true');
    await submit.click();
    await route(page, 'generating');
    await route(page, 'generated');
    await page.getByRole('button', { name: '开启学习旅程' }).click();
    await route(page, 'roadmap');
    await textHas(page, '.route-hero', title);
    await textHas(page, '.route-hero', '每周 11 小时');
    await page.getByRole('tab', { name: '学习目标与计划' }).click();
    await textHas(page, '.route-overview', goal);
    const saved = await storage(page);
    assert.equal(saved.created.length, 1);
    assert.equal(saved.created[0].title, title);
    assert.equal(saved.created[0].goal, goal);
    assert.equal(saved.created[0].hours, 11);
    customId = saved.created[0].id;
    await page.reload();
    await textHas(page, '.route-hero', title);
    await page.getByRole('tab', { name: '学习目标与计划' }).click();
    await textHas(page, '.route-overview', goal);
    return { title, goal, hours: 11, customId };
  });

  await step('Created-theme starting-level display matches zero-basis selection', async () => {
    await textHas(page, '.route-hero', title);
    assert((await page.locator('.route-hero .meta-line').innerText()).includes('零基础'),
      `Selected 零基础 in wizard; confirmed roadmap displays: ${await page.locator('.route-hero .meta-line').innerText()}`);
  });

  const note = '## 交互测试笔记\n封装用于隐藏内部状态，继承用于复用父类能力。\n刷新后仍应保留。';
  await step('j5 note autosaves across immediate and settled reload', async () => {
    await goto(page, 'node/j5');
    await visible(page, '#note-editor');
    await page.getByRole('textbox', { name: '我的学习笔记', exact: true }).fill(note);
    await page.reload();
    await visible(page, '#note-editor');
    assert.equal(await page.locator('#note-editor').inputValue(), note);
    await page.locator('#note-editor').fill(`${note}\n第二次编辑`);
    await textHas(page, '#save-status', '已保存到本机');
    await page.reload();
    assert.equal(await page.locator('#note-editor').inputValue(), `${note}\n第二次编辑`);
  });

  await step('All six Markdown toolbar buttons format actual selection and persist', async () => {
    const content = '测试内容';
    for (const [label, expected] of [
      ['插入标题', `## ${content}`], ['插入加粗', `**${content}**`], ['插入斜体', `*${content}*`],
      ['插入列表', `- ${content}`], ['插入代码', `\`${content}\``], ['插入链接', `[${content}](链接地址)`]
    ]) {
      await page.locator('#note-editor').fill(content);
      await page.locator('#note-editor').press('ControlOrMeta+A');
      await page.getByRole('button', { name: label, exact: true }).click();
      assert.equal(await page.locator('#note-editor').inputValue(), expected, label);
      assert.equal(await page.locator('#note-count').innerText(), `${expected.length} 字`);
      await textHas(page, '#save-status', '已保存到本机');
      await page.reload();
      assert.equal(await page.locator('#note-editor').inputValue(), expected, `${label} after reload`);
    }
    await page.locator('#note-editor').fill(note);
    await textHas(page, '#save-status', '已保存到本机');
  });

  const resourceUrl = 'https://example.com/pathly-ui-test';
  await step('Resource: reject javascript URL, add HTTPS link, reject duplicate, retain after reload', async () => {
    const originalCount = await page.locator('.resource-item').count();
    await page.getByRole('button', { name: '添加资源收藏' }).click();
    await page.getByRole('textbox', { name: '资源名称', exact: true }).fill('安全与持久化测试资源');
    await page.getByRole('textbox', { name: '资源链接', exact: true }).fill('javascript:alert(1)');
    await page.getByRole('button', { name: '添加到资源收藏' }).click();
    await textHas(page, '#resource-error', '有效的 http:// 或 https://');
    assert.equal(await page.locator('.resource-item').count(), originalCount);
    await page.getByRole('textbox', { name: '资源链接', exact: true }).fill(resourceUrl);
    await page.getByLabel('资源类型', { exact: true }).selectOption('文档');
    await page.getByRole('button', { name: '添加到资源收藏' }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('.resource-item').count(), originalCount + 1);
    const link = page.getByRole('link', { name: '安全与持久化测试资源', exact: true });
    assert.equal(await link.getAttribute('href'), resourceUrl);
    assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
    await page.getByRole('button', { name: '添加资源收藏' }).click();
    await page.locator('#resource-title').fill('重复链接');
    await page.locator('#resource-url').fill(resourceUrl);
    await page.getByRole('button', { name: '添加到资源收藏' }).click();
    await textHas(page, '#resource-error', '这个链接已经收藏过了');
    assert.equal(await page.locator('.resource-item').count(), originalCount + 1);
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    await page.reload();
    assert.equal(await page.locator('.resource-item').count(), originalCount + 1);
    assert.equal(await page.locator(`.resource-item a[href="${resourceUrl}"]`).count(), 1);
  });

  async function completeQuiz(correct) {
    await route(page, 'quiz');
    await visible(page, '[data-action="submit-answer"]');
    assert.equal(await page.getByRole('button', { name: '提交答案', exact: true }).isEnabled(), false);
    await page.getByRole('radio').nth(correct ? 1 : 0).click();
    await page.getByRole('button', { name: '提交答案', exact: true }).click();
    await textHas(page, '.answer-feedback', correct ? '回答正确' : '还差一点');
    await page.getByRole('button', { name: '下一题', exact: true }).click();
    await page.getByRole('textbox', { name: '概念问答答案', exact: true }).fill(correct ? '封装隐藏内部状态保护对象，继承父类复用能力' : '不知道，两者完全没有区别');
    await page.getByRole('button', { name: '提交答案', exact: true }).click();
    await textHas(page, '.answer-feedback', correct ? '回答正确' : '还差一点');
    await page.getByRole('button', { name: '下一题', exact: true }).click();
    await page.getByRole('textbox', { name: '编码小题答案', exact: true }).fill(correct ? 'class Dog extends Animal { @Override public String speak() { return "汪汪"; } }' : 'class Cat { public int run() { return 1; } }');
    await page.getByRole('button', { name: '提交答案', exact: true }).click();
    await textHas(page, '.answer-feedback', correct ? '回答正确' : '还差一点');
    await page.getByRole('button', { name: '查看检验结果', exact: true }).click();
    await route(page, correct ? 'success' : 'failure');
    await visible(page, '.result-body');
  }

  await step('j5 wrong quiz: 0/3, failed node, zero checkins, Java 4/12 and streak 7', async () => {
    await page.getByRole('button', { name: '发起 AI 检验' }).click();
    await route(page, 'quiz-loading');
    await textHas(page, '[role="dialog"]', '本地演示规则');
    await completeQuiz(false);
    await textHas(page, '.result-score', '0 / 3');
    await textHas(page, '.failure-note', '本次不计入打卡');
    const saved = await storage(page);
    assert.equal(saved.statuses.j5, 'failed');
    assert.deepEqual(saved.checked, []);
    await page.getByRole('button', { name: '回到节点，巩固一下' }).click();
    await route(page, 'node/j5');
    await textHas(page, '.detail-heading .badge', '检验未通过');
    await page.reload();
    await textHas(page, '.detail-heading .badge', '检验未通过');
    await page.getByRole('link', { name: /^返回学习路线/ }).click();
    await route(page, 'roadmap');
    await textHas(page, '.route-hero', '已掌握 4 / 12 个节点');
    await page.getByRole('link', { name: '学习统计', exact: true }).click();
    await route(page, 'stats');
    assert.match(await page.locator('.stats-stat.featured strong').innerText(), /^7\s*天$/);
    return { status: saved.statuses.j5, checked: saved.checked, progress: '4/12', streak: 7 };
  });

  await step('j5 correct quiz: 3/3, exactly one checkin, done, Java 5/12, streak 8', async () => {
    await goto(page, 'node/j5');
    await page.getByRole('button', { name: '重新发起检验' }).click();
    await route(page, 'quiz-loading');
    await completeQuiz(true);
    await textHas(page, '.result-score', '3 / 3');
    await textHas(page, '.result-streak', '连续打卡 8 天');
    const saved = await storage(page);
    assert.equal(saved.statuses.j5, 'done');
    assert.deepEqual(saved.checked, ['j5']);
    await page.getByRole('button', { name: '回到学习路线', exact: true }).click();
    await route(page, 'roadmap');
    await textHas(page, '.route-hero', '已掌握 5 / 12 个节点');
    await textHas(page, 'a[href="#node/j5"] .badge', '已完成');
    await page.getByRole('link', { name: '学习统计', exact: true }).click();
    await route(page, 'stats');
    assert.match(await page.locator('.stats-stat.featured strong').innerText(), /^8\s*天$/);
    await page.getByRole('button', { name: '定位今天' }).click();
    await textHas(page, '#heat-selection', '2026-09-23 · 1 个节点通过检验');
    await textHas(page, '.topic-progress-row[data-topic="java"]', '5 / 12 个节点已掌握');
    await page.reload();
    assert.deepEqual((await storage(page)).checked, ['j5']);
    return { status: saved.statuses.j5, checked: saved.checked, progress: '5/12', streak: 8 };
  });

  await step('Repeat completed quiz: no duplicate checkin or progress increase', async () => {
    await goto(page, 'node/j5');
    await textHas(page, '.detail-heading .badge', '已完成');
    await page.getByRole('button', { name: '再次巩固知识' }).click();
    await completeQuiz(true);
    const saved = await storage(page);
    assert.equal(saved.statuses.j5, 'done');
    assert.deepEqual(saved.checked, ['j5']);
    report.observations.push({ name: 'Repeat success result copy', text: await page.locator('.result-score').innerText() });
    await page.getByRole('button', { name: '回到学习路线', exact: true }).click();
    await route(page, 'roadmap');
    await textHas(page, '.route-hero', '已掌握 5 / 12 个节点');
    await page.getByRole('link', { name: '学习统计', exact: true }).click();
    await route(page, 'stats');
    assert.match(await page.locator('.stats-stat.featured strong').innerText(), /^8\s*天$/);
    await page.getByRole('button', { name: '定位今天' }).click();
    await textHas(page, '#heat-selection', '2026-09-23 · 1 个节点通过检验');
  });

  await step('Search: node, case-insensitive topic, no matches, click result and Escape', async () => {
    const trigger = page.getByRole('button', { name: '搜索学习节点', exact: true });
    await trigger.click();
    await visible(page, '#node-search');
    assert.equal(await page.locator('#node-search').evaluate(el => document.activeElement === el), true);
    await page.locator('#node-search').fill('面向对象');
    assert.equal(await page.locator('.search-result').count(), 1);
    await textHas(page, '#search-results', '封装与继承');
    await page.locator('#node-search').fill('jAvA');
    assert.equal(await page.locator('.search-result').count(), 7);
    await page.locator('#node-search').fill('完全不存在的关键词xyz987');
    await textHas(page, '.search-empty', '没有找到相关节点');
    assert.equal(await page.locator('.search-result').count(), 0);
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await trigger.evaluate(el => document.activeElement === el), true);
    await trigger.click();
    await page.locator('#node-search').fill('面向对象');
    await page.locator('.search-result').click();
    await route(page, 'node/j5');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await page.getByRole('dialog').count(), 0);
    await textHas(page, '.detail-heading h1', '面向对象：封装与继承');
  });

  await step('Completed-node failed retake preserves existing completion and checkin', async () => {
    await page.getByRole('button', { name: '再次巩固知识' }).click();
    await completeQuiz(false);
    const saved = await storage(page);
    assert.equal(saved.statuses.j5, 'done');
    assert.deepEqual(saved.checked, ['j5']);
    report.observations.push({ name: 'Failed retake copy', text: await page.locator('.failure-note').innerText() });
    await page.keyboard.press('Escape');
    await route(page, 'node/j5');
    await textHas(page, '.detail-heading .badge', '已完成');
  });

  await regression('Completed seed title and duration edits preserve progress and history', async page => {
    const initial = await storage(page);
    const activity = await activitySnapshot(page);
    await goto(page, 'roadmap');
    await openEditor(page, 'j1');
    const originalObjective = await page.locator('#edit-node-objective').inputValue();
    await fillNodeEditor(page, { title: '开发环境安装与验证（已重命名）' });
    assert.equal(await page.locator('#ack-node-impact').isVisible(), false);
    await submitEditor(page, '保存修改');
    let saved = await storage(page);
    assert.equal(rawProgress(saved, 'j1'), 'done');
    assert.equal(savedNode(saved, 'j1').objective, originalObjective);
    assert.equal(savedNode(saved, 'j1').revision, 1);
    assert.deepEqual(saved.assessments, initial.assessments);
    assert.deepEqual(saved.checked, initial.checked);
    await textHas(page, '.route-hero', '已掌握 4 / 12 个节点');
    await editNode(page, 'j1', { minutes: 600 });
    await page.locator('[data-move-node="j1"][data-direction="1"]').click();
    await page.reload();
    saved = await storage(page);
    assert.equal(savedNode(saved, 'j1').duration, '600 分钟');
    assert.equal(savedNode(saved, 'j1').revision, 1);
    assert.equal(rawProgress(saved, 'j1'), 'done');
    assert.deepEqual(await peerOrder(page, null, 0), ['j2', 'j1', 'j3']);
    assert.deepEqual(await activitySnapshot(page), activity);
    assert.deepEqual(saved.assessments, initial.assessments);
  });

  await regression('Seed objective acknowledgement resets current result but recheck retains first history', async page => {
    const initial = await storage(page);
    const activity = await activitySnapshot(page);
    await goto(page, 'roadmap');
    await openEditor(page, 'j1');
    await fillNodeEditor(page, { objective: customObjective });
    await textHas(page, '#node-edit-impact', '1 个叶子节点');
    await nativeInvalid(page, '#ack-node-impact', page.getByRole('button', { name: '保存修改', exact: true }), 'valueMissing');
    assert.deepEqual((await storage(page)).assessments, initial.assessments);
    await submitEditor(page, '保存修改', true);
    let saved = await storage(page);
    assert.equal(rawProgress(saved, 'j1'), 'idle');
    assert.equal(savedNode(saved, 'j1').revision, 2);
    assert.deepEqual(saved.assessments, initial.assessments);
    await textHas(page, '.route-hero', '已掌握 3 / 12 个节点');
    assert.equal(await page.locator('[data-review="0"]').count(), 0);
    await page.reload();
    assert.equal(rawProgress(await storage(page), 'j1'), 'idle');
    saved = await genericQuiz(page, 'j1', customObjective);
    assert.equal(rawProgress(saved, 'j1'), 'done');
    assert.equal(saved.assessments.length, initial.assessments.length + 1);
    assert.deepEqual(firstPasses(saved), firstPasses(initial));
    assert.deepEqual(saved.checked, initial.checked);
    await textHas(page, '.route-hero', '已掌握 4 / 12 个节点');
    assert.deepEqual(await activitySnapshot(page), activity);
    await goto(page, 'node/j1');
    await page.locator('.node-history summary').click();
    await textHas(page, '.node-history', '第 1 版');
    await textHas(page, '.node-history', '第 2 版');
    await textHas(page, '.node-history', '旧版记录，仅作回顾');
  });

  await regression('Custom objective recheck never duplicates checked or heatmap', async page => {
    const id = await addNode(page, '自定义检验与首次打卡');
    const initial = await storage(page);
    let saved = await genericQuiz(page, id, customObjective);
    assert.deepEqual(saved.checked, [id]);
    assert.equal(firstPasses(saved).length, firstPasses(initial).length + 1);
    const activity = await activitySnapshot(page);
    await goto(page, 'roadmap');
    const changedObjective = `${customObjective}新增复核过程并解释校验失败的原因。`;
    await editNode(page, id, { objective: changedObjective }, true);
    assert.equal(rawProgress(await storage(page), id), 'idle');
    saved = await genericQuiz(page, id, changedObjective);
    assert.deepEqual(saved.checked, [id]);
    assert.equal(saved.assessments.filter(r => r.nodeId === id && r.passed).length, 2);
    assert.equal(saved.assessments.at(-1).revision, 2);
    assert.deepEqual(await activitySnapshot(page), activity);
    await page.reload();
    assert.deepEqual((await storage(page)).checked, [id]);
  });

  await regression('Node editor validation and dirty discard retain draft without mutation', async page => {
    const initial = await storage(page);
    await page.locator('.route-stage[data-stage="2"] [data-add-stage="2"]').click();
    const submit = page.getByRole('button', { name: '添加节点', exact: true });
    await nativeInvalid(page, '#edit-node-title', submit, 'valueMissing');
    await page.locator('#edit-node-title').fill('验证未保存的节点');
    await nativeInvalid(page, '#edit-node-objective', submit, 'valueMissing');
    await page.locator('#edit-node-objective').fill('短目标');
    await nativeInvalid(page, '#edit-node-objective', submit, 'tooShort');
    await page.locator('#edit-node-objective').fill(customObjective);
    for (const [value, flag] of [['0', 'rangeUnderflow'], ['605', 'rangeOverflow'], ['7', 'stepMismatch']]) {
      await page.locator('#edit-node-minutes').fill(value);
      await nativeInvalid(page, '#edit-node-minutes', submit, flag);
    }
    await page.locator('#edit-node-minutes').fill('5');
    await page.keyboard.press('Escape');
    await textHas(page, '[role="dialog"]', '放弃未保存的修改');
    await page.getByRole('button', { name: '继续编辑', exact: true }).click();
    assert.equal(await page.locator('#edit-node-title').inputValue(), '验证未保存的节点');
    assert.equal(await page.locator('#edit-node-objective').inputValue(), customObjective);
    assert.equal(await page.locator('#edit-node-minutes').inputValue(), '5');
    await page.getByRole('button', { name: '关闭弹窗', exact: true }).click();
    await page.getByRole('button', { name: '放弃修改', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.deepEqual((await storage(page)).routes, initial.routes);
    assert.deepEqual((await storage(page)).assessments, initial.assessments);
    await openEditor(page, 'j1');
    await page.locator('#edit-node-objective').fill(customObjective);
    await page.locator('#ack-node-impact').check();
    await page.locator('#edit-node-objective').fill(`${customObjective}再补充一个边界案例。`);
    assert.equal(await page.locator('#ack-node-impact').isChecked(), false, 'Further objective changes require fresh acknowledgement');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '放弃修改', exact: true }).click();
    assert.deepEqual((await storage(page)).routes, initial.routes);
  });

  await regression('Modal Escape focus trap and nested editor return focus', async page => {
    const trigger = page.locator('[data-node-actions="j1"]');
    await trigger.click();
    await page.keyboard.press('Tab');
    assert.equal(await page.getByRole('button', { name: '关闭弹窗', exact: true }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.getByRole('button', { name: '返回路线', exact: true }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Tab');
    assert.equal(await page.getByRole('button', { name: '关闭弹窗', exact: true }).evaluate(el => el === document.activeElement), true);
    assert.equal(await page.locator('#app').evaluate(el => el.inert), true);
    await page.keyboard.press('Escape');
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
    await openEditor(page, 'j1');
    assert.equal(await page.locator('#edit-node-title').evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#app').evaluate(el => el.inert), false);
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true, 'Closing a nested editor must restore the original management-button focus');
  });

  await regression('Create roots children grandchildren depth limit folding and responsive overflow', async page => {
    const root = await addNode(page, '一级学习目标与边界条件验证');
    const secondRoot = await addNode(page, '第二个独立学习目标');
    const child = await addNode(page, '二级学习目标与实际应用步骤', { parentId: root });
    const sibling = await addNode(page, '二级并列学习目标', { parentId: root });
    const grandchild = await addNode(page, '三级目标：验证正常输入以及边界输入并详细记录结果', { parentId: child });
    const saved = await storage(page);
    for (const [id, parentId, depth] of [[root, null, 1], [secondRoot, null, 1], [child, root, 2], [sibling, root, 2], [grandchild, child, 3]]) {
      const n = savedNode(saved, id);
      assert.equal(n.parentId, parentId);
      assert.equal(n.stage, 2);
      assert.equal(n.objective, customObjective);
      assert(Number.isFinite(n.order));
      assert.equal(rawProgress(saved, id), 'idle');
      assert.equal(await page.locator(`[data-node-id="${id}"]`).getAttribute('data-depth'), String(depth));
    }
    await textHas(page, '.route-hero', '已掌握 4 / 15 个节点');
    await page.locator(`[data-node-actions="${grandchild}"]`).click();
    assert.equal(await page.locator(`[data-add-child="${grandchild}"]`).isEnabled(), false);
    await textHas(page, '[role="dialog"]', '已达三级上限');
    await page.keyboard.press('Escape');
    await page.locator(`[data-toggle-node="${root}"]`).click();
    assert.equal(await page.locator(`[data-toggle-node="${root}"]`).getAttribute('aria-expanded'), 'false');
    assert.equal(await card(page, grandchild).isVisible(), false);
    await page.locator(`[data-toggle-node="${root}"]`).click();
    assert.equal(await card(page, grandchild).isVisible(), true);
    assert.deepEqual((await storage(page)).routes, saved.routes);
    await page.reload();
    await visible(page, `[data-card-id="${grandchild}"]`);
    const layouts = [];
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 1080 });
      await card(page, grandchild).scrollIntoViewIfNeeded();
      layouts.push(await assertNoOverflow(page, `Depth-three roadmap at ${width}px`));
      await openEditor(page, grandchild);
      await assertNoOverflow(page, `Depth-three editor at ${width}px`);
      await page.keyboard.press('Escape');
    }
    return { root, child, grandchild, layouts };
  });

  await regression('Same-level buttons and native drag preserve subtrees and reject cross groups', async page => {
    const root = await addNode(page, '排序父节点甲');
    const otherRoot = await addNode(page, '排序父节点乙');
    const childA = await addNode(page, '排序子节点甲', { parentId: root });
    const childB = await addNode(page, '排序子节点乙', { parentId: root });
    const grandchild = await addNode(page, '排序孙节点', { parentId: childA });
    const originalHistory = (await storage(page)).assessments;
    assert.equal(await page.locator(`[data-move-node="${childA}"][data-direction="-1"]`).isEnabled(), false);
    assert.equal(await page.locator(`[data-move-node="${childB}"][data-direction="1"]`).isEnabled(), false);
    await page.locator(`[data-move-node="${childB}"][data-direction="-1"]`).click();
    assert.deepEqual(await peerOrder(page, root), [childB, childA]);
    await page.locator(`[data-move-node="${childB}"][data-direction="1"]`).click();
    assert.deepEqual(await peerOrder(page, root), [childA, childB]);
    await dragNode(page, childA, childB, true);
    assert.deepEqual(await peerOrder(page, root), [childB, childA]);
    await dragNode(page, childA, childB, false);
    assert.deepEqual(await peerOrder(page, root), [childA, childB]);
    await dragNode(page, root, otherRoot, true);
    assert.deepEqual((await peerOrder(page)).slice(-2), [otherRoot, root]);
    assert.equal(savedNode(await storage(page), grandchild).parentId, childA);
    const routes = (await storage(page)).routes;
    await dragNode(page, childA, otherRoot, false, false);
    assert.deepEqual((await storage(page)).routes, routes, 'Dragging across parents must not mutate nodes');
    await dragNode(page, root, 'j10', false, false);
    assert.deepEqual((await storage(page)).routes, routes, 'Dragging across stages must not mutate nodes');
    await page.reload();
    assert.deepEqual(await peerOrder(page, root), [childA, childB]);
    assert.deepEqual((await peerOrder(page)).slice(-2), [otherRoot, root]);
    assert.deepEqual((await storage(page)).assessments, originalHistory);
  });

  await regression('Delete subtree counts cancellation LIFO reload undo and unrelated edit preservation', async page => {
    const root = await addNode(page, '可撤销的完整学习分组');
    const child = await addNode(page, '可撤销的子节点', { parentId: root });
    const leaf = await addNode(page, '可撤销的三级学习节点', { parentId: child });
    await genericQuiz(page, leaf, customObjective);
    await goto(page, `node/${leaf}`);
    await page.locator('#note-editor').fill('需要随撤销恢复的真实学习笔记。');
    await page.getByRole('button', { name: '添加资源收藏', exact: true }).click();
    await page.locator('#resource-title').fill('撤销回归测试资源');
    await page.locator('#resource-url').fill('https://example.com/undo-resource');
    await page.getByRole('button', { name: '添加到资源收藏', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await goto(page, 'roadmap');
    const initial = await storage(page);
    await openDelete(page, root);
    await textHas(page, '.delete-impact', '3 个节点');
    await textHas(page, '.delete-impact', '2 个子孙节点');
    await textHas(page, '.delete-impact', '1 份笔记、10 个资源');
    await textHas(page, '.delete-impact', '1 条历史检验记录');
    await page.getByRole('button', { name: '保留节点', exact: true }).click();
    assert.deepEqual((await storage(page)).routes, initial.routes);
    assert.equal((await storage(page)).deleted.length, 0);
    await deleteNodeUI(page, root);
    for (const id of [root, child, leaf]) assert.equal(await card(page, id).count(), 0);
    await editNode(page, 'j2', { title: '删除之后独立保存的新名称', minutes: 55 });
    await deleteNodeUI(page, 'j3');
    await page.reload();
    await textHas(page, '.route-undo', '流程控制与方法');
    await page.locator('.route-undo [data-undo-delete]').click();
    await visible(page, '[data-card-id="j3"]');
    assert.equal(await card(page, root).count(), 0);
    await textHas(page, '.route-undo', '可撤销的完整学习分组');
    await page.locator('.route-undo [data-undo-delete]').click();
    const restored = await storage(page);
    for (const id of [root, child, leaf]) {
      await visible(page, `[data-card-id="${id}"]`);
      const beforeNode = savedNode(initial, id), afterNode = savedNode(restored, id);
      assert.deepEqual({ ...afterNode, order: beforeNode.order }, beforeNode);
    }
    assert.equal(savedNode(restored, 'j2').title, '删除之后独立保存的新名称');
    assert.equal(savedNode(restored, 'j2').duration, '55 分钟');
    assert.deepEqual(restored.assessments, initial.assessments);
    assert.deepEqual(restored.checked, initial.checked);
    assert.equal(restored.deleted.length, 0);
    assert.equal(await page.locator('.route-undo').count(), 0);
    await goto(page, `node/${leaf}`);
    assert.equal(await page.locator('#note-editor').inputValue(), '需要随撤销恢复的真实学习笔记。');
    assert.equal(await page.getByRole('link', { name: '撤销回归测试资源', exact: true }).getAttribute('href'), 'https://example.com/undo-resource');
    await textHas(page, '.detail-heading .badge', '已完成');
  });

  await regression('Undo batches remain isolated per topic', async page => {
    await deleteNodeUI(page, 'j2');
    await page.locator('.topic-nav[data-topic="design"]').click();
    await deleteNodeUI(page, 'd1');
    await page.reload();
    await textHas(page, '.route-undo', '认识用户体验与设计流程');
    await page.locator('.topic-nav[data-topic="java"]').click();
    await textHas(page, '.route-undo', '变量、类型与运算符');
    await page.locator('.route-undo [data-undo-delete]').click();
    await visible(page, '[data-card-id="j2"]');
    assert.equal((await storage(page)).deleted.length, 1);
    await page.locator('.topic-nav[data-topic="design"]').click();
    assert.equal(await card(page, 'd1').count(), 0);
    await page.locator('.route-undo [data-undo-delete]').click();
    await visible(page, '[data-card-id="d1"]');
    assert.equal((await storage(page)).deleted.length, 0);
  });

  await regression('Split completed seed group-only progress direct quiz guard and final child removal', async page => {
    const initial = await storage(page);
    await page.locator('[data-node-actions="j1"]').click();
    await page.locator('[data-add-child="j1"]').click();
    await fillNodeEditor(page, { title: '已完成父节点的新学习步骤', objective: customObjective });
    await nativeInvalid(page, '#ack-node-impact', page.getByRole('button', { name: '添加节点', exact: true }), 'valueMissing');
    await submitEditor(page, '添加节点', true);
    let saved = await storage(page);
    const child = saved.routes.java.find(n => n.parentId === 'j1').id;
    assert.equal(rawProgress(saved, 'j1'), 'idle');
    assert.equal(rawProgress(saved, child), 'idle');
    assert.equal(savedNode(saved, 'j1').revision, 2);
    assert.deepEqual(saved.assessments, initial.assessments);
    await textHas(page, '.route-hero', '已掌握 3 / 12 个节点');
    await textHas(page, '[data-card-id="j1"] .node-bottom', '0 / 1 个叶子节点已掌握');
    saved = await genericQuiz(page, child, customObjective);
    await textHas(page, '.route-hero', '已掌握 4 / 12 个节点');
    await textHas(page, '[data-card-id="j1"] .badge', '已完成');
    assert.equal(rawProgress(saved, 'j1'), 'idle');
    assert.deepEqual(saved.checked, [child]);
    assert.equal(firstPasses(saved).length, firstPasses(initial).length + 1);
    await goto(page, 'node/j1');
    assert.equal(await page.locator('[data-action="start-quiz"]').count(), 0);
    await textHas(page, '.ready-card', '分组节点');
    // Same-document direct hash navigation deliberately tests the route guard, not an injected quiz state.
    await page.goto(`${BASE}#quiz`);
    await route(page, 'node/j1');
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.deepEqual((await storage(page)).assessments, saved.assessments);
    await goto(page, 'roadmap');
    await openDelete(page, child);
    await textHas(page, '.delete-impact', '不能继承子节点成绩');
    await page.locator(`[data-confirm-delete="${child}"]`).click();
    await textHas(page, '[data-card-id="j1"] .badge', '未开始');
    await textHas(page, '.route-hero', '已掌握 3 / 12 个节点');
    assert.equal(rawProgress(await storage(page), 'j1'), 'idle');
    assert.deepEqual((await storage(page)).checked, [child]);
    assert.deepEqual((await storage(page)).assessments, saved.assessments);
    await page.reload();
    await textHas(page, '[data-card-id="j1"] .badge', '未开始');
    await page.locator('.route-undo [data-undo-delete]').click();
    await textHas(page, '[data-card-id="j1"] .badge', '已完成');
    await textHas(page, '.route-hero', '已掌握 4 / 12 个节点');
  });

  await regression('Parent objective change explicitly resets every descendant without erasing history', async page => {
    const root = await addNode(page, '需要重新检验的父目标');
    const child = await addNode(page, '子目标甲', { parentId: root });
    const other = await addNode(page, '子目标乙', { parentId: root });
    const grandchild = await addNode(page, '孙目标甲', { parentId: child });
    await genericQuiz(page, grandchild, customObjective);
    await genericQuiz(page, other, customObjective);
    await textHas(page, `[data-card-id="${root}"] .badge`, '已完成');
    await textHas(page, '.route-hero', '已掌握 6 / 14 个节点');
    const initial = await storage(page);
    await openEditor(page, root);
    await fillNodeEditor(page, { objective: `${customObjective}重新定义整体评估标准并检查全部子任务。` });
    await textHas(page, '#node-edit-impact', '2 个叶子节点');
    await nativeInvalid(page, '#ack-node-impact', page.getByRole('button', { name: '保存修改', exact: true }), 'valueMissing');
    await submitEditor(page, '保存修改', true);
    const saved = await storage(page);
    for (const id of [root, child, other, grandchild]) {
      assert.equal(rawProgress(saved, id), 'idle', `Reset descendant ${id}`);
      assert.equal(savedNode(saved, id).revision, savedNode(initial, id).revision + 1);
    }
    assert.deepEqual(saved.assessments, initial.assessments);
    assert.deepEqual(saved.checked, initial.checked);
    await textHas(page, '.route-hero', '已掌握 4 / 14 个节点');
    await page.reload();
    await textHas(page, `[data-card-id="${root}"] .badge`, '未开始');
  });

  await regression('Undo after parent goal changes or new leaf progress requires explicit confirmation', async page => {
    const root = await addNode(page, '撤销时校验父目标版本');
    const child = await addNode(page, '可恢复的二级分组', { parentId: root });
    const grandchild = await addNode(page, '可恢复的已掌握叶子', { parentId: child });
    const completed = await genericQuiz(page, grandchild, customObjective);
    await deleteNodeUI(page, child);
    const objective = `${customObjective}增加对异常输出的独立解释与复盘要求。`;
    await editNode(page, root, { objective }, true);
    const changed = await storage(page);
    await page.locator('.route-undo [data-undo-delete]').click();
    await textHas(page, '.modal-body', '恢复的子节点需重新检验');
    await page.getByRole('button', { name: '暂不恢复', exact: true }).click();
    assert.deepEqual(await storage(page), changed);
    await page.locator('.route-undo [data-undo-delete]').click();
    await page.getByRole('button', { name: '确认恢复', exact: true }).click();
    await visible(page, `[data-card-id="${grandchild}"]`);
    let saved = await storage(page);
    assert.equal(saved.deleted.length, 0);
    assert.equal(savedNode(saved, root).objective, objective);
    for (const id of [child, grandchild]) {
      assert.equal(rawProgress(saved, id), 'idle');
      assert.equal(savedNode(saved, id).revision, savedNode(completed, id).revision + 1);
      assert.equal(savedNode(saved, id).customContent, true);
    }
    assert.deepEqual(saved.assessments, completed.assessments);
    assert.deepEqual(saved.checked, completed.checked);
    await page.reload();
    await textHas(page, `[data-card-id="${root}"] .badge`, '未开始');
    saved = await genericQuiz(page, grandchild, customObjective);
    assert.deepEqual(firstPasses(saved), firstPasses(completed));
    await deleteNodeUI(page, child);
    const parentPassed = await genericQuiz(page, root, objective);
    await page.locator('.route-undo [data-undo-delete]').click();
    await textHas(page, '.modal-body', '父节点已产生新的学习进度');
    await page.getByRole('button', { name: '暂不恢复', exact: true }).click();
    assert.deepEqual(await storage(page), parentPassed);
    await page.locator('.route-undo [data-undo-delete]').click();
    await page.getByRole('button', { name: '确认恢复', exact: true }).click();
    await textHas(page, `[data-card-id="${root}"] .badge`, '已完成');
    saved = await storage(page);
    assert.equal(rawProgress(saved, root), 'idle');
    assert.equal(rawProgress(saved, grandchild), 'done');
    assert.equal(savedNode(saved, root).revision, savedNode(parentPassed, root).revision + 1);
    assert.deepEqual(saved.assessments, parentPassed.assessments);
    assert.deepEqual(saved.checked, parentPassed.checked);
    assert.equal(saved.deleted.length, 0);
    await goto(page, `node/${root}`);
    assert.equal(await page.locator('[data-action="start-quiz"]').count(), 0);
    await textHas(page, '.ready-card', '分组节点');
  });

  await regression('Delete completed seed retains historical dashboard and heatmap activity', async page => {
    const initial = await storage(page);
    const activity = await activitySnapshot(page);
    await goto(page, 'roadmap');
    await openDelete(page, 'j1');
    await textHas(page, '.delete-impact', '1 条历史检验记录');
    await page.locator('[data-confirm-delete="j1"]').click();
    await textHas(page, '.route-hero', '已掌握 3 / 11 个节点');
    assert.deepEqual((await storage(page)).assessments, initial.assessments);
    assert.deepEqual((await storage(page)).checked, initial.checked);
    assert.deepEqual(await activitySnapshot(page), activity);
    await goto(page, 'dashboard');
    await textHas(page, '.summary-row', '历史通过');
    assert.equal(parseInt(await page.locator('.summary-item').nth(1).locator('.summary-value').innerText(), 10), firstPasses(initial).length);
    await page.getByRole('button', { name: '搜索学习节点', exact: true }).click();
    await page.locator('#node-search').fill('搭建 Java 开发环境');
    assert.equal(await page.locator('.search-result').count(), 0);
    await page.keyboard.press('Escape');
    await goto(page, 'node/j1');
    await textHas(page, '.empty-state', '这个节点已从路线移除');
    assert.equal(await page.locator('[data-action="start-quiz"]').count(), 0);
    await page.getByRole('button', { name: '返回学习路线', exact: true }).click();
    await route(page, 'roadmap');
    await page.locator('.route-undo [data-undo-delete]').click();
    await textHas(page, '[data-card-id="j1"] .badge', '已完成');
  });

  await regression('Search dashboard continue and next links track renamed and deleted nodes', async page => {
    const title = '重命名后应出现在所有入口的封装课程';
    await editNode(page, 'j5', { title });
    await editNode(page, 'j6', { title: '新的集合课程名称' });
    await goto(page, 'dashboard');
    await textHas(page, '.topic-card[data-topic="java"] .topic-next', title);
    await textHas(page, '.today-card', title);
    await page.getByRole('button', { name: '继续上次学习' }).click();
    await route(page, 'node/j5');
    await textHas(page, '.detail-heading h1', title);
    await textHas(page, '.next-node-card', '新的集合课程名称');
    assert.equal(await page.locator('.next-node-card a').getAttribute('href'), '#node/j6');
    await page.getByRole('button', { name: '搜索学习节点', exact: true }).click();
    await page.locator('#node-search').fill(title);
    assert.equal(await page.locator('.search-result').count(), 1);
    await page.keyboard.press('Escape');
    await goto(page, 'roadmap');
    await deleteNodeUI(page, 'j5');
    await goto(page, 'dashboard');
    assert.equal(await page.locator('[data-go="node/j5"], a[href="#node/j5"]').count(), 0);
    await textHas(page, '.topic-card[data-topic="java"] .topic-next', '新的集合课程名称');
    await page.getByRole('button', { name: '继续上次学习' }).click();
    await route(page, 'node/j6');
    await goto(page, 'node/j4');
    assert.equal(await page.locator('.next-node-card a').getAttribute('href'), '#node/j6');
    await page.locator('.next-node-card a').click();
    await route(page, 'node/j6');
    await goto(page, 'roadmap');
    await deleteNodeUI(page, 'j6');
    await goto(page, 'node/j4');
    assert.equal(await page.locator('.next-node-card a').getAttribute('href'), '#node/j7');
    await page.getByRole('button', { name: '搜索学习节点', exact: true }).click();
    await page.locator('#node-search').fill(title);
    assert.equal(await page.locator('.search-result').count(), 0);
    await page.locator('#node-search').fill('新的集合课程名称');
    assert.equal(await page.locator('.search-result').count(), 0);
    await page.keyboard.press('Escape');
  });

  await regression('Empty stages and entirely deleted route never complete or divide by zero', async page => {
    const history = (await storage(page)).assessments;
    for (const id of ['j1', 'j2', 'j3']) await deleteNodeUI(page, id);
    await textHas(page, '.route-stage[data-stage="0"] .stage-meta', '0 / 0 个节点');
    assert.equal(await page.locator('.route-stage[data-stage="0"] .stage-number.done, [data-review="0"]').count(), 0);
    await textHas(page, '.route-stage[data-stage="0"] .route-empty', '还没有学习节点');
    for (let index = 4; index <= 12; index++) await deleteNodeUI(page, `j${index}`);
    await page.reload();
    await textHas(page, '.route-hero', '已掌握 0 / 0 个节点');
    assert.equal(await page.locator('.progress-ring strong').innerText(), '0%');
    assert.equal(await page.locator('.stage-number.done, [data-review]').count(), 0);
    assert.equal(await page.locator('.tree-card').count(), 0);
    assert(!/NaN|Infinity/.test(await page.locator('.route-hero').innerHTML()));
    assert.deepEqual((await storage(page)).assessments, history);
    await goto(page, 'dashboard');
    await textHas(page, '.topic-card[data-topic="java"]', '已掌握 0 / 0 个节点');
    await textHas(page, '.topic-card[data-topic="java"]', '添加第一个学习节点');
    await page.getByRole('button', { name: '继续上次学习' }).click();
    await route(page, 'roadmap');
    await goto(page, 'stats');
    await textHas(page, '.topic-progress-row[data-topic="java"]', '0 / 0 个节点已掌握');
    const summary = await page.locator('.topic-progress-row[data-topic="java"]').innerText();
    assert(!summary.includes('全部阶段已完成'), `Empty route must not claim completion: ${summary}`);
    assert(!/NaN|Infinity/.test(await page.locator('.topic-progress-row[data-topic="java"]').innerHTML()));
  });

  await step('No browser console page or network errors across all regressions', async () => {
    assert.deepEqual(report.pageErrors, [], 'Uncaught page errors');
    assert.deepEqual(report.consoleErrors, {}, 'Browser console errors');
    assert.deepEqual(report.networkErrors, [], 'Failed network requests or HTTP errors');
  });

  report.observations.push({
    name: 'Source integrity (test does not write either source file)',
    appChangedConcurrently: (await digest('app.js')) !== before.app,
    cssChangedConcurrently: (await digest('styles.css')) !== before.css
  });
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
  console.log('\nINTERACTION_TEST_REPORT');
  console.log(JSON.stringify(report, null, 2));
  if (report.failures.length || report.pageErrors.length || Object.keys(report.consoleErrors).length || report.networkErrors.length) process.exitCode = 1;
}
