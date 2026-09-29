import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { backend } from '../../api';
import type { NodeDTO, TopicDetail } from '../../api/types';
import { Icon } from '../../components/Icon';
import { ReviewModal } from '../../components/ReviewModal';
import { useToast } from '../../app/ToastContext';
import { useTopics } from '../../app/TopicsContext';
import { aggregateStatus, siblingsOf, stageComplete, stageLeaves, topicLeaves } from '../../domain/tree';
import { cx } from '../../lib/cx';
import { NodeCard, type TreeCallbacks } from './NodeCard';
import { NodeModals, type NodeModalState } from './NodeModals';
import u from '../../styles/ui.module.css';
import s from './roadmap.module.css';

interface DeletionInfo {
  nodeId: number;
  subtreeCount: number;
  rootTitle: string;
}

export function RoadmapPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { summaries, details, activeTopicId, setActiveTopic, loadDetail, refreshSummaries } = useTopics();
  const [tab, setTab] = useState<'route' | 'overview'>('route');
  const [filterAll, setFilterAll] = useState(true);
  const [modalState, setModalState] = useState<NodeModalState>(null);
  const [deletion, setDeletion] = useState<DeletionInfo | null>(null);
  const [reviewStage, setReviewStage] = useState<number | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dropHint, setDropHint] = useState<{ id: number; after: boolean } | null>(null);

  const topicParam = Number(searchParams.get('topic'));
  useEffect(() => {
    if (topicParam && topicParam !== activeTopicId) setActiveTopic(topicParam);
  }, [topicParam, activeTopicId, setActiveTopic]);

  const topicId = activeTopicId && summaries.some((t) => t.id === activeTopicId)
    ? activeTopicId
    : summaries[0]?.id ?? null;
  const detail: TopicDetail | null = topicId ? details[topicId] ?? null : null;

  useEffect(() => {
    if (topicId && !details[topicId]) {
      loadDetail(topicId).catch(() => toast('路线加载失败，请刷新重试。'));
    }
  }, [topicId, details, loadDetail, toast]);

  const reload = async () => {
    if (!topicId) return;
    await Promise.all([loadDetail(topicId), refreshSummaries()]);
  };

  const leaves = useMemo(() => (detail ? topicLeaves(detail) : []), [detail]);
  const doneCount = useMemo(
    () => (detail ? leaves.filter((n) => aggregateStatus(detail.nodes, n) === 'done').length : 0),
    [detail, leaves],
  );
  const nextNode = useMemo(() => {
    if (!detail) return null;
    return (
      leaves.find((n) => aggregateStatus(detail.nodes, n) === 'active') ||
      leaves.find((n) => aggregateStatus(detail.nodes, n) !== 'done') ||
      null
    );
  }, [detail, leaves]);

  const reorderGroup = async (nodeId: number, targetId: number, after: boolean) => {
    if (!detail) return;
    const node = detail.nodes.find((n) => n.id === nodeId);
    const target = detail.nodes.find((n) => n.id === targetId);
    if (!node || !target) return;
    if (node.stageIndex !== target.stageIndex || (node.parentId ?? null) !== (target.parentId ?? null)) {
      toast('只能在同一阶段、同一父节点下排序，不能跨组移动。');
      return;
    }
    const peers = siblingsOf(detail.nodes, node.parentId, node.stageIndex).filter((n) => n.id !== nodeId);
    const position = peers.findIndex((n) => n.id === targetId) + (after ? 1 : 0);
    peers.splice(position, 0, node);
    try {
      await backend.reorderNodes(detail.topic.id, {
        groupId: { parentId: node.parentId, stageIndex: node.stageIndex },
        order: peers.map((n) => n.id),
      });
      await reload();
      toast('同级顺序已更新，子节点随父节点整体移动。');
    } catch (error) {
      toast(error instanceof Error ? error.message : '排序失败，请重试。');
    }
  };

  const moveNode = async (nodeId: number, direction: -1 | 1) => {
    if (!detail) return;
    const node = detail.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const peers = siblingsOf(detail.nodes, node.parentId, node.stageIndex);
    const index = peers.findIndex((n) => n.id === nodeId);
    const target = peers[index + direction];
    if (target) await reorderGroup(nodeId, target.id, direction > 0);
  };

  const callbacks: TreeCallbacks = {
    onManage: (nodeId) => setModalState({ kind: 'actions', nodeId }),
    onMove: moveNode,
    onDragStart: setDraggedId,
    onDropOn: (nodeId, after) => {
      if (draggedId !== null && draggedId !== nodeId) reorderGroup(draggedId, nodeId, after);
      setDraggedId(null);
      setDropHint(null);
    },
    onDragEnd: () => {
      setDraggedId(null);
      setDropHint(null);
    },
    draggedId,
    dropHint,
    setDropHint,
  };

  const handleSaved = async (values: { title: string; objective: string; minutes: number }) => {
    if (!detail || !modalState || modalState.kind !== 'editor') return;
    const { nodeId, parentId, stageIndex } = modalState;
    try {
      if (nodeId) {
        const result = await backend.patchNode(nodeId, {
          title: values.title,
          objective: values.objective,
          durationMinutes: values.minutes,
        });
        await reload();
        setModalState(null);
        toast(
          result.revisionChanged
            ? '节点已更新；学习目标已变化，相关节点需重新检验。'
            : '节点已更新，历史学习记录已保留。',
        );
      } else {
        await backend.addNode(detail.topic.id, {
          parentId,
          stageIndex,
          title: values.title,
          objective: values.objective,
          durationMinutes: values.minutes,
        });
        await reload();
        setModalState(null);
        toast('节点已添加，通过检验后计入进度。');
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : '保存失败，请重试。');
    }
  };

  const handleConfirmDelete = async (nodeId: number) => {
    if (!detail) return;
    try {
      const result = await backend.deleteNode(nodeId);
      const node = detail.nodes.find((n) => n.id === nodeId);
      setDeletion({
        nodeId,
        subtreeCount: result.deleted.subtreeCount,
        rootTitle: node?.title ?? '',
      });
      await reload();
      setModalState(null);
      toast('节点已从路线移除，可在顶部撤销；历史打卡保留。');
    } catch (error) {
      toast(error instanceof Error ? error.message : '删除失败，请重试。');
    }
  };

  const handleUndo = async () => {
    if (!topicId || !deletion) return;
    try {
      await backend.undoDelete(topicId);
      setDeletion(null);
      await reload();
      toast('删除已撤销，节点、笔记与资源已恢复。');
    } catch (error) {
      toast(error instanceof Error ? error.message : '撤销失败。');
    }
  };

  if (!topicId) {
    return (
      <section className={cx(u.card, s.routeEmpty)}>
        <h3>还没有学习主题</h3>
        <button type="button" className={cx(u.btn, u.primary)} onClick={() => navigate('/create')}>
          <Icon name="plus" cls="sm" />
          创建第一个学习主题
        </button>
      </section>
    );
  }

  if (!detail) {
    return (
      <p className="muted" style={{ padding: '40px 0', textAlign: 'center' }}>
        <Icon name="loading" className="icon sm spinner" /> 正在加载学习路线…
      </p>
    );
  }

  const topic = detail.topic;
  const percent = leaves.length ? Math.round((doneCount / leaves.length) * 100) : 0;

  const stages = topic.stageTitles.map((title, stageIndex) => {
    const stageLeavesList = stageLeaves(detail.nodes, stageIndex);
    const stageDone = stageLeavesList.filter((n) => aggregateStatus(detail.nodes, n) === 'done').length;
    const complete = stageComplete(detail.nodes, stageIndex);
    const roots = siblingsOf(detail.nodes, null, stageIndex).filter(
      (node: NodeDTO) => filterAll || aggregateStatus(detail.nodes, node) !== 'done',
    );
    return { title, stageIndex, stageLeavesList, stageDone, complete, roots };
  });

  const currentStage = nextNode?.stageIndex ?? -1;

  return (
    <>
      <section className={cx(u.card, s.routeHero)}>
        <div className={cx(u.circleIcon, topic.color)}>
          <Icon name={topic.icon} />
        </div>
        <div className={s.routeTitle}>
          <span className={cx(u.badge, u.ai)}>
            <Icon name="spark" cls="sm" />
            AI 规划 · 由你调整
          </span>
          <h1>{topic.title}</h1>
          <p>{topic.subtitle}</p>
          <div className={s.metaLine}>
            {topic.level ? (
              <span>
                <Icon name="cap" />
                {topic.level}
              </span>
            ) : null}
            <span>
              <Icon name="calendar" />
              预计 {topic.estimatedWeeks} 周
            </span>
            <span>
              <Icon name="clock" />
              每周 {topic.weeklyHours} 小时
            </span>
            <span>
              <Icon name="route" />
              {topic.stageTitles.length} 个阶段 · {leaves.length} 个学习节点
            </span>
          </div>
        </div>
        <div className={s.routeProgress}>
          <div className={s.progressRing}>
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="43" fill="none" stroke="#e4ebdc" strokeWidth="6" />
              <circle
                cx="50"
                cy="50"
                r="43"
                fill="none"
                stroke="#7ba46a"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${percent * 2.7} 270`}
              />
            </svg>
            <strong className="numeric">
              {percent}
              <small>%</small>
            </strong>
          </div>
          <div className={s.routeProgressCopy}>
            <h4>每一步，都在进步</h4>
            <p>
              已掌握 {doneCount} / {leaves.length} 个节点
            </p>
            {nextNode ? (
              <button type="button" className={cx(u.btn, u.primary, u.compact)} onClick={() => navigate(`/node/${nextNode.id}`)}>
                继续学习 <Icon name="arrow" cls="sm" />
              </button>
            ) : (
              <span className="muted small">添加节点，开启下一步</span>
            )}
          </div>
        </div>
      </section>
      <div className={s.routeToolbar}>
        <div className={s.tabs} role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'route'} className={cx(s.tab, tab === 'route' && s.active)} onClick={() => setTab('route')}>
            学习路线
          </button>
          <button type="button" role="tab" aria-selected={tab === 'overview'} className={cx(s.tab, tab === 'overview' && s.active)} onClick={() => setTab('overview')}>
            学习目标与计划
          </button>
        </div>
        {tab === 'route' ? (
          <>
            <div className={s.legend}>
              {[
                ['idle', '未开始'],
                ['active', '学习中'],
                ['pending', '待检验'],
                ['done', '已完成'],
                ['failed', '检验未通过'],
              ].map(([key, label]) => (
                <span className={s.legendItem} key={key}>
                  <i className={cx(s.legendDot, key)} />
                  {label}
                </span>
              ))}
            </div>
            <button
              type="button"
              className={cx(u.btn, u.ghost, u.compact)}
              onClick={() => setFilterAll((v) => !v)}
            >
              <Icon name="filter" cls="sm" />
              {filterAll ? '全部节点' : '未完成节点'}
            </button>
          </>
        ) : null}
      </div>
      {tab === 'overview' ? (
        <section className={cx(u.card, s.routeOverview)}>
          <span className="eyebrow">YOUR LEARNING BLUEPRINT</span>
          <h3>这段学习，要抵达哪里？</h3>
          <p>{topic.summary}</p>
          <h3>适合你的学习节奏</h3>
          <ul>
            <li>每周 {topic.weeklyHours} 小时，拆成 3–4 次专注学习。</li>
            <li>路线最多三级，阶段只是分组，不占层级。</li>
            <li>只有叶子节点参加检验，至少答对 2 / 3 题通过；父节点自动汇总进度，不重复打卡。</li>
            <li>新增、删除或拆分节点会重新计算路线进度，历史检验与打卡不会被抹去。</li>
            <li>修改学习目标后需重新检验；只调整名称、时长或顺序不影响成绩。</li>
          </ul>
          <button type="button" className={cx(u.btn, u.soft)} onClick={() => setTab('route')}>
            回到学习路线 <Icon name="arrow" cls="sm" />
          </button>
        </section>
      ) : (
        <>
          {deletion ? (
            <div className={s.routeUndo} role="status">
              <Icon name="info" />
              <div className={s.undoCopy}>
                <strong>
                  已删除「{deletion.rootTitle}」及其子孙，共 {deletion.subtreeCount} 个节点
                </strong>
                <span>历史记录保留 · 不会覆盖之后的编辑</span>
              </div>
              <button type="button" className={u.btn} onClick={handleUndo}>
                撤销删除
              </button>
            </div>
          ) : null}
          <div className={s.routeEditTools}>
            <small>拖动左侧手柄调整同级顺序 · 最多三级 · 更多操作见节点右侧</small>
            <button type="button" className={cx(u.btn, u.soft)} onClick={() => setModalState({ kind: 'editor', nodeId: null, parentId: null, stageIndex: 0 })}>
              <Icon name="plus" cls="sm" />
              新增节点
            </button>
          </div>
          {stages.map((stage) => (
            <section className={s.routeStage} key={stage.stageIndex}>
              <div className={cx(s.stageNumber, stage.complete && s.done, stage.stageIndex === currentStage && !stage.complete && s.current)}>
                {stage.complete ? <Icon name="check" cls="sm" /> : String(stage.stageIndex + 1).padStart(2, '0')}
              </div>
              <div className={s.stageHeader}>
                <h2>
                  {stage.title}
                  <small>{topic.stageWeeks[stage.stageIndex] ?? ''}</small>
                  {stage.complete ? <span className={cx(u.badge, u.done)}>阶段已完成</span> : null}
                </h2>
                <div className="flex gap12" style={{ marginLeft: 'auto', flexWrap: 'wrap' }}>
                  {stage.complete ? (
                    <button type="button" className={u.linkButton} onClick={() => setReviewStage(stage.stageIndex)}>
                      <Icon name="spark" cls="sm" />
                      查看阶段复盘
                    </button>
                  ) : (
                    <span className={s.stageMeta}>
                      {stage.stageDone} / {stage.stageLeavesList.length} 个节点
                    </span>
                  )}
                  <button
                    type="button"
                    className={cx(u.btn, u.ghost, u.compact)}
                    aria-label={`在${stage.title}新增节点`}
                    onClick={() => setModalState({ kind: 'editor', nodeId: null, parentId: null, stageIndex: stage.stageIndex })}
                  >
                    <Icon name="plus" cls="sm" />
                    新增节点
                  </button>
                </div>
              </div>
              <div className={s.roadmapTree}>
                {stage.roots.length ? (
                  stage.roots.map((node, index) => (
                    <NodeCard
                      key={node.id}
                      node={node}
                      index={String(index + 1).padStart(2, '0')}
                      detail={detail}
                      callbacks={callbacks}
                      hideDone={!filterAll}
                    />
                  ))
                ) : (
                  <div className={s.routeEmpty}>
                    {stage.stageLeavesList.length
                      ? '当前阶段没有未完成节点。'
                      : '这个阶段还没有学习节点，可以先添加一个小目标。'}
                  </div>
                )}
              </div>
            </section>
          ))}
          <div className={s.routeHint}>
            <Icon name="info" />
            进度仅统计当前路线中的叶子节点；父节点汇总，不单独检验。增删或拆分后进度可能变化，历史打卡保留。
          </div>
        </>
      )}
      <NodeModals
        state={modalState}
        detail={detail}
        onClose={() => setModalState(null)}
        onSwitch={setModalState}
        onSaved={handleSaved}
        onConfirmDelete={handleConfirmDelete}
      />
      {reviewStage !== null ? (
        <ReviewModal
          topicId={topicId}
          stageIndex={reviewStage}
          stageTitle={topic.stageTitles[reviewStage] ?? ''}
          leafTotal={stageLeaves(detail.nodes, reviewStage).length}
          onClose={() => setReviewStage(null)}
        />
      ) : null}
    </>
  );
}
