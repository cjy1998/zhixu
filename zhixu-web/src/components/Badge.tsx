import { Icon } from './Icon';
import { cx } from '../lib/cx';
import u from '../styles/ui.module.css';
import type { NodeStatus } from '../api/types';

const STATUS_META: Record<NodeStatus, { label: string; icon: string }> = {
  idle: { label: '未开始', icon: 'circle' },
  active: { label: '学习中', icon: 'play' },
  pending: { label: '待检验', icon: 'clock' },
  done: { label: '已完成', icon: 'check' },
  failed: { label: '检验未通过', icon: 'alert' },
};

export function StatusBadge({ status, className }: { status: NodeStatus; className?: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.idle;
  return (
    <span className={cx(u.badge, u[status], className)}>
      <Icon name={meta.icon} cls="sm" />
      {meta.label}
    </span>
  );
}

export function AiBadge({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <span className={cx(u.badge, u.ai, className)}>
      <Icon name="spark" cls="sm" />
      {children ?? 'AI 生成'}
    </span>
  );
}
