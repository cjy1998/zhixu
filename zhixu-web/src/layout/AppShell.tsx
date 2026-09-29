import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { BrandMark } from '../components/art';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/Badge';
import { cx } from '../lib/cx';
import { formatLongDate, todayISO, weekdayZh } from '../domain/dates';
import { aggregateStatus } from '../domain/tree';
import { useAuth } from '../app/AuthContext';
import { useTopics } from '../app/TopicsContext';
import { USE_MOCK } from '../api';
import u from '../styles/ui.module.css';
import s from './AppShell.module.css';
import search from './SearchModal.module.css';

function Brand() {
  return (
    <Link to="/dashboard" className={s.brand} aria-label="知序 Pathly 工作台">
      <BrandMark className={s.brandMark} />
      <div>
        <div className={s.brandName}>
          知序<span>Pathly</span>
        </div>
        <div className={s.brandSlogan}>让学习有迹可循</div>
      </div>
    </Link>
  );
}

function SearchModal({ onClose }: { onClose: () => void }) {
  const [value, setValue] = useState('');
  const { summaries, details, loadDetail } = useTopics();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const missing = summaries.filter((t) => !details[t.id]);
      for (const topic of missing) {
        if (cancelled) return;
        await loadDetail(topic.id);
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matches = useMemo(() => {
    if (!ready) return [];
    const entries: { nodeId: number; title: string; topicTitle: string; status: ReturnType<typeof aggregateStatus> }[] = [];
    for (const summary of summaries) {
      const detail = details[summary.id];
      if (!detail) continue;
      for (const node of detail.nodes) {
        entries.push({
          nodeId: node.id,
          title: node.title,
          topicTitle: detail.topic.title,
          status: aggregateStatus(detail.nodes, node),
        });
      }
    }
    const keyword = value.trim().toLowerCase();
    const filtered = keyword
      ? entries.filter((e) => `${e.title}${e.topicTitle}`.toLowerCase().includes(keyword))
      : entries;
    return filtered.slice(0, 7);
  }, [ready, value, summaries, details]);

  return (
    <Modal title="搜索学习节点" subtitle="找到想回顾的知识，再向前一步。" icon="search" onRequestClose={onClose}>
      <div>
        <label htmlFor="node-search" className={cx('small', 'muted')}>
          节点名称或主题名称
        </label>
        <input
          id="node-search"
          className={cx(u.searchInput, search.input)}
          placeholder="搜索，例如：面向对象、集合、英语"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoFocus
        />
        <div className={search.results}>
          {matches.length ? (
            matches.map((match) => (
              <button
                key={match.nodeId}
                type="button"
                className={search.result}
                onClick={() => {
                  onClose();
                  navigate(`/node/${match.nodeId}`);
                }}
              >
                <span>
                  {match.title}
                  <span className={cx('small', search.topicTitle)}>{match.topicTitle}</span>
                </span>
                <StatusBadge status={match.status} />
              </button>
            ))
          ) : (
            <p className={search.empty}>{ready ? '没有找到相关节点，试试更简短的关键词。' : '正在整理你的学习主题……'}</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

function breadcrumbFor(pathname: string, topicTitle?: string): string {
  if (pathname.startsWith('/roadmap') || pathname.startsWith('/node')) return topicTitle ?? '学习路线';
  if (pathname.startsWith('/stats')) return '学习统计';
  if (pathname.startsWith('/create')) return '创建学习主题';
  return '工作台';
}

export function AppShell() {
  const { user, logout } = useAuth();
  const { summaries, activeTopicId, activeDetail } = useTopics();
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const today = todayISO();
  const section = breadcrumbFor(location.pathname, activeDetail?.topic.title ?? summaries.find((t) => t.id === activeTopicId)?.title);
  const name = user?.name ?? '同学';

  return (
    <>
      <a href="#main" className="skip-link">
        跳转到主要内容
      </a>
      <aside className={s.sidebar}>
        <Brand />
        <nav className={s.navMain} aria-label="主导航">
          <NavLink to="/dashboard" className={({ isActive }) => cx(s.navItem, isActive && s.active)}>
            <Icon name="grid" />
            <span>工作台</span>
            <b className={s.navCount}>{summaries.length}</b>
          </NavLink>
          <NavLink to="/stats" className={({ isActive }) => cx(s.navItem, isActive && s.active)}>
            <Icon name="chart" />
            <span>学习统计</span>
          </NavLink>
          <div className={cx(s.navLabel, 'between')}>
            我的学习主题
            <Link to="/create" aria-label="创建学习主题" className={u.iconButton} style={{ height: 18, minWidth: 18 }}>
              <Icon name="plus" cls="sm" />
            </Link>
          </div>
          {summaries.map((topic) => (
            <button
              key={topic.id}
              type="button"
              className={cx(s.navItem, s.topicNav, location.pathname.startsWith('/roadmap') && topic.id === activeTopicId && s.active)}
              style={{ width: '100%' }}
              onClick={() => navigate(`/roadmap?topic=${topic.id}`)}
            >
              <i className={cx(s.topicDot, topic.color)} />
              <span>{topic.title.replace('学习路线', '').replace('提升计划', '提升')}</span>
            </button>
          ))}
          <button
            type="button"
            className={s.navItem}
            style={{ width: '100%', fontSize: 12 }}
            onClick={() => navigate('/create')}
          >
            <Icon name="plus" cls="sm" />
            <span>创建新主题</span>
          </button>
        </nav>
        <div className={s.sidebarTip}>
          <h4 className="flex gap8">
            <Icon name="leaf" cls="sm" />
            慢慢来，比较快
          </h4>
          <p>
            不必一次学完所有知识，
            <br />
            今天掌握一个节点就很好。
          </p>
        </div>
        <div className={s.userPanel}>
          <div className={u.avatar}>{name.slice(-2)}</div>
          <div>
            <strong>{name}</strong>
            <small>终身学习者</small>
          </div>
          <button
            type="button"
            className={u.iconButton}
            aria-label="返回登录页"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            <Icon name="logout" cls="sm" />
          </button>
        </div>
      </aside>
      <div className={s.workspace}>
        <header className={s.topbar}>
          <div className={s.breadcrumb}>
            <span>我的空间</span>
            <Icon name="chevron" />
            <span className={s.current}>{section}</span>
          </div>
          <div className={s.topbarTools}>
            <span className={s.topbarDate}>
              {formatLongDate(today)} · 星期{weekdayZh(today)}
            </span>
            <button
              type="button"
              className={u.iconButton}
              aria-label="搜索学习节点"
              onClick={() => setSearchOpen(true)}
            >
              <Icon name="search" />
            </button>
            <div className={u.avatar}>{name.slice(-2)}</div>
          </div>
        </header>
        <main className={s.main} id="main" tabIndex={-1}>
          <Outlet />
          <footer className={s.pageFooter}>
            <span>
              <Icon name="leaf" />
              每一小步，都在靠近更好的自己。
            </span>
            <span>知序 Pathly · 学以致知，行而有序{USE_MOCK ? ' · 演示模式' : ''}</span>
          </footer>
        </main>
      </div>
      {searchOpen ? <SearchModal onClose={() => setSearchOpen(false)} /> : null}
    </>
  );
}

export function PageHeading({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className={s.pageHeading}>
      <div>{children}</div>
      {actions}
    </div>
  );
}
