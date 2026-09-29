import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../components/Modal';
import { Icon } from '../../components/Icon';
import type { NodeDTO, TopicDetail } from '../../api/types';
import { childrenOf, descendantsOf } from '../../domain/tree';
import u from '../../styles/ui.module.css';
import s from './editor.module.css';

export type NodeModalState =
  | { kind: 'actions'; nodeId: number }
  | { kind: 'editor'; nodeId: number | null; parentId: number | null; stageIndex: number }
  | { kind: 'delete'; nodeId: number }
  | null;

export interface EditorValues {
  title: string;
  objective: string;
  minutes: number;
}

interface NodeModalsProps {
  state: NodeModalState;
  detail: TopicDetail;
  onClose: () => void;
  onSwitch: (state: NodeModalState) => void;
  onSaved: (values: EditorValues) => void;
  onConfirmDelete: (nodeId: number) => void;
}

function findNode(detail: TopicDetail, id: number | null): NodeDTO | null {
  if (id === null) return null;
  return detail.nodes.find((n) => n.id === id) ?? null;
}

function NodeActionsModal({ detail, nodeId, onClose, onSwitch }: { detail: TopicDetail; nodeId: number; onClose: () => void; onSwitch: (state: NodeModalState) => void }) {
  const node = findNode(detail, nodeId);
  if (!node) return null;
  const depth = node.level;
  const hasChildren = childrenOf(detail.nodes, node).length > 0;
  return (
    <Modal title="调整这一站" subtitle={node.title} icon="more" onRequestClose={onClose}
      footer={{ actions: <button type="button" className={u.btn} onClick={onClose}>返回路线</button> }}>
      <div className={s.nodeActionList}>
        <button type="button" onClick={() => onSwitch({ kind: 'editor', nodeId: node.id, parentId: null, stageIndex: node.stageIndex })}>
          <Icon name="pen" />
          <span>
            <strong>编辑节点</strong>
            <small>名称、学习目标与预计时长</small>
          </span>
        </button>
        <button
          type="button"
          disabled={depth >= 3}
          onClick={() => onSwitch({ kind: 'editor', nodeId: null, parentId: node.id, stageIndex: node.stageIndex })}
        >
          <Icon name="plus" />
          <span>
            <strong>添加子节点</strong>
            <small>
              {depth >= 3
                ? '已达三级上限，不能继续添加'
                : hasChildren
                  ? '继续细化这一组学习目标'
                  : '拆分为分组；子节点单独检验，父节点汇总'}
            </small>
          </span>
        </button>
        <button type="button" className={s.danger} onClick={() => onSwitch({ kind: 'delete', nodeId: node.id })}>
          <Icon name="close" />
          <span>
            <strong>删除节点</strong>
            <small>先确认影响，可撤销；历史打卡保留</small>
          </span>
        </button>
      </div>
    </Modal>
  );
}

interface EditorTarget {
  node: NodeDTO | null;
  parent: NodeDTO | null;
}

function computeImpact(
  target: EditorTarget,
  objectiveDraft: string,
  detail: TopicDetail,
): { confirm: boolean; message: string } {
  const { node, parent } = target;
  if (node && objectiveDraft !== node.objective) {
    const affected = childrenOf(detail.nodes, node).length
      ? descendantsOf(detail.nodes, node).filter((n) => !childrenOf(detail.nodes, n).length)
      : [node];
    return {
      confirm: true,
      message: `学习目标已改变：${affected.length} 个叶子节点将重置为「未开始」，需按新目标重新检验；历史成绩、打卡、笔记与资源保留，不直接继承原成绩。`,
    };
  }
  if (parent) {
    const parentHasChildren = childrenOf(detail.nodes, parent).length > 0;
    if (!parentHasChildren) {
      const hadProgress = parent.status !== 'idle' || parent.hasPassedRecord;
      return {
        confirm: hadProgress,
        message: `「${parent.title}」将成为分组，不再单独检验；新子节点从「未开始」起步，父节点原成绩不转给子节点。历史打卡、笔记与资源保留，路线进度会重新计算。`,
      };
    }
    return { confirm: false, message: '新子节点从「未开始」起步；父节点汇总全部叶子节点，原本已完成的分组可能恢复为学习中。' };
  }
  return {
    confirm: false,
    message: node
      ? '仅调整名称或时长，已有检验结果和学习记录不变。'
      : '新节点从「未开始」起步，只有通过检验后才会计入完成进度。',
  };
}

function NodeEditorModal({
  detail,
  nodeId,
  parentId,
  stageIndex,
  onClose,
  onSaved,
}: {
  detail: TopicDetail;
  nodeId: number | null;
  parentId: number | null;
  stageIndex: number;
  onClose: () => void;
  onSaved: (values: EditorValues) => void;
}) {
  const node = findNode(detail, nodeId);
  const parent = findNode(detail, parentId);
  const [title, setTitle] = useState(node?.title ?? '');
  const [objective, setObjective] = useState(node?.objective ?? '');
  const [minutes, setMinutes] = useState(node?.durationMinutes ?? 45);
  const [ack, setAck] = useState(false);
  const [error, setError] = useState('');
  const target = useMemo<EditorTarget>(() => ({ node, parent }), [node, parent]);
  const impact = useMemo(
    () => computeImpact(target, objective, detail),
    [target, objective, detail],
  );

  useEffect(() => {
    setAck(false);
  }, [objective]);

  const submit = () => {
    if (!title.trim()) {
      setError('请填写节点名称。');
      return;
    }
    if (objective.trim().length < 10) {
      setError('学习目标至少 10 个字，作为检验依据。');
      return;
    }
    const value = Number(minutes);
    if (!Number.isInteger(value) || value < 5 || value > 600 || value % 5 !== 0) {
      setError('预计时长需为 5–600 分钟内、按 5 分钟递增。');
      return;
    }
    if (impact.confirm && !ack) {
      setError('请先确认重新检验对学习进度的影响。');
      return;
    }
    onSaved({ title: title.trim(), objective: objective.trim(), minutes: value });
  };

  const stageTitle = detail.topic.stageTitles[stageIndex] ?? '';
  const location = `${stageTitle}${parent ? ` / ${parent.title}` : ''} · 第 ${node ? node.level : parent ? parent.level + 1 : 1} 级 / 最多 3 级`;

  return (
    <Modal
      title={node ? '编辑学习节点' : parent ? '添加子节点' : '新增学习节点'}
      subtitle="目标描述越具体，检验越有依据。"
      icon="pen"
      onRequestClose={onClose}
    >
      <form
        className={s.nodeEditor}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <p className={s.nodeLocation}>{location}</p>
        <div className={u.field}>
          <label htmlFor="edit-node-title">节点名称</label>
          <input
            id="edit-node-title"
            required
            maxLength={80}
            value={title}
            placeholder="例如：用 private 保护对象状态"
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />
        </div>
        <div className={u.field}>
          <label htmlFor="edit-node-objective">学习目标 / 检验依据</label>
          <textarea
            id="edit-node-objective"
            required
            minLength={10}
            maxLength={500}
            value={objective}
            placeholder="例如：能够解释封装的作用，并独立编写一个保护余额不为负数的账户类。"
            onChange={(event) => setObjective(event.target.value)}
          />
          <p className={u.helper}>至少 10 个字；修改目标后，相关节点需重新检验，原成绩不继承。</p>
        </div>
        <div className={u.field}>
          <label htmlFor="edit-node-minutes">预计学习时长（分钟）</label>
          <input
            id="edit-node-minutes"
            type="number"
            required
            min="5"
            max="600"
            step="5"
            value={minutes}
            onChange={(event) => setMinutes(Number(event.target.value))}
          />
          <p className={u.helper}>5–600 分钟，按 5 分钟递增；名称、时长和排序不改变检验结果。</p>
        </div>
        <div className={s.nodeImpact} role="status">{impact.message}</div>
        <label className={s.impactAck} hidden={!impact.confirm}>
          <input type="checkbox" id="ack-node-impact" checked={ack} onChange={(event) => setAck(event.target.checked)} />
          <span>我理解对进度的影响，同意相关节点重新检验</span>
        </label>
        <p className={u.fieldError} role="alert">{error}</p>
        <div className={s.nodeFormActions}>
          <button type="button" className={u.btn} onClick={onClose}>取消</button>
          <button type="submit" className={u.btn + ' ' + u.primary}>{node ? '保存修改' : '添加节点'}</button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteConfirmModal({
  detail,
  nodeId,
  onClose,
  onConfirm,
}: {
  detail: TopicDetail;
  nodeId: number;
  onClose: () => void;
  onConfirm: (nodeId: number) => void;
}) {
  const node = findNode(detail, nodeId);
  if (!node) return null;
  const removed = [node, ...descendantsOf(detail.nodes, node)];
  const parent = node.parentId ? findNode(detail, node.parentId) : null;
  const lastChild = parent ? childrenOf(detail.nodes, parent).length === 1 : false;
  return (
    <Modal title="删除这一组学习内容？" subtitle={node.title} icon="close" onRequestClose={onClose}
      footer={{
        actions: (
          <>
            <button type="button" className={u.btn} onClick={onClose}>保留节点</button>
            <button type="button" className={u.btn + ' ' + u.danger} onClick={() => onConfirm(nodeId)}>
              确认删除 {removed.length} 个节点
            </button>
          </>
        ),
      }}>
      <div className={s.deleteImpact}>
        <p>
          将从当前路线移除 <strong>{removed.length} 个节点</strong>
          {removed.length > 1 ? `（含 ${removed.length - 1} 个子孙节点）` : ''}。
        </p>
        <ul>
          <li>相关笔记与资源将随节点移出路线，撤销后恢复。</li>
          <li>历史检验记录及已有打卡保留，不受本次删除影响。</li>
          <li>当前路线进度按剩余叶子节点重新计算；删除不算通过检验，也不会产生打卡。</li>
          {lastChild && parent ? (
            <li>
              父节点「{parent.title}」将恢复为未开始的叶子节点，需要单独检验，不能继承子节点成绩。
            </li>
          ) : null}
        </ul>
        <p>可在路线顶部撤销最近删除。</p>
      </div>
    </Modal>
  );
}

export function NodeModals({ state, detail, onClose, onSwitch, onSaved, onConfirmDelete }: NodeModalsProps) {
  if (!state) return null;
  if (state.kind === 'actions') {
    return <NodeActionsModal detail={detail} nodeId={state.nodeId} onClose={onClose} onSwitch={onSwitch} />;
  }
  if (state.kind === 'editor') {
    return (
      <NodeEditorModal
        detail={detail}
        nodeId={state.nodeId}
        parentId={state.parentId}
        stageIndex={state.stageIndex}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
  }
  return (
    <DeleteConfirmModal
      detail={detail}
      nodeId={state.nodeId}
      onClose={onClose}
      onConfirm={() => onConfirmDelete(state.nodeId)}
    />
  );
}
