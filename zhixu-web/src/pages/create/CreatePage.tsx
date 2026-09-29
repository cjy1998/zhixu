import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { backend, USE_MOCK } from '../../api';
import type { Roadmap } from '../../api/types';
import { Icon } from '../../components/Icon';
import { useToast } from '../../app/ToastContext';
import { useTopics } from '../../app/TopicsContext';
import { cx } from '../../lib/cx';
import u from '../../styles/ui.module.css';
import s from './create.module.css';

type Step = 'form' | 'generating' | 'preview';

const LEVELS: Array<[string, string]> = [
  ['零基础', '从第一步开始'],
  ['有一点基础', '了解一些基本概念'],
  ['进阶提升', '希望系统深入'],
];

function Stepper({ step }: { step: Step }) {
  return (
    <div className={s.stepper}>
      <div className={cx(s.step, step !== 'form' && s.complete)}>
        <b>{step === 'form' ? '1' : <Icon name="check" cls="sm" />}</b>
        告诉我们你的目标
      </div>
      <div className={s.stepLine} />
      <div className={cx(s.step, step === 'generating' ? s.current : step === 'preview' ? s.complete : '')}>
        <b>2</b>
        AI 规划学习路线
      </div>
    </div>
  );
}

export function CreatePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setActiveTopic, refreshSummaries } = useTopics();
  const [step, setStep] = useState<Step>('form');
  const [title, setTitle] = useState('Java 后端学习路线');
  const [level, setLevel] = useState('有一点基础');
  const [goal, setGoal] = useState(
    '能够独立使用 Spring Boot 开发 RESTful API，完成一个可部署的个人项目。',
  );
  const [hours, setHours] = useState(8);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState({ percent: 0, message: '' });
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [creating, setCreating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const generate = async () => {
    if (!title.trim() || goal.trim().length < 10) {
      setError('请填写主题，并用至少 10 个字描述你的学习目标。');
      return;
    }
    setError('');
    setStep('generating');
    setProgress({ percent: 6, message: '正在排队…' });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await backend.generateRoadmap(
        { title: title.trim(), level, goal: goal.trim(), hoursPerWeek: hours },
        {
          onProgress: (event) => setProgress({ percent: event.percent, message: event.message }),
        },
        controller.signal,
      );
      setRoadmap(result);
      setStep('preview');
    } catch (err) {
      if (controller.signal.aborted) {
        setStep('form');
        return;
      }
      setStep('form');
      setError(err instanceof Error ? err.message : '生成失败，请重试。');
    } finally {
      abortRef.current = null;
    }
  };

  const confirmCreate = async () => {
    if (!roadmap) return;
    setCreating(true);
    try {
      const result = await backend.createTopic(roadmap);
      await refreshSummaries();
      setActiveTopic(result.topic.id);
      navigate('/roadmap');
      toast('路线已加入工作台，从第一个小目标开始吧。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败，请重试。');
    } finally {
      setCreating(false);
    }
  };

  const heading = (
    <div className={s.creationTitle}>
      <span className="eyebrow">A PATH MADE FOR YOU</span>
      <h1>
        {step === 'form'
          ? '你的目标，值得一条好路线。'
          : step === 'generating'
            ? '正在为你铺好每一步。'
            : '大目标，已经变成了小步。'}
      </h1>
      <p>
        {step === 'form'
          ? '从你的起点出发，把「想学」变成清晰的行动计划。'
          : step === 'generating'
            ? '结合你的基础、目标和时间，规划一条真正适合你的路线。'
            : '先看看路线是否适合你，再正式开启这段学习旅程。'}
      </p>
    </div>
  );

  const stageCount = roadmap?.stages.length ?? 0;
  const nodeCount = roadmap?.stages.reduce((sum, stage) => sum + stage.nodes.length, 0) ?? 0;

  return (
    <div className={s.createWrap}>
      {heading}
      <Stepper step={step} />
      {step === 'form' ? (
        <div className={s.creationGrid}>
          <form
            className={cx(u.card, s.creationForm)}
            onSubmit={(event) => {
              event.preventDefault();
              generate();
            }}
          >
            <div className={u.field}>
              <label htmlFor="topic-title">
                你想学习什么？ <span>必填</span>
              </label>
              <input
                id="topic-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={60}
                required
                placeholder="例如：Java 后端学习路线"
              />
              <div className={u.chips}>
                {[
                  ['Java 后端', 'Java 后端学习路线'],
                  ['UI/UX 设计', 'UI/UX 设计入门'],
                  ['英语口语', '英语口语提升计划'],
                ].map(([label, preset]) => (
                  <button key={preset} type="button" className={u.chip} onClick={() => setTitle(preset)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className={u.field}>
              <label id="level-label">你目前的水平？</label>
              <div className={s.levelOptions} role="radiogroup" aria-labelledby="level-label">
                {LEVELS.map(([value, desc]) => (
                  <button
                    key={value}
                    type="button"
                    className={cx(s.levelOption, level === value && s.selected)}
                    role="radio"
                    aria-checked={level === value}
                    onClick={() => setLevel(value)}
                  >
                    <strong>
                      {value}
                      <i className={s.radioDot} />
                    </strong>
                    <small>{desc}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className={u.field}>
              <label htmlFor="learning-goal">
                学完之后，你想做到什么？ <span>必填</span>
              </label>
              <textarea
                id="learning-goal"
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                required
                minLength={10}
                maxLength={500}
              />
              <p className={u.helper}>越具体的目标，越能让 AI 为你规划合适的路径。</p>
            </div>
            <div className={u.field}>
              <div className={s.rangeHeader}>
                <label htmlFor="hours">每周可以投入多少时间？</label>
                <strong>
                  <span>{hours}</span> <small>小时 / 周</small>
                </strong>
              </div>
              <input
                type="range"
                id="hours"
                className={s.rangeSlider}
                min="2"
                max="20"
                value={hours}
                step="1"
                onChange={(event) => setHours(Number(event.target.value))}
              />
              <div className={s.rangeMarks}>
                <span>2 小时 · 轻松开始</span>
                <span>20 小时 · 全力投入</span>
              </div>
            </div>
            <p className={u.fieldError} role="alert">
              {error}
            </p>
            <button type="submit" className={cx(u.btn, u.primary, u.wide, u.large)}>
              <Icon name="spark" cls="sm" />
              生成我的学习路线 <Icon name="arrow" cls="sm" />
            </button>
            <p className={s.privacyNote}>
              <Icon name="shield" cls="sm" />
              {USE_MOCK ? '演示模式使用本地预设路线，不发送你的学习背景' : '你的学习背景仅用于生成这条路线'}
            </p>
          </form>
          <aside className={s.creationAside}>
            <div className={s.benefitCard}>
              <h3>不是一张普通的待办清单。</h3>
              <div className={s.benefitItem}>
                <Icon name="route" />
                <div>
                  <h4>由浅入深，有路可循</h4>
                  <p>
                    AI 把你的目标拆成阶段和里程碑，
                    <br />
                    让每一步都有明确的方向。
                  </p>
                </div>
              </div>
              <div className={s.benefitItem}>
                <Icon name="clock" />
                <div>
                  <h4>尊重你的时间与起点</h4>
                  <p>
                    不追求塞满日程，
                    <br />
                    只规划真正能坚持的学习节奏。
                  </p>
                </div>
              </div>
              <div className={s.benefitItem}>
                <Icon name="shield" />
                <div>
                  <h4>不是看过，是确实学会</h4>
                  <p>
                    用问答与小练习验证理解，
                    <br />
                    让打卡成为掌握的证明。
                  </p>
                </div>
              </div>
            </div>
            <blockquote className={s.quote}>
              “不用看见整个楼梯，
              <br />
              只需要迈出第一步。”
              <cite>从一个小小的学习目标开始。</cite>
            </blockquote>
          </aside>
        </div>
      ) : step === 'generating' ? (
        <div className={cx(u.card, s.generating)} aria-live="polite">
          <div className={s.aiOrbit}>
            <Icon name="spark" />
          </div>
          <h2>好的路线，正在发生。</h2>
          <p>
            正在为「{title}」设计学习阶段与检验要点
          </p>
          <div className={s.generationPercent}>
            <span>{progress.message || '正在构建阶段与里程碑节点'}</span>
            <span>{progress.percent}%</span>
          </div>
          <div className={u.progress}>
            <span style={{ width: `${progress.percent}%` }} />
          </div>
          <div className={s.generationSteps}>
            <div className={s.generationStep}>
              <Icon name="circleCheck" />
              理解你的学习背景
              <small>{progress.percent >= 30 ? '已完成' : '进行中'}</small>
            </div>
            <div className={cx(s.generationStep, progress.percent < 30 && s.pending)}>
              {progress.percent >= 60 ? <Icon name="circleCheck" /> : <Icon name="loading" cls="spinner" />}
              规划由浅入深的学习阶段
              <small>{progress.percent >= 60 ? '已完成' : progress.percent >= 30 ? '正在生成' : '即将开始'}</small>
            </div>
            <div className={cx(s.generationStep, progress.percent < 60 && s.pending)}>
              <Icon name="circle" />
              设计每个节点的掌握标准
              <small>{progress.percent >= 85 ? '已完成' : '即将开始'}</small>
            </div>
          </div>
          <div className={s.skeletons}>
            {Array.from({ length: 3 }, (_, index) => (
              <div className={s.skeletonCard} key={index}>
                <i className={s.skeleton} />
                <i className={s.skeleton} />
                <i className={s.skeleton} />
              </div>
            ))}
          </div>
          <p className={s.generationFooter}>一点耐心，换一条更清晰的路。</p>
          <button
            type="button"
            className={u.linkButton}
            style={{ marginTop: 13, fontSize: 10 }}
            onClick={() => {
              abortRef.current?.abort();
              setStep('form');
            }}
          >
            <Icon name="left" cls="sm" />
            返回调整学习背景
          </button>
        </div>
      ) : roadmap ? (
        <div className={cx(u.card, s.generated)}>
          <div className={s.generatedHead}>
            <div className={u.circleIcon}>
              <Icon name="check" />
            </div>
            <h2>专属于你的学习路线，准备好了。</h2>
            <p>
              {roadmap.title} · {stageCount} 个阶段 · {nodeCount} 个节点 · 预计 {roadmap.estimatedWeeks} 周
            </p>
            <span className={cx(u.badge, u.ai)} style={{ marginTop: 12, display: 'inline-flex' }}>
              <Icon name="spark" cls="sm" />
              根据 {level} · 每周 {hours} 小时规划
            </span>
          </div>
          {roadmap.stages.map((stage, index) => (
            <div className={s.generatedStage} key={stage.title + index}>
              <div className={s.number}>{`0${index + 1}`}</div>
              <div>
                <h4>{stage.title}</h4>
                <p>{stage.nodes.map((node) => node.title).slice(0, 2).join(' → ')}</p>
              </div>
              <span className="muted">{stage.nodes.length} 个节点</span>
            </div>
          ))}
          <p className={s.privacyNote} style={{ marginTop: 18, textAlign: 'left' }}>
            {roadmap.summary}
          </p>
          <p className={u.fieldError} role="alert">
            {error}
          </p>
          <div className={s.formActions}>
            <button type="button" className={u.btn} onClick={() => setStep('form')}>
              <Icon name="left" cls="sm" />
              调整背景
            </button>
            <button type="button" className={cx(u.btn, u.primary)} disabled={creating} onClick={confirmCreate}>
              {creating ? '正在创建…' : '开启学习旅程'}
              <Icon name="arrow" cls="sm" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
