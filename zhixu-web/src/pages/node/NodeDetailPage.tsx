import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { backend } from '../../api';
import type { AssessmentHistoryItem, ResourceDTO, TopicDetail } from '../../api/types';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { StatusBadge, AiBadge } from '../../components/Badge';
import { QuizFlow } from './QuizFlow';
import { NodeCard, type TreeCallbacks } from '../roadmap/NodeCard';
import { NodeModals, type NodeModalState } from '../roadmap/NodeModals';
import { useToast } from '../../app/ToastContext';
import { useTopics } from '../../app/TopicsContext';
import {
  aggregateStatus,
  childrenOf,
  descendantsOf,
  nextLeafAfter,
  siblingsOf,
} from '../../domain/tree';
import { cx } from '../../lib/cx';
import u from '../../styles/ui.module.css';
import s from './detail.module.css';

const RESOURCE_TYPES: Array<[string, string, string]> = [
  ['book', '课程', 'book'],
  ['document', '文档', 'file'],
  ['video', '视频', 'video'],
  ['link', '仓库 / 链接', 'code'],
];

function learningPoints(title: string, objective: string): Array<[string, string]> {
  return [
    ['理解核心概念', `围绕目标——${objective} 先用自己的话解释它解决的问题与适用边界。`],
    ['独立完成一个练习', `选择一个具体场景，把「${title}」的方法完整走一遍，记录步骤、关键判断与结果。`],
    ['检验与复盘', '对照学习目标检查概念解释和练习结果；未覆盖的点回到资料补齐，再试一次。'],
  ];
}

export function NodeDetailPage() {
  const { nodeId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { summaries, details, activeTopicId, setActiveTopic, loadDetail, refreshSummaries } = useTopics();
  const id = Number(nodeId);
  const [modalState, setModalState] = useState<NodeModalState>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizKey, setQuizKey] = useState(0);
  const [note, setNote] = useState<string>('');
  const [noteStatus, setNoteStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [resources, setResources] = useState<ResourceDTO[]>([]);
  const [resourceModal, setResourceModal] = useState(false);
  const [history, setHistory] = useState<AssessmentHistoryItem[]>([]);
  const noteTimer = useRef<number>(undefined);
  const loadedNoteFor = useRef<number | null>(null);

  const detail = useMemo<TopicDetail | null>(() => {
    for (const topicId of Object.keys(details).map(Number)) {
      const candidate = details[topicId];
      if (candidate.nodes.some((n) => n.id === id)) return candidate;
    }
    return null;
  }, [details, id]);

  const node = detail?.nodes.find((n) => n.id === id) ?? null;

  useEffect(() => {
    if (node && detail && detail.topic.id !== activeTopicId) setActiveTopic(detail.topic.id);
  }, [node, detail, activeTopicId, setActiveTopic]);

  useEffect(() => {
    if (!detail && summaries.length > 0) {
      const missing = summaries.filter((t) => !details[t.id]);
      const load = missing.length ? missing.map((t) => loadDetail(t.id)) : [loadDetail(summaries[0].id)];
      Promise.all(load).catch(() => toast('节点加载失败，请刷新重试。'));
    }
  }, [detail, summaries, details, loadDetail, toast]);

  useEffect(() => {
    if (!node) return;
    let cancelled = false;
    (async () => {
      try {
        const noteData = await backend.getNote(node.id);
        if (!cancelled && loadedNoteFor.current !== node.id) {
          loadedNoteFor.current = node.id;
          setNote(noteData?.content ?? '');
          setNoteStatus('saved');
        }
      } catch {
        if (!cancelled) setNoteStatus('error');
      }
      try {
        const resourceData = await backend.listResources(node.id);
        if (!cancelled) setResources(resourceData.items);
      } catch {
        if (!cancelled) setResources([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [node]);

  useEffect(() => {
    let cancelled = false;
    backend
      .listAssessments({ limit: 100 })
      .then(({ items }) => {
        if (!cancelled) setHistory(items);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [node?.status, node?.revision]);

  useEffect(
    () => () => {
      window.clearTimeout(noteTimer.current);
    },
    [],
  );

  if (!summaries.length) {
    return (
      <section className={cx(u.card, s.detailSuccess)} style={{ justifyContent: 'center' }}>
        <h2 style={{ fontSize: 20 }}>还没有学习主题</h2>
        <p style={{ marginTop: 10 }}>先创建一个学习主题，再开始节点学习。</p>
        <button type="button" className={cx(u.btn, u.primary)} style={{ marginTop: 18 }} onClick={() => navigate('/create')}>
          创建第一个学习主题
        </button>
      </section>
    );
  }

  if (!detail || !node) {
    return (
      <section className={cx(u.card, s.detailSuccess)} style={{ justifyContent: 'center', padding: 40 }}>
        <h2 style={{ fontSize: 20 }}>这个节点不存在或已从路线移除</h2>
        <p style={{ marginTop: 10 }}>
          可以回到学习路线撤销最近删除；历史打卡不受影响。
        </p>
        <button type="button" className={cx(u.btn, u.primary)} style={{ marginTop: 18 }} onClick={() => navigate('/roadmap')}>
          返回学习路线
        </button>
      </section>
    );
  }

  const nodes = detail.nodes;
  const children = childrenOf(nodes, node);
  const isGroup = children.length > 0;
  const status = aggregateStatus(nodes, node);
  const groupLeaves = isGroup ? descendantsOf(nodes, node).filter((n) => !childrenOf(nodes, n).length) : [];
  const next = isGroup
    ? groupLeaves.find((n) => aggregateStatus(nodes, n) !== 'done') ?? groupLeaves[0]
    : nextLeafAfter(detail, node.id);
  const nodeHistory = history.filter((h) => h.nodeId === node.id);
  const invalidated = !isGroup && node.revision > 1 && status !== 'done';

  const reload = async () => {
    if (detail) {
      await Promise.all([loadDetail(detail.topic.id), refreshSummaries()]);
    }
  };

  const saveNote = (content: string) => {
    if (!node) return;
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(async () => {
      setNoteStatus('saving');
      try {
        await backend.putNote(node.id, content);
        setNoteStatus('saved');
      } catch {
        setNoteStatus('error');
      }
    }, 450);
  };

  const callbacks: TreeCallbacks = {
    onManage: (targetId) => setModalState({ kind: 'actions', nodeId: targetId }),
    onMove: async (targetId, direction) => {
      const target = nodes.find((n) => n.id === targetId);
      if (!target) return;
      const peers = siblingsOf(nodes, target.parentId, target.stageIndex);
      const index = peers.findIndex((n) => n.id === targetId);
      const other = peers[index + direction];
      if (!other) return;
      const ordered = peers.filter((n) => n.id !== targetId);
      ordered.splice(ordered.findIndex((n) => n.id === other.id) + (direction > 0 ? 1 : 0), 0, target);
      try {
        await backend.reorderNodes(detail.topic.id, {
          groupId: { parentId: target.parentId, stageIndex: target.stageIndex },
          order: ordered.map((n) => n.id),
        });
        await reload();
        toast('同级顺序已更新。');
      } catch (error) {
        toast(error instanceof Error ? error.message : '排序失败。');
      }
    },
    onDragStart: () => {},
    onDropOn: () => {},
    onDragEnd: () => {},
    draggedId: null,
    dropHint: null,
    setDropHint: () => {},
  };

  const insertFormat = (format: string) => {
    const area = document.getElementById('note-editor') as HTMLTextAreaElement | null;
    if (!area) return;
    const start = area.selectionStart;
    const end = area.selectionEnd;
    const text = area.value.slice(start, end);
    const inserts: Record<string, string> = {
      heading: `## ${text || '新标题'}`,
      bold: `**${text || '重点内容'}**`,
      italic: `*${text || '强调内容'}*`,
      list: `- ${text || '学习要点'}`,
      code: '`' + (text || '代码') + '`',
      link: `[${text || '资源名称'}](链接地址)`,
    };
    area.setRangeText(inserts[format], start, end, 'end');
    const value = area.value;
    setNote(value);
    saveNote(value);
    area.focus();
  };

  return (
    <>
      <div className={s.detailHeading}>
        <Link className={cx(s.backLink, 'flex gap6')} to="/roadmap">
          <Icon name="left" />
          返回学习路线
          <span style={{ marginLeft: 8, color: '#696e62' }}>/ {detail.topic.stageTitles[node.stageIndex]}</span>
        </Link>
        <div className="between">
          <div>
            <div className="flex gap8">
              <StatusBadge status={status} />
              <span className="muted small" style={{ fontSize: 10 }}>
                第 {node.level} 级 ·{' '}
                {isGroup ? '分组节点，不单独检验' : `叶子节点 · 第 ${node.revision} 版目标`}
              </span>
            </div>
            <div className="between" style={{ marginTop: 9 }}>
              <h1>{node.title}</h1>
              <button type="button" className={u.btn} onClick={() => setModalState({ kind: 'actions', nodeId: node.id })}>
                <Icon name="more" cls="sm" />
                管理节点
              </button>
            </div>
            <div className={cx(s.metaLine, 'meta-line')} style={{ marginTop: 9 }}>
              <span>
                <Icon name="folder" />
                {detail.topic.title}
              </span>
              <span>
                <Icon name="clock" />
                建议学习 {node.durationMinutes} 分钟
              </span>
              <span>
                <Icon name="spark" />
                AI 生成学习要点
              </span>
            </div>
          </div>
        </div>
      </div>
      {invalidated ? (
        <div className={s.statusNotice}>
          <Icon name="info" cls="sm" />
          学习目标已修改，请按新目标重新检验；历史成绩仅作回顾，不计入当前进度。
        </div>
      ) : null}
      {status === 'done' && !isGroup ? (
        <div className={s.detailSuccess}>
          <Icon name="circleCheck" cls="sm" />
          当前目标已于 {node.completedAt ?? ''} 通过检验。首次通过记入打卡，重新检验不重复累计。
        </div>
      ) : status === 'failed' && !isGroup ? (
        <div className={cx(s.statusNotice, s.failedNotice)}>
          <Icon name="info" cls="sm" />
          上次检验暂未通过。建议先复习薄弱点，再尝试一次；不影响已完成的学习记录。
        </div>
      ) : null}
      <div className={s.detailGrid}>
        <section className={s.detailContent}>
          {isGroup ? (
            <section className={s.groupChildren}>
              <div className={s.groupSummary}>
                <div>
                  <h2>子节点进度</h2>
                  <p>父节点只汇总，全部叶子节点通过后自动完成，不额外打卡。</p>
                </div>
                <button
                  type="button"
                  className={cx(u.btn, u.soft)}
                  onClick={() => setModalState({ kind: 'editor', nodeId: null, parentId: node.id, stageIndex: node.stageIndex })}
                >
                  <Icon name="plus" cls="sm" />
                  添加子节点
                </button>
              </div>
              <div className="roadmap-tree">
                {children.map((child, index) => (
                  <NodeCard key={child.id} node={child} index={String(index + 1)} detail={detail} callbacks={callbacks} applyFilter={false} />
                ))}
              </div>
            </section>
          ) : null}
          <article className={cx(u.card, s.learningCard)}>
            <div className={cx(u.sectionHeading, 'between')}>
              <h2 className="flex gap8">
                <Icon name="book" cls="sm" />
                这一站，掌握什么？
              </h2>
              <AiBadge>学习要点</AiBadge>
            </div>
            <p className={s.nodeObjective} style={{ marginBottom: 14 }}>
              <strong>学习目标：</strong>
              {node.objective}
            </p>
            <p className={s.learningIntro}>
              围绕「{node.title}」，先理解概念，再通过练习把知识变成能独立运用的能力。
            </p>
            {learningPoints(node.title, node.objective).map(([title, description], index) => (
              <div className={s.learningPoint} key={title}>
                <span className={s.pointNumber}>{`0${index + 1}`}</span>
                <div>
                  <h4>{title}</h4>
                  <p>{description}</p>
                </div>
              </div>
            ))}
          </article>
          <section className={cx(u.card, s.noteCard)}>
            <div className={cx(u.sectionHeading, 'between')}>
              <h2 className="flex gap8">
                <Icon name="pen" cls="sm" />
                我的学习笔记
              </h2>
              <span className="small muted" style={{ fontSize: 10 }}>
                {noteStatus === 'saving' ? (
                  <span className="flex gap6">
                    <Icon name="loading" cls="sm spinner" />
                    正在保存…
                  </span>
                ) : noteStatus === 'error' ? (
                  '保存失败，请重试'
                ) : noteStatus === 'saved' ? (
                  <span className="flex gap6">
                    <Icon name="check" cls="sm" />
                    已保存
                  </span>
                ) : null}
              </span>
            </div>
            <div className={s.noteToolbar} aria-label="Markdown 编辑工具">
              <button type="button" onClick={() => insertFormat('heading')} aria-label="插入标题">
                <strong>H₂</strong>
              </button>
              <button type="button" onClick={() => insertFormat('bold')} aria-label="插入加粗">
                <b>B</b>
              </button>
              <button type="button" onClick={() => insertFormat('italic')} aria-label="插入斜体">
                <i>I</i>
              </button>
              <i className={s.toolSeparator} />
              <button type="button" onClick={() => insertFormat('list')} aria-label="插入列表">
                <Icon name="list" cls="sm" />
              </button>
              <button type="button" onClick={() => insertFormat('code')} aria-label="插入代码">
                <Icon name="code" cls="sm" />
              </button>
              <button type="button" onClick={() => insertFormat('link')} aria-label="插入链接">
                <Icon name="link" cls="sm" />
              </button>
            </div>
            <textarea
              id="note-editor"
              className={s.noteEditor}
              aria-label="我的学习笔记"
              placeholder="用自己的话记下来，才是真的理解了。支持 Markdown。"
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                saveNote(event.target.value);
              }}
            />
            <div className={s.noteBottom}>
              <span>支持 Markdown · 自动保存</span>
              <span>{note.length} 字</span>
            </div>
          </section>
          {nodeHistory.length ? (
            <details className={s.nodeHistory}>
              <summary>历史检验记录（{nodeHistory.length} 条）</summary>
              {nodeHistory.map((record) => (
                <div className={s.historyEntry} key={record.id}>
                  <strong>
                    {record.finishedAt?.slice(0, 10) ?? ''} · 第 {record.revision} 版 ·{' '}
                    {record.passed ? '通过' : '未通过'}
                    {record.passedCount !== null ? ` · ${record.passedCount} / 3` : ''}
                  </strong>
                  <p>{record.objective ?? ''}</p>
                  {record.isStale ? <small>旧版记录，仅作回顾，不代表当前目标已掌握。</small> : null}
                </div>
              ))}
            </details>
          ) : null}
        </section>
        <aside className={s.detailAside}>
          {isGroup ? (
            <section className={s.readyCard}>
              <div className={s.readyIcon}>
                <Icon name="route" />
              </div>
              <h3>把大目标，交给每一个小步。</h3>
              <p>
                这是分组节点，状态由所有叶子节点汇总。请进入子节点学习与检验；父节点不继承原成绩，也不会重复打卡。
              </p>
              <button
                type="button"
                className={cx(u.btn, u.primary, u.wide)}
                onClick={() => next && navigate(`/node/${next.id}`)}
              >
                前往子节点学习 <Icon name="arrow" cls="sm" />
              </button>
            </section>
          ) : (
            <section className={cx(s.readyCard, status === 'failed' && s.failedReady)}>
              <div className={s.readyIcon}>
                <Icon name={status === 'done' ? 'award' : 'shield'} />
              </div>
              <h3>
                {status === 'done'
                  ? '这一站，你已真正掌握。'
                  : status === 'failed'
                    ? '再巩固一下，就能更进一步。'
                    : '学会了？让理解被看见。'}
              </h3>
              <p>
                {status === 'done'
                  ? '当前目标已通过检验，可继续回顾或巩固；历史记录不会因路线编辑而消失。'
                  : '不是简单点一下「完成」。用 3 道小题检验掌握情况，让每一次打卡都有真实的进步。'}
              </p>
              <div className={s.checkRules}>
                <span>
                  <Icon name="clock" cls="sm" />
                  约 5 分钟
                </span>
                <span>
                  <Icon name="shield" cls="sm" />
                  答对 2 题通过
                </span>
              </div>
              <button
                type="button"
                className={cx(u.btn, u.primary, u.wide)}
                onClick={() => {
                  if (status === 'done') {
                    toast('该节点已通过当前目标的检验；修改学习目标后才能再次检验。');
                    return;
                  }
                  setQuizOpen(true);
                }}
              >
                <Icon name="spark" cls="sm" />
                {status === 'done' ? '再次巩固知识' : status === 'failed' ? '重新发起检验' : '发起 AI 检验'}
                <Icon name="arrow" cls="sm" />
              </button>
              <small>不用担心，没通过也会给你学习建议。</small>
            </section>
          )}
          <section className={cx(u.card, s.resourceCard)}>
            <div className={cx(u.sectionHeading, 'between')}>
              <h2 className="flex gap8">
                <Icon name="link" cls="sm" />
                学习资源 <span className={u.count}>{resources.length}</span>
              </h2>
            </div>
            {resources.length ? (
              resources.map((resource) => (
                <div className={s.resourceItem} key={resource.id}>
                  <div className={s.resourceIcon}>
                    <Icon
                      name={
                        RESOURCE_TYPES.find(([value]) => value === resource.type)?.[2] ?? 'link'
                      }
                    />
                  </div>
                  <div className={s.resourceInfo}>
                    <a href={resource.url} target="_blank" rel="noopener noreferrer">
                      {resource.title}
                    </a>
                    <p>
                      {RESOURCE_TYPES.find(([value]) => value === resource.type)?.[1] ?? '链接'} ·{' '}
                      {safeHostname(resource.url)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={cx(u.iconButton, s.resourceRemove)}
                    aria-label={`删除资源：${resource.title}`}
                    onClick={async () => {
                      try {
                        await backend.deleteResource(resource.id);
                        setResources((prev) => prev.filter((r) => r.id !== resource.id));
                        toast('资源已移除。');
                      } catch {
                        toast('删除失败，请重试。');
                      }
                    }}
                  >
                    <Icon name="close" cls="sm" />
                  </button>
                </div>
              ))
            ) : (
              <p className="muted small">收藏一份好资源，给学习多一个入口。</p>
            )}
            <button type="button" className={s.newTopicCard} onClick={() => setResourceModal(true)}>
              <Icon name="plus" cls="sm" />
              添加资源收藏
            </button>
          </section>
          {next ? (
            <section className={cx(u.card, s.nextNodeCard)}>
              <p>下一站，继续生长</p>
              <h4>{next.title}</h4>
              <Link className={u.linkButton} to={`/node/${next.id}`} style={{ fontSize: 10, marginTop: 13, display: 'inline-flex' }}>
                提前看看 <Icon name="arrow" cls="sm" />
              </Link>
            </section>
          ) : null}
        </aside>
      </div>
      <NodeModals
        state={modalState}
        detail={detail}
        onClose={() => setModalState(null)}
        onSwitch={setModalState}
        onSaved={async (values) => {
          if (!modalState || modalState.kind !== 'editor') return;
          const { nodeId: targetId, parentId, stageIndex } = modalState;
          try {
            if (targetId) {
              const result = await backend.patchNode(targetId, {
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
        }}
        onConfirmDelete={async (targetId) => {
          try {
            await backend.deleteNode(targetId);
            await reload();
            setModalState(null);
            toast('节点已从路线移除，可在路线页顶部撤销；历史打卡保留。');
            if (targetId === node.id) navigate('/roadmap');
          } catch (error) {
            toast(error instanceof Error ? error.message : '删除失败，请重试。');
          }
        }}
      />
      {resourceModal ? (
        <AddResourceModal
          nodeId={node.id}
          existing={resources}
          onClose={() => setResourceModal(false)}
          onAdded={async (resource) => {
            setResources((prev) => [...prev, resource]);
            setResourceModal(false);
            toast('资源已收藏，下次学习时一眼就能找到。');
          }}
        />
      ) : null}
      {quizOpen ? (
        <QuizFlow
          key={quizKey}
          nodeId={node.id}
          nodeTitle={node.title}
          onClose={() => setQuizOpen(false)}
          onCompleted={reload}
          onRetry={() => setQuizKey((k) => k + 1)}
        />
      ) : null}
    </>
  );
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function AddResourceModal({
  nodeId,
  existing,
  onClose,
  onAdded,
}: {
  nodeId: number;
  existing: ResourceDTO[];
  onClose: () => void;
  onAdded: (resource: ResourceDTO) => void;
}) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState('book');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="收藏一份学习资源" subtitle="给这一站的学习，多一个好入口。" icon="link" onRequestClose={onClose}>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setError('');
          let parsed: URL;
          try {
            parsed = new URL(url);
            if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
          } catch {
            setError('请输入有效的 http:// 或 https:// 链接。');
            return;
          }
          if (!title.trim()) {
            setError('请为资源填写一个名称。');
            return;
          }
          if (existing.some((r) => r.url === parsed.href)) {
            setError('这个链接已经收藏过了，可以在资源列表中查看。');
            return;
          }
          setBusy(true);
          try {
            const resource = await backend.addResource(nodeId, { type, title: title.trim(), url: parsed.href });
            onAdded(resource);
          } catch (err) {
            setError(err instanceof Error ? err.message : '收藏失败，请重试。');
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className={u.field}>
          <label htmlFor="resource-title">资源名称</label>
          <input
            id="resource-title"
            required
            maxLength={100}
            value={title}
            placeholder="例如：Java 继承与多态实战讲解"
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className={u.field}>
          <label htmlFor="resource-url">资源链接</label>
          <input
            type="url"
            id="resource-url"
            required
            value={url}
            placeholder="粘贴完整的 HTTPS 链接"
            onChange={(event) => setUrl(event.target.value)}
          />
          <p className={u.helper}>仅支持 http:// 或 https:// 链接。</p>
        </div>
        <div className={u.field}>
          <label htmlFor="resource-type">资源类型</label>
          <select id="resource-type" value={type} onChange={(event) => setType(event.target.value)}>
            {RESOURCE_TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <p className={u.fieldError} role="alert">{error}</p>
        <button type="submit" className={cx(u.btn, u.primary, u.wide)} disabled={busy}>
          <Icon name="plus" cls="sm" />
          {busy ? '正在添加…' : '添加到资源收藏'}
        </button>
      </form>
    </Modal>
  );
}
