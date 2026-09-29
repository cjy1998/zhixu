import type { NodeDTO, NodeStatus, TopicDetail } from '../api/types';

export interface NodeTree {
  node: NodeDTO;
  children: NodeTree[];
}

export function siblingsOf(nodes: NodeDTO[], parentId: number | null, stageIndex: number): NodeDTO[] {
  return nodes
    .filter((n) => n.parentId === parentId && n.stageIndex === stageIndex)
    .sort((a, b) => a.orderNo - b.orderNo);
}

export function childrenOf(nodes: NodeDTO[], node: NodeDTO): NodeDTO[] {
  return siblingsOf(nodes, node.id, node.stageIndex);
}

export function descendantsOf(nodes: NodeDTO[], node: NodeDTO): NodeDTO[] {
  return childrenOf(nodes, node).flatMap((child) => [child, ...descendantsOf(nodes, child)]);
}

export function isLeaf(nodes: NodeDTO[], node: NodeDTO): boolean {
  return !nodes.some((n) => n.parentId === node.id);
}

export function leafNodesOf(nodes: NodeDTO[]): NodeDTO[] {
  const parentIds = new Set(nodes.map((n) => n.parentId).filter((v) => v !== null));
  return nodes.filter((n) => !parentIds.has(n.id));
}

export function stageLeaves(nodes: NodeDTO[], stageIndex: number): NodeDTO[] {
  return leafNodesOf(nodes.filter((n) => n.stageIndex === stageIndex));
}

export function aggregateStatus(nodes: NodeDTO[], node: NodeDTO): NodeStatus {
  const children = childrenOf(nodes, node);
  if (children.length === 0) return node.status;
  const values = children.map((child) => aggregateStatus(nodes, child));
  if (values.every((s) => s === 'done')) return 'done';
  if (values.includes('failed')) return 'failed';
  if (values.includes('pending')) return 'pending';
  return values.some((s) => s !== 'idle') ? 'active' : 'idle';
}

export function topicLeaves(detail: TopicDetail): NodeDTO[] {
  return detail.topic.stageTitles.flatMap((_, stage) =>
    stageLeaves(detail.nodes, stage).sort(
      (a, b) =>
        a.stageIndex - b.stageIndex ||
        a.parentId! - b.parentId! ||
        a.orderNo - b.orderNo,
    ),
  );
}

export function leafDoneCount(detail: TopicDetail): number {
  return topicLeaves(detail).filter((n) => aggregateStatus(detail.nodes, n) === 'done').length;
}

export function topicPercent(detail: TopicDetail): number {
  const leaves = topicLeaves(detail);
  return leaves.length
    ? Math.round((leafDoneCount(detail) / leaves.length) * 100)
    : 0;
}

export function nextLearningNode(detail: TopicDetail): NodeDTO | null {
  const leaves = topicLeaves(detail);
  return (
    leaves.find((n) => aggregateStatus(detail.nodes, n) === 'active') ||
    leaves.find((n) => aggregateStatus(detail.nodes, n) !== 'done') ||
    leaves[0] ||
    null
  );
}

export function nextLeafAfter(detail: TopicDetail, nodeId: number): NodeDTO | null {
  const leaves = topicLeaves(detail);
  const index = leaves.findIndex((n) => n.id === nodeId);
  return index >= 0 ? leaves[index + 1] ?? null : null;
}

export function stageComplete(nodes: NodeDTO[], stageIndex: number): boolean {
  const leaves = stageLeaves(nodes, stageIndex);
  return leaves.length > 0 && leaves.every((n) => aggregateStatus(nodes, n) === 'done');
}

export function completedStages(detail: TopicDetail): number {
  return detail.topic.stageTitles.filter((_, stage) => stageComplete(detail.nodes, stage)).length;
}

export function buildStageTree(nodes: NodeDTO[], stageIndex: number): NodeTree[] {
  const wrap = (node: NodeDTO): NodeTree => ({
    node,
    children: childrenOf(nodes, node).map(wrap),
  });
  return siblingsOf(nodes, null, stageIndex).map(wrap);
}
