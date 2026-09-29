import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { backend } from '../../api';
import type { HeatmapDay, NodeDTO, StatsOverview, TopicDetail, TopicSummary } from '../../api/types';
import { Icon } from '../../components/Icon';
import { EmptyIllustration, HeroPlant } from '../../components/art';
import { Heatmap } from '../../components/Heatmap';
import { StatusBadge } from '../../components/Badge';
import { useAuth } from '../../app/AuthContext';
import { useTopics } from '../../app/TopicsContext';
import { greetingByHour, heatmapRange } from '../../domain/dates';
import { aggregateStatus } from '../../domain/tree';
import { cx } from '../../lib/cx';
import { PageHeading } from '../../layout/AppShell';
import u from '../../styles/ui.module.css';
import s from './dashboard.module.css';

function TopicCard({ summary }: { summary: TopicSummary }) {
  const navigate = useNavigate();
  const { setActiveTopic } = useTopics();
  return (
    <article
      className={cx(u.card, s.topicCard)}
      role="link"
      tabIndex={0}
      aria-label={`查看${summary.title}`}
      onClick={() => {
        setActiveTopic(summary.id);
        navigate('/roadmap');
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setActiveTopic(summary.id);
          navigate('/roadmap');
        }
      }}
    >
      <div className={s.topicTop}>
        <div className={cx(u.circleIcon, summary.color)}>
          <Icon name={summary.icon} />
        </div>
        <div>
          <h3>{summary.title}</h3>
          <p className={s.description}>{summary.subtitle}</p>
        </div>
        <span className={u.iconButton} aria-hidden="true">
          <Icon name="chevron" cls="sm" />
        </span>
      </div>
      <div className={s.progressDetail}>
        <span>
          已掌握 {summary.leafDone} / {summary.leafTotal} 个节点
        </span>
        <span className={cx(s.percent, 'numeric')}>{summary.percent}%</span>
      </div>
      <div className={cx(u.progress, summary.color)}>
        <span style={{ width: `${summary.percent}%` }} />
      </div>
      <div className={s.topicBottom}>
        <span className={cx('small', 'flex', 'gap6')}>
          <Icon name="clock" cls="sm" />
          预计 {summary.estimatedWeeks} 周 · 每周 {summary.weeklyHours} 小时
        </span>
        <span className={s.topicNext}>
          <Icon name="play" cls="sm" />
          {summary.nextNodeTitle ?? '添加第一个学习节点'}
        </span>
      </div>
    </article>
  );
}

interface TodoItem {
  node: NodeDTO;
  topic: TopicDetail;
}

function DashboardContent() {
  const { user } = useAuth();
  const { summaries, details, loadDetail, setActiveTopic, activeTopicId } = useTopics();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<(StatsOverview & { todayChecked?: boolean }) | null>(null);
  const [heat, setHeat] = useState<{ days: HeatmapDay[]; from: string; to: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stats = await backend.statsOverview();
        if (!cancelled) setOverview(stats);
      } catch {
        if (!cancelled) setOverview(null);
      }
      const range = heatmapRange(26);
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
      for (const summary of summaries) {
        if (cancelled) return;
        if (!details[summary.id]) await loadDetail(summary.id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [summaries, details, loadDetail]);

  const todos = useMemo<TodoItem[]>(() => {
    const items: TodoItem[] = [];
    for (const summary of summaries) {
      const detail = details[summary.id];
      if (!detail) continue;
      for (const node of detail.nodes) {
        if (!detail.nodes.some((n) => n.parentId === node.id)) {
          const status = aggregateStatus(detail.nodes, node);
          if (status === 'active' || status === 'pending' || status === 'failed') items.push({ node, topic: detail });
        }
      }
    }
    return items.slice(0, 3);
  }, [summaries, details]);

  const focusTopic = details[activeTopicId ?? summaries[0]?.id] ?? null;
  const nextNode = useMemo(() => {
    if (!focusTopic) return null;
    const leaves = focusTopic.nodes.filter((n) => !focusTopic.nodes.some((c) => c.parentId === n.id));
    const byStatus = (want: string[]) => leaves.filter((n) => want.includes(aggregateStatus(focusTopic.nodes, n)));
    return byStatus(['active'])[0] ?? byStatus(['pending', 'failed', 'idle'])[0] ?? leaves[0] ?? null;
  }, [focusTopic]);

  const name = user?.name ?? '同学';

  return (
    <>
      <PageHeading
        actions={
          <button type="button" className={cx(u.btn, u.primary)} onClick={() => navigate('/create')}>
            <Icon name="plus" cls="sm" />
            新建学习主题
          </button>
        }
      >
        <h1>
          {greetingByHour()}，<span className={s.greetingName}>{name}</span>。
        </h1>
        <p className={s.subtitle}>学习不是一场冲刺，而是每天向前的一小步。</p>
      </PageHeading>
      <section className={s.dashboardHero}>
        <div className={s.heroContent}>
          <span className="eyebrow" style={{ fontSize: 9, letterSpacing: 1.4, display: 'block', marginBottom: 8 }}>
            A LITTLE PROGRESS, EVERY DAY
          </span>
          <h2>今天，也让一个「不懂」变成「懂了」。</h2>
          <p>你已连续学习 {overview?.streak ?? 0} 天。保持自己的节奏，继续向前吧。</p>
          <button
            type="button"
            className={cx(u.btn, u.primary)}
            onClick={() => navigate(nextNode ? `/node/${nextNode.id}` : '/roadmap')}
          >
            继续上次学习 <Icon name="arrow" cls="sm" />
          </button>
        </div>
        <HeroPlant className={s.heroIllustration} />
      </section>
      <section className={s.summaryRow}>
        <div className={cx(u.card, s.summaryItem)}>
          <div className={u.circleIcon}>
            <Icon name="folder" />
          </div>
          <div>
            <div className={s.summaryLabel}>正在学习</div>
            <div className={cx(s.summaryValue, 'numeric')}>
              {summaries.length}
              <small>个主题</small>
            </div>
          </div>
        </div>
        <div className={cx(u.card, s.summaryItem)}>
          <div className={u.circleIcon}>
            <Icon name="circleCheck" />
          </div>
          <div>
            <div className={s.summaryLabel}>历史通过</div>
            <div className={cx(s.summaryValue, 'numeric')}>
              {overview?.passedTotal ?? 0}
              <small>个节点</small>
            </div>
          </div>
          <span className={s.trend}>每一步都算数</span>
        </div>
        <div className={cx(u.card, s.summaryItem)}>
          <div className={u.circleIcon}>
            <Icon name="target" />
          </div>
          <div>
            <div className={s.summaryLabel}>本周学习目标</div>
            <div className={cx(s.summaryValue, 'numeric')}>
              {overview?.weeklyTarget.passed ?? 0}
              <small>／ 4 个节点</small>
            </div>
          </div>
          <span className={s.trend}>{overview?.weeklyTarget.percent ?? 0}% 已达成</span>
        </div>
      </section>
      <div className={s.dashboardGrid}>
        <section>
          <div className={cx(u.sectionHeading, 'between')}>
            <h2>
              我的学习主题 <span className={u.count}>{summaries.length}</span>
            </h2>
            <span className={cx('muted', 'small')} style={{ fontSize: 10 }}>
              按最近学习排序
            </span>
          </div>
          {summaries.map((summary) => (
            <TopicCard key={summary.id} summary={summary} />
          ))}
          <button type="button" className={s.newTopicCard} onClick={() => navigate('/create')}>
            <Icon name="plus" cls="sm" />
            开启一段新的学习旅程
          </button>
        </section>
        <aside className={s.dashboardRight}>
          <section className={cx(u.card, s.todayCard)}>
            <div className={cx(u.sectionHeading, 'between')}>
              <h2>今天，学点什么</h2>
              <span className={s.todayMeta}>{todos.length} 个待办</span>
            </div>
            {todos.length ? (
              todos.map(({ node, topic }) => {
                const status = aggregateStatus(topic.nodes, node);
                return (
                  <div className={s.todoItem} key={node.id}>
                    <div className={cx(s.todoIndicator, status)} />
                    <div className={s.todoText}>
                      <h4>{node.title}</h4>
                      <p>
                        {topic.topic.title} · {topic.topic.stageTitles[node.stageIndex]}
                      </p>
                      <div className={s.todoAction}>
                        <a
                          href={`#/node/${node.id}`}
                          onClick={(event) => {
                            event.preventDefault();
                            setActiveTopic(topic.topic.id);
                            navigate(`/node/${node.id}`);
                          }}
                        >
                          {status === 'pending' ? '准备好检验了吗' : status === 'failed' ? '复习薄弱知识点' : '继续学习'}
                          <Icon name="arrow" />
                        </a>
                        <span style={{ fontSize: 9, color: '#686e62' }}>约 {node.durationMinutes} 分钟</span>
                      </div>
                    </div>
                    <StatusBadge status={status} />
                  </div>
                );
              })
            ) : (
              <p className="muted">今天的待办都完成了，做得很好。</p>
            )}
          </section>
          <section className={cx(u.card, s.activityCard)}>
            <div className={cx(u.sectionHeading, 'between')}>
              <h2>一点一滴，都有回响</h2>
              <a href="#/stats" className={cx(u.linkButton, 'small')} style={{ fontSize: 10 }}>
                学习记录 <Icon name="chevron" cls="sm" />
              </a>
            </div>
            {heat ? (
              <Heatmap days={heat.days} from={heat.from} to={heat.to} total={overview?.passedTotal ?? 0} />
            ) : (
              <p className="muted small">正在加载学习记录…</p>
            )}
            <div className={s.streakStrip}>
              <div className={s.streakIcon}>
                <Icon name="flame" />
              </div>
              <div>
                <strong className="numeric">
                  {overview?.streak ?? 0}
                  <small>天</small>
                </strong>
                <p>当前连续打卡</p>
              </div>
              <div className={s.streakCopy}>
                {overview?.todayChecked ? (
                  <>
                    今天的进步，已被记住
                    <br />
                    保持节奏，继续向前
                  </>
                ) : (
                  <>
                    今天再进一步
                    <br />
                    就能点亮下一天
                  </>
                )}
              </div>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

export function DashboardPage() {
  const { summaries } = useTopics();
  const navigate = useNavigate();
  const { setActiveTopic } = useTopics();

  if (summaries.length === 0) {
    return (
      <>
        <PageHeading>
          <div>
            <div className="eyebrow">A FRESH START</div>
            <h1>你好，欢迎来到知序。</h1>
            <p className={s.subtitle}>每一次真正的掌握，都值得被记录。</p>
          </div>
        </PageHeading>
        <div className={cx(u.card, s.emptyState)}>
          <EmptyIllustration className={s.emptyIllustration} />
          <span className="eyebrow" style={{ marginBottom: 10 }}>
            YOUR FIRST STEP
          </span>
          <h2>想学的很多，先从一个开始。</h2>
          <p>
            告诉知序你想学习什么，让 AI 把大目标拆成可抵达的小步。
            <br />
            有路线、有反馈，让努力不再只是「看过了」。
          </p>
          <button type="button" className={cx(u.btn, u.primary, u.large)} onClick={() => navigate('/create')}>
            <Icon name="plus" cls="sm" />
            创建第一个学习主题
          </button>
          <div className={u.chips}>
            {['Java 后端开发', 'UI/UX 设计', '英语口语'].map((label) => (
              <button key={label} type="button" className={u.chip} onClick={() => navigate('/create')}>
                {label}
              </button>
            ))}
          </div>
          <div className={s.emptyFeatures}>
            <span>
              <Icon name="spark" cls="sm" />
              AI 定制路线
            </span>
            <span>
              <Icon name="shield" cls="sm" />
              检验式打卡
            </span>
            <span>
              <Icon name="chart" cls="sm" />
              看得见的成长
            </span>
          </div>
        </div>
      </>
    );
  }
  void setActiveTopic;
  return <DashboardContent />;
}
