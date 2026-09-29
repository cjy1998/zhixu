import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { backend } from '../../api';
import type { AnswerResult, AssessmentView, QuizQuestion, SubmitResult } from '../../api/types';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { formatZhDate, todayISO } from '../../domain/dates';
import { cx } from '../../lib/cx';
import u from '../../styles/ui.module.css';
import s from './quiz.module.css';

type Feedback = AnswerResult;

interface QuizFlowProps {
  nodeId: number;
  nodeTitle: string;
  onClose: () => void;
  onCompleted: () => void;
  onRetry: () => void;
}

function AnswerFeedbackView({ feedback }: { feedback: Feedback }) {
  const correct = 'correct' in feedback ? feedback.correct : feedback.passed;
  return (
    <div className={cx(s.answerFeedback, !correct && s.wrong)} role="status">
      <strong>
        <Icon name={correct ? 'circleCheck' : 'info'} />
        {correct ? '回答正确，理解很到位。' : '还差一点，看看这里。'}
      </strong>
      {feedback.type === 'choice' ? feedback.explanation : feedback.feedback}
      {feedback.type !== 'choice' && feedback.missingPoints?.length ? (
        <p style={{ marginTop: 6 }}>
          可以补充：{feedback.missingPoints.map((p) => `「${p}」`).join('、')}
        </p>
      ) : null}
    </div>
  );
}

const TYPE_LABEL: Record<string, { label: string; icon: string }> = {
  choice: { label: '单项选择', icon: 'list' },
  concept: { label: '概念问答', icon: 'pen' },
  code: { label: '编码小题', icon: 'code' },
};

function hintFor(question: QuizQuestion): string {
  if (question.type === 'choice') return '选择一个最合适的答案，关注题目真正问到的概念。';
  if (question.type === 'concept')
    return `请用自己的话解释，并举一个简单例子；至少 ${question.minLength} 个字。`;
  return '在下方写下代码（或分步骤描述），覆盖检验要点即可能通过。';
}

export function QuizFlow({ nodeId, nodeTitle, onClose, onCompleted, onRetry }: QuizFlowProps) {
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<AssessmentView | null>(null);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [progressText, setProgressText] = useState('正在准备检验');
  const abortRef = useRef(new AbortController());

  useEffect(() => {
    const controller = abortRef.current;
    backend
      .startQuiz(
        nodeId,
        { onProgress: (event) => setProgressText(event.message) },
        controller.signal,
      )
      .then(({ assessment: view }) => setAssessment(view as AssessmentView))
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : '出题失败，请稍后再试。');
      });
    return () => controller.abort();
  }, [nodeId]);

  if (error) {
    return (
      <Modal title="AI 掌握检验" subtitle={nodeTitle} icon="spark" onRequestClose={onClose}>
        <p className={u.fieldError} role="alert">{error}</p>
        <button type="button" className={cx(u.btn, u.primary, u.wide)} onClick={onClose}>
          回到节点，稍后再试
        </button>
      </Modal>
    );
  }

  if (!assessment) {
    return (
      <Modal
        title="AI 掌握检验"
        subtitle={nodeTitle}
        icon="spark"
        onRequestClose={onClose}
        footer={{
          note: '理解比速度重要，不限时作答。',
          actions: <button type="button" className={u.btn} onClick={onClose}>先继续学习</button>,
        }}
      >
        <div className={s.quizLoading}>
          <div className={s.aiOrbit}>
            <Icon name="spark" />
          </div>
          <h3>把「看懂了」，变成「真会了」。</h3>
          <p>
            正在围绕这个节点生成 3 道小题，
            <br />
            从概念理解到实际应用，看看你掌握得怎么样。
          </p>
          <div className={s.loadingChips}>
            <span>01 · 选择题</span>
            <span>02 · 概念问答</span>
            <span>03 · 编码小题</span>
          </div>
          <div className={s.skeletons}>
            {Array.from({ length: 3 }, (_, i) => (
              <div className={s.skeletonCard} key={i}>
                <i className={s.skeleton} />
                <i className={s.skeleton} />
                <i className={s.skeleton} />
              </div>
            ))}
          </div>
          <p style={{ fontSize: 10, marginBottom: 0 }} className="flex gap6" >
            <Icon name="loading" cls={`sm ${s.spinner}`} />
            {progressText} · 预计数秒
          </p>
        </div>
      </Modal>
    );
  }

  const questions = assessment.questions;
  const question = questions[index];

  const submitAnswer = async () => {
    if (selected === null || selected === '') return;
    setSubmitting(true);
    try {
      const answerFeedback = await backend.answer(assessment.id, {
        questionIndex: index,
        answer: selected,
      });
      setFeedback(answerFeedback);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败，请重试。');
    } finally {
      setSubmitting(false);
    }
  };

  const nextQuestion = async () => {
    if (index < questions.length - 1) {
      setIndex(index + 1);
      setSelected(null);
      setFeedback(null);
      return;
    }
    setSubmitting(true);
    try {
      const submitResult = await backend.submit(assessment.id);
      setResult(submitResult);
      onCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败，请重试。');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    const score = result.passedCount;
    if (result.passed) {
      return (
        <Modal
          title="一次真正的进步"
          subtitle={nodeTitle}
          icon="check"
          onRequestClose={onClose}
          footer={{
            actions: (
              <>
                <button type="button" className={u.btn} onClick={() => { onClose(); navigate('/roadmap'); }}>
                  回到学习路线
                </button>
                <button
                  type="button"
                  className={cx(u.btn, u.primary)}
                  onClick={() => {
                    const next = result.nextNode;
                    onClose();
                    navigate(next ? `/node/${next.id}` : '/roadmap');
                  }}
                >
                  前往下一节点 <Icon name="arrow" cls="sm" />
                </button>
              </>
            ),
          }}
        >
          <div className={s.resultBody}>
            <i className={cx(s.confetti, s.c1)} />
            <i className={cx(s.confetti, s.c2)} />
            <i className={cx(s.confetti, s.c3)} />
            <i className={cx(s.confetti, s.c4)} />
            <div className={s.resultIllustration}>
              <Icon name="check" />
            </div>
            <span className="eyebrow" style={{ fontSize: 9 }}>A MILESTONE, WELL EARNED</span>
            <h2 style={{ marginTop: 8 }}>这一站，你真的学会了。</h2>
            <p className={s.resultDescription}>
              不只是完成了一项任务，
              <br />
              而是又多了一份可以独立运用的知识。
            </p>
            <div className={s.resultScore}>
              <div>
                <strong className="numeric">
                  {score} / {result.total}
                </strong>
                <p>题目回答正确</p>
              </div>
              <div>
                <strong className="numeric">
                  {formatZhDate(result.checkIn?.checkDate ?? todayISO())}
                </strong>
                <p>打卡日期</p>
              </div>
              <div>
                <strong className="numeric">+1</strong>
                <p>已掌握的节点</p>
              </div>
            </div>
            <div className={s.resultInsight}>
              <h4>
                <Icon name="spark" />
                这次检验，你做得很好
              </h4>
              3 道题你都给出了有依据的回答。接下来，试着在一个小场景里独立使用这些知识，让理解更扎实。
            </div>
            <div className={s.resultStreak}>
              <Icon name="flame" />
              连续打卡 {result.streak} 天，把这一小步留给未来的自己。
            </div>
          </div>
        </Modal>
      );
    }
    return (
      <Modal
        title="AI 掌握检验 · 学习反馈"
        subtitle={nodeTitle}
        icon="leaf"
        onRequestClose={onClose}
        footer={{
          actions: (
            <>
              <button type="button" className={u.btn} onClick={onClose}>
                <Icon name="spark" cls="sm" />
                回到节点，巩固一下
              </button>
              <button type="button" className={cx(u.btn, u.primary)} onClick={onRetry}>
                重新检验
              </button>
            </>
          ),
        }}
      >
        <div className={cx(s.resultBody, s.failure)}>
          <div className={s.resultIllustration}>
            <Icon name="leaf" />
          </div>
          <h2>还差一点，理解就更扎实了。</h2>
          <p className={s.resultDescription}>
            这不是失败，是找到了下一步该学什么。
            <br />
            先补上这几个小缺口，再回来试试看。
          </p>
          <div className={s.resultScore}>
            <div>
              <strong className="numeric">
                {score} / {result.total}
              </strong>
              <p>题目回答正确</p>
            </div>
            <div>
              <strong className="numeric">2 / 3</strong>
              <p>通过所需答对</p>
            </div>
          </div>
          <div className={s.weakPoints}>
            {questions.map((q, i) => (
              <div className={s.weakPoint} key={i}>
                <h4>
                  <Icon name="info" />
                  第 {i + 1} 题 · {TYPE_LABEL[q.type]?.label ?? q.type}需要巩固
                </h4>
                <p>
                  {q.prompt}
                  {i === 2 ? ' 建议：对照学习要点，独立重写一遍示例。' : ' 建议：先用自己的话解释，再举一个具体例子。'}
                </p>
              </div>
            ))}
          </div>
          <div className={s.failureNote}>
            <Icon name="info" cls="sm" />
            节点已标记为「检验未通过」，本次不计入打卡；不影响已完成的学习记录。
          </div>
        </div>
      </Modal>
    );
  }

  const typeMeta = TYPE_LABEL[question.type] ?? TYPE_LABEL.concept;
  const isChoice = question.type === 'choice';

  return (
    <Modal
      title="AI 掌握检验"
      subtitle={nodeTitle}
      icon="spark"
      onRequestClose={onClose}
      footer={{
        note: feedback ? '掌握不止于对错，更在于理解原因。' : '学习笔记已保存，放心作答。',
        actions: (
          <button
            type="button"
            className={cx(u.btn, u.primary)}
            disabled={
              submitting || (!feedback && (selected === null || selected === ''))
            }
            onClick={() => (feedback ? nextQuestion() : submitAnswer())}
          >
            {feedback
              ? index === questions.length - 1
                ? '查看检验结果'
                : '下一题'
              : submitting
                ? '正在判分…'
                : '提交答案'}
            <Icon name="arrow" cls="sm" />
          </button>
        ),
      }}
    >
      <div>
        <div className={s.questionProgress}>
          <strong>把理解说清楚，就已经进了一步。</strong>
          <span>
            第 {index + 1} / {questions.length} 题
          </span>
        </div>
        <div className={s.quizSegments}>
          {questions.map((_, i) => (
            <span key={i} className={cx(i === index && s.current, i < index && s.filled)} />
          ))}
        </div>
        <span className={s.questionType}>
          <Icon name={typeMeta.icon} cls="sm" />
          {typeMeta.label}
        </span>
        <h3 className={s.questionTitle}>{question.prompt}</h3>
        <p className={s.questionNote}>{hintFor(question)}</p>
        {isChoice ? (
          <div role="radiogroup" aria-label="选择答案">
            {(question as { options: string[] }).options.map((option, i) => (
              <button
                key={i}
                type="button"
                className={cx(s.answerOption, selected === i && s.selected)}
                role="radio"
                aria-checked={selected === i}
                disabled={feedback !== null}
                onClick={() => setSelected(i)}
              >
                <span className={s.optionLetter}>{String.fromCharCode(65 + i)}</span>
                <span>{option}</span>
                <span className={s.optionRadio} />
              </button>
            ))}
          </div>
        ) : (
          <textarea
            className={cx(s.quizAnswer, question.type === 'code' && s.code)}
            aria-label={`${typeMeta.label}答案`}
            placeholder={question.type === 'code' ? '写下你的代码或步骤描述……' : '写下你的理解……'}
            value={
              typeof selected === 'string'
                ? selected
                : question.type === 'code' && question.starterCode
                  ? question.starterCode
                  : ''
            }
            readOnly={feedback !== null}
            onChange={(event) => setSelected(event.target.value)}
          />
        )}
        {feedback ? (
          <AnswerFeedbackView feedback={feedback} />
        ) : (
          <div className={s.quizHint}>
            <Icon name="shield" />
            至少答对 2 / 3 题即可通过。每题提交后会立即反馈。
          </div>
        )}
        <p className={u.fieldError} role="alert">{error}</p>
      </div>
    </Modal>
  );
}
