import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { backend } from '../../api';
import type { HeatmapDay, StageProgress, StatsOverview } from '../../api/types';
import { Icon } from '../../components/Icon';
import { Heatmap, HeatLegend } from '../../components/Heatmap';
import { ReviewModal } from '../../components/ReviewModal';
import { useToast } from '../../app/ToastContext';
import { useTopics } from '../../app/TopicsContext';
import { heatmapRange } from '../../domain/dates';
import { cx } from '../../lib/cx';
import { PageHeading } from '../../layout/AppShell';
import u from '../../styles/ui.module.css';
import s from './stats.module.css';

export function StatsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { summaries, setActiveTopic } = useTopics();
  const [overview, setOverview] = useState<(StatsOverview & { todayChecked?: boolean }) | null>(null);
  const [heat, setHeat] = useState<{ days: HeatmapDay[]; from: string; to: string } | null>(null);
  const [stagesByTopic, setStagesByTopic] = useState<Record<number, StageProgress[]>>({});
  const [selection, setSelection] = useState<string | null>(null);
  const [review, setReview] = useState<{ topicId: number; stageIndex: number; title: string; leafTotal: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stats = await backend.statsOverview();
        if (!cancelled) setOverview(stats);
      } catch {
        if (!cancelled) setOverview(null);
      }
      const range = heatmapRange(52);
      try {
        const { days } = await backend.statsHeatmap(range.from, range.to);
        if (!cancelled) setHeat({ days, ...range });
      } catch {
        if (!cancelled) setHeat(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<number, StageProgress[]> = {};
      for (const summary of summaries) {
        try {
          const { stages } = await backend.topicProgress(summary.id);
          next[summary.id] = stages;
        } catch {
          next[summary.id] = [];
        }
      }
      if (!cancelled) setStagesByTopic(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [summaries]);

  const completedStages = useMemo(
    () => Object.values(stagesByTopic).reduce((sum, stages) => sum + stages.filter((stage) => stage.allDone).length, 0),
    [stagesByTopic],
  );

  const firstCompleted = useMemo(() => {
    for (const summary of summaries) {
      const stages = stagesByTopic[summary.id] ?? [];
      const done = stages.find((item) => item.allDone);
      if (done) return { topic: summary, stage: done };
    }
    return null;
  }, [summaries, stagesByTopic]);

  const firstIncomplete = useMemo(() => {
    for (const summary of summaries) {
      const stages = stagesByTopic[summary.id] ?? [];
      const pending = stages.find((stage) => !stage.allDone);
      if (pending) return pending.title;
    }
    return null;
  }, [summaries, stagesByTopic]);

  const rangeLabel = heat
    ? `${heat.from.slice(0, 4)} 年 ${Number(heat.from.slice(5, 7))} 月 — ${todayLabel()}`
    : '';

  return (
    <>
      <PageHeading
        actions={
          <div className={s.headingDate}>
            <Icon name="calendar" cls="sm" />
            {rangeLabel}
          </div>
        }
      >
        <div>
          <div className="eyebrow">SMALL STEPS, REAL GROWTH</div>
          <h1>你的坚持，正在发生。</h1>
          <p className="subtitle" style={{ color: 'var(--muted)', fontSize: 12, marginTop: 7 }}>
            不和别人比速度，只回望自己走过的路。
          </p>
        </div>
      </PageHeading>
      <div className={s.statsSummary}>
        <div className={cx(u.card, s.statsStat, s.featured)}>
          <div className={s.top}>
            <span>连续打卡</span>
            <Icon name="flame" />
          </div>
          <strong className="numeric">
            {overview?.streak ?? 0}
            <small>天</small>
          </strong>
          <p>
            {overview?.todayChecked
              ? '今天的打卡已点亮，明天继续。'
              : '今天再进一步，就能点亮下一天。'}
          </p>
        </div>
        <div className={cx(u.card, s.statsStat)}>
          <div className={s.top}>
            <span>历史通过节点</span>
            <Icon name="circleCheck" />
          </div>
          <strong className="numeric">
            {overview?.passedTotal ?? 0}
            <small>个</small>
          </strong>
          <p>
            本周新掌握 <span>+{overview?.weeklyTarget.passed ?? 0} 个节点</span>
          </p>
        </div>
        <div className={cx(u.card, s.statsStat)}>
          <div className={s.top}>
            <span>已完成学习阶段</span>
            <Icon name="award" />
          </div>
          <strong className="numeric">
            {completedStages}
            <small>个</small>
          </strong>
          <p>每一个阶段，都是新的里程碑。</p>
        </div>
        <div className={cx(u.card, s.statsStat)}>
          <div className={s.top}>
            <span>最长连续记录</span>
            <Icon name="target" />
          </div>
          <strong className="numeric">
            {overview?.longestStreak ?? 0}
            <small>天</small>
          </strong>
          <p>
            <span>正在刷新自己的最好记录</span>
          </p>
        </div>
      </div>
      <section className={cx(u.card, s.statsHeat)}>
        <div className={cx(u.sectionHeading, 'between')}>
          <div>
            <h2>每一格，都是一次真正的掌握</h2>
            <p className="small muted" style={{ fontSize: 10, marginTop: 5 }}>
              仅记录首次通过的叶子节点 · 删除或修改路线不抹去历史打卡
            </p>
          </div>
          <button
            type="button"
            className={cx(u.btn, u.compact)}
            onClick={() => {
              const today = heat?.days.at(-1)?.date;
              if (today) setSelection(`${today} · ${heat?.days.at(-1)?.count ?? 0} 个节点通过检验`);
              else toast('今天还没有打卡记录。');
            }}
          >
            <Icon name="calendar" cls="sm" />
            定位今天
          </button>
        </div>
        {heat ? (
          <Heatmap
            days={heat.days}
            from={heat.from}
            to={heat.to}
            total={overview?.passedTotal ?? 0}
            onSelectDate={(info) =>
              setSelection(
                info ? `${info.date} · ${info.count ? `${info.count} 个节点通过检验` : '没有打卡记录，积累需要时间'}` : null,
              )
            }
          />
        ) : (
          <p className="muted small">正在加载学习记录…</p>
        )}
        <div className={s.statsHeatBottom}>
          <span className={s.heatSelected}>
            {selection ?? `${overview?.passedTotal ?? 0} 个节点通过检验 · 点击方格查看日期记录`}
          </span>
          <HeatLegend />
        </div>
      </section>
      <div className={s.statsColumns}>
        <section className={cx(u.card, s.topicProgressPanel)}>
          <div className={cx(u.sectionHeading, 'between')}>
            <h2 style={{ fontSize: 15 }}>每一个目标，都在靠近</h2>
            <span className="small muted" style={{ fontSize: 10 }}>
              {summaries.length} 个学习主题
            </span>
          </div>
          {summaries.map((summary) => {
            const stages = stagesByTopic[summary.id] ?? [];
            const pending = stages.find((stage) => !stage.allDone);
            return (
              <button
                key={summary.id}
                type="button"
                className={s.topicProgressRow}
                onClick={() => {
                  setActiveTopic(summary.id);
                  navigate('/roadmap');
                }}
              >
                <div className={s.top}>
                  <div className={cx(u.circleIcon, summary.color)}>
                    <Icon name={summary.icon} />
                  </div>
                  <h4>{summary.title}</h4>
                  <strong className="numeric">
                    {summary.percent}
                    <small>%</small>
                  </strong>
                </div>
                <div className={cx(u.progress, summary.color)}>
                  <span style={{ width: `${summary.percent}%` }} />
                </div>
                <div className={s.bottom}>
                  <span>
                    {summary.leafDone} / {summary.leafTotal} 个节点已掌握
                  </span>
                  <span>
                    {pending?.title ?? '全部阶段已完成'}
                    <Icon name="chevron" cls="sm" />
                  </span>
                </div>
              </button>
            );
          })}
        </section>
        <section className={cx(u.card, s.reviewPanel)}>
          <div className={cx(u.sectionHeading, 'between')}>
            <h2 style={{ fontSize: 15 }}>停下来，看看自己的成长</h2>
            <span className={cx(u.badge, u.ai)}>
              <Icon name="spark" cls="sm" />
              AI 阶段复盘
            </span>
          </div>
          {firstCompleted ? (
            <article className={s.reviewCard}>
              <div className={s.reviewLabel}>
                <Icon name="circleCheck" cls="sm" />
                已完成阶段 · {firstCompleted.topic.title}
              </div>
              <h3>{firstCompleted.stage.title}，稳稳迈出第一步。</h3>
              <div className={s.reviewDate}>
                阶段 {String(firstCompleted.stage.index + 1).padStart(2, '0')} ·{' '}
                {firstCompleted.stage.leafDone} / {firstCompleted.stage.leafTotal} 个叶子节点已掌握
              </div>
              <p>当前阶段全部叶子节点已通过检验，可以回顾学习目标与掌握情况。</p>
              <button
                type="button"
                className={u.linkButton}
                onClick={() =>
                  setReview({
                    topicId: firstCompleted.topic.id,
                    stageIndex: firstCompleted.stage.index,
                    title: firstCompleted.stage.title,
                    leafTotal: firstCompleted.stage.leafTotal,
                  })
                }
              >
                阅读完整阶段复盘 <Icon name="arrow" cls="sm" />
              </button>
            </article>
          ) : (
            <div className={s.reviewCard}>
              <div className={s.reviewLabel}>
                <Icon name="lock" cls="sm" />
                尚无已完成的阶段
              </div>
              <p>完成一个阶段的全部节点并通过检验后，这里会出现第一份专属于你的阶段复盘。</p>
            </div>
          )}
          {firstIncomplete ? (
            <div className={s.nextReview}>
              <Icon name="lock" />
              完成「{firstIncomplete}」的全部节点后，
              <br />
              就能解锁下一份专属于你的阶段复盘。
            </div>
          ) : null}
        </section>
      </div>
      {review ? (
        <ReviewModal
          topicId={review.topicId}
          stageIndex={review.stageIndex}
          stageTitle={review.title}
          leafTotal={review.leafTotal}
          onClose={() => setReview(null)}
        />
      ) : null}
    </>
  );
}

function todayLabel(): string {
  const now = new Date();
  return `${now.getFullYear()} 年 ${now.getMonth() + 1} 月`;
}
