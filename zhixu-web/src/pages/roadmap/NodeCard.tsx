import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { NodeDTO, TopicDetail } from '../../api/types';
import { Icon } from '../../components/Icon';
import { StatusBadge } from '../../components/Badge';
import { childrenOf, descendantsOf, aggregateStatus, siblingsOf } from '../../domain/tree';
import { formatZhDate } from '../../domain/dates';
import { cx } from '../../lib/cx';
import u from '../../styles/ui.module.css';
import s from './tree.module.css';

export interface TreeCallbacks {
  onManage: (nodeId: number) => void;
  onMove: (nodeId: number, direction: -1 | 1) => void;
  onDragStart: (nodeId: number) => void;
  onDropOn: (nodeId: number, after: boolean) => void;
  onDragEnd: () => void;
  draggedId: number | null;
  dropHint: { id: number; after: boolean } | null;
  setDropHint: (hint: { id: number; after: boolean } | null) => void;
}

interface NodeCardProps {
  node: NodeDTO;
  index: string;
  detail: TopicDetail;
  callbacks: TreeCallbacks;
  applyFilter?: boolean;
  hideDone?: boolean;
}

const ACTION_BY_STATUS: Record<string, string> = {
  done: '回顾笔记',
  pending: '发起检验',
  failed: '再学一次',
};

export function NodeCard({ node, index, detail, callbacks, applyFilter = true, hideDone = false }: NodeCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const nodes = detail.nodes;
  const children = childrenOf(nodes, node);
  const status = aggregateStatus(nodes, node);
  const depth = node.level;
  const peers = siblingsOf(nodes, node.parentId, node.stageIndex);
  const position = peers.findIndex((p) => p.id === node.id);
  const isGroup = children.length > 0;
  const leaves = isGroup ? descendantsOf(nodes, node).filter((n) => !childrenOf(nodes, n).length) : [];
  const done = leaves.filter((n) => aggregateStatus(nodes, n) === 'done').length;
  const isDragTarget = callbacks.dropHint?.id === node.id;
  const dragging = callbacks.draggedId === node.id;
  const childNodes = children.filter((child) => !applyFilter || !hideDone || aggregateStatus(nodes, child) !== 'done');

  return (
    <div className={cx(s.nodeBranch, isGroup && s.isGroup, dragging && s.isDragging)}>
      <div
        className={cx(s.nodeCard, s.treeCard, status, isGroup && s.isGroup, isDragTarget && callbacks.dropHint?.after && s.dropAfter, isDragTarget && !callbacks.dropHint?.after && s.dropBefore)}
        onDragOver={(event) => {
          if (callbacks.draggedId === null || callbacks.draggedId === node.id) return;
          const dragged = nodes.find((n) => n.id === callbacks.draggedId);
          if (!dragged || dragged.stageIndex !== node.stageIndex || (dragged.parentId ?? null) !== (node.parentId ?? null)) return;
          event.preventDefault();
          const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
          const after = event.clientY > rect.top + rect.height / 2;
          callbacks.setDropHint({ id: node.id, after });
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (callbacks.dropHint?.id === node.id) callbacks.onDropOn(node.id, callbacks.dropHint.after);
          else callbacks.onDragEnd();
        }}
      >
        <button
          type="button"
          className={s.nodeDrag}
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', String(node.id));
            callbacks.onDragStart(node.id);
          }}
          onDragEnd={callbacks.onDragEnd}
          aria-label={`拖拽排序：${node.title}`}
          title="仅限同一父节点、同一阶段内排序"
        >
          <Icon name="list" cls="sm" />
        </button>
        {isGroup ? (
          <button
            type="button"
            className={s.nodeToggle}
            aria-expanded={!collapsed}
            aria-label={`${collapsed ? '展开' : '收起'}：${node.title}`}
            onClick={() => setCollapsed((v) => !v)}
          >
            <Icon name={collapsed ? 'chevron' : 'down'} cls="sm" />
          </button>
        ) : null}
        <Link className={s.nodeMain} to={`/node/${node.id}`} draggable={false}>
          <div className={s.nodeTop}>
            <span className={s.nodeIndex}>
              {index} · {depth} 级{isGroup ? ' · 分组' : ''}
            </span>
            <StatusBadge status={status} />
          </div>
          <h3>{node.title}</h3>
          <p className={s.nodeObjective}>{node.objective}</p>
          <div className={s.nodeBottom}>
            <span>
              <Icon name={isGroup ? 'route' : status === 'done' ? 'calendar' : 'clock'} />
              {isGroup
                ? `${done} / ${leaves.length} 个叶子节点已掌握`
                : status === 'done' && node.completedAt
                  ? `${formatZhDate(node.completedAt)} 已掌握`
                  : `约 ${node.durationMinutes} 分钟`}
            </span>
            <span className={s.nodeAction}>
              {isGroup ? '查看子节点' : ACTION_BY_STATUS[status] ?? '继续学习'}
              <Icon name="arrow" />
            </span>
          </div>
        </Link>
        <div className={s.nodeControls}>
          <button
            type="button"
            className={u.iconButton}
            onClick={() => callbacks.onMove(node.id, -1)}
            disabled={position === 0}
            aria-label={`上移：${node.title}`}
            title="同级上移"
          >
            <Icon name="left" cls={`sm ${s.nodeUp}`} />
          </button>
          <button
            type="button"
            className={u.iconButton}
            onClick={() => callbacks.onMove(node.id, 1)}
            disabled={position === peers.length - 1}
            aria-label={`下移：${node.title}`}
            title="同级下移"
          >
            <Icon name="down" cls="sm" />
          </button>
          <button
            type="button"
            className={u.iconButton}
            onClick={() => callbacks.onManage(node.id)}
            aria-label={`管理节点：${node.title}`}
            title="编辑、新增子节点、删除"
          >
            <Icon name="more" cls="sm" />
          </button>
        </div>
      </div>
      {isGroup && !collapsed ? (
        <div className={s.nodeChildren}>
          {childNodes.map((child, childIndex) => (
            <NodeCard
              key={child.id}
              node={child}
              index={`${index}.${childIndex + 1}`}
              detail={detail}
              callbacks={callbacks}
              applyFilter={applyFilter}
              hideDone={hideDone}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
