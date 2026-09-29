import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
await page.goto('http://127.0.0.1:4170/?capture=1#dashboard');
const screens = await page.evaluate(() => window.prototypeScreens);
for (const [route, number, title] of screens) {
  await page.goto(`http://127.0.0.1:4170/?capture=1#${route}`);
  await page.waitForFunction(() => document.getElementById('app')?.textContent.length > 100);
  if (route === 'quiz') await page.locator('[data-answer="1"]').click();
  await page.evaluate(() => document.activeElement?.blur());
  await page.mouse.move(0, 0);
  const modalRoute = ['quiz-loading', 'quiz', 'success', 'failure', 'review'].includes(route);
  await page.screenshot({ path: path.join(import.meta.dirname, 'screenshots', `${number}-${route.replace('/', '-')}.png`), fullPage: !modalRoute });
  console.log(`${number} ${title} captured`);
}
await page.goto('http://127.0.0.1:4170/?capture=1#quiz');
await page.locator('[data-answer="1"]').click();
await page.locator('[data-action="submit-answer"]').click();
await page.evaluate(() => document.activeElement?.blur());
await page.screenshot({ path: path.join(import.meta.dirname, 'screenshots', '16-answer-feedback.png') });
await page.locator('[data-action="next-question"]').click();
await page.locator('#quiz-answer').fill('封装通过 private 隐藏内部状态，保护对象的数据不被任意修改。例如，账户通过存取款方法控制余额。继承则表达 is-a 关系，通过父类复用共同能力，例如 Dog 继承 Animal。');
await page.evaluate(() => document.activeElement?.blur());
await page.screenshot({ path: path.join(import.meta.dirname, 'screenshots', '17-concept-answer.png') });
await page.locator('[data-action="submit-answer"]').click();
await page.locator('[data-action="next-question"]').click();
await page.locator('#quiz-answer').fill('class Dog extends Animal {\n    @Override\n    public String speak() {\n        return "汪汪";\n    }\n}');
await page.evaluate(() => document.activeElement?.blur());
await page.screenshot({ path: path.join(import.meta.dirname, 'screenshots', '18-code-answer.png') });

// Build the three-level example through the UI in this disposable context.
await page.goto('http://127.0.0.1:4170/?capture=1#roadmap');
async function addChild(parentId, title, objective) {
  await page.locator(`[data-node-actions="${parentId}"]`).click();
  await page.locator(`[data-add-child="${parentId}"]`).click();
  await page.locator('#edit-node-title').fill(title);
  await page.locator('#edit-node-objective').fill(objective);
  await page.locator('#edit-node-minutes').fill('25');
  if (await page.locator('#ack-node-impact').isVisible()) await page.locator('#ack-node-impact').check();
  await page.getByRole('button', { name: '添加节点', exact: true }).click();
  await page.locator('#node-editor-form').waitFor({ state: 'hidden' });
  // Read only: the app, not the exporter, owns persistence and generated IDs.
  const created = await page.evaluate(({ parentId, title }) =>
    JSON.parse(localStorage.getItem('zhixu-prototype-v1')).routes.java.find(n => n.parentId === parentId && n.title === title),
  { parentId, title });
  if (!created) throw new Error(`Node was not saved: ${title}`);
  return created.id;
}
const childObjective = '能够解释封装如何保护对象状态，并使用私有字段与公开方法维护账户余额。';
const childId = await addChild('j5', '理解封装：保护对象状态', childObjective);
const grandchildId = await addChild(childId, '实践：编写安全的取款方法', '能够独立编写安全的取款方法，拒绝负数金额与余额不足的请求，并验证边界条件。');
await page.locator('#toast.visible').waitFor({ state: 'hidden' });
await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
await page.mouse.move(0, 0);
await page.screenshot({ path: path.join(import.meta.dirname, 'screenshots', '19-roadmap-editing.png'), fullPage: true });
console.log('19 三级路线树 captured');

await page.locator(`[data-node-actions="${childId}"]`).click();
await page.locator(`[data-edit-node="${childId}"]`).click();
await page.locator('#edit-node-objective').fill('能够设计保护账户状态的封装接口，验证取款金额与余额边界，并为所有异常情况编写测试。');
await page.locator('#ack-node-impact').waitFor({ state: 'visible' });
await page.evaluate(() => document.activeElement?.blur());
await page.mouse.move(0, 0);
await page.screenshot({ path: path.join(import.meta.dirname, 'screenshots', '20-node-edit-impact.png') });
console.log('20 学习目标变更影响确认 captured');
await page.getByRole('button', { name: '取消', exact: true }).click();
if (await page.getByRole('heading', { name: '放弃未保存的修改？', exact: true }).isVisible()) {
  await page.locator('[data-action="discard-node-edit"]').click();
}
await page.getByRole('dialog').waitFor({ state: 'hidden' });
const savedObjective = await page.evaluate(id => JSON.parse(localStorage.getItem('zhixu-prototype-v1')).routes.java.find(n => n.id === id).objective, childId);
if (savedObjective !== childObjective) throw new Error('Discarding the draft changed the saved objective');
await page.setViewportSize({ width: 375, height: 812 });
await page.locator('[data-card-id="j5"]').evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
await page.evaluate(() => { document.activeElement?.blur(); window.scrollBy(0, -1); });
await page.mouse.move(0, 0);
const mobile = await page.evaluate(ids => ({
  width: window.innerWidth,
  scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  cards: ids.map(id => {
    const card = document.querySelector(`[data-card-id="${id}"]`);
    const { left, right, top, bottom } = card.getBoundingClientRect();
    return { depth: card.parentElement.dataset.depth, left, right, top, bottom };
  })
}), ['j5', childId, grandchildId]);
if (mobile.scrollWidth > mobile.width || mobile.cards.some(card => card.left < 0 || card.right > mobile.width || card.top < 0 || card.bottom > 812)) {
  throw new Error(`Mobile tree is clipped: ${JSON.stringify(mobile)}`);
}
await page.screenshot({ path: path.join(import.meta.dirname, 'screenshots', '21-tree-mobile.png') });
console.log(`21 375px 移动端三级树 captured ${JSON.stringify(mobile)}`);

// Supplementary entries name image states, not navigable application routes.
const supplementalScreens = [
  ['answer-feedback', '16', '答案即时反馈'],
  ['concept-answer', '17', '概念问答作答'],
  ['code-answer', '18', '编码小题作答'],
  ['roadmap-editing', '19', '三级路线树 · 1440px 桌面端'],
  ['node-edit-impact', '20', '学习目标变更影响确认 · 1440px 桌面端'],
  ['tree-mobile', '21', '三级路线树 · 375px 移动端']
];
await writeFile(path.join(import.meta.dirname, 'screenshots', 'screens.json'), JSON.stringify([...screens, ...supplementalScreens], null, 2));
console.log(JSON.stringify({ errors, count: screens.length + supplementalScreens.length }));
await browser.close();
if (errors.length) throw new Error('Capture encountered browser errors');
