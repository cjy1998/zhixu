import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { ApiError } from '../../api/client';
import { USE_MOCK } from '../../api';
import { useAuth } from '../../app/AuthContext';
import { useToast } from '../../app/ToastContext';
import { cx } from '../../lib/cx';
import u from '../../styles/ui.module.css';
import s from './auth.module.css';

function AuthStory() {
  return (
    <section className={s.authStory}>
      <div className={cx(s.authStoryContent)}>
        <span className="eyebrow" style={{ fontSize: 10, letterSpacing: 2 }}>
          LESS OVERWHELM. MORE PROGRESS.
        </span>
        <h1>
          想学的，
          <br />
          一步一步<em>变成会的。</em>
        </h1>
        <p>
          AI 为你规划路线，用检验确认每一次掌握。
          <br />
          让学习不止于收藏，让努力真正留下痕迹。
        </p>
        <div className={s.authMiniRoute}>
          <div className={s.miniRouteCard}>
            <div className={u.circleIcon}>
              <Icon name="route" cls="sm" />
            </div>
            <div>
              <h4>一个大目标，拆成小步</h4>
              <p>Java 后端学习路线 · 4 个学习阶段</p>
            </div>
            <span className={cx(u.badge, u.done)}>路线已规划</span>
          </div>
          <div className={s.miniRouteCard}>
            <div className={u.circleIcon} style={{ background: '#f4f2df', color: '#726f43' }}>
              <Icon name="spark" cls="sm" />
            </div>
            <div>
              <h4>面向对象：封装与继承</h4>
              <p>学懂了，还要能独立说清楚</p>
            </div>
            <span className={cx(u.badge, u.pending)}>AI 检验中</span>
          </div>
          <div className={s.miniRouteCard}>
            <div className={u.circleIcon}>
              <Icon name="check" cls="sm" />
            </div>
            <div>
              <h4>真正学会，才算完成</h4>
              <p>每一份理解，都成为可见的进步</p>
            </div>
            <span className={cx(u.badge, u.done)}>打卡成功</span>
          </div>
        </div>
        <div className={s.authQuote}>
          “重要的不是学了多久，而是今天真正学会了什么。”
          <small>知序 · 陪你走好每一步</small>
        </div>
      </div>
    </section>
  );
}

function TermsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="服务与隐私说明" subtitle="知序 Pathly" onRequestClose={onClose}>
      <p style={{ lineHeight: 2, fontSize: 12, color: 'var(--muted)' }}>
        {USE_MOCK
          ? '当前为演示模式：不创建真实账号，学习记录（笔记、资源、检验结果）仅保存在当前浏览器，AI 规划与检验由本地预设数据与简单规则模拟，不构成真实能力评估。请勿填写个人敏感信息。'
          : '你的学习背景将用于生成个性化路线；笔记、资源与学习进度保存在你的账号下。请勿在笔记或作答中填写个人敏感信息。'}
      </p>
    </Modal>
  );
}

function ForgotModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { demoLogin } = useAuth();
  return (
    <Modal title="找回密码" subtitle="重置链接将发送到注册邮箱" onRequestClose={onClose}>
      <p className="muted" style={{ fontSize: 12, lineHeight: 2 }}>
        {USE_MOCK
          ? '演示模式无需找回密码，可以直接体验示例工作台。'
          : '正式环境会通过注册邮箱发送重置链接；如需帮助请联系管理员。'}
      </p>
      {USE_MOCK ? (
        <div className={u.field} style={{ marginTop: 18 }}>
          <button
            type="button"
            className={cx(u.btn, u.primary, u.wide)}
            onClick={async () => {
              await demoLogin();
              onClose();
              navigate('/dashboard');
            }}
          >
            体验示例工作台
          </button>
        </div>
      ) : null}
    </Modal>
  );
}

export function AuthPage({ register = false }: { register?: boolean }) {
  const { login, register: registerUser, demoLogin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState(register ? '' : 'lin.zhixia@example.com');
  const [password, setPassword] = useState(register ? '' : 'Pathly2026');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<'terms' | 'forgot' | null>(null);

  const submit = async () => {
    setError('');
    if (register && (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password))) {
      setError('密码需要同时包含字母和数字。');
      return;
    }
    setBusy(true);
    try {
      if (register) await registerUser(name.trim() || '新同学', email, password);
      else await login(email, password);
      navigate('/dashboard');
      toast(register ? '账号已就绪，创建你的第一个学习主题吧。' : '欢迎回来，今天也继续前进。');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '网络异常，请稍后再试。';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.authPage}>
      <AuthStory />
      <section className={s.authRight}>
        <div className={s.authFormWrap}>
          <span className="eyebrow">{register ? 'YOUR JOURNEY STARTS HERE' : 'GOOD TO SEE YOU AGAIN'}</span>
          <h2>{register ? '开启你的学习新旅程' : '欢迎回来。'}</h2>
          <p>{register ? '给每一个想学的念头，一个清晰的起点。' : '今天，也离想成为的自己更近一点。'}</p>
          <div className={s.authTabs}>
            <Link to="/login" className={cx(s.tab, !register && s.active)}>
              登录
            </Link>
            <Link to="/register" className={cx(s.tab, register && s.active)}>
              注册
            </Link>
          </div>
          <form
            className={s.authForm}
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy) submit();
            }}
          >
            {register ? (
              <div className={u.field}>
                <label htmlFor="auth-name">怎么称呼你</label>
                <input
                  id="auth-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="nickname"
                  required
                  maxLength={20}
                  placeholder="你的名字或昵称"
                />
              </div>
            ) : null}
            <div className={u.field}>
              <label htmlFor="auth-email">邮箱</label>
              <input
                type="email"
                id="auth-email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                placeholder="输入你的邮箱地址"
              />
            </div>
            <div className={u.field}>
              <label htmlFor="auth-password">密码</label>
              <div className={s.inputIconWrap}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="auth-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={register ? 'new-password' : 'current-password'}
                  required
                  minLength={8}
                  placeholder={register ? '至少 8 位，包含字母和数字' : '输入你的密码'}
                />
                <button
                  type="button"
                  className={u.iconButton}
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <Icon name="eye" cls="sm" />
                </button>
              </div>
              {register ? <p className={u.helper}>至少 8 位，包含字母和数字。请勿输入真实密码。</p> : null}
            </div>
            {register ? (
              <label className={s.checkLabel} style={{ marginBottom: 20 }}>
                <input type="checkbox" required />
                我已阅读并同意
                <button
                  type="button"
                  className={u.linkButton}
                  style={{ fontSize: 10 }}
                  onClick={() => setModal('terms')}
                >
                  服务与隐私说明
                </button>
              </label>
            ) : (
              <div className={s.rememberRow}>
                <label className={s.checkLabel}>
                  <input type="checkbox" defaultChecked />
                  记住学习进度
                </label>
                <button type="button" className={u.linkButton} style={{ fontSize: 10 }} onClick={() => setModal('forgot')}>
                  忘记密码？
                </button>
              </div>
            )}
            <p className={u.fieldError} role="alert">
              {error}
            </p>
            <button type="submit" className={cx(u.btn, u.primary, u.wide, u.large)} disabled={busy}>
              {busy ? '正在进入你的学习空间…' : register ? '创建我的账号' : '登录，继续学习'}
              {!busy ? <Icon name="arrow" cls="sm" /> : null}
            </button>
          </form>
          {USE_MOCK ? (
            <>
              <div className={s.authSeparator}>想先了解一下？</div>
              <button
                type="button"
                className={cx(u.btn, u.wide)}
                onClick={async () => {
                  await demoLogin();
                  navigate('/dashboard');
                  toast('已进入示例工作台，随便逛逛。');
                }}
              >
                <Icon name="play" cls="sm" />
                免登录，体验示例工作台
              </button>
              <p className={s.demoWarning}>
                <Icon name="info" cls="sm" />
                演示模式：不创建真实账号，学习记录仅保存在当前浏览器。
              </p>
            </>
          ) : null}
        </div>
        <div className={s.authFooter}>© 2026 知序 Pathly · 给学习以方向，给成长以回响</div>
      </section>
      {modal === 'terms' ? <TermsModal onClose={() => setModal(null)} /> : null}
      {modal === 'forgot' ? <ForgotModal onClose={() => setModal(null)} /> : null}
    </div>
  );
}
