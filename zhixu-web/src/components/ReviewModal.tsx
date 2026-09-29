import { useEffect, useRef, useState } from 'react';
import { backend } from '../api';
import type { ReviewResult } from '../api/types';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { cx } from '../lib/cx';
import u from '../styles/ui.module.css';
import s from './ReviewModal.module.css';

interface ReviewModalProps {
  topicId: number;
  stageIndex: number;
  stageTitle: string;
  leafTotal: number;
  onClose: () => void;
}

export function ReviewModal({ topicId, stageIndex, stageTitle, leafTotal, onClose }: ReviewModalProps) {
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [error, setError] = useState('');
  const [percent, setPercent] = useState(10);
  const controller = useRef(new AbortController());

  useEffect(() => {
    const current = controller.current;
    backend
      .stageReview(
        topicId,
        stageIndex,
        { onProgress: (event) => setPercent(event.percent) },
        current.signal,
      )
      .then(setReview)
      .catch((err) => {
        if (current.signal.aborted) return;
        setError(err instanceof Error ? err.message : '复盘生成失败，请重试。');
      });
    return () => current.abort();
  }, [topicId, stageIndex]);

  return (
    <Modal
      title="回望这一程，看见你的成长"
      subtitle={`${stageTitle} · 阶段 ${String(stageIndex + 1).padStart(2, '0')}`}
      extraClassName={s.reviewModal}
      onRequestClose={onClose}
      footer={{
        note: '成长值得被回望，也值得被继续。',
        actions: (
          <button type="button" className={cx(u.btn, u.primary)} onClick={onClose}>
            继续下一阶段 <Icon name="arrow" cls="sm" />
          </button>
        ),
      }}
    >
      {error ? (
        <p className={u.fieldError} role="alert">{error}</p>
      ) : !review ? (
        <div className={s.reviewLoading}>
          <div className={s.orbit}>
            <Icon name="spark" />
          </div>
          <h3>正在生成阶段复盘…</h3>
          <p>汇总这个阶段的学习与检验记录，给你一份看得见的成长回望。</p>
          <div className={u.progress} style={{ maxWidth: 320, margin: '0 auto' }}>
            <span style={{ width: `${percent}%` }} />
          </div>
        </div>
      ) : (
        <>
          <div className={s.reviewHead}>
            <h2>{review.stageTitle}，顺利完成。</h2>
            <span className={cx(u.badge, u.done)}>
              <Icon name="check" cls="sm" />
              {leafTotal}/{leafTotal} 已掌握
            </span>
          </div>
          <div className={s.reviewSummary}>{review.summary.text}</div>
          <section className={s.reviewBlock}>
            <h3>
              <Icon name="circleCheck" />你已经能够独立做到
            </h3>
            <ul>
              {review.mastered.map((item) => (
                <li key={item.point}>
                  {item.point}：{item.evidence}
                </li>
              ))}
            </ul>
          </section>
          <section className={s.reviewBlock}>
            <h3>
              <Icon name="info" />值得继续留意的小细节
            </h3>
            {review.needsAttention.map((item) => (
              <p key={item.point}>
                <strong>{item.point}</strong> — {item.reason}
              </p>
            ))}
          </section>
          <section className={s.reviewBlock}>
            <h3>
              <Icon name="route" />给下一阶段的建议
            </h3>
            {review.nextStep.map((item) => (
              <p key={item.action}>
                {item.action} — {item.reason}
              </p>
            ))}
          </section>
        </>
      )}
    </Modal>
  );
}
